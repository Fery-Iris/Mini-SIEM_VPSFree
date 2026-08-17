import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Bell, Save, Send, Loader2, CheckCircle2, AlertTriangle, Menu, MessageSquare } from 'lucide-react';
import { authFetch } from '../utils/auth';
import { useSidebar } from '../contexts/SidebarContext';

interface Config {
  telegramEnabled: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  blockThreshold: number;
  alertThreshold: number;
  scoreWindowMinutes: number;
}

export const AlertsPanel: FC = () => {
  const { setSidebarOpen } = useSidebar();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState<Config>({ telegramEnabled: false, telegramBotToken: '', telegramChatId: '', blockThreshold: 10, alertThreshold: 7, scoreWindowMinutes: 5 });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    authFetch('/api/admin/config').then(async (res) => {
      if (res.ok) { const data = await res.json(); setConfig({ telegramEnabled: data.telegramEnabled || false, telegramBotToken: data.telegramBotToken || '', telegramChatId: data.telegramChatId || '', blockThreshold: data.blockThreshold || 10, alertThreshold: data.alertThreshold || 7, scoreWindowMinutes: data.scoreWindowMinutes || 5 }); }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true); setMessage(null);
    try {
      const res = await authFetch('/api/admin/config', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) });
      const data = await res.json();
      if (res.ok) setMessage({ type: 'success', text: 'Configuration saved successfully.' });
      else setMessage({ type: 'error', text: data.error || 'Failed to save.' });
    } catch { setMessage({ type: 'error', text: 'Network error.' }); } finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true); setMessage(null);
    try {
      const res = await authFetch('/api/admin/telegram-test', { method: 'POST' });
      const data = await res.json();
      if (res.ok) setMessage({ type: 'success', text: 'Test alert sent to Telegram!' });
      else setMessage({ type: 'error', text: data.error || 'Failed to send test alert.' });
    } catch { setMessage({ type: 'error', text: 'Network error.' }); } finally { setTesting(false); }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <header className="h-16 border-b border-slate-800 bg-[#0b1120]/80 backdrop-blur-md flex items-center px-4 lg:px-6 gap-4 shrink-0 sticky top-0 z-30">
        <button className="lg:hidden text-slate-400 hover:text-slate-200" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
        <div className="hidden lg:block w-px h-8 bg-slate-800 mr-2" />
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg text-white"><Bell size={18} /></div>
          <h1 className="text-lg font-bold text-slate-100 tracking-tight">Alerts & Notifications</h1>
        </div>
      </header>

      <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          {message && (
            <div className={`p-4 rounded-xl flex items-center gap-3 border ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
              {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
              <span className="text-sm font-medium">{message.text}</span>
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center p-12"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Scoring Configuration */}
              <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-6 shadow-xl shadow-black/20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-slate-800 rounded-lg text-blue-400"><AlertTriangle size={18} /></div>
                  <div><h2 className="text-base font-bold text-slate-100">Scoring Thresholds</h2><p className="text-xs text-slate-400">Configure Wazuh-style rules</p></div>
                </div>
                <div className="space-y-5">
                  <div>
                    <div className="flex justify-between mb-1"><label className="text-sm font-semibold text-slate-300">Block Threshold</label><span className="text-xs font-mono text-slate-400">{config.blockThreshold}</span></div>
                    <input type="range" min="1" max="16" value={config.blockThreshold} onChange={(e) => setConfig({ ...config, blockThreshold: parseInt(e.target.value) })} className="w-full accent-rose-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
                    <p className="text-[11px] text-slate-500 mt-1">Accumulated score required to trigger an IP block.</p>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1"><label className="text-sm font-semibold text-slate-300">Alert Threshold</label><span className="text-xs font-mono text-slate-400">{config.alertThreshold}</span></div>
                    <input type="range" min="1" max="16" value={config.alertThreshold} onChange={(e) => setConfig({ ...config, alertThreshold: parseInt(e.target.value) })} className="w-full accent-amber-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
                    <p className="text-[11px] text-slate-500 mt-1">Accumulated score required to trigger a Telegram alert.</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-300 block mb-1">Time Window (Minutes)</label>
                    <input type="number" min="1" max="1440" value={config.scoreWindowMinutes} onChange={(e) => setConfig({ ...config, scoreWindowMinutes: parseInt(e.target.value) || 5 })} className="w-full bg-slate-900 border border-slate-700 text-slate-100 text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" />
                    <p className="text-[11px] text-slate-500 mt-1">Duration for which a threat's score is accumulated.</p>
                  </div>
                </div>
              </div>

              {/* Telegram Integration */}
              <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-6 shadow-xl shadow-black/20">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-800 rounded-lg text-sky-400"><MessageSquare size={18} /></div>
                    <div><h2 className="text-base font-bold text-slate-100">Telegram Bot</h2><p className="text-xs text-slate-400">Receive instant push alerts</p></div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={config.telegramEnabled} onChange={(e) => setConfig({ ...config, telegramEnabled: e.target.checked })} />
                    <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                  </label>
                </div>
                <div className={`space-y-4 transition-opacity ${config.telegramEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                  <div>
                    <label className="text-sm font-semibold text-slate-300 block mb-1">Bot Token</label>
                    <input type="password" placeholder="1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ" value={config.telegramBotToken} onChange={(e) => setConfig({ ...config, telegramBotToken: e.target.value })} className="w-full bg-slate-900 border border-slate-700 text-slate-100 text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all font-mono" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-300 block mb-1">Chat ID</label>
                    <input type="text" placeholder="-1001234567890" value={config.telegramChatId} onChange={(e) => setConfig({ ...config, telegramChatId: e.target.value })} className="w-full bg-slate-900 border border-slate-700 text-slate-100 text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all font-mono" />
                  </div>
                  <button onClick={handleTest} disabled={testing || !config.telegramBotToken || !config.telegramChatId} className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold py-2.5 px-4 rounded-lg transition-colors border border-slate-700 disabled:opacity-50">
                    {testing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}Test Telegram Alert
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end pt-4">
            <button onClick={handleSave} disabled={saving || loading} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold py-2.5 px-6 rounded-lg transition-colors shadow-lg shadow-indigo-500/20 disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}Save Configuration
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
