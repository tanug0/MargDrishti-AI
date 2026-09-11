import React, { useState, useRef, useEffect } from 'react';
import { 
  UploadCloud, 
  Scan, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle, 
  XCircle, 
  MapPin, 
  Cpu, 
  Info, 
  RefreshCw, 
  Check, 
  ShieldAlert, 
  Layers, 
  FileImage, 
  Play,
  RotateCcw,
  Sparkles,
  FileCheck2,
  Image as ImageIcon,
  ShieldCheck,
  AlertOctagon,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { detectRoadHazards } from '../ai/detectionService';
import { loadImageElement } from '../ai/preprocessor';
import { getCurrentGPSPosition } from '../services/geoService';
import { storageService } from '../services/storageService';

const SAMPLE_ANALYSES = [
  { id: 'pothole_deep', label: 'Deep Pothole', url: '/sample_images/pothole_deep.jpg', desc: 'Urban road cavity' },
  { id: 'pothole_crater', label: 'Severe Pothole', url: '/sample_images/pothole_crater.jpg', desc: 'Deep asphalt depression' },
  { id: 'pothole_1', label: 'Road Pit', url: '/sample_images/pothole_1.jpg', desc: 'Surface cavity defect' },
  { id: 'pothole_2', label: 'Dual Pothole', url: '/sample_images/pothole_2.jpg', desc: 'Multiple surface voids' },
  { id: 'cracked_asphalt', label: 'Cracked Asphalt', url: '/sample_images/cracked_asphalt.jpg', desc: 'Surface road fatigue' },
  { id: 'clean_highway', label: 'Clean Highway', url: '/sample_images/clean_highway.jpg', desc: 'Undamaged multi-lane road' },
  { id: 'clean_road', label: 'Clean Road', url: '/sample_images/clean_road.jpg', desc: 'Clear asphalt roadway' },
  { id: 'suburban_road', label: 'Suburban Road', url: '/sample_images/suburban_road.jpg', desc: 'Residential asphalt pavement' }
];

export default function AnalyzeRoad({ onHazardSaved, initialImage = null }) {
  // Clean empty initial state (no preloaded image, no automatic inference)
  const [selectedImage, setSelectedImage] = useState(initialImage || null);
  const [selectedImageName, setSelectedImageName] = useState(initialImage ? 'Selected Road Image' : '');
  const [selectedImageMeta, setSelectedImageMeta] = useState({ size: '', dimensions: '' });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Optional Sample Analysis Drawer (collapsed by default)
  const [showSampleSection, setShowSampleSection] = useState(false);

  // Settings
  const [selectedModel, setSelectedModel] = useState('unified');
  const [confThreshold, setConfThreshold] = useState(0.25);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [hoveredBoxIndex, setHoveredBoxIndex] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  
  // GPS & Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [gpsStatus, setGpsStatus] = useState(null);

  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const imageObjRef = useRef(null);

  // Load preview whenever selectedImage changes
  useEffect(() => {
    if (!selectedImage) {
      setImageLoaded(false);
      imageObjRef.current = null;
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      return;
    }

    let isCancelled = false;
    setErrorMessage(null);

    loadImageElement(selectedImage)
      .then((img) => {
        if (isCancelled) return;
        imageObjRef.current = img;
        const w = img.naturalWidth || img.width || 640;
        const h = img.naturalHeight || img.height || 480;
        setSelectedImageMeta(prev => ({
          ...prev,
          dimensions: `${w} × ${h} px`
        }));
        setImageLoaded(true);
        drawCanvasOverlay(img, result);
      })
      .catch((err) => {
        if (isCancelled) return;
        console.error('Error loading image preview:', err);
        setErrorMessage(err.message || 'Invalid image. Please select a JPG, PNG or WEBP image.');
        setImageLoaded(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedImage]);

  // Redraw canvas overlay whenever result or hovered box changes
  useEffect(() => {
    if (imageObjRef.current) {
      drawCanvasOverlay(imageObjRef.current, result);
    }
  }, [result, hoveredBoxIndex]);

  const handleFileSelection = (file) => {
    if (!file) {
      return;
    }

    // Validate image format
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
    if (file.type && !validTypes.includes(file.type.toLowerCase()) && !file.type.startsWith('image/')) {
      setErrorMessage('Invalid image format. Please select a JPG, PNG or WEBP image.');
      return;
    }

    setErrorMessage(null);
    setResult(null);
    setSaveSuccess(false);

    try {
      const objectUrl = URL.createObjectURL(file);
      const sizeStr = file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'Uploaded File';

      setSelectedImage(objectUrl);
      setSelectedImageName(file.name || 'Uploaded Road Image');
      setSelectedImageMeta({ size: sizeStr, dimensions: 'Loading...' });

      // Automatically run real ONNX analysis upon user upload
      handleAnalyze(objectUrl);
    } catch (e) {
      console.error('File read error:', e);
      setErrorMessage('Failed to read image file. Please try another file.');
    }
  };

  const handleSelectSample = (sample) => {
    setErrorMessage(null);
    setResult(null);
    setSaveSuccess(false);
    setSelectedImageName(sample.label);
    setSelectedImageMeta({ size: 'Sample Image', dimensions: 'Loading...' });
    setSelectedImage(sample.url);

    // Run the SAME REAL ONNX pipeline on the chosen sample
    handleAnalyze(sample.url);
  };

  const handleClearImage = () => {
    setSelectedImage(null);
    setSelectedImageName('');
    setSelectedImageMeta({ size: '', dimensions: '' });
    setImageLoaded(false);
    setResult(null);
    setErrorMessage(null);
    setSaveSuccess(false);
    setGpsStatus(null);
    imageObjRef.current = null;
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const handleAnalyze = async (imageSrc) => {
    const src = imageSrc || selectedImage;
    if (!src) {
      setErrorMessage('Please upload a road image first.');
      return;
    }

    if (isAnalyzing) return;

    setIsAnalyzing(true);
    setErrorMessage(null);
    setSaveSuccess(false);

    try {
      const res = await detectRoadHazards(src, {
        model: selectedModel,
        confThreshold: confThreshold,
        nmsThreshold: 0.45
      });

      setResult(res);
      if (res.sourceImg) {
        imageObjRef.current = res.sourceImg;
        drawCanvasOverlay(res.sourceImg, res);
      }

      // Voice Alert
      if (voiceEnabled && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          let text = '';
          if (res.status === 'DETECTED' && res.sceneRisk?.priorityHazard) {
            text = `Warning. ${res.sceneRisk.priorityHazard.type} detected ahead. Risk level ${res.sceneRisk.overallRisk.toLowerCase()}.`;
          } else if (res.status === 'CLEAR') {
            text = 'Road appears clear.';
          }
          if (text) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.05;
            window.speechSynthesis.speak(utterance);
          }
        } catch (e) {
          console.warn('Voice alert note:', e);
        }
      }

      // Automatically record analysis to LocalStorage History
      try {
        const priority = res.sceneRisk?.priorityHazard || (res.detections.length > 0 ? res.detections[0] : null);
        storageService.saveHazard({
          hazardType: priority ? priority.type : (res.status === 'CLEAR' ? 'Clear Road' : 'Road Anomaly'),
          hazardClass: priority ? priority.hazardClass : 'clear',
          confidence: priority ? priority.confidence : 0.95,
          confidencePct: priority ? priority.confidencePct : 95,
          severity: res.sceneRisk?.overallRisk || (res.status === 'CLEAR' ? 'LOW' : 'MEDIUM'),
          riskScore: res.sceneRisk?.riskScore || 0,
          hazardCount: res.detections.length,
          detections: res.detections,
          bbox: priority?.bbox || null,
          location: null,
          thumbnail: null,
          modelUsed: selectedModel,
          inferenceTimeMs: res.inferenceTime
        });
      } catch (e) {
        console.warn('History save note:', e);
      }

    } catch (err) {
      console.error('[MargDrishti AI] Inference error:', err);
      setResult({
        status: 'ERROR',
        detections: [],
        inferenceTime: 0,
        error: err.message || 'AI inference could not be completed. Please retry.'
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Canvas Drawing: Exact pixel-level Bounding Boxes & Badges
  const drawCanvasOverlay = (img, currentResult) => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    const origW = img.naturalWidth || img.width || 640;
    const origH = img.naturalHeight || img.height || 480;

    canvas.width = origW;
    canvas.height = origH;

    // 1. Draw base original image
    ctx.drawImage(img, 0, 0, origW, origH);

    if (!currentResult || !currentResult.detections || currentResult.detections.length === 0) {
      return;
    }

    // 2. Draw each bounding box accurately
    currentResult.detections.forEach((det, idx) => {
      const { bbox, type, confidencePct, risk } = det;
      const isHovered = hoveredBoxIndex === idx;
      const hClass = (det.hazardClass || '').toLowerCase();

      // Color scheme based on hazard class and severity
      let strokeColor = '#ef4444'; // Red for potholes
      let fillColor = 'rgba(239, 68, 68, 0.20)';
      let labelBg = '#ef4444';

      if (hClass.includes('crack')) {
        strokeColor = '#f59e0b'; // Amber for cracks
        fillColor = 'rgba(245, 158, 11, 0.20)';
        labelBg = '#f59e0b';
      } else if (hClass === 'obstacle') {
        strokeColor = '#eab308'; // Yellow for obstacles
        fillColor = 'rgba(234, 179, 8, 0.20)';
        labelBg = '#eab308';
      }

      if (isHovered) {
        strokeColor = '#38bdf8'; // Sky blue highlight on hover
        fillColor = 'rgba(56, 189, 248, 0.30)';
        labelBg = '#0284c7';
      }

      // Draw bounding box rectangle
      ctx.lineWidth = isHovered ? 5 : 3.5;
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

      // Corner accent markers for futuristic tech HUD
      const markerSize = Math.min(20, bbox.width / 4, bbox.height / 4);
      ctx.lineWidth = isHovered ? 6 : 4.5;
      ctx.strokeStyle = strokeColor;
      
      // Top-Left
      ctx.beginPath();
      ctx.moveTo(bbox.x, bbox.y + markerSize);
      ctx.lineTo(bbox.x, bbox.y);
      ctx.lineTo(bbox.x + markerSize, bbox.y);
      ctx.stroke();

      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(bbox.x + bbox.width - markerSize, bbox.y + bbox.height);
      ctx.lineTo(bbox.x + bbox.width, bbox.y + bbox.height);
      ctx.lineTo(bbox.x + bbox.width, bbox.y + bbox.height - markerSize);
      ctx.stroke();

      // Draw Label Badge Header
      const labelText = `⚠ ${type.toUpperCase()} ${confidencePct}% [${risk?.level || 'MED'}]`;
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

  // Save to LocalStorage with Real GPS coordinates
  const handleSaveToMap = async () => {
    if (!result || result.status !== 'DETECTED') return;
    setIsSaving(true);
    setGpsStatus('Acquiring real GPS coordinates...');

    try {
      const gpsResult = await getCurrentGPSPosition();
      let locationData = null;

      if (gpsResult.available && gpsResult.coords) {
        locationData = {
          latitude: gpsResult.coords.latitude,
          longitude: gpsResult.coords.longitude,
          accuracy: gpsResult.coords.accuracyMeters
        };
        setGpsStatus(`GPS Logged: ${locationData.latitude.toFixed(4)}, ${locationData.longitude.toFixed(4)}`);
      } else {
        setGpsStatus(gpsResult.error || 'Location unavailable');
      }

      let thumbnail = null;
      if (canvasRef.current) {
        try {
          thumbnail = canvasRef.current.toDataURL('image/jpeg', 0.6);
        } catch (e) {}
      }

      const priority = result.sceneRisk?.priorityHazard || result.detections[0];

      const record = {
        hazardType: priority ? priority.type : 'Road Hazard',
        hazardClass: priority ? priority.hazardClass : 'pothole',
        confidence: priority ? priority.confidence : 0.9,
        confidencePct: priority ? priority.confidencePct : 90,
        severity: result.sceneRisk?.overallRisk || 'HIGH',
        riskScore: result.sceneRisk?.riskScore || 75,
        hazardCount: result.detections.length,
        detections: result.detections,
        bbox: priority?.bbox || null,
        location: locationData,
        thumbnail,
        modelUsed: selectedModel,
        inferenceTimeMs: result.inferenceTime
      };

      storageService.saveHazard(record);
      setSaveSuccess(true);
      if (onHazardSaved) onHazardSaved(record);
    } catch (e) {
      console.error('Error saving hazard:', e);
      alert('Failed to save hazard log: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-in fade-in duration-300">
      {/* Top Header & Model Controls */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 backdrop-blur-xl shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5 uppercase font-mono">
              <Scan className="w-6 h-6 text-brand-400" />
              Analyze Road
            </h1>
            <p className="text-sm text-slate-400 mt-1 font-sans">
              Upload a road image to detect supported road hazards.
            </p>
          </div>

          {/* Controls: Model, Voice Alert, Diagnostics & Reset */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono">
              <Cpu className="w-3.5 h-3.5 text-brand-400" />
              <span className="text-slate-400">Model:</span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-transparent text-slate-200 font-semibold focus:outline-none cursor-pointer"
              >
                <option value="unified" className="bg-slate-900">MargDrishti Unified (Pothole + RDD Global + Obstacle)</option>
                <option value="pothole" className="bg-slate-900">Pothole Specialist (YOLOv8-End2End)</option>
                <option value="rddGlobal" className="bg-slate-900">RDD2022 Global (Multi-Class Cracks)</option>
                <option value="rdd" className="bg-slate-900">RDD2022 Japan (Legacy Fallback)</option>
                <option value="obstacle" className="bg-slate-900">Road Obstacle & Debris (COCO)</option>
              </select>
            </div>

            <button
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-mono transition-colors ${
                voiceEnabled 
                  ? 'bg-brand-600/20 text-brand-300 border-brand-500/40' 
                  : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
              }`}
              title="Toggle Voice Alerts"
            >
              {voiceEnabled ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-brand-400" />
                  <span>Voice On</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                  <span>Voice Off</span>
                </>
              )}
            </button>

            <button
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-mono transition-colors ${
                showDiagnostics 
                  ? 'bg-brand-500/20 text-brand-300 border-brand-500/40'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>Diagnostics</span>
            </button>

            {selectedImage && (
              <button
                onClick={handleClearImage}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-mono bg-slate-950 text-slate-400 border-slate-800 hover:text-rose-400 hover:border-rose-500/40 transition-colors"
                title="Clear image and reset"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Optional "Try a Sample Analysis" Drawer (Collapsed by Default) */}
        <div className="pt-3 border-t border-slate-800/80">
          <button
            onClick={() => setShowSampleSection(!showSampleSection)}
            className="flex items-center justify-between w-full p-2.5 sm:p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:bg-slate-850 hover:border-slate-700 text-xs font-mono transition-all text-slate-300 group"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-400 group-hover:scale-110 transition-transform" />
              <span className="font-bold text-slate-200">Try a Sample Analysis</span>
              <span className="hidden sm:inline text-slate-500 text-[11px]">— Evaluate pre-loaded road conditions</span>
            </div>
            <div className="flex items-center gap-1 text-slate-400">
              <span className="text-[11px]">{showSampleSection ? 'Hide Samples' : 'Show Samples'}</span>
              {showSampleSection ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </div>
          </button>

          {/* Collapsible Sample Cards Grid */}
          {showSampleSection && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
              {SAMPLE_ANALYSES.map((sample) => (
                <button
                  key={sample.id}
                  onClick={() => handleSelectSample(sample)}
                  className={`flex flex-col items-center p-2 rounded-xl border text-center transition-all ${
                    selectedImageName === sample.label
                      ? 'bg-brand-600/25 border-brand-500 text-white shadow-sm shadow-brand-500/20'
                      : 'bg-slate-950/70 border-slate-800/90 text-slate-400 hover:text-slate-200 hover:bg-slate-900 hover:border-slate-700'
                  }`}
                >
                  <img 
                    src={sample.url} 
                    alt={sample.label} 
                    className="w-full h-12 rounded-lg object-cover border border-slate-800 mb-1.5" 
                  />
                  <p className="font-mono font-bold truncate text-[11px] leading-tight text-slate-200 w-full">
                    {sample.label}
                  </p>
                  <p className="text-[9px] text-slate-500 truncate w-full font-sans">
                    {sample.desc}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-500/50 text-rose-200 text-xs font-mono flex items-center gap-2.5 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Analysis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Image Canvas & Upload Dropzone (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Canvas Viewport */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative">
            <div className="relative bg-slate-950 min-h-[400px] max-h-[560px] flex items-center justify-center overflow-hidden">
              {/* Canvas rendered when an image is loaded */}
              <canvas
                ref={canvasRef}
                className={`max-h-[540px] w-auto max-w-full object-contain cursor-crosshair ${
                  selectedImage ? 'block' : 'hidden'
                }`}
              />

              {/* Clean Empty State Placeholder when no image is selected */}
              {!selectedImage && (
                <div className="text-center py-16 px-6 space-y-4 font-mono">
                  <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-brand-400 shadow-inner">
                    <UploadCloud className="w-8 h-8 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white uppercase tracking-wider">
                      No Road Image Selected
                    </h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 font-sans">
                      Upload a road photo or select a sample analysis to execute real-time neural hazard detection.
                    </p>
                  </div>
                  <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs uppercase tracking-wider font-mono transition-all shadow-lg shadow-brand-500/25 active:scale-95"
                    >
                      <UploadCloud className="w-4 h-4" />
                      <span>Upload Road Image</span>
                    </button>
                    <button
                      onClick={() => setShowSampleSection(true)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs uppercase tracking-wider font-mono border border-slate-800 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                      <span>Try Sample</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Scanning Radar Animation during inference */}
              {isAnalyzing && (
                <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px] flex flex-col items-center justify-center z-20">
                  <div className="w-full h-1 bg-gradient-to-r from-transparent via-brand-400 to-transparent absolute animate-radar-scan"></div>
                  <div className="bg-slate-900/95 border border-brand-500/40 px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 font-mono text-sm text-brand-300">
                    <RefreshCw className="w-5 h-5 animate-spin text-brand-400" />
                    <span>AI ANALYZING ROAD...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Canvas Toolbar Footer */}
            {selectedImage && (
              <div className="p-3.5 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-400">
                <div className="flex items-center gap-2 min-w-0">
                  <FileImage className="w-4 h-4 text-brand-400 flex-shrink-0" />
                  <span className="truncate text-slate-200 font-bold">{selectedImageName}</span>
                  <span className="text-slate-500 text-[11px]">
                    ({selectedImageMeta.dimensions} {selectedImageMeta.size ? `• ${selectedImageMeta.size}` : ''})
                  </span>
                </div>

                {/* Action Buttons: Re-Analyze & Clear */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAnalyze(selectedImage)}
                    disabled={isAnalyzing}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all font-mono shadow-md ${
                      isAnalyzing
                        ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                        : 'bg-brand-600 hover:bg-brand-500 text-white shadow-brand-500/25 active:scale-95'
                    }`}
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>AI ANALYZING...</span>
                      </>
                    ) : (
                      <>
                        <Scan className="w-3.5 h-3.5" />
                        <span>ANALYZE ROAD</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleClearImage}
                    disabled={isAnalyzing}
                    className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/40 transition-colors"
                    title="Clear Image"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Drag & Drop Upload Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
            onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFileSelection(file);
            }}
            className={`p-6 rounded-2xl border-2 border-dashed text-center transition-all ${
              isDragOver
                ? 'bg-brand-600/15 border-brand-400 text-brand-300 scale-[1.01]'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:bg-slate-900/90'
            }`}
          >
            {/* Hidden native input */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileSelection(file);
                }
                e.target.value = ''; // Reset input so re-selecting same file triggers change
              }}
            />
            
            <UploadCloud className="w-9 h-9 mx-auto text-brand-400 mb-2.5" />
            <p className="text-xs sm:text-sm font-bold text-white font-mono uppercase">
              UPLOAD ROAD IMAGE
            </p>
            <p className="text-xs text-slate-400 mt-1 font-sans">
              Drag & drop a road image here, or browse from your device
            </p>

            <div className="mt-3 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono font-bold text-xs transition-colors border border-slate-700 shadow-sm"
              >
                Browse Image
              </button>
            </div>

            <div className="mt-2.5 flex items-center justify-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-950 text-slate-500 border border-slate-800">
                JPG
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-950 text-slate-500 border border-slate-800">
                PNG
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-950 text-slate-500 border border-slate-800">
                WEBP
              </span>
            </div>
          </div>

          {/* Detections Pill Selector */}
          {result?.detections && result.detections.length > 0 && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-2.5 animate-in fade-in">
              <p className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center justify-between">
                <span>Identified Road Hazards ({result.detections.length})</span>
                <span className="text-slate-500 font-normal">Hover to highlight</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {result.detections.map((det, idx) => {
                  const hClass = (det.hazardClass || '').toLowerCase();
                  return (
                    <div
                      key={det.id || idx}
                      onMouseEnter={() => setHoveredBoxIndex(idx)}
                      onMouseLeave={() => setHoveredBoxIndex(null)}
                      className={`p-3 rounded-xl border text-xs font-mono flex items-center justify-between transition-all cursor-pointer ${
                        hoveredBoxIndex === idx
                          ? 'bg-brand-600/30 border-brand-400 text-white shadow-md'
                          : 'bg-slate-950 border-slate-800/90 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                          hClass.includes('pothole') ? 'bg-red-500' : 'bg-amber-400'
                        }`} />
                        <span className="font-bold truncate uppercase">{det.type}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-slate-400 font-semibold">{det.confidencePct}%</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                          det.risk?.badgeClass || 'bg-slate-800 text-slate-300'
                        }`}>
                          {det.risk?.level || 'MED'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: AI Result Panel & Explainable Risk Engine (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
            {/* Status State Header */}
            <div>
              <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-2">
                AI INFERENCE RESULT
              </p>

              {isAnalyzing ? (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-mono text-xs">
                  <RefreshCw className="w-5 h-5 text-brand-400 animate-spin flex-shrink-0" />
                  <span>Processing neural inference across models...</span>
                </div>
              ) : result?.status === 'DETECTED' ? (
                <div className="p-5 rounded-xl bg-red-950/40 border border-red-500/50 text-red-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-red-400 font-black text-base sm:text-lg tracking-wide font-mono">
                      <AlertTriangle className="w-5 h-5 text-red-400 animate-bounce flex-shrink-0" />
                      <span>⚠ ROAD HAZARD DETECTED</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-red-500/20 border border-red-500/50 text-red-300 uppercase">
                      {result.sceneRisk?.overallRisk} RISK
                    </span>
                  </div>
                  <p className="text-xs text-red-100 font-sans leading-relaxed">
                    {result.sceneRisk?.summary}
                  </p>
                </div>
              ) : result?.status === 'CLEAR' ? (
                <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-300 font-black text-sm sm:text-base tracking-wide font-mono">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                      <span>NO SUPPORTED HAZARD DETECTED</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                      NO HAZARDS (0/100)
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    Inference completed successfully. No trained defect classes (potholes, cracks, road obstacles) were detected above the {Math.round(confThreshold * 100)}% threshold.
                  </p>
                  <div className="text-[11px] text-slate-300 font-mono bg-slate-900/90 p-3 rounded-lg border border-slate-800 space-y-1">
                    <p className="text-amber-400 font-bold flex items-center gap-1">
                      <Info className="w-3.5 h-3.5" />
                      Model Scope Notice:
                    </p>
                    <p className="text-slate-400 font-sans text-[11px] leading-tight">
                      Current AI models detect potholes, cracks, and road obstacles. Waterlogging, open manholes and other unsupported hazards require dedicated trained models.
                    </p>
                  </div>
                </div>
              ) : result?.status === 'UNCERTAIN' ? (
                <div className="p-5 rounded-xl bg-yellow-950/40 border border-yellow-500/50 text-yellow-200 space-y-2">
                  <div className="flex items-center gap-2 text-yellow-400 font-black text-base font-mono">
                    <HelpCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                    <span>? DETECTION UNCERTAIN</span>
                  </div>
                  <p className="text-xs text-yellow-100 font-sans">
                    The current model detected marginal features, but signal confidence was below the configured {Math.round(confThreshold * 100)}% threshold.
                  </p>
                  <button
                    onClick={() => handleAnalyze(selectedImage)}
                    className="px-3 py-1.5 rounded-lg bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 font-mono text-xs font-bold hover:bg-yellow-500/30"
                  >
                    TRY AGAIN
                  </button>
                </div>
              ) : result?.status === 'ERROR' ? (
                <div className="p-5 rounded-xl bg-rose-950/40 border border-rose-500/50 text-rose-200 space-y-2">
                  <div className="flex items-center gap-2 text-rose-400 font-black text-base font-mono">
                    <XCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                    <span>✕ ANALYSIS FAILED</span>
                  </div>
                  <p className="text-xs text-rose-100 font-sans">
                    {result?.error || 'AI inference could not be completed. Please retry.'}
                  </p>
                  <button
                    onClick={() => handleAnalyze(selectedImage)}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 font-mono text-xs font-bold hover:bg-rose-500/30"
                  >
                    RETRY INFERENCE
                  </button>
                </div>
              ) : selectedImage ? (
                <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 font-mono text-xs space-y-2 text-center">
                  <FileCheck2 className="w-8 h-8 text-brand-400 mx-auto" />
                  <p className="font-bold text-white uppercase">IMAGE LOADED</p>
                  <p className="text-[11px] text-slate-400 font-sans">
                    Click "ANALYZE ROAD" to execute neural road defect detection.
                  </p>
                  <button
                    onClick={() => handleAnalyze(selectedImage)}
                    className="mt-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs font-mono uppercase shadow-md shadow-brand-500/20"
                  >
                    ANALYZE ROAD
                  </button>
                </div>
              ) : (
                /* Clean Empty Standby State */
                <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 font-mono text-xs space-y-3">
                  <div className="flex items-center gap-2 text-brand-400 font-bold text-sm">
                    <Sparkles className="w-4 h-4" />
                    <span>READY FOR ANALYSIS</span>
                  </div>
                  <p className="text-slate-300 font-sans text-xs leading-relaxed">
                    Upload a road surface photo or select a sample analysis to detect road defects in real time using client-side ONNX Runtime WASM.
                  </p>
                  <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-[11px] text-slate-400 font-mono">
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <Check className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Potholes & Cavities (Specialist YOLOv8)</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-amber-400">
                      <Check className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Longitudinal & Transverse Cracks (RDD Global)</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-yellow-400">
                      <Check className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Road Obstacles & Debris (COCO)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Metrics Display */}
            {result?.status === 'DETECTED' && result.sceneRisk?.priorityHazard && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 font-mono">
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] uppercase text-slate-500 block mb-1 font-bold">PRIMARY HAZARD</span>
                    <span className="text-base font-bold text-white block truncate uppercase">
                      {result.sceneRisk.priorityHazard.type}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] uppercase text-slate-500 block mb-1 font-bold">AI CONFIDENCE</span>
                    <span className="text-base font-bold text-brand-400 block">
                      {result.sceneRisk.priorityHazard.confidencePct}%
                    </span>
                  </div>
                </div>

                {/* AI Confidence Progress Bar */}
                <div className="space-y-1.5 font-mono">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400 font-bold uppercase">AI Confidence Metric</span>
                    <span className="text-brand-400 font-bold">{result.sceneRisk.priorityHazard.confidencePct}%</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-indigo-500 transition-all duration-700"
                      style={{ width: `${result.sceneRisk.priorityHazard.confidencePct}%` }}
                    />
                  </div>
                </div>

                {/* Explainable Risk Engine Breakdown */}
                {result.sceneRisk.priorityHazard.risk && (
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-amber-400" />
                        RISK FACTORS
                      </span>
                      <span className="text-xs font-bold text-amber-400">
                        Score: {result.sceneRisk.riskScore}/100
                      </span>
                    </div>

                    <ul className="space-y-1.5 text-xs text-slate-300 font-sans">
                      {result.sceneRisk.priorityHazard.risk.factors.map((factor, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-amber-400 font-bold">•</span>
                          <span>{factor}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action Bar: Save to GPS Map */}
                <div className="pt-1">
                  <button
                    onClick={handleSaveToMap}
                    disabled={isSaving || saveSuccess}
                    className={`w-full py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider font-mono flex items-center justify-center gap-2 transition-all ${
                      saveSuccess
                        ? 'bg-emerald-600 text-white cursor-default'
                        : 'bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-lg shadow-brand-500/20 active:scale-95'
                    }`}
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Acquiring GPS & Saving...</span>
                      </>
                    ) : saveSuccess ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Hazard Saved to Map & History!</span>
                      </>
                    ) : (
                      <>
                        <MapPin className="w-4 h-4" />
                        <span>Tag Real GPS & Save Hazard</span>
                      </>
                    )}
                  </button>
                  {gpsStatus && (
                    <p className="text-[11px] text-slate-400 text-center font-mono mt-2">
                      {gpsStatus}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Transparent Diagnostics Drawer */}
          {showDiagnostics && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 font-mono text-xs text-slate-300 space-y-3.5 animate-in fade-in shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-brand-400 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" />
                  [MargDrishti AI AUDIT & DIAGNOSTIC]
                </span>
                <span className="text-slate-500 text-[10px]">{result?.diagnostic?.timestamp || 'Active'}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500 block">Input Tensor:</span>
                  <span className="text-slate-200">{result?.diagnostic?.inputTensor || '[1, 3, 640, 640] Float32'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Output Tensor:</span>
                  <span className="text-slate-200">{result?.diagnostic?.outputTensor || '[1, 300, 6] / [1, 10, 8400]'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Inference Time:</span>
                  <span className="text-emerald-400 font-bold">{result?.inferenceTime || 0} ms</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Candidates / NMS:</span>
                  <span className="text-slate-200">
                    {result?.diagnostic?.rawDetectionsCount ?? 0} raw → {result?.diagnostic?.filteredDetectionsCount ?? 0} kept
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-500 block">Models Executed:</span>
                <span className="text-slate-300 text-[10px]">
                  {result?.diagnostic?.modelsExecuted?.join(', ') || 'Unified (Pothole + RDD2022)'}
                </span>
              </div>

              {/* Supported Classes */}
              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-emerald-400 font-bold block mb-1">
                  ✓ Verified Supported Defect Classes:
                </span>
                <div className="flex flex-wrap gap-1">
                  {['Pothole', 'Longitudinal Crack', 'Transverse Crack', 'Alligator Crack', 'Crosswalk Blur', 'Whiteline Blur', 'Road Obstacle'].map((c, i) => (
                    <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950/60 border border-emerald-500/30 text-emerald-300">
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              {/* Unsupported Categories Note */}
              <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/30 text-[11px] text-amber-200/90 font-sans space-y-1">
                <p className="font-bold text-amber-300 flex items-center gap-1 font-mono text-[10px] uppercase">
                  <AlertOctagon className="w-3 h-3" />
                  Model Capability Gap:
                </p>
                <p className="leading-tight text-[11px]">
                  Waterlogging / Puddles and Open Manholes are not present in current trained ONNX models. These conditions require dedicated exported models rather than misclassification.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
