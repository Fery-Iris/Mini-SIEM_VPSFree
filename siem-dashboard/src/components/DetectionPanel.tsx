import type { FC } from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Radar,
  Menu,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  ShieldAlert,
  Activity
} from 'lucide-react';

const API = '';
const POLL_INTERVAL = 10_000;

import { authFetch } from '../utils/auth';
import { useLanguage } from '../contexts/LanguageContext';
import { useSidebar } from '../contexts/SidebarContext';

/* ─────────────────────────── Types ─────────────────────────── */

interface ThreatRow {
  attackType: string;
  sourceIp: string;
  publicIp: string;
  severity: string;
  latestUpdate: string;
  countryCode: string;
  country: string;
  lat: number;
  lng: number;
  score: number;
  accumulatedScore: number;
  matchedRules: string[];
  decision: string;
}

interface CrowdSecStatus {
  connected: boolean;
  lapi_url: string;
  machine_id: string;
  alerts_stored: number;
  scenario: string;
}

const SEVERITY_STYLES: Record<string, string> = {
  Critical: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  High: 'bg-red-500/10 text-red-400 border-red-500/20',
  Medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Low: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
};

const BLOCK_BTN_STYLES: Record<string, string> = {
  Critical: 'border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/50',
  High: 'border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50',
  Medium: 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/50',
  Low: 'border-slate-500/30 text-slate-400 hover:bg-slate-500/10 hover:border-slate-500/50',
};

/* ─────────────────── Components ─────────────────── */

const CrowdSecStatusBadge: FC<{ status: CrowdSecStatus | null; loading: boolean }> = ({ status, loading }) => {
  const { t } = useLanguage();
  if (loading) return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 text-slate-400 text-xs font-semibold">
      <Loader2 size={14} className="animate-spin" />{t('detection.connecting')}
    </div>
  );
  if (!status) return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-semibold border border-red-500/20">
      <XCircle size={14} />{t('detection.offline')}
    </div>
  );
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border ${status.connected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
      {status.connected ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
      <span>CrowdSec {status.connected ? t('detection.connected') : t('detection.disconnected')}</span>
      <span className="text-[10px] opacity-60">|</span>
      <span className="text-[10px] opacity-70">{status.alerts_stored} {t('detection.alerts')}</span>
    </div>
  );
};

const ScoreBar: FC<{ score: number; maxScore: number }> = ({ score, maxScore }) => {
  const ratio = Math.min(score / maxScore, 1);
  const percent = ratio * 100;
  let color = 'bg-emerald-400';
  if (percent >= 100) color = 'bg-rose-500 animate-pulse';
  else if (percent >= 70) color = 'bg-amber-400';
  return (
    <div className="w-24">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] font-mono text-slate-400">Score</span>
        <span className={`text-[10px] font-mono font-bold ${percent >= 100 ? 'text-rose-400' : 'text-slate-300'}`}>{score}/{maxScore}</span>
      </div>
      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};

const DecisionBadge: FC<{ decision: string }> = ({ decision }) => {
  switch (decision?.toUpperCase()) {
    case 'BLOCK': return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20"><ShieldAlert size={10} /> BLOCK</span>;
    case 'ALERT': return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20"><Activity size={10} /> ALERT</span>;
    default: return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20">LOG</span>;
  }
};

