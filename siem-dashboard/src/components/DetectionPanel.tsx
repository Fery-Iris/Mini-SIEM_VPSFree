import type { FC } from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  LayoutDashboard,
  KeyRound,
  Radar,
  ShieldBan,
  LogOut,
  Menu,
  X,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
} from 'lucide-react';

/* ─────────────────────────── Constants ─────────────────────────── */

const API = '';
const POLL_INTERVAL = 10_000; // 10 seconds

import { authFetch } from '../utils/auth';
import { LanguageToggle } from './LanguageToggle';
import { useLanguage } from '../contexts/LanguageContext';

/* ─────────────────────────── Types ─────────────────────────── */

interface DetectionPanelProps {
  userEmail: string;
  onLogout: () => void;
  onNavigate: (page: string) => void;
}

interface ThreatRow {
  attackType: string;
  sourceIp: string;   // Private/internal IP — used for blocking
  publicIp: string;   // Public/external IP — used for GeoIP & globe
  severity: string;
  latestUpdate: string;
  countryCode: string;
  country: string;
  lat: number;
  lng: number;
}

interface CrowdSecStatus {
  connected: boolean;
  lapi_url: string;
  machine_id: string;
  alerts_stored: number;
  scenario: string;
}

/* ─────────────────────── Nav Items ─────────────────────── */

const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { label: 'Detection Panel', icon: Radar, key: 'detection' },
  { label: 'Blocked Panel', icon: ShieldBan, key: 'blocked' },
  { label: 'Get API Key', icon: KeyRound, key: 'apikey', isNew: true },
];

const SEVERITY_STYLES: Record<string, string> = {
  Critical: 'bg-rose-100 text-rose-700 border-rose-200',
  High: 'bg-red-100 text-red-700 border-red-200',
  Medium: 'bg-amber-100 text-amber-700 border-amber-200',
  Low: 'bg-sky-100 text-sky-700 border-sky-200',
};

const BLOCK_BTN_STYLES: Record<string, string> = {
  Critical: 'border-rose-300 text-rose-600 hover:bg-rose-50',
  High: 'border-red-300 text-red-600 hover:bg-red-50',
  Medium: 'border-amber-300 text-amber-600 hover:bg-amber-50',
  Low: 'border-slate-300 text-slate-600 hover:bg-slate-50',
};

/* ─────────────────── Sidebar ─────────────────── */

