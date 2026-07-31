import type { FC } from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  KeyRound,
  Radar,
  ShieldBan,
  ShieldAlert,
  AlertTriangle,
  Users,
  LogOut,
  Search,
  ChevronLeft,
  ChevronRight,
  Zap,
  ChevronDown,
  Menu,
  X,
  RefreshCw,
} from 'lucide-react';
import ReactCountryFlag from 'react-country-flag';
import { authFetch } from '../utils/auth';
import { maskIP } from '../utils/ipMask';
import { LanguageToggle } from './LanguageToggle';
import { useLanguage } from '../contexts/LanguageContext';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8081';

/* ─────────────────────────── Types ─────────────────────────── */

interface DashboardProps {
  userEmail: string;
  onLogout: () => void;
  onNavigate: (page: string) => void;
}


interface LogEntry {
  id: number;
  adminId?: string;
  userIdentity: string;
  action: string;
  payload?: string;
  severity: string;
  ipAddress: string;
  countryCode?: string;
  userAgent?: string;
  isBlocked: boolean;
  createdAt: string;
  // Computed
  flag?: string;
  country?: string;
}

interface StatCardData {
  label: string;
  value: string;
  change: string;
  sub: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  changeBg: string;
}

/* ─────────────────────── Nav Items ─────────────────────── */

const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { label: 'Detection Panel', icon: Radar, key: 'detection' },
  { label: 'Blocked Panel', icon: ShieldBan, key: 'blocked' },
  { label: 'Get API Key', icon: KeyRound, key: 'apikey', isNew: true },
];

const ICON_MAP: Record<string, FC<{ size?: number; className?: string }>> = {
  ShieldAlert,
  AlertTriangle,
  Users,
};

/* ─────────────────── Sidebar Component ─────────────────── */

