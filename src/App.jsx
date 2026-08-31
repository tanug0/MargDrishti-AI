import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import AnalyzeRoad from './components/AnalyzeRoad';
import LiveCamera from './components/LiveCamera';
import HazardMap from './components/HazardMap';
import HistoryView from './components/HistoryView';
import AnalyticsView from './components/AnalyticsView';
import { modelManager } from './ai/modelManager';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard'); // Command Center default
  const [modelReady, setModelReady] = useState(false);
  const [lastSavedHazard, setLastSavedHazard] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Preload primary models in background
    modelManager.preloadModels()
      .then(() => setModelReady(true))
      .catch(e => console.warn('Preload note:', e));
  }, []);

  const handleHazardSaved = (hazard) => {
    setLastSavedHazard(hazard);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row font-sans selection:bg-brand-500 selection:text-white">
      {/* Left Sidebar on Desktop & Top Navbar on Mobile */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        modelStatus={modelReady}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />

      {/* Main Command Center Content View */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen lg:h-screen lg:overflow-y-auto">
        <main className="flex-1 pb-8">
          {activeTab === 'dashboard' && (
            <Dashboard setActiveTab={setActiveTab} />
          )}

          {activeTab === 'analyze' && (
            <AnalyzeRoad 
              onHazardSaved={handleHazardSaved} 
            />
          )}

          {activeTab === 'camera' && (
            <LiveCamera 
              onHazardSaved={handleHazardSaved} 
            />
          )}

          {activeTab === 'map' && (
            <HazardMap />
          )}

          {activeTab === 'history' && (
            <HistoryView 
              onSelectHazardForMap={() => setActiveTab('map')} 
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView />
          )}
        </main>

        {/* Command Center Minimal Footer */}
        <footer className="border-t border-slate-900/80 bg-slate-950/80 py-4 px-6 text-center text-xs font-mono text-slate-500">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>MARGDRISHTI AI • "See the Hazard. Predict the Risk. Protect the Road."</span>
            <span className="text-slate-600">Client-Side ONNX Runtime Web WASM • RDD2022 Benchmark</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