const ThreatTable: FC<{
  threats: ThreatRow[];
  loading: boolean;
  onRefresh: () => void;
  onBlock: (ip: string) => void;
  blockingIps: Set<string>;
  blockThreshold: number;
}> = ({ threats, loading, onRefresh, onBlock, blockingIps, blockThreshold }) => {
  const { t } = useLanguage();
  return (
    <div className="bg-[#0b1120] border border-slate-800 rounded-2xl shadow-xl shadow-black/20 overflow-hidden">
      <div className="px-6 py-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-500/20"><Radar size={16} /></div>
          <div>
            <h1 className="text-base font-bold text-slate-100">{t('detection.title')}</h1>
            <p className="text-[11px] text-slate-400">Real-time threat monitoring and scoring</p>
          </div>
        </div>
        <button onClick={onRefresh} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all disabled:opacity-50">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />{t('detection.refresh')}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-800 bg-slate-900/30">
              <th className="px-4 py-3 font-semibold pl-6">{t('detection.colAttack')}</th>
              <th className="px-4 py-3 font-semibold">{t('detection.colSource')}</th>
              <th className="px-4 py-3 font-semibold">Rules</th>
              <th className="px-4 py-3 font-semibold">Score</th>
              <th className="px-4 py-3 font-semibold">Acc. Score</th>
              <th className="px-4 py-3 font-semibold">Decision</th>
              <th className="px-4 py-3 font-semibold">{t('detection.colSeverity')}</th>
              <th className="px-4 py-3 font-semibold text-right pr-6">{t('detection.colAction')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {threats.length === 0 ? (
              <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-400 text-sm">
                {loading ? <div className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin text-indigo-400" />{t('detection.loadingThreats')}</div> : t('detection.noThreats')}
              </td></tr>
            ) : threats.map((row, i) => (
              <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                <td className="px-4 py-3.5 pl-6 font-semibold text-slate-200">{row.attackType}</td>
                <td className="px-4 py-3.5 font-mono text-xs text-slate-300">{row.sourceIp}</td>
                <td className="px-4 py-3.5">
                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {(row.matchedRules || []).slice(0, 3).map((rule, idx) => (
                      <span key={idx} className="text-[9px] font-mono bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700 truncate max-w-[120px]">{rule}</span>
                    ))}
                    {(row.matchedRules || []).length > 3 && <span className="text-[9px] font-mono text-slate-500">+{row.matchedRules.length - 3}</span>}
                  </div>
                </td>
                <td className="px-4 py-3.5"><span className={`text-xs font-bold font-mono ${row.score >= 12 ? 'text-rose-400' : row.score >= 8 ? 'text-amber-400' : 'text-slate-300'}`}>+{row.score || 0}</span></td>
                <td className="px-4 py-3.5"><ScoreBar score={row.accumulatedScore || row.score || 0} maxScore={blockThreshold} /></td>
                <td className="px-4 py-3.5"><DecisionBadge decision={row.decision} /></td>
                <td className="px-4 py-3.5"><span className={`text-[10px] font-bold px-2 py-1 rounded-full border uppercase tracking-wider ${SEVERITY_STYLES[row.severity] || SEVERITY_STYLES.Low}`}>{t(`severity.${(row.severity || 'low').toLowerCase()}`) || row.severity}</span></td>
                <td className="px-4 py-3.5 text-right pr-6">
                  <button onClick={() => onBlock(row.sourceIp)} disabled={blockingIps.has(row.sourceIp) || row.decision?.toUpperCase() === 'BLOCK'}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${blockingIps.has(row.sourceIp) || row.decision?.toUpperCase() === 'BLOCK' ? 'bg-slate-800 text-slate-500 cursor-not-allowed border-slate-700' : (BLOCK_BTN_STYLES[row.severity] || BLOCK_BTN_STYLES.Low)}`}>
                    {blockingIps.has(row.sourceIp) || row.decision?.toUpperCase() === 'BLOCK' ? 'Blocked' : 'Block'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ActiveResponseFeed: FC<{ threats: ThreatRow[]; blockThreshold: number }> = ({ threats, blockThreshold }) => {
  const feed = threats.filter(t => t.decision === 'BLOCK' || t.decision === 'ALERT').slice(0, 5);
  return (
    <div className="bg-[#0b1120] border border-slate-800 rounded-2xl shadow-xl shadow-black/20 overflow-hidden flex flex-col h-full">
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex items-center gap-2">
        <Activity size={16} className="text-indigo-400" />
        <h3 className="text-sm font-bold text-slate-100">Active Response Feed</h3>
      </div>
      <div className="flex-1 p-4 overflow-y-auto">
        {feed.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-500">No active responses yet.</div>
        ) : (
          <div className="space-y-3">
            {feed.map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/30 border border-slate-800/50">
                <div className="shrink-0 mt-0.5">{item.decision === 'BLOCK' ? <ShieldAlert size={14} className="text-rose-400" /> : <Activity size={14} className="text-amber-400" />}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-200 truncate">{item.sourceIp}</span>
                    <span className="text-[10px] text-slate-500">{new Date(item.latestUpdate).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">{item.attackType}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${item.decision === 'BLOCK' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>{item.decision}</span>
                    <span className="text-[10px] font-mono text-slate-500">Score: {item.accumulatedScore}/{blockThreshold}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const THREAT_COLORS = ['#22d3ee', '#fb923c', '#f87171', '#a78bfa', '#34d399', '#f472b6'];
const SOC_CENTER = { lat: -6.2088, lng: 106.8456 };

const LiveThreatViz: FC<{ threats: ThreatRow[] }> = ({ threats }) => {
  const globeRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [globeSize, setGlobeSize] = useState({ width: 600, height: 450 });
  const [GlobeComponent, setGlobeComponent] = useState<any>(null);
  const { t } = useLanguage();

  const ipMap = new Map<string, ThreatRow>();
  for (const threat of threats) { if (!ipMap.has(threat.sourceIp)) ipMap.set(threat.sourceIp, threat); }
  const uniqueIps = Array.from(ipMap.keys());
  const globePoints = uniqueIps.map((ip, i) => {
    const threat = ipMap.get(ip)!;
    return { lat: threat.lat || 0, lng: threat.lng || 0, ip, country: threat.country || threat.countryCode || '--', color: THREAT_COLORS[i % THREAT_COLORS.length], size: 0.6 };
  });
  const globeArcs = globePoints.map((p) => ({ startLat: p.lat, startLng: p.lng, endLat: SOC_CENTER.lat, endLng: SOC_CENTER.lng, color: p.color }));

  useEffect(() => { import('react-globe.gl').then((mod) => setGlobeComponent(() => mod.default)); }, []);
  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const observer = new ResizeObserver((entries) => { for (const entry of entries) { const { width } = entry.contentRect; setGlobeSize({ width, height: Math.min(450, width * 0.75) }); } });
    observer.observe(el); return () => observer.disconnect();
  }, []);
  const handleGlobeReady = useCallback(() => {
    const globe = globeRef.current; if (!globe) return;
    const controls = globe.controls();
    if (controls) { controls.autoRotate = true; controls.autoRotateSpeed = 0.8; controls.enableZoom = true; }
    globe.pointOfView({ lat: -2, lng: 115, altitude: 2.2 }, 1000);
  }, []);

  return (
    <div className="rounded-2xl overflow-hidden shadow-xl shadow-black/20 border border-slate-800 h-full flex flex-col">
      <div className="bg-slate-900 px-6 py-4 flex items-center gap-2.5 border-b border-slate-800">
        <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">{t('detection.liveViz')}</span>
        <span className="ml-auto text-[10px] text-slate-500 font-medium">{uniqueIps.length} {t('detection.activeSources')}</span>
      </div>
      <div ref={containerRef} className="relative bg-[#020617] flex-1 flex items-center justify-center overflow-hidden min-h-[300px]"
        onMouseEnter={() => { const c = globeRef.current?.controls(); if (c) c.autoRotate = false; }}
        onMouseLeave={() => { const c = globeRef.current?.controls(); if (c) c.autoRotate = true; }}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
        {GlobeComponent ? (
          <GlobeComponent ref={globeRef} width={globeSize.width} height={globeSize.height} backgroundColor="rgba(0,0,0,0)"
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg" atmosphereColor="#6366f1" atmosphereAltitude={0.2}
            pointsData={globePoints} pointLat="lat" pointLng="lng" pointColor="color" pointAltitude={0.01} pointRadius="size"
            ringsData={globePoints} ringLat="lat" ringLng="lng" ringColor={() => (t: number) => `rgba(34,211,238,${1 - t})`} ringMaxRadius={3} ringPropagationSpeed={2} ringRepeatPeriod={1400}
            arcsData={globeArcs} arcStartLat="startLat" arcStartLng="startLng" arcEndLat="endLat" arcEndLng="endLng" arcColor="color" arcDashLength={0.4} arcDashGap={0.2} arcDashAnimateTime={1500} arcStroke={0.5}
            labelsData={globePoints} labelLat="lat" labelLng="lng" labelText="country" labelSize={1.4} labelDotRadius={0.4} labelColor={() => 'rgba(255, 255, 255, 0.85)'} labelAltitude={0.02} labelResolution={2}
            onGlobeReady={handleGlobeReady} />
        ) : (
          <div className="flex flex-col items-center gap-3"><Loader2 className="animate-spin text-indigo-400" size={32} /><span className="text-xs text-slate-500">{t('detection.loadingGlobe')}</span></div>
        )}
      </div>
    </div>
  );
};

/* ─────────────────── Main Component (content-only) ─────────────────── */

export const DetectionPanel: FC = () => {
  const { setSidebarOpen } = useSidebar();
  const { t } = useLanguage();
  const [threats, setThreats] = useState<ThreatRow[]>([]);
  const [threatsLoading, setThreatsLoading] = useState(true);
  const [csStatus, setCsStatus] = useState<CrowdSecStatus | null>(null);
  const [csLoading, setCsLoading] = useState(true);
  const [blockingIps, setBlockingIps] = useState<Set<string>>(new Set());
  const [blockThreshold, setBlockThreshold] = useState(10);

  const fetchConfig = useCallback(async () => {
    try { const res = await authFetch(`${API}/api/admin/config`); if (res.ok) { const data = await res.json(); setBlockThreshold(data.blockThreshold || 10); } } catch {}
  }, []);

  const fetchThreats = useCallback(async () => {
    setThreatsLoading(true);
    try { const res = await authFetch(`${API}/api/detection/threats`); const data = await res.json(); setThreats(data.threats || []); }
    catch (err) { console.error('Failed to fetch threats:', err); } finally { setThreatsLoading(false); }
  }, []);

  const fetchStatus = useCallback(async () => {
    try { const res = await authFetch(`${API}/api/crowdsec/status`); const data = await res.json(); setCsStatus(data); }
    catch { setCsStatus(null); } finally { setCsLoading(false); }
  }, []);

  useEffect(() => {
    fetchConfig(); fetchThreats(); fetchStatus();
    const interval = setInterval(() => { fetchThreats(); fetchStatus(); }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchConfig, fetchThreats, fetchStatus]);

  const handleBlockIP = useCallback(async (ip: string) => {
    setBlockingIps((prev) => new Set(prev).add(ip));
    try {
      const res = await authFetch(`${API}/api/detection/block`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ip }) });
      if (res.ok) fetchThreats();
    } catch (err) { console.error('Failed to block IP:', err); } finally {
      setBlockingIps((prev) => { const next = new Set(prev); next.delete(ip); return next; });
    }
  }, [fetchThreats]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <header className="h-16 border-b border-slate-800 bg-[#0b1120]/80 backdrop-blur-md flex items-center px-4 lg:px-6 gap-4 shrink-0 sticky top-0 z-30">
        <button className="lg:hidden text-slate-400 hover:text-slate-200" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
        <div className="hidden lg:block w-px h-8 bg-slate-800 mr-2" />
        <h1 className="text-lg font-bold text-slate-100 tracking-tight">{t('detection.title')}</h1>
        <div className="ml-auto"><CrowdSecStatusBadge status={csStatus} loading={csLoading} /></div>
      </header>
      <main className="flex-1 p-4 lg:p-6 space-y-6 overflow-y-auto">
        <ThreatTable threats={threats} loading={threatsLoading} onRefresh={fetchThreats} onBlock={handleBlockIP} blockingIps={blockingIps} blockThreshold={blockThreshold} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2"><LiveThreatViz threats={threats} /></div>
          <div className="lg:col-span-1"><ActiveResponseFeed threats={threats} blockThreshold={blockThreshold} /></div>
        </div>
      </main>
    </div>
  );
};
