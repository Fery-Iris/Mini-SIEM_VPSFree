import type { FC } from 'react';
import { useState, useCallback, useEffect } from 'react';
import {
  LayoutDashboard,
  KeyRound,
  Radar,
  ShieldBan,
  LogOut,
  Menu,
  X,
  Copy,
  Check,
  Plus,
  Key,
  Eye,
  EyeOff,
  Trash2,
} from 'lucide-react';
import { authFetch } from '../utils/auth';
import { LanguageToggle } from './LanguageToggle';
import { useLanguage } from '../contexts/LanguageContext';

/* ─────────────────────────── Types ─────────────────────────── */

interface GetApiKeyProps {
  userEmail: string;
  onLogout: () => void;
  onNavigate: (page: string) => void;
}

interface ApiKeyEntry {
  id: number;
  adminId: number;
  key: string;
  isActive: number;
  created: string;
}

/* ─────────────────────── Constants ─────────────────────── */

const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { label: 'Detection Panel', icon: Radar, key: 'detection' },
  { label: 'Blocked Panel', icon: ShieldBan, key: 'blocked' },
  { label: 'Get API Key', icon: KeyRound, key: 'apikey', isNew: true },
];

const API = import.meta.env.VITE_API_URL || 'http://localhost:8081';

/* ─────────────────── Helpers ─────────────────── */

const maskKey = (key: string): string => {
  if (key.length <= 8) return key;
  return '...' + key.slice(-4);
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

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = item.key === 'apikey';
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

/* ─────────────────── Empty State ─────────────────── */

const EmptyState: FC = () => {
  const { t } = useLanguage();
  return (
  <div className="flex flex-col items-center justify-center py-20 px-6">
    <div className="bg-slate-100 p-5 rounded-2xl mb-5">
      <Key size={32} className="text-slate-400" strokeWidth={1.5} />
    </div>
    <h3 className="text-lg font-bold text-slate-700 mb-1.5">
      {t('api.emptyTitle')}
    </h3>
    <p className="text-sm text-slate-400 text-center max-w-xs">
      {t('api.emptyDesc')}
    </p>
  </div>
  );
};

/* ─────────────────── Copy Button ─────────────────── */

const CopyButton: FC<{ fullKey: string }> = ({ fullKey }) => {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(fullKey).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [fullKey]);

  return (
    <button
      onClick={handleCopy}
      className={`p-2 rounded-lg transition-all duration-200 ${
        copied
          ? 'bg-emerald-50 text-emerald-500'
          : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
      }`}
      title={copied ? t('api.copied') : t('api.copy')}
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
    </button>
  );
};

/* ─────────────────── API Key Table ─────────────────── */

