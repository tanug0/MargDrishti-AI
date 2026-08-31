import React, { useState, useEffect } from 'react';
import { 
  History, 
  Trash2, 
  Download, 
  Filter, 
  MapPin, 
  Calendar, 
  AlertTriangle, 
  Eye, 
  X,
  Clock,
  ShieldAlert,
  Layers,
  FileSpreadsheet
} from 'lucide-react';
import { storageService } from '../services/storageService';

export default function HistoryView({ onSelectHazardForMap }) {
  const [records, setRecords] = useState([]);
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'grid'

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = () => {
    setRecords(storageService.getHazards());
  };

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this hazard record?')) {
      storageService.deleteHazard(id);
      loadRecords();
      if (selectedRecord?.id === id) {
        setSelectedRecord(null);
      }
    }
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to delete all saved hazard records? This action cannot be undone.')) {
      storageService.clearAll();
      loadRecords();
      setSelectedRecord(null);
    }
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(records, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `margdrishti_hazard_logs_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const filteredRecords = records.filter(r => 
    severityFilter === 'ALL' ? true : r.severity === severityFilter
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 backdrop-blur-xl shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5 font-mono uppercase">
              <History className="w-6 h-6 text-brand-400" />
              DETECTION HISTORY
            </h1>
            <p className="text-sm text-slate-400 mt-1 font-sans">
              "Chronological audit log of confirmed road hazard inferences"
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {records.length > 0 && (
              <>
                <button
                  onClick={handleExportJSON}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-bold transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-brand-400" />
                  <span>EXPORT JSON</span>
                </button>

                <button
                  onClick={handleClearAll}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/60 text-xs font-mono font-bold transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>CLEAR ALL</span>
                </button>
              </>
            )}

            {/* Severity Filter */}
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-slate-900">All Severities ({records.length})</option>
                <option value="CRITICAL" className="bg-slate-900">Critical ({records.filter(r => r.severity === 'CRITICAL').length})</option>
                <option value="HIGH" className="bg-slate-900">High Risk ({records.filter(r => r.severity === 'HIGH').length})</option>
                <option value="MEDIUM" className="bg-slate-900">Medium Risk ({records.filter(r => r.severity === 'MEDIUM').length})</option>
                <option value="LOW" className="bg-slate-900">Low Risk ({records.filter(r => r.severity === 'LOW').length})</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* History Content */}
      {records.length === 0 ? (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-16 text-center space-y-3 font-mono">
          <Layers className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-200 uppercase">No Hazard Records Yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto font-sans">
            Analyze road images using the "Analyze Road" tab or live camera to record detected defects into this log.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {/* Responsive Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4 font-bold">TIME</th>
                  <th className="py-3.5 px-4 font-bold">HAZARD</th>
                  <th className="py-3.5 px-4 font-bold">CONFIDENCE</th>
                  <th className="py-3.5 px-4 font-bold">RISK</th>
                  <th className="py-3.5 px-4 font-bold">LOCATION</th>
                  <th className="py-3.5 px-4 font-bold">SOURCE</th>
                  <th className="py-3.5 px-4 font-bold text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-950/40 transition-colors">
                    <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        <span>{new Date(rec.timestamp).toLocaleString()}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-bold text-white whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        {rec.thumbnail ? (
                          <img 
                            src={rec.thumbnail} 
                            alt="" 
                            className="w-8 h-8 rounded-lg object-cover border border-slate-800" 
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-amber-400">
                            <AlertTriangle className="w-4 h-4" />
                          </div>
                        )}
                        <span className="uppercase">{rec.hazardType}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-brand-400 font-bold whitespace-nowrap">
                      {rec.confidencePct}%
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
                        rec.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-300 border-red-500/40' :
                        rec.severity === 'HIGH' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                        'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
                      }`}>
                        {rec.severity}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                      {rec.location ? (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          <span>{rec.location.latitude.toFixed(4)}, {rec.location.longitude.toFixed(4)}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500">Location unavailable</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                      <span className="truncate max-w-[140px] block text-[11px]">
                        {rec.modelUsed}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedRecord(rec)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-brand-300 font-bold text-[11px] transition-colors"
                        >
                          Inspect
                        </button>
                        <button
                          onClick={() => handleDelete(rec.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Inspection Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl space-y-4 p-6 animate-in fade-in zoom-in-95 font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2 uppercase">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Detection Log Inspection
              </h3>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedRecord.thumbnail && (
              <img
                src={selectedRecord.thumbnail}
                alt="Hazard"
                className="w-full h-48 object-cover rounded-xl border border-slate-800"
              />
            )}

            <div className="space-y-2 text-xs text-slate-300">
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Hazard Type</span>
                  <span className="font-bold text-white uppercase">{selectedRecord.hazardType}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Confidence</span>
                  <span className="font-bold text-brand-400">{selectedRecord.confidencePct}%</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Risk Severity</span>
                  <span className="font-bold text-red-400 uppercase">{selectedRecord.severity}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Inference Time</span>
                  <span className="font-bold text-emerald-400">{selectedRecord.inferenceTimeMs || 0} ms</span>
                </div>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Audit Timestamp:</span>
                <span className="text-slate-200">{new Date(selectedRecord.timestamp).toLocaleString()}</span>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Model Source:</span>
                <span className="text-slate-200">{selectedRecord.modelUsed}</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setSelectedRecord(null)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
