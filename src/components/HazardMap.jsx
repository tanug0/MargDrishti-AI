import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { 
  MapPin, 
  Layers, 
  Filter, 
  ShieldAlert, 
  Navigation, 
  Calendar, 
  ExternalLink,
  AlertTriangle,
  Compass,
  Radio,
  Eye
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { getCurrentGPSPosition } from '../services/geoService';

// Fix standard Leaflet icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom SVG Pin Generator by Severity
function createCustomPin(severity = 'HIGH') {
  let color = '#ef4444'; // CRITICAL / HIGH
  if (severity === 'MEDIUM') color = '#f59e0b';
  if (severity === 'LOW') color = '#10b981';

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="28" height="42">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24c0-6.63-5.37-12-12-12z" fill="${color}" stroke="#070b12" stroke-width="2"/>
      <circle cx="12" cy="12" r="5" fill="#ffffff"/>
      <circle cx="12" cy="12" r="2.5" fill="${color}"/>
    </svg>
  `;

  return L.divIcon({
    className: 'custom-map-pin',
    html: svg,
    iconSize: [28, 42],
    iconAnchor: [14, 42],
    popupAnchor: [0, -38]
  });
}

export default function HazardMap() {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);

  const [hazards, setHazards] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const [selectedHazard, setSelectedHazard] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [gpsError, setGpsError] = useState(null);

  // Load saved hazards
  useEffect(() => {
    const records = storageService.getHazards();
    const geoHazards = records.filter(
      r => r.location && r.location.latitude && r.location.longitude
    );
    setHazards(geoHazards);
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const defaultLat = hazards.length > 0 ? hazards[0].location.latitude : 20.5937;
      const defaultLng = hazards.length > 0 ? hazards[0].location.longitude : 78.9629;
      const defaultZoom = hazards.length > 0 ? 14 : 5;

      const map = L.map(mapContainerRef.current, {
        center: [defaultLat, defaultLng],
        zoom: defaultZoom,
        zoomControl: false
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> & OpenStreetMap',
        maxZoom: 19
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update map markers when hazards or filter changes
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();

    const filtered = hazards.filter(h => {
      if (selectedFilter === 'ALL') return true;
      if (selectedFilter === 'POTHOLES') return h.hazardClass === 'pothole' || h.hazardType?.toLowerCase().includes('pothole');
      if (selectedFilter === 'CRACKS') return h.hazardClass?.includes('crack') || h.hazardType?.toLowerCase().includes('crack');
      if (selectedFilter === 'OBSTACLES') return h.hazardClass === 'obstacle' || h.hazardType?.toLowerCase().includes('obstacle');
      if (selectedFilter === 'HIGH_RISK') return h.severity === 'CRITICAL' || h.severity === 'HIGH';
      return true;
    });

    const bounds = [];

    filtered.forEach(h => {
      const { latitude, longitude } = h.location;
      const latLng = [latitude, longitude];
      bounds.push(latLng);

      const marker = L.marker(latLng, {
        icon: createCustomPin(h.severity)
      });

      const popupHtml = `
        <div style="font-family: inherit; font-size: 12px; line-height: 1.4; min-width: 190px; color: #f8fafc;">
          ${h.thumbnail ? `<img src="${h.thumbnail}" style="width: 100%; height: 95px; object-fit: cover; border-radius: 8px; margin-bottom: 8px; border: 1px solid #334155;" />` : ''}
          <div style="font-weight: 800; font-size: 13px; color: #ffffff; margin-bottom: 4px; text-transform: uppercase; font-family: monospace;">
            ${h.hazardType}
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px; font-family: monospace;">
            <span style="color: #94a3b8;">Confidence:</span>
            <span style="color: #818cf8; font-weight: bold;">${h.confidencePct}%</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px; font-family: monospace;">
            <span style="color: #94a3b8;">Risk Level:</span>
            <span style="color: ${h.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b'}; font-weight: bold;">${h.severity}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px; font-family: monospace; font-size: 10px;">
            <span style="color: #64748b;">Coordinates:</span>
            <span style="color: #cbd5e1;">${latitude.toFixed(4)}, ${longitude.toFixed(4)}</span>
          </div>
          <div style="font-size: 10px; color: #64748b; font-family: monospace; margin-top: 4px; border-top: 1px solid #334155; pt-1;">
            ${new Date(h.timestamp).toLocaleString()}
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      marker.on('click', () => setSelectedHazard(h));
      markersLayerRef.current.addLayer(marker);
    });

    if (bounds.length > 0 && mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [hazards, selectedFilter]);

  const handleLocateMe = async () => {
    setIsLocating(true);
    setGpsError(null);

    const gps = await getCurrentGPSPosition();
    if (gps.available && gps.coords && mapInstanceRef.current) {
      const { latitude, longitude } = gps.coords;
      mapInstanceRef.current.setView([latitude, longitude], 15);

      L.circleMarker([latitude, longitude], {
        radius: 8,
        color: '#6366f1',
        fillColor: '#818cf8',
        fillOpacity: 0.8
      }).addTo(mapInstanceRef.current).bindPopup('Your Current Location').openPopup();
    } else {
      setGpsError(gps.error || 'Location unavailable');
    }
    setIsLocating(false);
  };

  const handleFocusHazard = (hazard) => {
    setSelectedHazard(hazard);
    if (mapInstanceRef.current && hazard.location) {
      mapInstanceRef.current.setView([hazard.location.latitude, hazard.location.longitude], 16);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 backdrop-blur-xl shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5 font-mono uppercase">
              <MapPin className="w-6 h-6 text-brand-400" />
              LIVE HAZARD MAP
            </h1>
            <p className="text-sm text-slate-400 mt-1 font-sans">
              "Geospatial intelligence from confirmed road hazards"
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleLocateMe}
              disabled={isLocating}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-bold transition-colors"
            >
              <Compass className={`w-4 h-4 text-brand-400 ${isLocating ? 'animate-spin' : ''}`} />
              <span>LOCATE ME</span>
            </button>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs font-mono">
              {[
                { id: 'ALL', label: 'ALL' },
                { id: 'POTHOLES', label: 'POTHOLES' },
                { id: 'CRACKS', label: 'CRACKS' },
                { id: 'OBSTACLES', label: 'OBSTACLES' },
                { id: 'HIGH_RISK', label: 'HIGH RISK' }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFilter(f.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                    selectedFilter === f.id
                      ? 'bg-brand-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {gpsError && (
        <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs font-mono">
          ⚠ {gpsError}
        </div>
      )}

      {/* Main Map + Sidebar Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Leaflet Map Canvas (8 Cols) */}
        <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative">
          <div 
            ref={mapContainerRef} 
            className="w-full h-[560px] z-10"
          />

          {/* Map Legend Overlay */}
          <div className="absolute bottom-4 left-4 z-20 bg-slate-950/90 backdrop-blur-md border border-slate-800 p-3.5 rounded-xl shadow-lg font-mono text-[11px] space-y-1.5">
            <span className="text-slate-400 font-bold block mb-1 uppercase tracking-wider">Hazard Severity</span>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500"></span>
              <span className="text-slate-300 font-medium">Critical / High Risk</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500"></span>
              <span className="text-slate-300 font-medium">Medium Risk Crack</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              <span className="text-slate-300 font-medium">Low Risk Anomaly</span>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Geotagged Hazards Feed (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
                <Navigation className="w-4 h-4 text-brand-400" />
                Geotagged Hazards ({hazards.length})
              </h3>
              <span className="text-[11px] font-mono text-slate-500">
                {hazards.length === 0 ? 'No GPS logs' : 'Confirmed Pins'}
              </span>
            </div>

            {hazards.length === 0 ? (
              <div className="text-center py-14 px-4 space-y-2 font-mono">
                <MapPin className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm font-semibold text-slate-300">No Geotagged Hazards Stored</p>
                <p className="text-xs text-slate-500 font-sans">
                  Analyze a road image in the "Analyze Road" tab and click "Tag Real GPS & Save Hazard" to record points on this map.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {hazards.map((h) => {
                  const isSelected = selectedHazard?.id === h.id;
                  return (
                    <div
                      key={h.id}
                      onClick={() => handleFocusHazard(h)}
                      className={`p-3 rounded-xl border text-xs font-mono cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-brand-600/25 border-brand-500 text-white'
                          : 'bg-slate-950/80 border-slate-800/80 text-slate-300 hover:border-slate-700 hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                            h.severity === 'CRITICAL' || h.severity === 'HIGH' ? 'bg-red-500' : 'bg-amber-400'
                          }`} />
                          <span className="font-bold text-white truncate uppercase">{h.hazardType}</span>
                        </div>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                          h.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {h.severity}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-400 text-[11px] mt-2 pt-2 border-t border-slate-800/60">
                        <span>Conf: {h.confidencePct}%</span>
                        <span className="text-[10px] text-slate-500">
                          {h.location.latitude.toFixed(4)}, {h.location.longitude.toFixed(4)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
