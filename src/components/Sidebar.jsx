import React from 'react';
import { 
  ShieldAlert, 
  LayoutDashboard, 
  Scan, 
  Camera, 
  MapPin, 
  History, 
  BarChart3, 
  Cpu, 
  Zap,
  Activity,
  CheckCircle2,
  Radio,
  Menu,
  X
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, modelStatus, mobileMenuOpen, setMobileMenuOpen }) {
  const navItems = [
    { id: 'dashboard', label: 'Command Center', icon: LayoutDashboard, badge: null },
    { id: 'analyze', label: 'Analyze Road', icon: Scan, badge: 'Core AI' },
    { id: 'camera', label: 'Live Monitoring', icon: Camera, badge: 'Real-time' },
    { id: 'map', label: 'Hazard Map', icon: MapPin, badge: null },
    { id: 'history', label: 'Detection History', icon: History, badge: null },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, badge: null },
  ];

  return (
    <>
      {/* Desktop Sidebar (Left Fixed) */}
      <aside className="hidden lg:flex flex-col w-64 xl:w-72 bg-slate-950/95 border-r border-slate-800/80 backdrop-blur-xl h-screen sticky top-0 z-40 select-none">
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-800/80">
          <div 
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-3.5 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-brand-500 to-amber-400 p-0.5 shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform duration-300">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-wider bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                  MARGDRISHTI AI
                </span>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold block">
                Road Safety Command
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2.5 font-medium leading-relaxed">
            "See the Hazard. Predict the Risk. Protect the Road."
          </p>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <p className="px-3 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 mb-2">
            Navigation Modules
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-mono font-semibold transition-all duration-200 group ${
                  isActive
                    ? 'bg-brand-600/20 text-brand-300 border border-brand-500/40 shadow-sm shadow-brand-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 transition-colors ${
                    isActive ? 'text-brand-400' : 'text-slate-500 group-hover:text-slate-300'
                  }`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full font-bold uppercase ${
                    isActive 
                      ? 'bg-brand-500/30 text-brand-200 border border-brand-400/40' 
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom System Status Widget */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/60 font-mono">
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-brand-400" />
                AI ENGINE
              </span>
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                ONLINE
              </span>
            </div>

            <div className="space-y-1 text-[10px] text-slate-400 border-t border-slate-800/80 pt-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Runtime:</span>
                <span className="text-slate-300">ONNX WASM SIMD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Latency:</span>
                <span className="text-emerald-400 font-semibold">Zero Server Lag</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Models:</span>
                <span className="text-slate-300">Pothole + RDD2022</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Top Navigation Bar */}
      <header className="lg:hidden sticky top-0 z-40 bg-slate-950/95 border-b border-slate-800 backdrop-blur-xl px-4 py-3">
        <div className="flex items-center justify-between">
          <div 
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-amber-400 p-0.5 shadow-md">
              <div className="w-full h-full bg-slate-950 rounded-[6px] flex items-center justify-center">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
              </div>
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-wide text-white">
                MARGDRISHTI AI
              </span>
              <span className="text-[9px] font-mono text-slate-400 block leading-none">
                Command Center
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              AI READY
            </span>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="pt-3 pb-2 space-y-1 border-t border-slate-800/80 mt-3 animate-in fade-in">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-mono font-semibold ${
                    isActive
                      ? 'bg-brand-600/20 text-brand-300 border border-brand-500/40'
                      : 'text-slate-400 hover:bg-slate-900 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </header>
    </>
  );
}
