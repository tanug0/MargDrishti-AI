import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  ShieldAlert, 
  Cpu, 
  Layers, 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Percent,
  Compass,
  Zap
} from 'lucide-react';
import { storageService } from '../services/storageService';

export default function AnalyticsView() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const s = storageService.getStatistics();
    setStats(s);
  }, []);

  if (!stats) return null;

  const typeEntries = Object.entries(stats.typeBreakdown || {});
  const totalTypesCount = typeEntries.reduce((acc, [, count]) => acc + count, 0);

  const severityData = [
    { label: 'CRITICAL', count: stats.severityBreakdown.CRITICAL || 0, color: 'bg-red-500', text: 'text-red-400', border: 'border-red-500/40' },
    { label: 'HIGH', count: stats.severityBreakdown.HIGH || 0, color: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500/40' },
    { label: 'MEDIUM', count: stats.severityBreakdown.MEDIUM || 0, color: 'bg-yellow-500', text: 'text-yellow-400', border: 'border-yellow-500/40' },
    { label: 'LOW', count: stats.severityBreakdown.LOW || 0, color: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500/40' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 backdrop-blur-xl shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5 font-mono uppercase">
              <BarChart3 className="w-6 h-6 text-brand-400" />
              ROAD HAZARD ANALYTICS
            </h1>
            <p className="text-sm text-slate-400 mt-1 font-sans">
              "Deterministic telemetry aggregated strictly from real client-side ONNX neural inferences"
            </p>
          </div>

          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Real Client-Side Telemetry</span>
          </div>
        </div>
      </div>

      {stats.totalAnalyses === 0 ? (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-16 text-center space-y-3 font-mono">
          <Activity className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-200 uppercase">No Analytics Data Available</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto font-sans">
            Zero analyses stored. Once you run image road hazard scans in the "Analyze Road" tab, real metrics and charts will compute here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Top KPI Metrics Row (12 Cols) */}
          <div className="lg:col-span-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-1">
              <span className="text-slate-500 uppercase text-[10px] tracking-wider font-bold block">Detection Count</span>
              <span className="text-3xl font-black text-white block">{stats.totalHazardsDetected}</span>
              <p className="text-[11px] text-slate-400">Total detected hazard instances</p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-1">
              <span className="text-slate-500 uppercase text-[10px] tracking-wider font-bold block">High Risk %</span>
              <span className="text-3xl font-black text-red-400 block">
                {stats.totalAnalyses > 0 ? Math.round((stats.highRiskHazards / stats.totalAnalyses) * 100) : 0}%
              </span>
              <p className="text-[11px] text-slate-400">Critical & High severity ratio</p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-1">
              <span className="text-slate-500 uppercase text-[10px] tracking-wider font-bold block">Avg Confidence</span>
              <span className="text-3xl font-black text-brand-400 block">{stats.avgConfidence}%</span>
              <p className="text-[11px] text-slate-400">Neural detection certainty</p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-1">
              <span className="text-slate-500 uppercase text-[10px] tracking-wider font-bold block">GPS Tagged</span>
              <span className="text-3xl font-black text-emerald-400 block">{stats.hasGPSCount} / {stats.totalAnalyses}</span>
              <p className="text-[11px] text-slate-400">Geospatially confirmed points</p>
            </div>
          </div>

          {/* Hazard Distribution By Type (6 Cols) */}
          <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-400" />
                Hazard Distribution
              </h2>
              <span className="text-xs font-mono text-slate-500">{totalTypesCount} instances</span>
            </div>

            <div className="space-y-3.5 font-mono text-xs">
              {typeEntries.length === 0 ? (
                <p className="text-slate-500">No defect types recorded yet.</p>
              ) : (
                typeEntries.map(([type, count]) => {
                  const pct = totalTypesCount > 0 ? Math.round((count / totalTypesCount) * 100) : 0;
                  return (
                    <div key={type} className="space-y-1.5">
                      <div className="flex justify-between text-slate-300">
                        <span className="font-semibold uppercase">{type}</span>
                        <span className="text-brand-400 font-bold">{count} ({pct}%)</span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-indigo-500 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Risk Distribution (6 Cols) */}
          <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Risk Distribution
              </h2>
              <span className="text-xs font-mono text-slate-500">{stats.totalAnalyses} records</span>
            </div>

            <div className="space-y-3.5 font-mono text-xs">
              {severityData.map((item) => {
                const pct = stats.totalAnalyses > 0 ? Math.round((item.count / stats.totalAnalyses) * 100) : 0;
                return (
                  <div key={item.label} className="space-y-1.5">
                    <div className="flex justify-between text-slate-300">
                      <span className="font-semibold">{item.label} RISK</span>
                      <span className={`${item.text} font-bold`}>{item.count} ({pct}%)</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                      <div
                        className={`h-full rounded-full ${item.color} transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
