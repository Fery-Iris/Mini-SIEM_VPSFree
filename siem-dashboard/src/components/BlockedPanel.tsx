import type { FC } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { ShieldBan, Menu, RefreshCw, Loader2 } from 'lucide-react';

const API = '';
const POLL_INTERVAL = 10_000;

import { authFetch } from '../utils/auth';
import { maskIP } from '../utils/ipMask';
import { useLanguage } from '../contexts/LanguageContext';
import { useSidebar } from '../contexts/SidebarContext';
import {
  useToast,
  useConfirm,
  ToastContainer,
  ConfirmModal,
} from './ui/Toast';

interface BlockedIp {
  ip: string;
  blockedAt: string;
  highlight?: boolean;
}

const BlockedTable: FC<{
  blockedIps: BlockedIp[];
  loading: boolean;
  onRefresh: () => void;
  onUnblock: (ip: string) => void;
  unblockedIps: Set<string>;
}> = ({ blockedIps, loading, onRefresh, onUnblock, unblockedIps }) => {
  const { t } = useLanguage();
  return (
    <div className="bg-[#0b1120] border border-slate-800 rounded-2xl shadow-xl shadow-black/20 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-rose-500 to-red-600 p-2 rounded-xl text-white shadow-lg shadow-rose-500/20"><ShieldBan size={16} /></div>
          <div>
            <h2 className="text-base font-bold text-slate-100">{t('blocked.title')}</h2>
            <p className="text-[11px] text-slate-400">{t('blocked.subtitle')}</p>
          </div>
        </div>
        <button onClick={onRefresh} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all disabled:opacity-50">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />{t('blocked.refresh')}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-800 bg-slate-900/30">
              <th className="px-6 py-3 font-semibold w-12">{t('blocked.colNo')}</th>
              <th className="px-4 py-3 font-semibold">{t('blocked.colIp')}</th>
              <th className="px-4 py-3 font-semibold">{t('blocked.colTime')}</th>
              <th className="px-4 py-3 font-semibold text-right pr-6">{t('blocked.colAction')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {blockedIps.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400 text-sm">
                {loading ? <div className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin text-rose-400" />{t('blocked.loading')}</div> : t('blocked.noIps')}
              </td></tr>
            ) : blockedIps.map((row, i) => (
              <tr key={row.ip} className={`transition-colors ${row.highlight ? 'bg-rose-500/10 hover:bg-rose-500/20' : 'hover:bg-slate-800/50'}`}>
                <td className="px-6 py-3.5 text-xs text-slate-500 font-medium">{i + 1}</td>
                <td className="px-4 py-3.5 font-mono text-sm font-semibold text-rose-400">{maskIP(row.ip)}</td>
                <td className="px-4 py-3.5 text-xs text-slate-400">{new Date(row.blockedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'medium' })}</td>
                <td className="px-4 py-3.5 text-right pr-6">
                  <button onClick={() => onUnblock(row.ip)} disabled={unblockedIps.has(row.ip)}
                    className={`text-xs font-semibold px-4 py-1.5 rounded-lg border transition-all ${unblockedIps.has(row.ip) ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 hover:border-emerald-500/50'}`}>
                    {unblockedIps.has(row.ip) ? t('blocked.unblocking') : t('blocked.unblock')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-6 py-3 bg-slate-900/30 border-t border-slate-800 flex items-center justify-between">
        <p className="text-[10px] text-slate-500 font-medium">{t('blocked.footerNote')}</p>
        <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-400">
          <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></div>WAF ENGINE ACTIVE
        </div>
      </div>
    </div>
  );
};

export const BlockedPanel: FC = () => {
  const { setSidebarOpen } = useSidebar();
  const { t } = useLanguage();
  const [blockedIps, setBlockedIps] = useState<BlockedIp[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblockedIps, setUnblockedIps] = useState<Set<string>>(new Set());

  // Toast + Confirm
  const { toasts, success, error, dismiss } = useToast();
  const { confirmState, confirm, closeConfirm } = useConfirm();

  const fetchBlockedIps = useCallback(async () => {
    try {
      const res = await authFetch(`${API}/api/blocked`);
      const data = await res.json();
      if (Array.isArray(data.blocked_ips)) {
        const newIps = data.blocked_ips.map((entry: { ip: string; blockedAt: string }) => ({
          ip: entry.ip,
          blockedAt: entry.blockedAt,
        }));
        setBlockedIps(newIps);
      }
    } catch (err) { console.error('Failed to fetch blocked IPs:', err); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchBlockedIps();
    const interval = setInterval(fetchBlockedIps, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchBlockedIps]);

  const handleUnblock = useCallback(async (ip: string) => {
    // Step 1: show confirmation modal
    const confirmed = await confirm({
      title: 'Cabut Pemblokiran IP',
      message: 'Apakah kamu yakin ingin mencabut status pemblokiran untuk IP berikut? IP ini akan diizinkan kembali mengakses sistem.',
      ip,
      variant: 'danger',
      confirmLabel: 'Ya, Cabut Blokir',
      cancelLabel: 'Batal',
    });
    if (!confirmed) return;

    // Step 2: execute unblock
    setUnblockedIps(prev => new Set(prev).add(ip));
    try {
      const res = await authFetch(`${API}/api/blocked/unblock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip }),
      });
      if (res.ok) {
        setBlockedIps(prev => prev.filter(b => b.ip !== ip));
        success(`IP ${ip} berhasil di-unblock.`);
      } else {
        fetchBlockedIps();
        error(`Gagal mencabut blokir IP ${ip}. Coba lagi.`);
      }
    } catch {
      fetchBlockedIps();
      error(`Gagal mencabut blokir IP ${ip}. Periksa koneksi.`);
    } finally {
      setUnblockedIps(prev => { const next = new Set(prev); next.delete(ip); return next; });
    }
  }, [confirm, fetchBlockedIps, success, error]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <header className="h-16 border-b border-slate-800 bg-[#0b1120]/80 backdrop-blur-md flex items-center px-4 lg:px-6 gap-4 shrink-0 sticky top-0 z-30">
        <button className="lg:hidden text-slate-400 hover:text-slate-200" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
        <div className="hidden lg:block w-px h-8 bg-slate-800 mr-2" />
        <h1 className="text-lg font-bold text-slate-100 tracking-tight">{t('blocked.title')}</h1>
      </header>
      <main className="flex-1 p-4 lg:p-6 space-y-6 overflow-y-auto">
        <BlockedTable blockedIps={blockedIps} loading={loading} onRefresh={fetchBlockedIps} onUnblock={handleUnblock} unblockedIps={unblockedIps} />
      </main>

      {/* Confirm modal + toast notifications */}
      <ConfirmModal state={confirmState} onClose={closeConfirm} />
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
};
