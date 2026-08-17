'use client';
import type { FC } from 'react';
import { useState, useCallback, useEffect } from 'react';
import { KeyRound, Menu, Copy, Check, Plus, Key, Eye, EyeOff, Trash2, Loader2 } from 'lucide-react';
import { authFetch } from '../utils/auth';
import { useLanguage } from '../contexts/LanguageContext';
import { useSidebar } from '../contexts/SidebarContext';

const API = '';

interface ApiKeyEntry {
  id: number;
  adminId: number;
  key: string;
  isActive: number;
  created: string;
}

const maskKey = (key: string): string => key.length <= 8 ? key : '...' + key.slice(-4);

const EmptyState: FC<{ onGenerate: () => void; loading: boolean }> = ({ onGenerate, loading }) => {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-20 h-20 bg-[#0b1120] border border-slate-800 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-black/20 relative">
        <div className="absolute inset-0 border-2 border-indigo-500/20 rounded-full animate-ping"></div>
        <KeyRound size={32} className="text-indigo-400" />
      </div>
      <h2 className="text-xl font-bold text-slate-100 mb-2">{t('apikey.noKeyTitle')}</h2>
      <p className="text-sm text-slate-400 text-center max-w-md mb-8 leading-relaxed">{t('apikey.noKeyDesc')}</p>
      <button onClick={onGenerate} disabled={loading}
        className="group relative flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50 hover:shadow-lg hover:shadow-indigo-500/25 overflow-hidden">
        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform"></div>
        <Plus size={18} className="relative z-10 group-hover:rotate-90 transition-transform duration-300" />
        <span className="relative z-10">{loading ? t('apikey.generating') : t('apikey.generateBtn')}</span>
      </button>
    </div>
  );
};

const ActiveKeyCard: FC<{ apiKey: ApiKeyEntry; onRevoke: (id: number) => void; loading: boolean }> = ({ apiKey, onRevoke, loading }) => {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const handleCopy = () => { navigator.clipboard.writeText(apiKey.key); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-6 shadow-xl shadow-black/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[80px] pointer-events-none"></div>
        <div className="flex items-start justify-between mb-8 relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-indigo-400"><Key size={24} /></div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">{t('apikey.activeTitle')}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="flex h-2 w-2 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>
                <span className="text-[11px] font-semibold text-emerald-400 tracking-wider uppercase">{t('apikey.statusActive')}</span>
              </div>
            </div>
          </div>
          <button onClick={() => onRevoke(apiKey.id)} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/20 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-all disabled:opacity-50">
            <Trash2 size={14} />{t('apikey.revoke')}
          </button>
        </div>
        <div className="space-y-4 relative z-10">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">{t('apikey.secretKey')}</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 font-mono text-sm text-slate-300">
                <span className="flex-1 truncate">{showKey ? apiKey.key : maskKey(apiKey.key)}</span>
                <button onClick={() => setShowKey(!showKey)} className="ml-2 text-slate-500 hover:text-slate-300 transition-colors">{showKey ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
              <button onClick={handleCopy} className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl hover:bg-indigo-500/20 transition-all flex-shrink-0">
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-6 pt-4 border-t border-slate-800/80">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{t('apikey.created')}</p>
              <p className="text-xs font-medium text-slate-300">{new Date(apiKey.created).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-3">
        <div className="text-blue-400 mt-0.5">ℹ️</div>
        <div>
          <h4 className="text-xs font-bold text-blue-400 mb-1">{t('apikey.integrationInfo')}</h4>
          <p className="text-[11px] text-blue-400/80 leading-relaxed">{t('apikey.integrationDesc')} <code className="bg-blue-500/20 px-1 py-0.5 rounded text-slate-300">Authorization: Bearer &lt;YOUR_API_KEY&gt;</code></p>
        </div>
      </div>
    </div>
  );
};

export const GetApiKey: FC = () => {
  const { setSidebarOpen } = useSidebar();
  const { t } = useLanguage();
  const [apiKey, setApiKey] = useState<ApiKeyEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchKey = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API}/api/apikeys`);
      const data = await res.json();
      if (res.ok && data.keys && data.keys.length > 0) {
        // Map backend field names to what the card expects
        const k = data.keys[0];
        setApiKey({ id: k.id, adminId: k.adminId || 0, key: k.keyValue || k.key || '', isActive: k.isActive, created: k.createdAt || k.created || new Date().toISOString() });
      } else { setApiKey(null); }
    } catch { console.error('Failed to fetch API key'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchKey(); }, [fetchKey]);

  const handleGenerate = async () => {
    setActionLoading(true);
    try {
      const res = await authFetch(`${API}/api/apikeys/generate`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        // Server returns: { success: true, key: { id, keyValue, createdAt } }
        const k = data.key || data.apiKey || data;
        setApiKey({
          id: k.id,
          adminId: 0,
          key: k.keyValue || k.key || '',
          isActive: 1,
          created: k.createdAt || new Date().toISOString(),
        });
      } else if (res.status === 409) {
        // Single API Key Policy — key already exists, just fetch it
        fetchKey();
      } else {
        alert(data.error || data.message || 'Failed to generate key');
      }
    } catch { alert('Failed to generate key'); } finally { setActionLoading(false); }
  };

  const handleRevoke = async (id: number) => {
    if (!confirm(t('apikey.revokeConfirm'))) return;
    setActionLoading(true);
    try {
      const res = await authFetch(`${API}/api/apikeys/delete?id=${id}`, { method: 'DELETE' });
      if (res.ok) setApiKey(null); else alert('Failed to revoke key');
    } catch { alert('Failed to revoke key'); } finally { setActionLoading(false); }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <header className="h-16 border-b border-slate-800 bg-[#0b1120]/80 backdrop-blur-md flex items-center px-4 lg:px-6 gap-4 shrink-0 sticky top-0 z-30">
        <button className="lg:hidden text-slate-400 hover:text-slate-200" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
        <div className="hidden lg:block w-px h-8 bg-slate-800 mr-2" />
        <h1 className="text-lg font-bold text-slate-100 tracking-tight">{t('apikey.title')}</h1>
      </header>
      <main className="flex-1 p-4 lg:p-8 flex flex-col">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-100 mb-2">{t('apikey.pageHeading')}</h2>
          <p className="text-sm text-slate-400">{t('apikey.pageDesc')}</p>
        </div>
        <div className="flex-1 flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center"><Loader2 size={32} className="animate-spin text-indigo-500" /></div>
          ) : apiKey ? (
            <ActiveKeyCard apiKey={apiKey} onRevoke={handleRevoke} loading={actionLoading} />
          ) : (
            <EmptyState onGenerate={handleGenerate} loading={actionLoading} />
          )}
        </div>
      </main>
    </div>
  );
};
