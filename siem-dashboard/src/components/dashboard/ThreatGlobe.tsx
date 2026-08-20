'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Globe, Map, RefreshCw } from 'lucide-react';
import ReactCountryFlag from 'react-country-flag';
import { authFetch } from '@/utils/auth';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from 'react-simple-maps';

// Dynamic import to avoid SSR issues with react-globe.gl
const GlobeGL = dynamic(() => import('react-globe.gl'), { ssr: false });

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

interface ThreatPoint {
  countryCode: string;
  country: string;
  lat: number;
  lng: number;
  count: number;
}

interface GlobeData {
  threats: ThreatPoint[];
  totalCountries: number;
  totalAttacks: number;
}

type ViewMode = 'globe' | 'map';

export default function ThreatGlobe() {
  const [data, setData] = useState<GlobeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('globe');
  const globeRef = useRef<any>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await authFetch('/api/dashboard/geo-threats');
      if (!res.ok) { setData(null); return; }
      const json = await res.json();
      if (json.threats) setData(json);
    } catch (err) {
      console.error('Failed to fetch geo-threats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-rotate globe
  useEffect(() => {
    if (viewMode === 'globe' && globeRef.current) {
      const controls = globeRef.current.controls();
      if (controls) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.5;
        controls.enableZoom = true;
      }
    }
  }, [data, viewMode]);

  const maxCount = data?.threats?.length
    ? Math.max(...data.threats.map((t) => t.count))
    : 1;

  // Prepare points data for globe
  const pointsData = data?.threats?.map((t) => ({
    lat: t.lat,
    lng: t.lng,
    size: 0.3 + (t.count / maxCount) * 0.7,
    color: t.count > maxCount * 0.7 ? '#ef4444' : t.count > maxCount * 0.3 ? '#f59e0b' : '#3b82f6',
    label: `${t.country}: ${t.count} threats`,
    country: t.country,
    countryCode: t.countryCode,
    count: t.count,
  })) || [];

  // Arcs from threat origins to "server location" (Indonesia)
  const arcsData = data?.threats?.slice(0, 10).map((t) => ({
    startLat: t.lat,
    startLng: t.lng,
    endLat: -0.79,
    endLng: 113.92,
    color: t.count > maxCount * 0.5 ? ['#ef444480', '#ef444420'] : ['#3b82f680', '#3b82f620'],
    stroke: 0.3 + (t.count / maxCount) * 0.5,
  })) || [];

  const topThreats = data?.threats?.slice(0, 5) || [];

  // Map marker radius: proportional, min 4px max 20px
  const markerRadius = (count: number) =>
    Math.max(4, Math.min(20, 4 + (count / maxCount) * 16));

  return (
    <div className="bg-[#0b1120] border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl shadow-black/20 flex flex-col">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-slate-700/40">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-red-500/10">
            {viewMode === 'globe'
              ? <Globe size={16} className="text-red-400" />
              : <Map size={16} className="text-red-400" />
            }
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">Threat Map</h3>
            <p className="text-[10px] text-slate-500 font-medium">
              {data ? `${data.totalCountries} countries · ${data.totalAttacks} attacks` : 'Loading...'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex bg-slate-800/60 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('globe')}
              title="3D Globe"
              className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                viewMode === 'globe'
                  ? 'bg-red-500/20 text-red-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Globe size={11} />
              Globe
            </button>
            <button
              onClick={() => setViewMode('map')}
              title="2D Flat Map"
              className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                viewMode === 'map'
                  ? 'bg-red-500/20 text-red-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Map size={11} />
              Map
            </button>
          </div>

          <button
            onClick={fetchData}
            className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Globe + Sidebar */}
      <div className="flex flex-1 min-h-[320px]">
        {/* Visualization area */}
        <div className="flex-1 relative flex items-center justify-center" style={{ minHeight: 320 }}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw size={24} className="animate-spin text-blue-400" />
            </div>
          ) : viewMode === 'globe' ? (
            /* ─── 3D Globe ─── */
            <GlobeGL
              ref={globeRef}
              width={360}
              height={320}
              backgroundColor="rgba(0,0,0,0)"
              globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
              atmosphereColor="#3b82f6"
              atmosphereAltitude={0.15}
              // Points
              pointsData={pointsData}
              pointAltitude={(d: any) => d.size * 0.05}
              pointRadius={(d: any) => d.size * 0.6}
              pointColor={(d: any) => d.color}
              pointLabel={(d: any) => `
                <div style="background: #1e293b; padding: 6px 10px; border-radius: 8px; border: 1px solid #334155; font-size: 11px; color: #e2e8f0; font-family: system-ui;">
                  <b>${d.country}</b><br/>
                  <span style="color: #ef4444;">${d.count} threats</span>
                </div>
              `}
              // Arcs
              arcsData={arcsData}
              arcStartLat={(d: any) => d.startLat}
              arcStartLng={(d: any) => d.startLng}
              arcEndLat={(d: any) => d.endLat}
              arcEndLng={(d: any) => d.endLng}
              arcColor={(d: any) => d.color}
              arcStroke={(d: any) => d.stroke}
              arcDashLength={0.6}
              arcDashGap={0.3}
              arcDashAnimateTime={2000}
            />
          ) : (
            /* ─── 2D Flat Map ─── */
            <div className="relative w-full h-full" style={{ minHeight: 320 }}>
              <ComposableMap
                projectionConfig={{ scale: 130 }}
                style={{ width: '100%', height: '100%' }}
                height={320}
              >
                <ZoomableGroup zoom={1} minZoom={0.8} maxZoom={5}>
                  <Geographies geography={GEO_URL}>
                    {({ geographies }) =>
                      geographies.map((geo) => (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          style={{
                            default: { fill: '#1e293b', stroke: '#334155', strokeWidth: 0.4, outline: 'none' },
                            hover:   { fill: '#273548', stroke: '#475569', strokeWidth: 0.4, outline: 'none' },
                            pressed: { fill: '#1e293b', outline: 'none' },
                          }}
                        />
                      ))
                    }
                  </Geographies>

                  {/* Threat markers */}
                  {(data?.threats || []).map((t) => {
                    const r = markerRadius(t.count);
                    const isCritical = t.count > maxCount * 0.7;
                    const isHigh = t.count > maxCount * 0.3;
                    const color = isCritical ? '#ef4444' : isHigh ? '#f59e0b' : '#3b82f6';
                    return (
                      <Marker key={t.countryCode} coordinates={[t.lng, t.lat]}>
                        {/* Pulse ring */}
                        <circle
                          r={r + 4}
                          fill="none"
                          stroke={color}
                          strokeWidth={1}
                          strokeOpacity={0.3}
                        />
                        {/* Core dot */}
                        <circle
                          r={r}
                          fill={color}
                          fillOpacity={0.8}
                          stroke={color}
                          strokeWidth={0.5}
                        />
                        {/* Tooltip on hover via title */}
                        <title>{t.country}: {t.count} threats</title>
                      </Marker>
                    );
                  })}
                </ZoomableGroup>
              </ComposableMap>

              {/* Legend */}
              <div className="absolute bottom-3 left-3 flex items-center gap-3 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-700/50">
                <LegendDot color="#ef4444" label="Critical" />
                <LegendDot color="#f59e0b" label="High" />
                <LegendDot color="#3b82f6" label="Low" />
              </div>
            </div>
          )}
        </div>

        {/* Top Threats Sidebar */}
        <div className="w-44 border-l border-slate-700/40 px-3 py-3 space-y-1.5 overflow-y-auto">
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2">
            Top Origins
          </p>
          {topThreats.map((t, i) => (
            <div
              key={t.countryCode}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
            >
              <span className="text-[10px] font-bold text-slate-500 w-4">{i + 1}</span>
              <ReactCountryFlag
                countryCode={t.countryCode}
                svg
                className="text-base rounded-sm"
              />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-slate-300 truncate">{t.country}</p>
                <p className="text-[10px] text-red-400 font-mono">{t.count} hits</p>
              </div>
            </div>
          ))}
          {topThreats.length === 0 && !loading && (
            <p className="text-[11px] text-slate-600 text-center py-4">No threat data</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Legend dot helper ─── */
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[9px] text-slate-500 font-medium">{label}</span>
    </div>
  );
}
