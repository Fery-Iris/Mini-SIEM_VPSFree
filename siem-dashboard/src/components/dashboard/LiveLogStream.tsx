'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal, Pause, Play, RefreshCw } from 'lucide-react';
import { authFetch } from '@/utils/auth';

interface LogLine {
  id: number;
  createdAt: string;
  severity: string;
  sourceIp: string;
  action: string;
  detail?: string | null;
  isBlocked: boolean;
  countryCode?: string | null;
}

const SEVERITY_COLORS: Record<string, string> = {
  Critical: 'text-red-400',
  High: 'text-amber-400',
  Medium: 'text-blue-400',
  Low: 'text-emerald-400',
  INFO: 'text-emerald-400',
};

const SEVERITY_BG: Record<string, string> = {
  Critical: 'bg-red-500/10 text-red-400',
  High: 'bg-amber-500/10 text-amber-400',
  Medium: 'bg-blue-500/10 text-blue-400',
  Low: 'bg-emerald-500/10 text-emerald-400',
  INFO: 'bg-emerald-500/10 text-emerald-400',
};

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return iso;
  }
}

function maskIP(ip: string): string {
  if (!ip) return '0.0.0.0';
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.***.**`;
  }
  return ip;
}

export default function LiveLogStream() {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const seenIds = useRef<Set<number>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await authFetch('/api/dashboard/logs?page=1&limit=25');
      if (!res.ok) return;
      const data = await res.json();
      const newLogs: LogLine[] = (data.logs || []).map((l: any) => ({
        id: l.id,
        createdAt: l.createdAt || l.CreatedAt,
        severity: l.severity || 'INFO',
        sourceIp: l.sourceIp || l.ipAddress || '',
        action: l.action || '',
        detail: l.detail || null,
        isBlocked: l.isBlocked || false,
        countryCode: l.countryCode || null,
      }));

      setLogs((prev) => {
        // Merge: add new logs that don't exist yet
        const existing = new Set(prev.map((l) => l.id));
        const fresh = newLogs.filter((l) => !existing.has(l.id));
        if (fresh.length === 0) return prev;

        fresh.forEach((l) => seenIds.current.add(l.id));

        // Keep last 100 lines
        const merged = [...prev, ...fresh].slice(-100);
        return merged;
      });
    } catch (err) {
      console.error('LiveLog fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchLogs();

    intervalRef.current = setInterval(() => {
      if (!paused) fetchLogs();
    }, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchLogs, paused]);

  // Auto-scroll
  useEffect(() => {
    if (!paused && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, paused]);

  return (
    <div className="bg-[#0a0e1a] border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl shadow-black/20 flex flex-col">
      {/* Header bar */}
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-slate-700/40 bg-[#0d1221]">
        <div className="flex items-center gap-2.5">
          <Terminal size={14} className="text-emerald-400" />
          <span className="text-xs font-bold text-slate-300">Live Log Stream</span>
          <div className="flex items-center gap-1.5 ml-2">
            <span
              className={`w-2 h-2 rounded-full ${
                paused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'
              }`}
            />
            <span className={`text-[10px] font-bold uppercase tracking-wider ${paused ? 'text-amber-400' : 'text-emerald-400'}`}>
              {paused ? 'PAUSED' : 'LIVE'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-500 font-mono mr-2">
            {logs.length} events
          </span>
          <button
            onClick={() => setPaused(!paused)}
            className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-500 hover:text-slate-300 transition-colors"
            title={paused ? 'Resume' : 'Pause'}
          >
            {paused ? <Play size={13} /> : <Pause size={13} />}
          </button>
          <button
            onClick={() => { setLogs([]); seenIds.current.clear(); fetchLogs(); }}
            className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-500 hover:text-slate-300 transition-colors"
            title="Clear & Refresh"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Log lines */}
      <div
        ref={containerRef}
        className="px-4 py-2 font-mono text-[11px] leading-[1.8] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent"
        style={{ maxHeight: 250, minHeight: 200 }}
      >
        {loading && logs.length === 0 && (
          <div className="flex items-center justify-center h-32">
            <RefreshCw size={18} className="animate-spin text-blue-400" />
          </div>
        )}
        {logs.map((log, idx) => {
          const severityColor = SEVERITY_COLORS[log.severity] || 'text-slate-400';
          const severityBg = SEVERITY_BG[log.severity] || 'bg-slate-500/10 text-slate-400';
          const isNew = idx >= logs.length - 3; // Highlight last 3 as "new"

          return (
            <div
              key={log.id}
              className={`flex items-start gap-0 leading-relaxed transition-opacity duration-300 hover:bg-slate-800/30 rounded px-1 -mx-1 ${
                isNew ? 'opacity-100' : 'opacity-80'
              }`}
            >
              {/* Timestamp */}
              <span className="text-slate-600 shrink-0 w-[70px]">
                {formatTime(log.createdAt)}
              </span>

              {/* Severity badge */}
              <span className={`shrink-0 w-[72px] text-center text-[10px] font-bold uppercase rounded px-1 py-0 ${severityBg}`}>
                {log.severity || 'INFO'}
              </span>

              {/* IP */}
              <span className="text-cyan-400 shrink-0 w-[120px] ml-2">
                {maskIP(log.sourceIp)}
              </span>

              {/* Arrow */}
              <span className="text-slate-600 shrink-0 mx-1">→</span>

              {/* Action */}
              <span className={`flex-1 min-w-0 truncate ${log.isBlocked ? 'text-red-300' : 'text-slate-400'}`}>
                {log.action || 'request'}
                {log.isBlocked && (
                  <span className="ml-1.5 text-[9px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                    BLOCKED
                  </span>
                )}
              </span>
            </div>
          );
        })}
        {logs.length === 0 && !loading && (
          <div className="text-center py-8 text-slate-600">
            <Terminal size={24} className="mx-auto mb-2 opacity-30" />
            <p className="text-xs">Waiting for incoming logs...</p>
          </div>
        )}
      </div>
    </div>
  );
}
