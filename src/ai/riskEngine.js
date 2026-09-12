/**
 * MargDrishti AI Calibrated Explainable Risk Engine
 *
 * Deterministic 0–100 Road Safety Severity Calculation:
 *
 * A) BASE DEFECT RISK:
 *    - Pothole: 35
 *    - Alligator crack: 25
 *    - Longitudinal crack: 20
 *    - Transverse / Equal-interval crack: 20
 *    - Other supported road defect / Obstacle: 20
 *
 * B) CONFIDENCE CONTRIBUTION:
 *    - < 40%   -> +0
 *    - 40–60%  -> +5
 *    - 60–75%  -> +10
 *    - 75–90%  -> +15
 *    - > 90%   -> +18
 *
 * C) SIZE / FOOTPRINT CONTRIBUTION (bbox area / image area):
 *    - < 2%    -> +0
 *    - 2–5%    -> +5
 *    - 5–10%   -> +10
 *    - 10–20%  -> +15
 *    - 20–35%  -> +20
 *    - > 35%   -> +22
 *
 * D) ROAD-PATH / POSITION CONTRIBUTION:
 *    - Clearly outside likely travel path: +0
 *    - Partially overlaps travel path / mid-road: +5
 *    - Centered in likely travel path: +10
 *    - Very close foreground + centered in path: +15
 *
 * E) SEVERITY THRESHOLDS:
 *    - 0–24   = SAFE
 *    - 25–39  = LOW
 *    - 40–59  = MEDIUM
 *    - 60–79  = HIGH
 *    - 80–100 = CRITICAL
 */

// A) Base Defect Risk Constants
const BASE_DEFECT_RISK = {
  pothole: 35,
  alligator_crack: 25,
  transverse_crack: 20,
  longitudinal_crack: 20,
  crack: 20,
  obstacle: 20,
  marking_blur: 10,
  hazard: 20
};

/**
 * Calculates deterministic risk for an individual detection
 */
export function calculateHazardRisk(detection) {
  const { hazardClass, confidence, bboxNormalized } = detection;

  // A) Base Defect Risk (Max 35 pts)
  const basePts = BASE_DEFECT_RISK[hazardClass] || 20;

  // B) Confidence Contribution (Max 18 pts)
  // Confidence confirms detection certainty; it does not by itself represent danger
  const confPct = Math.round(confidence * 100);
  let confPts = 0;
  if (confPct > 90) {
    confPts = 18;
  } else if (confPct >= 75) {
    confPts = 15;
  } else if (confPct >= 60) {
    confPts = 10;
  } else if (confPct >= 40) {
    confPts = 5;
  } else {
    confPts = 0;
  }

  // C) Size / Footprint Contribution (Max 22 pts)
  const relArea = (bboxNormalized.width * bboxNormalized.height);
  const relAreaPct = relArea * 100;
  let footprintPts = 0;
  let footprintDesc = 'Small affected road area';

  if (relAreaPct > 35) {
    footprintPts = 22;
    footprintDesc = 'Extensive affected road area';
  } else if (relAreaPct >= 20) {
    footprintPts = 20;
    footprintDesc = 'Large affected road area';
  } else if (relAreaPct >= 10) {
    footprintPts = 15;
    footprintDesc = 'Moderate-to-large affected road area';
  } else if (relAreaPct >= 5) {
    footprintPts = 10;
    footprintDesc = 'Moderate affected road area';
  } else if (relAreaPct >= 2) {
    footprintPts = 5;
    footprintDesc = 'Minor affected road area';
  } else {
    footprintPts = 0;
    footprintDesc = 'Small affected road area';
  }

  // D) Road-Path / Position Contribution (Max 15 pts)
  const bottomY = bboxNormalized.y + bboxNormalized.height;
  const centerX = bboxNormalized.x + bboxNormalized.width / 2;
  const laneCenterDeviation = Math.abs(centerX - 0.5);

  let pathPts = 0;
  let pathDesc = 'Distant / outside primary vehicle trajectory';

  if (bottomY >= 0.85 && laneCenterDeviation <= 0.20) {
    // Very close foreground + centered in path
    pathPts = 15;
    pathDesc = 'High proximity / immediate impact zone directly in vehicle path';
  } else if (bottomY >= 0.65 && laneCenterDeviation <= 0.25) {
    // Centered in likely travel path
    pathPts = 10;
    pathDesc = 'Defect overlaps likely vehicle path';
  } else if (bottomY >= 0.40 && laneCenterDeviation <= 0.35) {
    // Partially overlaps travel path / mid-road
    pathPts = 5;
    pathDesc = 'Mid-road / partially overlaps travel path';
  } else {
    // Clearly outside likely travel path or high on horizon
    pathPts = 0;
    pathDesc = 'Distant / outside primary vehicle trajectory';
  }

  // Raw Total Score (0 - 100)
  let rawScore = basePts + confPts + footprintPts + pathPts;

  // HARD SAFETY RULES:
  // Rule 1: A crack with confidence below 70% MUST NOT be Critical (cap at max 59 Medium)
  const isCrack = hazardClass.includes('crack');
  if (isCrack && confPct < 70) {
    rawScore = Math.min(rawScore, 59); // Capped at MEDIUM
  }

  // Rule 2: Alligator crack MUST NOT be Critical unless exceptionally strong evidence:
  // confidence >= 85% AND footprint >= 10% AND vehicle-path alignment AND foreground proximity (bottomY >= 0.70)
  if (hazardClass === 'alligator_crack') {
    const isExceptionallyStrong = (confPct >= 85) && (relAreaPct >= 10) && (laneCenterDeviation <= 0.25) && (bottomY >= 0.70);
    if (!isExceptionallyStrong) {
      rawScore = Math.min(rawScore, 74); // Capped at HIGH maximum
    }
  }

  // Rule 3: Any detection with confidence below 50% MUST NOT be High or Critical (cap at max 55 Medium)
  if (confPct < 50) {
    rawScore = Math.min(rawScore, 55); // Capped at MEDIUM
  }

  // Rule 4: Very weak detection below 35% confidence is capped at LOW (max 35)
  if (confPct < 35) {
    rawScore = Math.min(rawScore, 35); // Capped at LOW
  }

  // Clamp to valid 0–100 range
  const numericScore = Math.min(100, Math.max(0, Math.round(rawScore)));

  // Severity Thresholds:
  // 0–24   = SAFE
  // 25–39  = LOW
  // 40–59  = MEDIUM
  // 60–79  = HIGH
  // 80–100 = CRITICAL
  let level = 'LOW';
  let color = 'emerald';
  let badgeClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';

  if (numericScore >= 80) {
    level = 'CRITICAL';
    color = 'red';
    badgeClass = 'bg-red-500/20 text-red-400 border-red-500/30';
  } else if (numericScore >= 60) {
    level = 'HIGH';
    color = 'orange';
    badgeClass = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  } else if (numericScore >= 40) {
    level = 'MEDIUM';
    color = 'yellow';
    badgeClass = 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  } else if (numericScore >= 25) {
    level = 'LOW';
    color = 'emerald';
    badgeClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  } else {
    level = 'SAFE';
    color = 'emerald';
    badgeClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  }

  // Explainable Contributing Factors (Explaining severity independently from confidence)
  const factors = [];
  factors.push(`${detection.type} detected (Base hazard rating: ${basePts} pts)`);

  if (confPct >= 90) {
    factors.push(`High model confidence (${confPct}%) confirms the detected defect.`);
  } else if (confPct >= 60) {
    factors.push(`Model confidence (${confPct}%) confirms defect detection.`);
  } else {
    factors.push(`Moderate model confidence (${confPct}%).`);
  }

  if (footprintPts > 0) {
    factors.push(`${footprintDesc} (${relAreaPct.toFixed(1)}% of frame: +${footprintPts} pts).`);
  } else {
    factors.push(`Small physical footprint (${relAreaPct.toFixed(1)}% of frame: +0 pts).`);
  }

  if (pathPts > 0) {
    factors.push(`${pathDesc} (+${pathPts} pts).`);
  } else {
    factors.push(`${pathDesc} (+0 pts).`);
  }

  return {
    riskScore: numericScore,
    level,
    color,
    badgeClass,
    factors,
    breakdown: {
      basePoints: basePts,
      confidencePoints: confPts,
      footprintPoints: footprintPts,
      roadPathPoints: pathPts
    },
    areaPct: relAreaPct.toFixed(1)
  };
}

