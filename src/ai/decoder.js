export const CONFIDENCE_THRESHOLD = 0.25;
export const NMS_THRESHOLD = 0.45;

/**
 * Decodes ONNX tensor output based on model architecture
 */
export function decodeModelOutput(outputTensor, modelInfo, metadata, options = {}) {
  if (!outputTensor || !outputTensor.data || !outputTensor.dims) {
    console.warn('[MargDrishti AI] Decoder received empty or invalid output tensor');
    return [];
  }

  const confThreshold = options.confThreshold ?? CONFIDENCE_THRESHOLD;
  const nmsThreshold = options.nmsThreshold ?? NMS_THRESHOLD;

  if (modelInfo.type === 'end2end') {
    return decodeEnd2EndOutput(outputTensor, modelInfo, metadata, confThreshold);
  } else if (modelInfo.type === 'yolo_multiclass') {
    return decodeYoloMulticlassOutput(outputTensor, modelInfo, metadata, confThreshold, nmsThreshold);
  } else if (modelInfo.type === 'yolo_coco') {
    return decodeYoloCocoOutput(outputTensor, modelInfo, metadata, confThreshold, nmsThreshold);
  } else {
    // General fallback
    return decodeYoloMulticlassOutput(outputTensor, modelInfo, metadata, confThreshold, nmsThreshold);
  }
}

/**
 * Decodes End2End format: Shape [1, 300, 6] -> [x1, y1, x2, y2, score, class_id]
 */