const Sidebar: FC<{
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
  onNavigate: (page: string) => void;
}> = ({ open, onClose, onLogout, onNavigate }) => {
  const { t } = useLanguage();

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-60 flex flex-col bg-gradient-to-b from-white via-slate-50 to-blue-50/60 border-r border-slate-200/80 transition-transform duration-300 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center gap-2.5 px-5 shrink-0">
          <img src="/logo-siem.png" alt="Mini-SIEM Logo" className="h-8 w-auto" />
          <span className="text-lg font-bold text-slate-800 tracking-tight whitespace-nowrap">
            XR Security
          </span>
          <LanguageToggle variant="dark" />
          <button
            className="ml-auto lg:hidden text-slate-400 hover:text-slate-600"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = item.key === 'detection';
            let translatedLabel = item.label;
            if (item.key === 'dashboard') translatedLabel = t('sidebar.dashboard');
            if (item.key === 'detection') translatedLabel = t('sidebar.detectionPanel');
            if (item.key === 'blocked') translatedLabel = t('sidebar.blockedPanel');
            if (item.key === 'apikey') translatedLabel = t('sidebar.getApiKey');

            return (
              <button
                key={item.label}
                onClick={() => onNavigate(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 shadow-sm shadow-blue-100'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                <item.icon size={17} strokeWidth={2} />
                <span>{translatedLabel}</span>
                {item.isNew && (
                  <span className="ml-auto text-[10px] font-bold bg-gradient-to-r from-blue-500 to-cyan-400 text-white px-2 py-0.5 rounded-full uppercase tracking-wide">
                    {t('sidebar.new')}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-slate-200/80">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all"
          >
            <LogOut size={17} />
            {t('sidebar.logout')}
          </button>
        </div>
      </aside>
    </>
  );
};

/* ─────────────────── CrowdSec Status Badge ─────────────────── */

const CrowdSecStatusBadge: FC<{ status: CrowdSecStatus | null; loading: boolean }> = ({ status, loading }) => {
  const { t } = useLanguage();

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-500 text-xs font-semibold">
        <Loader2 size={14} className="animate-spin" />
        {t('detection.connecting')}
      </div>
    );
  }

  if (!status) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold border border-red-200">
        <XCircle size={14} />
        {t('detection.offline')}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
      status.connected
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-amber-50 text-amber-700 border-amber-200'
    }`}>
      {status.connected ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
      <span>CrowdSec {status.connected ? t('detection.connected') : t('detection.disconnected')}</span>
      <span className="text-[10px] opacity-60">|</span>
      <span className="text-[10px] opacity-70">{status.alerts_stored} {t('detection.alerts')}</span>
    </div>
  );
};

/* ─────────────────── Threat Table (Live) ─────────────────── */

const ThreatTable: FC<{
  threats: ThreatRow[];
  loading: boolean;
  onRefresh: () => void;
  onBlock: (ip: string) => void;
  blockingIps: Set<string>;
}> = ({ threats, loading, onRefresh, onBlock, blockingIps }) => {
  const { t } = useLanguage();

  return (
  <div className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-md shadow-slate-200/40 overflow-hidden">
    {/* Header */}
    <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100">
      <div className="flex items-center gap-3">
        <div className="bg-gradient-to-br from-red-400 to-rose-500 p-2 rounded-xl text-white shadow-md shadow-red-200/50">
          <Radar size={16} />
        </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-slate-800 leading-tight truncate">
              {t('detection.title')}
            </h1>
            <p className="text-[11px] text-slate-400 font-medium leading-tight">
              {t('detection.subtitle')}
            </p>
          </div>
      </div>
      <button
        onClick={onRefresh}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all disabled:opacity-50"
      >
        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        {t('detection.refresh')}
      </button>
    </div>

    {/* Table */}
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-200/80 bg-slate-50/60">
            <th className="px-6 py-3 font-semibold">{t('detection.colAttack')}</th>
            <th className="px-4 py-3 font-semibold">{t('detection.colSource')}</th>
            <th className="px-4 py-3 font-semibold">{t('detection.colSeverity')}</th>
            <th className="px-4 py-3 font-semibold">{t('detection.colUpdate')}</th>
            <th className="px-4 py-3 font-semibold text-right">{t('detection.colAction')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {threats.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-sm">
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    {t('detection.loadingThreats')}
                  </div>
                ) : (
                  t('detection.noThreats')
                )}
              </td>
            </tr>
          ) : (
            threats.map((row, i) => (
              <tr key={i} className="hover:bg-blue-50/40 transition-colors">
                <td className="px-6 py-3.5 font-semibold text-slate-700">
                  <div className="flex items-center gap-2">
                    {row.attackType.toLowerCase() === 'crowdsec-detection' ? t('attackType.crowdsecDetection') : row.attackType}
                    {row.attackType.includes('CrowdSec') && (
                      <span className="text-[9px] font-bold bg-gradient-to-r from-violet-500 to-purple-500 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                        CS
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3.5 font-mono text-xs text-slate-600">
                  {row.sourceIp}
                </td>
                <td className="px-4 py-3.5">
                  <span
                    className={`text-[11px] font-bold px-3 py-1 rounded-full border ${
                      SEVERITY_STYLES[row.severity] || SEVERITY_STYLES.Low
                    }`}
                  >
                    {t(`severity.${(row.severity || 'low').toLowerCase()}`)}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-xs text-slate-500">
                  {row.latestUpdate}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <button
                    onClick={() => onBlock(row.sourceIp)}
                    disabled={blockingIps.has(row.sourceIp)}
                    className={`text-xs font-semibold px-3.5 py-1.5 rounded-lg border transition-all ${
                      blockingIps.has(row.sourceIp)
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
                        : (BLOCK_BTN_STYLES[row.severity] || BLOCK_BTN_STYLES.Low)
                    }`}
                  >
                    {blockingIps.has(row.sourceIp) ? t('detection.blocked') : t('detection.block')}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>

    {/* Footer - XSS Patterns */}
    <div className="px-6 py-3 bg-slate-50/60 border-t border-slate-100">
      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-2">
        {t('detection.xssPatterns')}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {['<script>', '<img>', '<svg>', '<embed>', '<style>', 'javascript:', 'alert()', 'prompt()', '<input>', '<object>', '<meta>', '<frameset>', '%3Cscript', '%3Cimg'].map((p) => (
          <span key={p} className="text-[10px] font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200">
            {p}
          </span>
        ))}
        <span className="text-[10px] text-slate-400 font-medium self-center">{t('detection.morePatterns')}</span>
      </div>
    </div>
  </div>
  );
};

/* ────────────── Live Threat Visualization ────────────── */

const THREAT_COLORS = ['#22d3ee', '#fb923c', '#f87171', '#a78bfa', '#34d399', '#f472b6'];

// SOC center point (Jakarta HQ)
const SOC_CENTER = { lat: -6.2088, lng: 106.8456 };

const LiveThreatViz: FC<{ threats: ThreatRow[] }> = ({ threats }) => {
  const globeRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [globeSize, setGlobeSize] = useState({ width: 600, height: 450 });
  const [GlobeComponent, setGlobeComponent] = useState<any>(null);
  const { t } = useLanguage();

  // Derive globe points from actual threats
  const ipMap = new Map<string, ThreatRow>();
  for (const t of threats) {
    if (!ipMap.has(t.sourceIp)) {
      ipMap.set(t.sourceIp, t);
    }
  }

  const uniqueIps = Array.from(ipMap.keys());
  const globePoints = uniqueIps.map((ip, i) => {
    const t = ipMap.get(ip)!;
    return {
      lat: t.lat || 0,
      lng: t.lng || 0,
      ip,
      country: t.country || t.countryCode || '--',
      color: THREAT_COLORS[i % THREAT_COLORS.length],
      size: 0.6,
    };
  });

  const globeArcs = globePoints.map((p) => ({
    startLat: p.lat,
    startLng: p.lng,
    endLat: SOC_CENTER.lat,
    endLng: SOC_CENTER.lng,
    color: p.color,
  }));

  // Dynamically import react-globe.gl (it's a default export)
  useEffect(() => {
    import('react-globe.gl').then((mod) => {
      setGlobeComponent(() => mod.default);
    });
  }, []);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        setGlobeSize({ width, height: Math.min(450, width * 0.75) });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Configure globe on mount
  const handleGlobeReady = useCallback(() => {
    const globe = globeRef.current;
    if (!globe) return;

    // Auto-rotate
    const controls = globe.controls();
    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.8;
      controls.enableZoom = true;
    }

    // Point camera at Southeast Asia
    globe.pointOfView({ lat: -2, lng: 115, altitude: 2.2 }, 1000);
  }, []);

  return (
    <div className="rounded-2xl overflow-hidden shadow-lg shadow-slate-300/30 border border-slate-200/60">
      {/* Header */}
      <div className="bg-slate-900 px-6 py-3 flex items-center gap-2.5">
        <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/40" />
        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">
          {t('detection.liveViz')}
        </span>
        <span className="ml-auto text-[10px] text-slate-500 font-medium">
          {uniqueIps.length} {t('detection.activeSources')}
        </span>
      </div>

      {/* Globe Area */}
      <div
        ref={containerRef}
        className="relative bg-gradient-to-b from-[#020617] via-[#0f172a] to-[#020617] flex items-center justify-center overflow-hidden"
        style={{ minHeight: '400px' }}
        onMouseEnter={() => {
          const controls = globeRef.current?.controls();
          if (controls) controls.autoRotate = false;
        }}
        onMouseLeave={() => {
          const controls = globeRef.current?.controls();
          if (controls) controls.autoRotate = true;
        }}
      >
        {/* Ambient glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-500/8 rounded-full blur-[120px] pointer-events-none" />

        {GlobeComponent ? (
          <GlobeComponent
            ref={globeRef}
            width={globeSize.width}
            height={globeSize.height}
            backgroundColor="rgba(0,0,0,0)"
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
            atmosphereColor="#dc14ff"
            atmosphereAltitude={0.2}
            // Points
            pointsData={globePoints}
            pointLat="lat"
            pointLng="lng"
            pointColor="color"
            pointAltitude={0.01}
            pointRadius="size"
            // Point rings
            ringsData={globePoints}
            ringLat="lat"
            ringLng="lng"
            ringColor={() => (t: number) => `rgba(34,211,238,${1 - t})`}
            ringMaxRadius={3}
            ringPropagationSpeed={2}
            ringRepeatPeriod={1400}
            // Arcs
            arcsData={globeArcs}
            arcStartLat="startLat"
            arcStartLng="startLng"
            arcEndLat="SOC_CENTER.lat"
            arcEndLng="SOC_CENTER.lng"
            arcColor="color"
            arcDashLength={0.4}
            arcDashGap={0.2}
            arcDashAnimateTime={1500}
            arcStroke={0.5}
            // Labels — show country names on the globe
            labelsData={globePoints}
            labelLat="lat"
            labelLng="lng"
            labelText="country"
            labelSize={1.4}
            labelDotRadius={0.4}
            labelColor={() => 'rgba(255, 255, 255, 0.85)'}
            labelAltitude={0.02}
            labelResolution={2}
            onGlobeReady={handleGlobeReady}
          />
        ) : (
          <div className="flex items-center justify-center h-[400px]">
            <div className="flex flex-col items-center gap-3">
              <svg className="animate-spin h-8 w-8 text-cyan-400" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-xs text-slate-500 font-medium">{t('detection.loadingGlobe')}</span>
            </div>
          </div>
        )}
      </div>

      {/* IP List — derived from real threats */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-800 px-6 py-4 space-y-2">
        {uniqueIps.length === 0 ? (
          <div className="text-center text-slate-500 text-xs py-3">
            {t('detection.noActiveThreats')}
          </div>
        ) : (
          uniqueIps.slice(0, 8).map((ip, i) => (
            <div
              key={ip}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/5 border border-white/5 backdrop-blur-sm hover:bg-white/10 transition-colors"
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: THREAT_COLORS[i % THREAT_COLORS.length] }}
              />
              <span className="font-mono text-sm font-semibold text-white/90">
                {ip}
              </span>
              <span className="ml-auto text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {t(`severity.${(threats.find((t) => t.sourceIp === ip)?.severity || 'low').toLowerCase()}`)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Bottom label */}
      <div className="bg-slate-800 px-6 py-2.5 flex justify-center">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.25em]">
          ✦ {t('detection.liveViz')} ✦
        </span>
      </div>
    </div>
  );
};

/* ─────────────────── Main Component ─────────────────── */

export const DetectionPanel: FC<DetectionPanelProps> = ({ onLogout, onNavigate }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { t } = useLanguage();
  const [threats, setThreats] = useState<ThreatRow[]>([]);
  const [threatsLoading, setThreatsLoading] = useState(true);
  const [csStatus, setCsStatus] = useState<CrowdSecStatus | null>(null);
  const [csLoading, setCsLoading] = useState(true);
  const [blockingIps, setBlockingIps] = useState<Set<string>>(new Set());

  // Fetch threats from backend
  const fetchThreats = useCallback(async () => {
    setThreatsLoading(true);
    try {
      const res = await authFetch(`${API}/api/detection/threats`);
      const data = await res.json();
      setThreats(data.threats || []);
    } catch (err) {
      console.error('Failed to fetch threats:', err);
    } finally {
      setThreatsLoading(false);
    }
  }, []);

  // Fetch CrowdSec status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await authFetch(`${API}/api/crowdsec/status`);
      const data = await res.json();
      setCsStatus(data);
    } catch {
      setCsStatus(null);
    } finally {
      setCsLoading(false);
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchThreats();
    fetchStatus();

    const interval = setInterval(() => {
      fetchThreats();
      fetchStatus();
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchThreats, fetchStatus]);

  // Block IP handler — calls real API with optimistic update
  const handleBlockIP = useCallback(async (ip: string) => {
    // Optimistic: immediately remove from local state
    setBlockingIps((prev) => new Set(prev).add(ip));
    setThreats((prev) => prev.filter((t) => t.sourceIp !== ip));
    try {
      const res = await authFetch(`${API}/api/detection/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip }),
      });
      if (!res.ok) {
        // Revert on failure — re-fetch from server
        fetchThreats();
      }
    } catch (err) {
      console.error('Failed to block IP:', err);
      // Revert on error
      fetchThreats();
    } finally {
      setBlockingIps((prev) => {
        const next = new Set(prev);
        next.delete(ip);
        return next;
      });
    }
  }, [fetchThreats]);

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-sky-50 via-blue-50/30 to-indigo-50/40 font-sans">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={onLogout}
        onNavigate={onNavigate}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 border-b border-slate-200/70 bg-white/60 backdrop-blur-md flex items-center px-4 lg:px-6 gap-4 shrink-0 sticky top-0 z-30">
          <button
            className="lg:hidden text-slate-400 hover:text-slate-600"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>

          <div className="hidden lg:block w-px h-8 bg-slate-200 mr-2" />

          <div className="flex items-center gap-3">
            <img src="/logo-siem.png" alt="Mini-SIEM Logo" className="h-8 w-auto" />
            <h1 className="text-lg font-bold text-slate-800 tracking-tight">
              {t('detection.title')}
            </h1>
          </div>

          {/* CrowdSec Status */}
          <div className="ml-auto">
            <CrowdSecStatusBadge status={csStatus} loading={csLoading} />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 space-y-6 overflow-y-auto">
          {/* Threat Table */}
          <ThreatTable
            threats={threats}
            loading={threatsLoading}
            onRefresh={fetchThreats}
            onBlock={handleBlockIP}
            blockingIps={blockingIps}
          />

          {/* Live Threat Visualization */}
          <LiveThreatViz threats={threats} />
        </main>
      </div>
    </div>
  );
};