/**
 * Calculates aggregate road risk for the entire scene
 */
export function calculateSceneRisk(detections) {
  if (!detections || detections.length === 0) {
    return {
      overallRisk: 'NO SUPPORTED HAZARD DETECTED',
      riskScore: 0,
      badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
      summary: 'Inference completed successfully. No supported road hazards detected above configured confidence threshold.',
      priorityHazard: null,
      maxSeverity: 'UNCONFIRMED',
      evaluatedDetections: []
    };
  }

  // Calculate risk for each detection
  const evaluatedDetections = detections.map(d => ({
    ...d,
    risk: calculateHazardRisk(d)
  }));

  // Find maximum risk detection (priority hazard)
  let maxScore = 0;
  let priorityHazard = evaluatedDetections[0];

  evaluatedDetections.forEach(d => {
    if (d.risk.riskScore > maxScore) {
      maxScore = d.risk.riskScore;
      priorityHazard = d;
    }
  });

  // Multiple Detections Bounded Aggregation (E: 1 -> +0, 2 -> +3, 3+ -> +5 maximum)
  const numHazards = evaluatedDetections.length;
  let multiHazardBonus = 0;
  if (numHazards >= 3) {
    multiHazardBonus = 5;
  } else if (numHazards === 2) {
    multiHazardBonus = 3;
  }

  // Apply bonus only if there are genuine multiple hazards
  let sceneScore = maxScore + multiHazardBonus;
  if (priorityHazard && priorityHazard.confidencePct < 50) {
    sceneScore = Math.min(sceneScore, 59);
  }
  const finalSceneScore = Math.min(100, Math.max(0, sceneScore));

  // Overall Severity Thresholds:
  // 0–24   = SAFE
  // 25–39  = LOW
  // 40–59  = MEDIUM
  // 60–79  = HIGH
  // 80–100 = CRITICAL
  let overallRisk = 'LOW';
  let badgeClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';

  if (finalSceneScore >= 80) {
    overallRisk = 'CRITICAL';
    badgeClass = 'bg-red-500/20 text-red-400 border-red-500/30';
  } else if (finalSceneScore >= 60) {
    overallRisk = 'HIGH';
    badgeClass = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  } else if (finalSceneScore >= 40) {
    overallRisk = 'MEDIUM';
    badgeClass = 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  } else if (finalSceneScore >= 25) {
    overallRisk = 'LOW';
    badgeClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  } else {
    overallRisk = 'SAFE';
    badgeClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  }

  return {
    overallRisk,
    riskScore: finalSceneScore,
    badgeClass,
    evaluatedDetections,
    priorityHazard,
    hazardCount: evaluatedDetections.length,
    summary: `${overallRisk} RISK: ${evaluatedDetections.length} hazard(s) detected. Primary concern: ${priorityHazard.type} (${priorityHazard.risk.riskScore}/100 score). Model confidence (${priorityHazard.confidencePct}%) confirms detection, while severity represents estimated road safety impact.`
  };
}
