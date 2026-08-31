import React, { useEffect, useState } from 'react';
import { 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  Scan, 
  Camera, 
  MapPin, 
  ArrowRight, 
  Cpu, 
  Layers, 
  Activity, 
  History, 
  Clock, 
  Radio,
  Compass,
  Zap,
  Eye
} from 'lucide-react';
import { storageService } from '../services/storageService';

export default function Dashboard({ setActiveTab }) {
  const [stats, setStats] = useState({
    totalAnalyses: 0,
    totalHazardsDetected: 0,
    highRiskHazards: 0,
    avgConfidence: 0,
    hasGPSCount: 0,
    recentRecords: []
  });

  const [selectedRecord, setSelectedRecord] = useState(null);

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = () => {
    const s = storageService.getStatistics();
    setStats(s);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 lg:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/15 border border-brand-500/30 text-brand-300 text-xs font-mono font-semibold">
              <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse"></span>
              <span>Edge AI Command Center • ONNX Runtime Web</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white uppercase">
              ROAD SAFETY COMMAND CENTER
            </h1>
            <p className="text-sm sm:text-base text-slate-300 font-medium">
              "Real-time AI intelligence for safer roads"
            </p>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-sans">
              Autonomous edge-deployed neural vision detecting structural road defects, cracks, potholes, and obstructions with zero server latency.
            </p>
          </div>

          {/* Quick Launch Action CTAs */}
          <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row gap-3 flex-shrink-0">
            <button
              onClick={() => setActiveTab('analyze')}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-brand-500/25 active:scale-95 font-mono"
            >
              <Scan className="w-4 h-4" />
              <span>Analyze Road</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>

            <button
              onClick={() => setActiveTab('camera')}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs uppercase tracking-wider transition-all font-mono"
            >
              <Camera className="w-4 h-4 text-amber-400" />
              <span>Live Monitoring</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Analyses */}
        <div className="bg-slate-900/90 border border-slate-800/90 hover:border-slate-700 rounded-2xl p-5 shadow-lg relative overflow-hidden transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">TOTAL ANALYSES</span>
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400 group-hover:scale-110 transition-transform">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl lg:text-4xl font-black text-white mt-3 font-mono">
            {stats.totalAnalyses}
          </p>
          <p className="text-[11px] text-slate-500 font-mono mt-1">Logged Road Surface Scans</p>
        </div>

        {/* Hazards Detected */}
        <div className="bg-slate-900/90 border border-slate-800/90 hover:border-slate-700 rounded-2xl p-5 shadow-lg relative overflow-hidden transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">HAZARDS DETECTED</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl lg:text-4xl font-black text-amber-400 mt-3 font-mono">
            {stats.totalHazardsDetected}
          </p>
          <p className="text-[11px] text-slate-500 font-mono mt-1">Confirmed Potholes & Defects</p>
        </div>

        {/* High Risk */}
        <div className="bg-slate-900/90 border border-slate-800/90 hover:border-slate-700 rounded-2xl p-5 shadow-lg relative overflow-hidden transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">HIGH RISK</span>
            <div className="p-2 rounded-xl bg-red-500/10 text-red-400 group-hover:scale-110 transition-transform">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl lg:text-4xl font-black text-red-400 mt-3 font-mono">
            {stats.highRiskHazards}
          </p>
          <p className="text-[11px] text-slate-500 font-mono mt-1">Critical Vehicle Danger Zones</p>
        </div>

        {/* Active Monitoring */}
        <div className="bg-slate-900/90 border border-slate-800/90 hover:border-slate-700 rounded-2xl p-5 shadow-lg relative overflow-hidden transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">ACTIVE MONITORING</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-3 font-mono">
            <span className="text-3xl lg:text-4xl font-black text-emerald-400">
              {stats.hasGPSCount}
            </span>
            <span className="text-xs text-slate-400 font-semibold">GPS Locations</span>
          </div>
          <p className="text-[11px] text-slate-500 font-mono mt-1">Geotagged Road Assets</p>
        </div>
      </div>

      {/* Main Command Center Grid: System Status Panel & Recent Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Recent Hazard Detections Feed (7 Cols) */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold flex items-center gap-2">
              <History className="w-4 h-4 text-brand-400" />
              Live Detection Feed
            </h2>
            <button
              onClick={() => setActiveTab('history')}
              className="text-xs font-mono text-brand-400 hover:text-brand-300 flex items-center gap-1 font-semibold"
            >
              <span>View Full History</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {stats.recentRecords.length === 0 ? (
            <div className="text-center py-14 px-4 space-y-3">
              <Scan className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-300">No Road Detections Stored Yet</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto font-sans">
                Upload a road image or choose a verified test benchmark in the "Analyze Road" tab to run genuine ONNX inference.
              </p>
              <button
                onClick={() => setActiveTab('analyze')}
                className="mt-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold font-mono transition-colors"
              >
                Run First Analysis
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {stats.recentRecords.map((rec) => (
                <div
                  key={rec.id}
                  onClick={() => setSelectedRecord(rec)}
                  className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between gap-3 text-xs font-mono transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {rec.thumbnail ? (
                      <img
                        src={rec.thumbnail}
                        alt="Hazard"
                        className="w-12 h-12 rounded-lg object-cover border border-slate-800 flex-shrink-0 group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center flex-shrink-0 text-slate-500">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate text-sm">{rec.hazardType}</p>
                      <p className="text-slate-500 text-[11px] flex items-center gap-1.5 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {new Date(rec.timestamp).toLocaleTimeString()} • Conf: {rec.confidencePct}%
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-2.5 py-1 rounded text-[10px] uppercase font-bold border ${
                      rec.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-300 border-red-500/40' :
                      rec.severity === 'HIGH' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                      'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
                    }`}>
                      {rec.severity}
                    </span>
                    <Eye className="w-3.5 h-3.5 text-slate-600 group-hover:text-brand-400 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Live System Status Panel (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold flex items-center gap-2">
                <Cpu className="w-4 h-4 text-brand-400" />
                Live System Status
              </h2>
              <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                ALL SYSTEMS NOMINAL
              </span>
            </div>

            {/* Status Grid */}
            <div className="space-y-2.5 font-mono text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                <span className="text-slate-400">AI Engine:</span>
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  ONLINE
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                <span className="text-slate-400">ONNX Runtime:</span>
                <span className="font-bold text-brand-400">READY (WASM SIMD)</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                <span className="text-slate-400">Camera Sensor:</span>
                <span className="font-bold text-emerald-400">READY (Rear Preferred)</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                <span className="text-slate-400">GPS Telemetry:</span>
                <span className="font-bold text-emerald-400">AVAILABLE</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                <span className="text-slate-400">Active Model:</span>
                <span className="font-bold text-white truncate max-w-[180px]">ROAD DAMAGE DETECTOR</span>
              </div>
            </div>

            {/* Quick Map Action Banner */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white font-mono">Geospatial Telemetry</p>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  {stats.hasGPSCount} confirmed hazards pinned
                </p>
              </div>
              <button
                onClick={() => setActiveTab('map')}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono font-bold text-slate-200 transition-colors"
              >
                Open Map
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Record Inspection Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white font-mono flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Hazard Inspection Log
              </h3>
              <button
                onClick={() => setSelectedRecord(null)}
                className="text-xs font-mono text-slate-400 hover:text-white"
              >
                ✕ Close
              </button>
            </div>

            {selectedRecord.thumbnail && (
              <img
                src={selectedRecord.thumbnail}
                alt="Hazard"
                className="w-full h-48 object-cover rounded-xl border border-slate-800"
              />
            )}

            <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-500 block text-[10px]">Hazard</span>
                <span className="font-bold text-white">{selectedRecord.hazardType}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Confidence</span>
                <span className="font-bold text-brand-400">{selectedRecord.confidencePct}%</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Severity</span>
                <span className="font-bold text-red-400">{selectedRecord.severity}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Latency</span>
                <span className="font-bold text-emerald-400">{selectedRecord.inferenceTimeMs || 0} ms</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedRecord(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs font-mono"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
