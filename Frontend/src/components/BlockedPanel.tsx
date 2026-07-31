import type { FC } from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  KeyRound,
  Radar,
  ShieldBan,
  LogOut,
  Menu,
  X,
  RefreshCw,
  Loader2,
} from 'lucide-react';

/* ─────────────────────────── Constants ─────────────────────────── */

const API = import.meta.env.VITE_API_URL || 'http://localhost:8081';
const POLL_INTERVAL = 10_000; // 10 seconds

import { authFetch } from '../utils/auth';
import { maskIP } from '../utils/ipMask';
import { LanguageToggle } from './LanguageToggle';
import { useLanguage } from '../contexts/LanguageContext';

/* ─────────────────────────── Types ─────────────────────────── */

interface BlockedPanelProps {
  userEmail: string;
  onLogout: () => void;
  onNavigate: (page: string) => void;
}

interface BlockedIp {
  ip: string;
  blockedAt: string;
  highlight?: boolean;
}

/* ─────────────────────── Nav Items ─────────────────────── */

const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { label: 'Detection Panel', icon: Radar, key: 'detection' },
  { label: 'Blocked Panel', icon: ShieldBan, key: 'blocked' },
  { label: 'Get API Key', icon: KeyRound, key: 'apikey', isNew: true },
];

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
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
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
            const isActive = item.key === 'blocked';
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

/* ─────────────────── Blocked IPs Table (Live) ─────────────────── */

const BlockedTable: FC<{
  blockedIps: BlockedIp[];
  loading: boolean;
  onRefresh: () => void;
  onUnblock: (ip: string) => void;
  unblockedIps: Set<string>;
}> = ({ blockedIps, loading, onRefresh, onUnblock, unblockedIps }) => {
  const { t } = useLanguage();

  return (
  <div className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-md shadow-slate-200/40 overflow-hidden">
    {/* Card Header */}
    <div className="px-6 py-4 border-b border-slate-200/60 flex items-center justify-between">
      <div>
        <h2 className="text-base font-bold text-slate-800">{t('blocked.title')}</h2>
        <p className="text-[11px] text-slate-400 font-medium mt-0.5">
          {t('blocked.subtitle')}
        </p>
      </div>
      <button
        onClick={onRefresh}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all disabled:opacity-50"
      >
        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        {t('blocked.refresh')}
      </button>
    </div>

    {/* Table */}
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-200/80 bg-slate-50/60">
            <th className="px-6 py-3 font-semibold">{t('blocked.colIp')}</th>
            <th className="px-6 py-3 font-semibold">{t('blocked.colBlockedAt')}</th>
            <th className="px-6 py-3 font-semibold text-right">{t('blocked.colAction')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {blockedIps.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-6 py-12 text-center text-slate-400 text-sm">
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    {t('blocked.loading')}
                  </div>
                ) : (
                  t('blocked.noBlocked')
                )}
              </td>
            </tr>
          ) : (
            blockedIps.map((row, i) => (
              <tr
                key={`${row.ip}-${i}`}
                className="hover:bg-blue-50/40 transition-colors"
              >
                <td className="px-6 py-4 font-mono text-sm font-semibold text-slate-700">
                  {maskIP(row.ip)}
                </td>
                <td className="px-6 py-4 text-sm text-slate-500 tabular-nums">
                  {row.blockedAt}
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => onUnblock(row.ip)}
                    disabled={unblockedIps.has(row.ip)}
                    className={`text-xs font-semibold px-4 py-2 rounded-lg transition-all min-w-[90px] ${
                      unblockedIps.has(row.ip)
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : row.highlight
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-300/40 hover:shadow-lg hover:from-blue-600 hover:to-blue-700 active:scale-[0.97]'
                          : 'border border-slate-300 text-slate-600 bg-white hover:bg-slate-50 hover:border-slate-400 hover:shadow-sm active:scale-[0.97]'
                    }`}
                  >
                    {unblockedIps.has(row.ip) ? t('blocked.unblocked') : t('blocked.unblock')}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
  );
};

/* ─────────────────── Main Component ─────────────────── */

export const BlockedPanel: FC<BlockedPanelProps> = ({
  onLogout,
  onNavigate,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { t } = useLanguage();
  const [blockedIps, setBlockedIps] = useState<BlockedIp[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblockedIps, setUnblockedIps] = useState<Set<string>>(new Set());

  // Fetch blocked IPs from backend
  const fetchBlocked = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API}/api/blocked`);
      const data = await res.json();
      setBlockedIps(data.blocked || []);
    } catch (err) {
      console.error('Failed to fetch blocked IPs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchBlocked();

    const interval = setInterval(() => {
      fetchBlocked();
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchBlocked]);

  // Unblock IP handler — calls real API
  const handleUnblock = useCallback(async (ip: string) => {
    try {
      const res = await authFetch(`${API}/api/blocked/unblock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip }),
      });
      if (res.ok) {
        setUnblockedIps((prev) => new Set(prev).add(ip));
        // Refresh list after short delay to show animation
        setTimeout(() => {
          fetchBlocked();
          setUnblockedIps(new Set());
        }, 800);
      }
    } catch (err) {
      console.error('Failed to unblock IP:', err);
    }
  }, [fetchBlocked]);

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
              {t('blocked.title')}
            </h1>
          </div>

          {/* Blocked count badge */}
          <div className="ml-auto">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              blockedIps.length > 0
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              <ShieldBan size={14} />
              <span>{blockedIps.length} {t('blocked.blockedCount')}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 space-y-6 overflow-y-auto">
          <BlockedTable
            blockedIps={blockedIps}
            loading={loading}
            onRefresh={fetchBlocked}
            onUnblock={handleUnblock}
            unblockedIps={unblockedIps}
          />
        </main>
      </div>
    </div>
  );
};