const ApiKeyTable: FC<{ keys: ApiKeyEntry[], onDelete: (id: number) => void }> = ({ keys, onDelete }) => {
  const [revealedId, setRevealedId] = useState<number | null>(null);
  const { t } = useLanguage();

  const toggleReveal = (id: number) => {
    setRevealedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-md shadow-slate-200/40 overflow-hidden">
      {/* Card Header */}
      <div className="px-6 py-4 border-b border-slate-200/60 flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-800">{t('api.yourKeys')}</h2>
        <span className="text-xs font-medium text-slate-400">
          {keys.length} {keys.length !== 1 ? t('api.keysLabel') : t('api.keyLabel')}
        </span>
      </div>

      {keys.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-200/80 bg-slate-50/60">
                <th className="px-6 py-3 font-semibold w-12">#</th>
                <th className="px-4 py-3 font-semibold">{t('api.colKey')}</th>
                <th className="px-4 py-3 font-semibold">{t('api.colAdminId')}</th>
                <th className="px-4 py-3 font-semibold">{t('api.colStatus')}</th>
                <th className="px-4 py-3 font-semibold">{t('api.colCreated')}</th>
                <th className="px-4 py-3 font-semibold text-right">{t('api.colAction')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {keys.map((entry, i) => {
                const isRevealed = revealedId === entry.id;

                return (
                  <tr
                    key={entry.id}
                    className="hover:bg-blue-50/40 transition-colors duration-200"
                  >
                    <td className="px-6 py-4 text-xs text-slate-400 font-mono">
                      {i + 1}
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => toggleReveal(entry.id)}
                        className={`group inline-flex items-center gap-2 font-mono text-sm font-semibold px-2.5 py-1 rounded-lg transition-all duration-200 cursor-pointer select-all ${
                          isRevealed
                            ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                        }`}
                        title={isRevealed ? t('api.hideKey') : t('api.revealKey')}
                      >
                        <span className={`transition-all duration-200 ${isRevealed ? 'text-xs break-all' : 'text-sm'}`}>
                          {isRevealed ? entry.key : maskKey(entry.key)}
                        </span>
                        {isRevealed ? (
                          <EyeOff size={13} className="text-blue-400 shrink-0" />
                        ) : (
                          <Eye size={13} className="text-slate-400 group-hover:text-slate-600 shrink-0" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600 font-mono">
                      {entry.adminId}
                    </td>
                    <td className="px-4 py-4">
                      {entry.isActive === 1 ? (
                        <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">{t('api.active')}</span>
                      ) : (
                        <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{t('api.inactive')}</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-500 whitespace-nowrap">
                      {entry.created}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <CopyButton fullKey={entry.key} />
                        <button
                          onClick={() => onDelete(entry.id)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors duration-200"
                          title={t('api.delete')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/* ─────────────────── Main Component ─────────────────── */

export const GetApiKey: FC<GetApiKeyProps> = ({
  onLogout,
  onNavigate,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeyEntry[]>([]);
  const [, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string; desc?: string } | null>(null);
  const { t } = useLanguage();

  const fetchKeys = useCallback(async () => {
    try {
      const res = await authFetch(`${API}/api/apikeys`);
      const data = await res.json();
      setApiKeys(data.keys || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleGenerateKey = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await authFetch(`${API}/api/apikeys/generate`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.key) {
        setApiKeys((prev) => [data.key, ...prev]);
        setMessage({ type: 'success', text: t('api.genSuccess'), desc: t('api.genSuccessDesc') });
      }
    } catch (e) {
      console.error(e);
      setMessage({ type: 'error', text: t('api.genFail'), desc: t('api.genFailDesc') });
    } finally {
      setGenerating(false);
    }
  }, [t]);

  const handleDeleteKey = useCallback(async (id: number) => {
    if (!window.confirm(t('api.confirmDelete'))) return;
    
    try {
      const res = await authFetch(`${API}/api/apikeys/delete?id=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setApiKeys((prev) => prev.filter((k) => k.id !== id));
        setMessage({ type: 'success', text: t('api.deleteSuccess'), desc: t('api.deleteSuccessDesc') });
      } else {
        setMessage({ type: 'error', text: t('api.deleteFail'), desc: t('api.deleteFailDesc') });
      }
    } catch (e) {
      console.error("Failed to delete key:", e);
      setMessage({ type: 'error', text: t('api.deleteFail'), desc: t('api.deleteFailDesc') });
    }
  }, [t]);

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-sky-50 via-blue-50/30 to-indigo-50/40 font-sans">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={onLogout}
        onNavigate={onNavigate}
      />

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

          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="bg-gradient-to-br from-cyan-400 to-blue-500 p-2 rounded-xl text-white shadow-md shadow-blue-200/50">
              <KeyRound size={18} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 tracking-tight">
                {t('api.title')}
              </h1>
              <p className="text-[11px] text-slate-400 font-medium leading-tight">
                {t('api.subtitle')}
              </p>
            </div>
          </div>

          <button
            onClick={handleGenerateKey}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-semibold shadow-lg shadow-blue-300/40 hover:shadow-xl hover:from-blue-600 hover:to-blue-700 active:scale-[0.97] transition-all duration-200 disabled:opacity-50"
          >
            {generating ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="hidden sm:inline">{t('api.generating')}</span>
              </>
            ) : (
              <>
                <Plus size={15} strokeWidth={2.5} />
                <span className="hidden sm:inline">{t('api.generate')}</span>
              </>
            )}
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 space-y-6 overflow-y-auto">
          {message && (
            <div className={`p-4 rounded-xl border ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
              <p className="font-bold text-sm">{message.text}</p>
              {message.desc && <p className="text-xs mt-1 opacity-90">{message.desc}</p>}
            </div>
          )}
          <ApiKeyTable keys={apiKeys} onDelete={handleDeleteKey} />
        </main>
      </div>
    </div>
  );
};
