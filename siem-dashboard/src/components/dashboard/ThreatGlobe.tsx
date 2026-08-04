'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Globe, RefreshCw } from 'lucide-react';
import ReactCountryFlag from 'react-country-flag';
import { authFetch } from '@/utils/auth';

// Dynamic import to avoid SSR issues with react-globe.gl
const GlobeGL = dynamic(() => import('react-globe.gl'), { ssr: false });

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

export default function ThreatGlobe() {
  const [data, setData] = useState<GlobeData | null>(null);
  const [loading, setLoading] = useState(true);
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
    if (globeRef.current) {
      const controls = globeRef.current.controls();
      if (controls) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.5;
        controls.enableZoom = true;
      }
    }
  }, [data]);

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

  return (
    <div className="bg-[#0b1120] border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl shadow-black/20 flex flex-col">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-slate-700/40">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-red-500/10">
            <Globe size={16} className="text-red-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">Threat Map</h3>
            <p className="text-[10px] text-slate-500 font-medium">
              {data ? `${data.totalCountries} countries · ${data.totalAttacks} attacks` : 'Loading...'}
            </p>
          </div>
        </div>
        <button
          onClick={fetchData}
          className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Globe + Sidebar */}
      <div className="flex flex-1 min-h-[320px]">
        {/* Globe */}
        <div className="flex-1 relative flex items-center justify-center" style={{ minHeight: 320 }}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw size={24} className="animate-spin text-blue-400" />
            </div>
          ) : (
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