const Sidebar: FC<{
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
  onNavigate: (page: string) => void;
  activePage?: string;
}> = ({ open, onClose, onLogout, onNavigate, activePage = 'dashboard' }) => {
  const { t } = useLanguage();

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-60 flex flex-col bg-gradient-to-b from-white via-slate-50 to-blue-50/60 border-r border-slate-200/80 transition-transform duration-300 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 flex items-center gap-2.5 px-5 shrink-0">
          <img src="/logo-siem.png" alt="Mini-SIEM Logo" className="h-8 w-auto" />
          <span className="text-lg font-bold text-slate-800 tracking-tight whitespace-nowrap">XR Security</span>
          <LanguageToggle variant="dark" />
          <button className="ml-auto lg:hidden text-slate-400 hover:text-slate-600" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = item.key === activePage;
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

/* ─────────────────── StatCard Component ─────────────────── */

const StatCard: FC<StatCardData> = ({ label, value, change, sub, icon, iconBg, iconColor, changeBg }) => {
  const Icon = ICON_MAP[icon];
  const { t } = useLanguage();

  const getLabel = (l: string) => {
    if (l === 'Attacks Blocked') return t('dashboard.statBlocked');
    if (l === 'Total Threats') return t('dashboard.statThreats');
    if (l === 'Active Sources') return t('dashboard.statSources');
    return l;
  };

  const getSub = (s: string) => {
    if (s === 'Last 24 Hours') return t('dashboard.statBlockedSub');
    if (s === 'Active Incidents') return t('dashboard.statThreatsSub');
    if (s === 'Unique IP Addresses') return t('dashboard.statSourcesSub');
    return s;
  };

  return (
    <div className="bg-white/70 backdrop-blur-sm border border-slate-200/60 rounded-2xl p-5 shadow-md shadow-slate-200/40 hover:shadow-lg transition-shadow flex items-start justify-between">
      <div>
        <p className="text-sm font-semibold text-slate-500 mb-1">{getLabel(label)}</p>
        <p className="text-3xl font-extrabold text-slate-800 tracking-tight">{value}</p>
        <p className="text-xs font-medium text-slate-400 mt-1">
          {change && <span className={`${changeBg} mr-1`}>{change}</span>}
          {getSub(sub)}
        </p>
      </div>
      <div className={`${iconBg} p-3 rounded-xl`}>
        {Icon && <Icon size={22} className={iconColor} />}
      </div>
    </div>
  );
};

/* ──────────────── Activity Logs Table ──────────────── */

const ActivityTable: FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [filterText, setFilterText] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const limit = 10;
  const { t } = useLanguage();

  const fetchLogs = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await authFetch(`${API}/api/dashboard/logs?page=${p}&limit=${limit}`);
      const data = await res.json();
      setLogs(data.logs || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
      setPage(p);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(1); }, [fetchLogs]);


  const toggleRow = (id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredLogs = filterText
    ? logs.filter(
        (l) =>
          l.ipAddress?.toLowerCase().includes(filterText.toLowerCase()) ||
          l.action?.toLowerCase().includes(filterText.toLowerCase()) ||
          l.userIdentity?.toLowerCase().includes(filterText.toLowerCase()) ||
          l.severity?.toLowerCase().includes(filterText.toLowerCase())
      )
    : logs;

  return (
    <div className="bg-white/70 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-md shadow-slate-200/40 overflow-hidden">
      {/* Section header */}
      <div className="px-6 pt-5 pb-3">
        <h2 className="text-lg font-bold text-slate-800">{t('dashboard.logsTitle')}</h2>
      </div>

      {/* Sub bar */}
      <div className="px-6 pb-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <Zap size={14} className="text-emerald-500" />
          <span className="text-emerald-600 uppercase tracking-wide">{t('dashboard.liveStream')}</span>
          <span className="text-slate-300 mx-0.5">|</span>
          <span className="text-slate-400 font-medium">{total} {t('dashboard.eventsCaptured')}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder={t('dashboard.filterLogs')}
              className="w-48 pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400/40 focus:border-blue-300 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw size={24} className="animate-spin text-blue-400" />
          </div>
        ) : (
          <div className="w-full text-sm">
            {/* Header */}
            <div className="grid grid-cols-[50px_160px_100px_minmax(180px,1fr)_180px_200px_40px] text-left text-[11px] text-slate-400 uppercase tracking-wider border-t border-b border-slate-200/80 bg-slate-50/60 font-semibold items-center">
              <div className="px-4 py-2.5">#</div>
              <div className="px-4 py-2.5">{t('dashboard.colCreatedAt')}</div>
              <div className="px-4 py-2.5">{t('dashboard.colSeverity')}</div>
              <div className="px-4 py-2.5">{t('dashboard.colIp')}</div>
              <div className="px-4 py-2.5">{t('dashboard.colAction')}</div>
              <div className="px-4 py-2.5">{t('dashboard.colUser')}</div>
              <div className="px-3 py-2.5"></div>
            </div>
            <div className="divide-y divide-slate-100">
              {filteredLogs.map((log) => {
                const isExpanded = expandedRows.has(log.id);
                const hasDetail = log.userAgent || log.payload;
                return (
                  <div key={`${log.id}-${log.createdAt}`} className="group relative bg-white">
                    {/* Main row */}
                    <div
                      className={`grid grid-cols-[50px_160px_100px_minmax(180px,1fr)_180px_200px_40px] items-center w-full hover:bg-blue-50/40 transition-colors ${
                        hasDetail ? 'cursor-pointer' : ''
                      }`}
                      onClick={() => hasDetail && toggleRow(log.id)}
                    >
                      <div className="px-4 py-3 text-xs text-slate-400 font-mono">{log.id}</div>
                      <div className="px-4 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">
                        {log.createdAt}
                      </div>
                      <div className="px-4 py-3">
                        <span
                          className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-md ${
                            log.severity === 'Critical'
                              ? 'bg-red-100 text-red-600'
                              : log.severity === 'High'
                              ? 'bg-amber-100 text-amber-600'
                              : log.severity === 'Medium'
                              ? 'bg-blue-100 text-blue-600'
                              : 'bg-cyan-50 text-cyan-600'
                          }`}
                        >
                          {t(`severity.${(log.severity || 'Low').toLowerCase()}`)}
                        </span>
                      </div>
                      <div className="px-4 py-3 text-xs font-mono whitespace-nowrap flex items-center gap-2">
                        {/* Flag + IP */}
                        {log.countryCode && log.countryCode !== 'LO' && log.countryCode !== '?' ? (
                          <ReactCountryFlag 
                            countryCode={log.countryCode} 
                            svg 
                            className="text-lg rounded-sm shadow-sm"
                            title={log.country}
                          />
                        ) : (
                          <span className="text-slate-400" title="Local/Unknown">🌐</span>
                        )}
                        <span className="text-teal-600">{maskIP(log.ipAddress)}</span>
                      </div>
                      <div className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">
                        <span className="font-bold">
                          {log.action.toLowerCase() === 'crowdsec-detection' ? t('attackType.crowdsecDetection') : log.action}
                        </span>
                        {log.isBlocked && (
                          <div className="mt-1 inline-block">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border bg-red-100 text-red-600 border-red-200">
                              BLOCKED
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="px-4 py-3 text-xs text-slate-500 min-w-0">
                        <div className="truncate" title={log.userIdentity}>{log.userIdentity}</div>
                        {log.adminId && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{log.adminId}</div>
                        )}
                      </div>
                      <div className="px-3 py-3 flex justify-end text-slate-300 group-hover:text-slate-400">
                        {hasDetail && (
                          <ChevronRight
                            size={14}
                            className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          />
                        )}
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="px-6 pb-4 pt-2 bg-slate-50/70 border-t border-slate-100 w-full overflow-hidden">
                        <div className="pl-6 space-y-3 w-full">
                          {log.userAgent && (
                            <p className="text-xs text-slate-500">
                              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mr-2">User-Agent</span>
                              <br />
                              <span className="font-mono text-slate-600 break-all">{log.userAgent}</span>
                            </p>
                          )}
                          {log.payload && (
                            <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200/60 overflow-hidden w-full max-w-full">
                              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1 block">Payload</span>
                              <code className="text-xs font-mono text-amber-700 break-all whitespace-pre-wrap block max-w-full">
                                {log.payload}
                              </code>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredLogs.length === 0 && !loading && (
                <div className="text-center py-10 text-sm text-slate-400">
                  No logs found.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer / Pagination */}
      <div className="px-6 py-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-4 bg-slate-50/40">
        <div className="text-xs text-slate-500">
          Page <span className="font-semibold">{page}</span> of <span className="font-semibold">{totalPages}</span>
          {' · '}{total} total events
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => fetchLogs(page - 1)}
            disabled={page <= 1}
            className="p-1 rounded hover:bg-slate-100 text-slate-400 disabled:opacity-30"
          >
            <ChevronLeft size={14} />
          </button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            const p = i + 1;
            return (
              <button
                key={p}
                onClick={() => fetchLogs(p)}
                className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${
                  p === page
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-blue-300/40'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {p}
              </button>
            );
          })}
          <button
            onClick={() => fetchLogs(page + 1)}
            disabled={page >= totalPages}
            className="p-1 rounded hover:bg-slate-100 text-slate-400 disabled:opacity-30"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────── Main Dashboard ─────────────────── */

export const Dashboard: FC<DashboardProps> = ({ onLogout, onNavigate }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState<StatCardData[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const { t } = useLanguage();

  useEffect(() => {
    authFetch(`${API}/api/dashboard/stats`)
      .then((r) => r.json())
      .then((data) => {
        setStats(data.stats || []);
        setTotalEvents(data.totalEvents || 0);
      })
      .catch(console.error);
  }, []);

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-sky-50 via-blue-50/30 to-indigo-50/40 font-sans">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={onLogout}
        onNavigate={onNavigate}
        activePage="dashboard"
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 border-b border-slate-200/70 bg-white/60 backdrop-blur-md flex items-center px-4 lg:px-6 gap-4 shrink-0 sticky top-0 z-30">
          <button className="lg:hidden text-slate-400 hover:text-slate-600" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="hidden lg:block w-px h-8 bg-slate-200 mr-2" />
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-slate-800 leading-tight truncate">
              {t('dashboard.title')}
            </h1>
            <p className="text-[11px] text-slate-400 font-medium leading-tight">
              {t('dashboard.subtitle')} {totalEvents > 0 && `· ${totalEvents} events`}
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-xs font-semibold shadow-md shadow-emerald-200/50 hover:shadow-lg transition-all">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              {t('dashboard.statusOnline')}
              <ChevronDown size={12} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 space-y-6 overflow-y-auto">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {stats.map((card) => (
              <StatCard key={card.label} {...card} />
            ))}
          </div>

          {/* Activity Logs from MySQL */}
          <ActivityTable />
        </main>
      </div>
    </div>
  );
};