function decodeEnd2EndOutput(outputTensor, modelInfo, metadata, confThreshold) {
  const { data, dims } = outputTensor; // dims: [1, 300, 6]
  const numDetections = dims[1]; // 300
  const numFeatures = dims[2];   // 6

  const detections = [];
  const { origW, origH, scale, padX, padY } = metadata;

  for (let i = 0; i < numDetections; i++) {
    const offset = i * numFeatures;
    const x1Raw = data[offset];
    const y1Raw = data[offset + 1];
    const x2Raw = data[offset + 2];
    const y2Raw = data[offset + 3];
    const score = data[offset + 4];
    const classId = Math.round(data[offset + 5]);

    if (score < confThreshold) continue;

    // Inverse letterbox mapping to original image coordinates
    const x1 = (x1Raw - padX) / scale;
    const y1 = (y1Raw - padY) / scale;
    const x2 = (x2Raw - padX) / scale;
    const y2 = (y2Raw - padY) / scale;

    // Clamp coordinates to image boundaries
    const clampedX1 = Math.max(0, Math.min(origW, x1));
    const clampedY1 = Math.max(0, Math.min(origH, y1));
    const clampedX2 = Math.max(0, Math.min(origW, x2));
    const clampedY2 = Math.max(0, Math.min(origH, y2));

    const width = Math.max(1, clampedX2 - clampedX1);
    const height = Math.max(1, clampedY2 - clampedY1);

    const className = modelInfo.classes[classId] || 'Pothole';

    detections.push({
      id: `det_${modelInfo.id}_${i}_${Math.round(score * 1000)}`,
      type: className,
      hazardClass: normalizeHazardClass(className),
      confidence: score,
      confidencePct: Math.round(score * 100),
      bbox: {
        x: Math.round(clampedX1),
        y: Math.round(clampedY1),
        width: Math.round(width),
        height: Math.round(height)
      },
      bboxNormalized: {
        x: clampedX1 / origW,
        y: clampedY1 / origH,
        width: width / origW,
        height: height / origH
      },
      modelSource: modelInfo.id
    });
  }

  return detections.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Decodes standard YOLO/RDD tensor: Shape [1, C+4, 8400]
 */
function decodeYoloMulticlassOutput(outputTensor, modelInfo, metadata, confThreshold, nmsThreshold) {
  const { data, dims } = outputTensor; // dims: [1, num_channels, 8400]
  const numChannels = dims[1]; // e.g. 10 (4 coords + 6 classes)
  const numAnchors = dims[2];  // 8400
  const numClasses = numChannels - 4;

  const candidates = [];
  const { origW, origH, scale, padX, padY } = metadata;

  for (let i = 0; i < numAnchors; i++) {
    // Find highest class score among classes
    let maxScore = 0;
    let bestClassId = 0;

    for (let c = 0; c < numClasses; c++) {
      const classScore = data[(4 + c) * numAnchors + i];
      if (classScore > maxScore) {
        maxScore = classScore;
        bestClassId = c;
      }
    }

    if (maxScore < confThreshold) continue;

    const rawClassName = modelInfo.classes[bestClassId] || `Damage_${bestClassId}`;
    const hClass = normalizeHazardClass(rawClassName);

    // Suppress non-hazard road marking blurs
    if (hClass === 'marking_blur') {
      continue;
    }

    // Bounding box center and dimensions in 640x640 space
    const cx = data[0 * numAnchors + i];
    const cy = data[1 * numAnchors + i];
    const w = data[2 * numAnchors + i];
    const h = data[3 * numAnchors + i];

    // Convert from cx, cy, w, h to top-left and bottom-right
    const x1Letterbox = cx - w / 2;
    const y1Letterbox = cy - h / 2;
    const x2Letterbox = cx + w / 2;
    const y2Letterbox = cy + h / 2;

    // Inverse letterbox mapping to original image coordinates
    const x1 = (x1Letterbox - padX) / scale;
    const y1 = (y1Letterbox - padY) / scale;
    const x2 = (x2Letterbox - padX) / scale;
    const y2 = (y2Letterbox - padY) / scale;

    const clampedX1 = Math.max(0, Math.min(origW, x1));
    const clampedY1 = Math.max(0, Math.min(origH, y1));
    const clampedX2 = Math.max(0, Math.min(origW, x2));
    const clampedY2 = Math.max(0, Math.min(origH, y2));

    const width = Math.max(1, clampedX2 - clampedX1);
    const height = Math.max(1, clampedY2 - clampedY1);

    candidates.push({
      type: rawClassName,
      hazardClass: hClass,
      confidence: maxScore,
      confidencePct: Math.round(maxScore * 100),
      bbox: {
        x: Math.round(clampedX1),
        y: Math.round(clampedY1),
        width: Math.round(width),
        height: Math.round(height)
      },
      bboxNormalized: {
        x: clampedX1 / origW,
        y: clampedY1 / origH,
        width: width / origW,
        height: height / origH
      },
      classId: bestClassId,
      modelSource: modelInfo.id
    });
  }

  // Apply Non-Maximum Suppression (NMS)
  return applyNMS(candidates, nmsThreshold);
}

/**
 * Decodes YOLO COCO for Road Obstacles & Debris
 * Filters out ordinary traffic participants (cars, trucks, buses, motorcycles, bicycles, persons),
 * normal road infrastructure (traffic lights, stop signs), and tiny household items (which trigger on lane stripes).
 * Preserves genuine road hazards: dropped luggage/cargo, bulky road debris, and wandering animals on the road.
 */
function decodeYoloCocoOutput(outputTensor, modelInfo, metadata, confThreshold, nmsThreshold) {
  const allDetections = decodeYoloMulticlassOutput(outputTensor, modelInfo, metadata, confThreshold, nmsThreshold);
  
  // Genuine foreign road debris, dropped cargo/luggage/furniture, and stray/wandering animals on roadway
  const supportedObstacleClasses = new Set([
    // Bulky Dropped Cargo, Luggage & Large Debris
    'backpack', 'suitcase', 'handbag', 'chair', 'couch', 'bench',
    'sports ball', 'skateboard', 'surfboard', 'umbrella',
    // Stray & Wandering Animals on Road
    'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe'
  ]);

  const filtered = [];

  for (const d of allDetections) {
    const rawType = d.type.toLowerCase();
    const formattedName = rawType.charAt(0).toUpperCase() + rawType.slice(1);

    if (supportedObstacleClasses.has(rawType)) {
      const relAreaPct = (d.bboxNormalized.width * d.bboxNormalized.height) * 100;
      
      // Filter out sub-pixel noise; genuine obstacles on a road have measurable footprint
      if (d.confidence >= 0.30 && relAreaPct >= 0.3) {
        filtered.push({
          ...d,
          type: `Road Obstacle (${formattedName})`,
          hazardClass: 'obstacle',
          cocoClass: rawType
        });
      }
    }
  }

  return filtered;
}

/**
 * Non-Maximum Suppression (NMS) & Multi-Model Fusion
 * Suppresses boxes with IoU > iouThreshold within same class, or cross-model duplicate boxes (> 0.70 IoU)
 * Preserves specific RDD crack classification over weak generic pothole detections
 */
export function applyNMS(boxes, iouThreshold = 0.45) {
  if (boxes.length <= 1) return boxes;

  // Multi-model damage ranking:
  // Ensure crack detections from RDD multi-damage model are not overshadowed by weak generic pothole activations
  const scoredBoxes = boxes.map(b => {
    let effectiveRank = b.confidence;
    const isCrack = b.hazardClass.includes('crack');
    if (isCrack && (b.modelSource === 'rdd' || b.modelSource === 'rddGlobal')) {
      effectiveRank = Math.max(effectiveRank, b.confidence + 0.05);
    }
    return { ...b, _rank: effectiveRank };
  });

  const sorted = scoredBoxes.sort((a, b) => b._rank - a._rank);
  const selected = [];
  const active = new Array(sorted.length).fill(true);

  for (let i = 0; i < sorted.length; i++) {
    if (!active[i]) continue;

    const current = sorted[i];
    selected.push({
      ...current,
      id: current.id || `det_${selected.length}_${Math.round(current.confidence * 1000)}`
    });

    for (let j = i + 1; j < sorted.length; j++) {
      if (!active[j]) continue;

      const other = sorted[j];
      const iou = calculateIoU(current.bbox, other.bbox);
      const isSameClass = current.hazardClass === other.hazardClass;

      // Suppress duplicate detections:
      // 1. Same hazard class with IoU > iouThreshold
      // 2. Overlapping bounding box (> 0.40 IoU) between weak pothole (< 0.50) and crack: suppress weaker generic candidate
      // 3. Different classes with near-identical bounding box (> 0.70 IoU)
      const isWeakPotholeCrackOverlap = (
        iou > 0.40 &&
        ((current.hazardClass.includes('crack') && other.hazardClass === 'pothole' && other.confidence < 0.50) ||
         (other.hazardClass.includes('crack') && current.hazardClass === 'pothole' && current.confidence < 0.50))
      );

      if ((isSameClass && iou > iouThreshold) || isWeakPotholeCrackOverlap || (!isSameClass && iou > 0.70)) {
        active[j] = false;
      }
    }
  }

  return selected.map(({ _rank, ...rest }) => rest);
}

/**
 * Calculate Intersection over Union (IoU) between two bounding boxes {x, y, width, height}
 */
export function calculateIoU(boxA, boxB) {
  const xA = Math.max(boxA.x, boxB.x);
  const yA = Math.max(boxA.y, boxB.y);
  const xB = Math.min(boxA.x + boxA.width, boxB.x + boxB.width);
  const yB = Math.min(boxA.y + boxA.height, boxB.y + boxB.height);

  const interWidth = Math.max(0, xB - xA);
  const interHeight = Math.max(0, yB - yA);
  const interArea = interWidth * interHeight;

  const boxAArea = boxA.width * boxA.height;
  const boxBArea = boxB.width * boxB.height;
  const unionArea = boxAArea + boxBArea - interArea;

  if (unionArea <= 0) return 0;
  return interArea / unionArea;
}

/**
 * Standardize hazard class keys
 */
export function normalizeHazardClass(className) {
  if (!className) return 'hazard';
  const lower = className.toLowerCase();
  if (lower.includes('pothole')) return 'pothole';
  if (lower.includes('alligator')) return 'alligator_crack';
  if (lower.includes('longitudinal')) return 'longitudinal_crack';
  if (lower.includes('transverse') || lower.includes('equal interval')) return 'transverse_crack';
  if (lower.includes('crack')) return 'crack';
  if (lower.includes('corruption') || lower.includes('degradation')) return 'hazard';
  if (lower.includes('obstacle') || lower.includes('debris')) return 'obstacle';
  if (lower.includes('blur')) return 'marking_blur';
  return 'hazard';
}
