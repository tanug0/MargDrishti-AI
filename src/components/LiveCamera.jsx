import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Camera, 
  CameraOff, 
  RefreshCw, 
  Scan, 
  MapPin, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  Check, 
  Play, 
  Square,
  Crosshair,
  Volume2,
  VolumeX,
  Radio,
  Activity,
  Zap,
  HelpCircle,
  XCircle,
  Eye,
  Sliders,
  Info
} from 'lucide-react';
import { detectRoadHazards } from '../ai/detectionService';
import { calculateSceneRisk } from '../ai/riskEngine';
import { getCurrentGPSPosition } from '../services/geoService';
import { storageService } from '../services/storageService';

export default function LiveCamera({ onHazardSaved }) {
  // Camera & Stream State
  const [isStreaming, setIsStreaming] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [videoDimensions, setVideoDimensions] = useState({ width: 1280, height: 720 });

  // Periodic Inference State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [latestResult, setLatestResult] = useState(null);
  const [inferenceStats, setInferenceStats] = useState({
    totalFramesAnalyzed: 0,
    lastInferenceMs: 0,
    hazardsDetectedInSession: 0
  });

  // Voice Alerts
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  // GPS & Save State
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [gpsStatus, setGpsStatus] = useState(null);

  // Selected Hazard for manual focus
  const [lastCapturedDataUrl, setLastCapturedDataUrl] = useState(null);

  // Refs for loop control, temporal confirmation, and cleanup
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const loopTimeoutRef = useRef(null);
  const isInferencingRef = useRef(false);
  const isStreamingRef = useRef(false);
  const lastSpokenRef = useRef({ key: '', time: 0 });
  const temporalTrackerRef = useRef({
    consecutiveCount: 0,
    lastHazardClass: null,
    lastConfirmedHazard: null
  });

  // Keep streaming ref synchronized
  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  /**
   * Voice Warning Alert with Cooldown
   */
  const triggerVoiceWarning = useCallback((hazardType, riskLevel) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;

    const now = Date.now();
    const alertKey = `${hazardType}_${riskLevel}`;
    // Cooldown: 7 seconds for identical hazard, 2.5 seconds for new hazard
    const minInterval = (lastSpokenRef.current.key === alertKey) ? 7000 : 2500;

    if (now - lastSpokenRef.current.time < minInterval) {
      return;
    }

    lastSpokenRef.current = { key: alertKey, time: now };

    try {
      window.speechSynthesis.cancel();
      const text = `Caution. ${hazardType} detected ahead. ${riskLevel} risk.`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.volume = 0.9;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis note:', e);
    }
  }, [voiceEnabled]);

  /**
   * Starts the camera and initiates the periodic inference loop
   */
  const startCamera = async () => {
    setCameraError(null);
    setLatestResult(null);
    setSaveSuccess(false);
    temporalTrackerRef.current = {
      consecutiveCount: 0,
      lastHazardClass: null,
      lastConfirmedHazard: null
    };

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Your browser does not support camera access via getUserMedia.');
      return;
    }

    try {
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' }, // Prefer rear road camera on phones/tablets
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const track = stream.getVideoTracks()[0];
        const settings = track ? track.getSettings() : {};
        const w = settings.width || videoRef.current.videoWidth || 1280;
        const h = settings.height || videoRef.current.videoHeight || 720;
        setVideoDimensions({ width: w, height: h });

        setIsStreaming(true);
        isStreamingRef.current = true;

        // Start controlled periodic inference loop (target ~1.5s intervals)
        scheduleNextInference(600); // Initial fast start
      }
    } catch (err) {
      console.error('Live camera access error:', err);
      let msg = 'Camera is unavailable.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera permission denied. Please enable camera access in browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No camera device was found on this system.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = 'Camera hardware is currently in use by another application.';
      }
      setCameraError(msg);
      setIsStreaming(false);
      isStreamingRef.current = false;
    }
  };

  /**
   * Stops camera stream and clears timers
   */
  const stopCamera = () => {
    if (loopTimeoutRef.current) {
      clearTimeout(loopTimeoutRef.current);
      loopTimeoutRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {}
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (overlayCanvasRef.current) {
      const ctx = overlayCanvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    temporalTrackerRef.current = {
      consecutiveCount: 0,
      lastHazardClass: null,
      lastConfirmedHazard: null
    };

    setIsStreaming(false);
    isStreamingRef.current = false;
    isInferencingRef.current = false;
    setIsAnalyzing(false);
    setLatestResult(null);
  };

  /**
   * Periodic Inference Cycle (~1.5s)
   */
  const scheduleNextInference = (delayMs = 1500) => {
    if (loopTimeoutRef.current) {
      clearTimeout(loopTimeoutRef.current);
    }

    loopTimeoutRef.current = setTimeout(async () => {
      if (!isStreamingRef.current || !videoRef.current) {
        return;
      }

      await executeFrameInference();

      // Continue monitoring if still streaming
      if (isStreamingRef.current) {
        scheduleNextInference(1500);
      }
    }, delayMs);
  };

  /**
   * Captures current frame and passes to real detectRoadHazards()
   */
  const executeFrameInference = async () => {
    // Prevent overlapping inference: if previous inference is still active, skip this cycle
    if (isInferencingRef.current || !videoRef.current) {
      return;
    }

    const video = videoRef.current;
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    const w = video.videoWidth;
    const h = video.videoHeight;

    // Downscale huge video frames to max 1280 width to prevent excessive memory copies
    const maxDim = 1280;
    const scale = Math.min(1.0, maxDim / Math.max(w, h));
    const targetW = Math.round(w * scale);
    const targetH = Math.round(h * scale);

    // Create offscreen canvas for snapshot
    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = targetW;
    snapCanvas.height = targetH;
    const snapCtx = snapCanvas.getContext('2d', { willReadFrequently: true });
    snapCtx.drawImage(video, 0, 0, targetW, targetH);

    isInferencingRef.current = true;
    setIsAnalyzing(true);

    try {
      // Execute REAL ONNX inference through detectionService
      const res = await detectRoadHazards(snapCanvas, {
        model: 'unified',
        confThreshold: 0.25,
        nmsThreshold: 0.45
      });

      if (!isStreamingRef.current) return; // Discard if user stopped camera during inference

      // --- LIVE CAMERA RELIABILITY & TEMPORAL STABILITY FILTER ---
      // 1. Filter out sub-pixel camera flutter, noise specs, and weak detections
      const validDetections = (res.detections || []).filter(det => {
        const areaPct = (det.bboxNormalized.width * det.bboxNormalized.height) * 100;
        const hClass = (det.hazardClass || '').toLowerCase();

        // Reject tiny camera flutter / speckle noise with low confidence
        if (areaPct < 0.30 && det.confidence < 0.55) {
          return false;
        }

        // Specific live camera confidence gates
        if (hClass === 'pothole') {
          return det.confidence >= 0.32;
        } else if (hClass.includes('crack') || hClass === 'obstacle') {
          return det.confidence >= 0.35;
        }
        return det.confidence >= 0.30;
      });

      let finalStatus = 'CLEAR';
      let finalSceneRisk = null;
      let finalDetections = [];

      if (validDetections.length === 0) {
        // No valid live hazards in this frame: reset temporal tracker
        temporalTrackerRef.current = {
          consecutiveCount: 0,
          lastHazardClass: null,
          lastConfirmedHazard: null
        };
        finalStatus = 'CLEAR';
        finalSceneRisk = calculateSceneRisk([]);
        finalDetections = [];
      } else {
        const liveSceneRisk = calculateSceneRisk(validDetections);
        const priority = liveSceneRisk.priorityHazard || validDetections[0];
        const pAreaPct = (priority.bboxNormalized.width * priority.bboxNormalized.height) * 100;

        // High evidence condition: >= 70% confidence OR (>= 55% conf with significant footprint >= 1.2%)
        const isHighEvidence = (priority.confidence >= 0.70) || (priority.confidence >= 0.55 && pAreaPct >= 1.2);

        let isConfirmed = false;
        if (isHighEvidence) {
          // Immediately confirmed on high evidence
          temporalTrackerRef.current.consecutiveCount = Math.max(2, temporalTrackerRef.current.consecutiveCount + 1);
          temporalTrackerRef.current.lastHazardClass = priority.hazardClass;
          temporalTrackerRef.current.lastConfirmedHazard = priority;
          isConfirmed = true;
        } else {
          // Moderate evidence: requires >= 2 consecutive cycles of same hazard class
          if (temporalTrackerRef.current.lastHazardClass === priority.hazardClass) {
            temporalTrackerRef.current.consecutiveCount += 1;
          } else {
            temporalTrackerRef.current.lastHazardClass = priority.hazardClass;
            temporalTrackerRef.current.consecutiveCount = 1;
          }

          if (temporalTrackerRef.current.consecutiveCount >= 2) {
            isConfirmed = true;
            temporalTrackerRef.current.lastConfirmedHazard = priority;
          } else {
            isConfirmed = false;
          }
        }

        if (isConfirmed) {
          finalStatus = 'DETECTED';
          finalDetections = liveSceneRisk.evaluatedDetections || validDetections;
          finalSceneRisk = liveSceneRisk;

          // Trigger Voice Alert (cooldown handled inside function)
          triggerVoiceWarning(priority.type, priority.risk?.level || liveSceneRisk.overallRisk);

          // Cache snapshot for GPS tagging
          try {
            setLastCapturedDataUrl(snapCanvas.toDataURL('image/jpeg', 0.7));
          } catch (e) {}
        } else {
          // Unconfirmed single-frame moderate signal: monitor without alarm
          finalStatus = 'UNCERTAIN';
          finalDetections = [];
          finalSceneRisk = {
            ...liveSceneRisk,
            overallRisk: 'MONITORING',
            summary: `Signal detected for ${priority.type} (${priority.confidencePct}%); awaiting temporal confirmation.`
          };
        }
      }

      const frameResult = {
        status: finalStatus,
        detections: finalDetections,
        inferenceTime: res.inferenceTime || 0,
        sceneRisk: finalSceneRisk,
        imageMetadata: res.imageMetadata || { origW: targetW, origH: targetH },
        error: null
      };

      setLatestResult(frameResult);
      setInferenceStats(prev => ({
        totalFramesAnalyzed: prev.totalFramesAnalyzed + 1,
        lastInferenceMs: res.inferenceTime || 0,
        hazardsDetectedInSession: prev.hazardsDetectedInSession + (finalStatus === 'DETECTED' ? finalDetections.length : 0)
      }));

    } catch (err) {
      console.error('[MargDrishti AI Live] Frame analysis error:', err);
      setLatestResult({
        status: 'ERROR',
        detections: [],
        inferenceTime: 0,
        sceneRisk: null,
        error: err.message || 'Frame inference error.'
      });
    } finally {
      isInferencingRef.current = false;
      setIsAnalyzing(false);
    }
  };

  /**
   * Renders bounding boxes accurately onto the overlay canvas
   */
  const renderOverlayCanvas = (detections, frameW, frameH) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = frameW;
    canvas.height = frameH;
    ctx.clearRect(0, 0, frameW, frameH);

    if (!detections || detections.length === 0) {
      return;
    }

    detections.forEach(det => {
      const { bbox, type, confidencePct, risk } = det;
      const hClass = (det.hazardClass || '').toLowerCase();

      let strokeColor = '#ef4444'; // Red for potholes
      let fillColor = 'rgba(239, 68, 68, 0.22)';
      let labelBg = '#ef4444';

      if (hClass.includes('crack')) {
        strokeColor = '#f59e0b'; // Amber for cracks
        fillColor = 'rgba(245, 158, 11, 0.22)';
        labelBg = '#f59e0b';
      } else if (hClass === 'obstacle') {
        strokeColor = '#eab308';
        fillColor = 'rgba(234, 179, 8, 0.22)';
        labelBg = '#eab308';
      }

      // Draw glowing bounding box
      ctx.lineWidth = 4;
      ctx.strokeStyle = strokeColor;
      ctx.fillStyle = fillColor;

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(bbox.x, bbox.y, bbox.width, bbox.height, 6);
      } else {
        ctx.rect(bbox.x, bbox.y, bbox.width, bbox.height);
      }
      ctx.fill();
      ctx.stroke();

      // Corner accent markers
      const markerSize = Math.min(20, bbox.width / 4, bbox.height / 4);
      ctx.lineWidth = 5;
      ctx.strokeStyle = strokeColor;

      // Top-Left Corner
      ctx.beginPath();
      ctx.moveTo(bbox.x, bbox.y + markerSize);
      ctx.lineTo(bbox.x, bbox.y);
      ctx.lineTo(bbox.x + markerSize, bbox.y);
      ctx.stroke();

      // Bottom-Right Corner
      ctx.beginPath();
      ctx.moveTo(bbox.x + bbox.width - markerSize, bbox.y + bbox.height);
      ctx.lineTo(bbox.x + bbox.width, bbox.y + bbox.height);
      ctx.lineTo(bbox.x + bbox.width, bbox.y + bbox.height - markerSize);
      ctx.stroke();

      // Draw Label Badge
      const labelText = `⚠ ${type.toUpperCase()} ${confidencePct}% [${risk?.level || 'HIGH'}]`;
      ctx.font = 'bold 13px "JetBrains Mono", monospace';
      const textMetrics = ctx.measureText(labelText);
      const textWidth = textMetrics.width;
      const textHeight = 24;

      const labelY = bbox.y > textHeight + 6 ? bbox.y - textHeight - 4 : bbox.y + 4;

      ctx.fillStyle = labelBg;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(bbox.x, labelY, textWidth + 16, textHeight, 4);
      } else {
        ctx.rect(bbox.x, labelY, textWidth + 16, textHeight);
      }
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.fillText(labelText, bbox.x + 8, labelY + 16);
    });
  };

  // Synchronize overlay canvas with latestResult and videoDimensions
  useEffect(() => {
    if (!isStreaming || !latestResult || latestResult.status !== 'DETECTED' || !latestResult.detections?.length) {
      if (overlayCanvasRef.current) {
        const ctx = overlayCanvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
      }
      return;
    }

    const frameW = latestResult.imageMetadata?.origW || videoDimensions.width || 1280;
    const frameH = latestResult.imageMetadata?.origH || videoDimensions.height || 720;
    renderOverlayCanvas(latestResult.detections, frameW, frameH);
  }, [latestResult, isStreaming, videoDimensions]);

  /**
   * Save detected hazard with real GPS
   */
  const handleSaveLiveHazard = async () => {
    if (!latestResult || latestResult.status !== 'DETECTED' || latestResult.detections.length === 0) return;
    setIsSaving(true);
    setGpsStatus('Acquiring real GPS coordinates...');

    try {
      const gps = await getCurrentGPSPosition();
      let locationData = null;
      if (gps.available && gps.coords) {
        locationData = {
          latitude: gps.coords.latitude,
          longitude: gps.coords.longitude,
          accuracy: gps.coords.accuracyMeters
        };
        setGpsStatus(`GPS Logged: ${locationData.latitude}, ${locationData.longitude}`);
      } else {
        setGpsStatus(gps.error || 'Location unavailable');
      }

      const priority = latestResult.sceneRisk?.priorityHazard || latestResult.detections[0];

      const record = {
        hazardType: priority ? priority.type : 'Road Hazard',
        hazardClass: priority ? priority.hazardClass : 'pothole',
        confidence: priority ? priority.confidence : 0.85,
        confidencePct: priority ? priority.confidencePct : 85,
        severity: latestResult.sceneRisk?.overallRisk || 'HIGH',
        riskScore: latestResult.sceneRisk?.riskScore || 75,
        hazardCount: latestResult.detections.length,
        detections: latestResult.detections,
        bbox: priority?.bbox || null,
        location: locationData,
        thumbnail: lastCapturedDataUrl,
        modelUsed: 'MargDrishti Live Camera AI',
        inferenceTimeMs: latestResult.inferenceTime
      };

      storageService.saveHazard(record);
      setSaveSuccess(true);
      if (onHazardSaved) onHazardSaved(record);
    } catch (e) {
      alert('Error saving hazard: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 backdrop-blur-xl shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5 font-mono uppercase">
                <Camera className="w-6 h-6 text-brand-400" />
                LIVE ROAD MONITORING
              </h1>
              {isStreaming && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  LIVE ● AI MONITORING
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400 mt-1 font-sans">
              "AI-powered hazard detection in real time"
            </p>
          </div>

          {/* Action Buttons: Start/Stop, Voice Alert Toggle */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-mono transition-colors ${
                voiceEnabled
                  ? 'bg-brand-600/20 text-brand-300 border-brand-500/40'
                  : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
              }`}
              title="Toggle Voice Alerts"
            >
              {voiceEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-brand-400" />
                  <span>VOICE ALERTS ON</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-slate-500" />
                  <span>VOICE ALERTS OFF</span>
                </>
              )}
            </button>

            {!isStreaming ? (
              <button
                onClick={startCamera}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs uppercase tracking-wider font-mono transition-all shadow-lg shadow-brand-500/25 active:scale-95"
              >
                <Play className="w-4 h-4" />
                <span>START CAMERA</span>
              </button>
            ) : (
              <button
                onClick={stopCamera}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider font-mono transition-all shadow-lg shadow-rose-600/25 active:scale-95"
              >
                <Square className="w-4 h-4" />
                <span>STOP CAMERA</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {cameraError && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-sm flex items-center gap-3">
          <CameraOff className="w-5 h-5 flex-shrink-0 text-red-400" />
          <div className="space-y-0.5">
            <p className="font-bold">Camera Access Notice</p>
            <p className="text-xs text-red-200">{cameraError}</p>
          </div>
        </div>
      )}

      {/* Main Video Viewport & Status Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Live Video Stream with Real-Time Bounding Box Canvas (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative">
            {/* Viewport Container */}
            <div className="relative bg-slate-950 min-h-[420px] max-h-[560px] flex items-center justify-center overflow-hidden">
              {/* Native Live Video Stream */}
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className={`w-full h-full object-contain max-h-[540px] ${isStreaming ? 'block' : 'hidden'}`}
              />

              {/* Exact Overlay Canvas for Neural Bounding Boxes */}
              <canvas
                ref={overlayCanvasRef}
                className={`absolute inset-0 w-full h-full object-contain pointer-events-none max-h-[540px] z-10 ${
                  isStreaming ? 'block' : 'hidden'
                }`}
              />

              {/* Viewfinder HUD Overlays when streaming */}
              {isStreaming && (
                <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between z-20">
                  {/* Top HUD Row */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-950/85 backdrop-blur-md border border-slate-800 text-[11px] font-mono text-white font-bold">
                        <Radio className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                        LIVE ● AI MONITORING
                      </span>
                      {isAnalyzing && (
                        <span className="flex items-center gap-1 px-2 py-1 rounded bg-brand-600/90 text-[10px] font-mono text-white font-semibold animate-pulse">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          AI ANALYZING...
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] font-mono text-slate-300 bg-slate-950/85 px-2.5 py-1 rounded border border-slate-800">
                      Cycle: ~1.5s • {inferenceStats.lastInferenceMs}ms
                    </span>
                  </div>

                  {/* Prominent Visual Warning Banner when hazard is detected */}
                  {latestResult?.status === 'DETECTED' && latestResult.sceneRisk?.priorityHazard && (
                    <div className="self-center bg-red-950/95 backdrop-blur-md border-2 border-red-500 px-6 py-3.5 rounded-2xl shadow-2xl animate-bounce text-center space-y-1 pointer-events-auto max-w-md">
                      <div className="flex items-center justify-center gap-2 text-red-400 font-black text-sm sm:text-base tracking-wide font-mono">
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                        <span>⚠ ROAD HAZARD AHEAD</span>
                      </div>
                      <p className="text-xs sm:text-sm font-black text-white font-mono uppercase">
                        {latestResult.sceneRisk.priorityHazard.type} • {latestResult.sceneRisk.priorityHazard.confidencePct}% CONFIDENCE • {latestResult.sceneRisk.priorityHazard.risk?.level || latestResult.sceneRisk.overallRisk} RISK
                      </p>
                    </div>
                  )}

                  {/* Bottom Center Crosshair Guide */}
                  <div className="self-center text-center pb-2">
                    <Crosshair className="w-8 h-8 text-brand-400/40 mx-auto" />
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-950/85 px-2 py-0.5 rounded border border-slate-800 mt-1 inline-block">
                      Vehicle Path Zone
                    </span>
                  </div>
                </div>
              )}

              {/* Idle State when Camera is Offline */}
              {!isStreaming && (
                <div className="text-center py-20 px-6 space-y-4 font-mono">
                  <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500 shadow-inner">
                    <Camera className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white uppercase">Live Monitoring Inactive</h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 font-sans">
                      Click "START CAMERA" to activate real-time edge neural inference (~1.5s frequency) with live HUD bounding boxes and audio warnings.
                    </p>
                  </div>
                  <button
                    onClick={startCamera}
                    className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-brand-500/20"
                  >
                    ACTIVATE CAMERA
                  </button>
                </div>
              )}
            </div>

            {/* Live Camera Stream Status Footer */}
            <div className="p-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}`} />
                <span>Frames Evaluated: {inferenceStats.totalFramesAnalyzed}</span>
              </div>

              <div>
                <span>Hazards Found: </span>
                <span className="text-amber-400 font-bold">{inferenceStats.hazardsDetectedInSession}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Real-Time Telemetry & Status HUD (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <h2 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-brand-400" />
              Live Telemetry & Evaluation
            </h2>

            {/* Real-time Status Banner */}
            {!isStreaming ? (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-500 font-mono">
                Camera is stopped. No active live telemetry.
              </div>
            ) : isAnalyzing && !latestResult ? (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center font-mono text-xs text-brand-300 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-brand-400" />
                <span>Evaluating frame...</span>
              </div>
            ) : latestResult?.status === 'DETECTED' ? (
              <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/50 text-red-200 space-y-2">
                <div className="flex items-center justify-between font-mono">
                  <span className="font-bold text-sm text-red-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    ⚠ HAZARD DETECTED
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-bold uppercase">
                    {latestResult.sceneRisk?.priorityHazard?.risk?.level || latestResult.sceneRisk?.overallRisk} RISK
                  </span>
                </div>
                <p className="text-xs text-red-100 font-sans">
                  {latestResult.sceneRisk?.summary}
                </p>
              </div>
            ) : latestResult?.status === 'CLEAR' ? (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs space-y-2">
                <span className="font-bold text-slate-300 flex items-center gap-1.5 font-mono">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  NO SUPPORTED HAZARD DETECTED
                </span>
                <p className="text-slate-400 font-sans">
                  No trained defects or road obstacles detected in active camera frame.
                </p>
                <div className="text-[10px] text-slate-400 font-mono bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-0.5">
                  <p className="text-amber-400 font-bold flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    Model Scope Notice:
                  </p>
                  <p className="text-slate-400 font-sans text-[10px] leading-tight">
                    Current AI models detect potholes, road cracks, and obstacles. Waterlogging, open manholes and other unsupported hazards require dedicated trained models.
                  </p>
                </div>
              </div>
            ) : latestResult?.status === 'UNCERTAIN' ? (
              <div className="p-4 rounded-xl bg-yellow-950/40 border border-yellow-500/50 text-yellow-200 text-xs space-y-1">
                <span className="font-bold text-yellow-400 flex items-center gap-1.5 font-mono">
                  <HelpCircle className="w-4 h-4" />
                  ? DETECTION UNCERTAIN
                </span>
                <p className="text-yellow-100 font-sans">
                  Signal level was below confidence threshold.
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/50 text-rose-200 text-xs space-y-1">
                <span className="font-bold text-rose-400 flex items-center gap-1.5 font-mono">
                  <XCircle className="w-4 h-4" />
                  ✕ ANALYSIS FAILED
                </span>
                <p className="text-rose-100 font-sans">
                  {latestResult?.error || 'Frame inference error.'}
                </p>
              </div>
            )}

            {/* Real Detection Details */}
            {latestResult?.status === 'DETECTED' && latestResult.sceneRisk?.priorityHazard && (
              <div className="space-y-3 font-mono text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase">Hazard Type</span>
                    <span className="font-bold text-white truncate block uppercase">
                      {latestResult.sceneRisk.priorityHazard.type}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase">Confidence</span>
                    <span className="font-bold text-brand-400 block">
                      {latestResult.sceneRisk.priorityHazard.confidencePct}%
                    </span>
                  </div>
                </div>

                {/* Contributing factors */}
                {latestResult.sceneRisk.priorityHazard.risk?.factors && (
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-500 block font-bold uppercase">RISK FACTORS:</span>
                    <ul className="text-[11px] text-slate-300 space-y-0.5 font-sans">
                      {latestResult.sceneRisk.priorityHazard.risk.factors.map((f, i) => (
                        <li key={i} className="flex items-center gap-1 text-slate-400">
                          <span className="text-amber-400">•</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Save Detected Hazard to Map button */}
                <div className="pt-2">
                  <button
                    onClick={handleSaveLiveHazard}
                    disabled={isSaving || saveSuccess}
                    className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider font-mono flex items-center justify-center gap-2 transition-all ${
                      saveSuccess
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-lg shadow-brand-500/20 active:scale-95'
                    }`}
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Acquiring GPS...</span>
                      </>
                    ) : saveSuccess ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Hazard Saved to Map!</span>
                      </>
                    ) : (
                      <>
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Tag GPS & Save Hazard</span>
                      </>
                    )}
                  </button>
                  {gpsStatus && (
                    <p className="text-[10px] text-slate-400 text-center font-mono mt-1.5">{gpsStatus}</p>
                  )}
                </div>
              </div>
            )}

            {/* Inference Performance Stats */}
            <div className="pt-2 border-t border-slate-800 space-y-2 font-mono text-[11px] text-slate-400">
              <div className="flex justify-between">
                <span className="text-slate-500">Inference Interval:</span>
                <span className="text-slate-300">~1500 ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Last Latency:</span>
                <span className="text-emerald-400 font-bold">{inferenceStats.lastInferenceMs} ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Inference Engine:</span>
                <span className="text-slate-300">ONNX WASM SIMD</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
