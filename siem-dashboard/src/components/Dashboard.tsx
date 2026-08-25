'use client';
import type { FC } from 'react';
import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  ShieldAlert,
  AlertTriangle,
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  Zap,
  ChevronDown,
  Menu,
  RefreshCw,
} from 'lucide-react';
import ReactCountryFlag from 'react-country-flag';
import { authFetch } from '../utils/auth';
import { maskIP } from '../utils/ipMask';
import { useLanguage } from '../contexts/LanguageContext';
import { useSidebar } from '../contexts/SidebarContext';

// Dynamic imports for dashboard visual components (client-only)
const ThreatGlobe = dynamic(() => import('./dashboard/ThreatGlobe'), {
  ssr: false,
  loading: () => (
    <div className="bg-[#0b1120] border border-slate-700/50 rounded-2xl h-[400px] flex items-center justify-center">
      <RefreshCw size={24} className="animate-spin text-blue-400" />
    </div>
  ),
});
const LiveLogStream = dynamic(() => import('./dashboard/LiveLogStream'), { ssr: false });
const AnalyticsCharts = dynamic(() => import('./dashboard/AnalyticsCharts'), { ssr: false });

const API = '';

/* ─────────────────────────── Types ─────────────────────────── */

interface LogEntry {
  id: number;
  adminId?: string | number | null;
  userIdentity?: string | null;
  action: string;
  severity?: string | null;
  // Normalized IP field (sourceIp || ipAddressPublic from API)
  ipAddress: string;
  sourceIp?: string;
  ipAddressPublic?: string | null;
  countryCode?: string | null;
  country?: string | null;
  userAgent?: string | null;
  payload?: string | null;
  isBlocked: boolean;
  createdAt: string;
  // v2.0 enrichment
  matchedRules?: string | null;   // JSON array string: '["SQLi","XSS"]'
  decision?: string | null;       // LOG | ALERT | BLOCK
  score?: number;
  accumulatedScore?: number;
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

const ICON_MAP: Record<string, FC<{ size?: number; className?: string }>> = {
  ShieldAlert,
  AlertTriangle,
  Users,
};

/* ─────────── Attack Type Parser ─────────── */

function parseAttackTypes(matchedRules?: string | null, action?: string): string[] {
  if (matchedRules) {
    try {
      const arr = JSON.parse(matchedRules);
      if (Array.isArray(arr) && arr.length > 0) return arr;
    } catch {
      // fallthrough
    }
  }
  // Fallback: derive from action
  if (!action) return [];
  const lower = action.toLowerCase();
  if (lower.includes('sql')) return ['SQLi'];
  if (lower.includes('xss')) return ['XSS'];
  if (lower.includes('lfi') || lower.includes('rfi') || lower.includes('traversal')) return ['Path Traversal'];
  if (lower.includes('bot') || lower.includes('scanner')) return ['Bot/Scanner'];
  if (lower.includes('brute') || lower.includes('auth')) return ['Brute Force'];
  if (lower.includes('crowdsec')) return ['CrowdSec Alert'];
  if (lower.includes('block') || lower.includes('waf')) return ['WAF Block'];
  return [action];
}

function shortAttackLabel(label: string): string {
  return label
    .replace('SQL Injection (SQLi)', 'SQLi')
    .replace('SQL Injection', 'SQLi')
    .replace('Cross-Site Scripting (XSS)', 'XSS')
    .replace('Path Traversal (LFI/RFI)', 'LFI/RFI')
    .replace('OS Command Injection', 'CMDi')
    .replace('Malicious Bot / Scanner', 'Bot')
    .replace('Server-Side Request Forgery (SSRF)', 'SSRF')
    .replace('XML External Entity (XXE)', 'XXE')
    .replace('JNDI / Log4Shell Injection', 'Log4Shell')
    .replace('NoSQL Injection', 'NoSQLi')
    .replace('Code Injection', 'Code Inj.')
    .replace('WAF_BLOCK', 'WAF Block')
    .replace('RATE_LIMIT_EXCEEDED', 'Rate Limit')
    .replace('crowdsec-detection', 'CrowdSec');
}

const ATTACK_BADGE_COLORS = [
  'bg-red-500/15 text-red-400 border-red-500/25',
  'bg-amber-500/15 text-amber-400 border-amber-500/25',
  'bg-purple-500/15 text-purple-400 border-purple-500/25',
  'bg-pink-500/15 text-pink-400 border-pink-500/25',
];

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
    <div className="bg-[#0b1120] backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5 shadow-xl shadow-black/20 hover:border-slate-600/50 transition-all flex items-start justify-between">
      <div>
        <p className="text-sm font-semibold text-slate-400 mb-1">{getLabel(label)}</p>
        <p className="text-3xl font-extrabold text-slate-100 tracking-tight">{value}</p>
        <p className="text-xs font-medium text-slate-500 mt-1">
          {change && <span className={`${changeBg} text-[10px] px-1.5 py-0.5 rounded mr-1`}>{change}</span>}
          {getSub(sub)}
        </p>
      </div>
      <div className={`${iconBg} p-3 rounded-xl`}>
        {Icon && <Icon size={22} className={iconColor} />}
      </div>
    </div>
  );
};

/* ──────────────── Timezone Helper ──────────────── */

function formatSingaporeTime(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
}

/* ──────────────── Expanded Row Detail Panel ──────────────── */

function DetailField({ label, value, mono = false, full = false, badge = false, badgeColor = '' }: {
  label: string;
  value?: string | null;
  mono?: boolean;
  full?: boolean;
  badge?: boolean;
  badgeColor?: string;
}) {
  if (!value) return (
    <div className={full ? 'col-span-2' : ''}>
      <p className="text-[10px] text-slate-600 uppercase font-bold tracking-wider mb-0.5">{label}</p>
      <p className="text-xs text-slate-600 italic">—</p>
    </div>
  );
  return (
    <div className={full ? 'col-span-2' : ''}>
      <p className="text-[10px] text-slate-600 uppercase font-bold tracking-wider mb-0.5">{label}</p>
      {badge ? (
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${badgeColor}`}>{value}</span>
      ) : (
        <p className={`text-xs break-all ${mono ? 'font-mono text-slate-300' : 'text-slate-400'}`}>{value}</p>
      )}
    </div>
  );
}

function ExpandedDetail({ log }: { log: LogEntry }) {
  const attackTypes = parseAttackTypes(log.matchedRules, log.action);

  const severityBadgeColor =
    log.severity === 'Critical' ? 'bg-red-500/15 text-red-400 border-red-500/25' :
    log.severity === 'High'     ? 'bg-amber-500/15 text-amber-400 border-amber-500/25' :
    log.severity === 'Medium'   ? 'bg-blue-500/15 text-blue-400 border-blue-500/25' :
                                  'bg-cyan-500/15 text-cyan-400 border-cyan-500/25';

  const decisionBadgeColor =
    log.decision === 'BLOCK'  ? 'bg-red-500/15 text-red-400 border-red-500/25' :
    log.decision === 'ALERT'  ? 'bg-amber-500/15 text-amber-400 border-amber-500/25' :
                                'bg-slate-500/15 text-slate-400 border-slate-500/25';

  // Construct structured payload content matching reference Image 2
  let payloadContent = '';
  if (log.payload) {
    try {
      const parsed = JSON.parse(log.payload);
      payloadContent = JSON.stringify(parsed, null, 2);
    } catch {
      payloadContent = JSON.stringify(
        {
          scenario: "waf/threat-detection",
          attack_type: log.action,
          message: `Detected ${log.action} attack from ${log.ipAddress}`,
          source_ip: log.ipAddress,
          request_details: log.payload,
          user_agent: log.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          patterns_matched: attackTypes,
          timestamp: formatSingaporeTime(log.createdAt) + " (+0800)",
          decisions: [log.decision || (log.isBlocked ? "BLOCK" : "LOG")]
        },
        null,
        2
      );
    }
  } else {
    payloadContent = JSON.stringify(
      {
        scenario: "waf/threat-detection",
        attack_type: log.action,
        message: `Detected ${log.action} attack from ${log.ipAddress}`,
        source_ip: log.ipAddress,
        user_agent: log.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        patterns_matched: attackTypes,
        timestamp: formatSingaporeTime(log.createdAt) + " (+0800)",
        decisions: [log.decision || (log.isBlocked ? "BLOCK" : "LOG")]
      },
      null,
      2
    );
  }

  return (
    <div className="px-6 pb-5 pt-3 bg-slate-800/20 border-t border-slate-700/30 w-full">
      <div className="grid grid-cols-2 gap-x-8 gap-y-3 max-w-4xl">
        {/* Row 1 */}
        <DetailField
          label="EVENT ID"
          value={`ID: ${log.id}`}
          mono
        />
        <DetailField
          label="Event Time"
          value={formatSingaporeTime(log.createdAt)}
          mono
        />

        {/* Row 2 */}
        <DetailField
          label="Rule"
          value={log.action}
        />
        <div>
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">Attack Type</p>
          {attackTypes.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {attackTypes.map((t, i) => (
                <span
                  key={i}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${ATTACK_BADGE_COLORS[i % ATTACK_BADGE_COLORS.length]}`}
                >
                  {shortAttackLabel(t)}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-600 italic">—</p>
          )}
        </div>

        {/* Row 3 */}
        <DetailField
          label="Severity"
          value={log.severity}
          badge
          badgeColor={severityBadgeColor}
        />
        <DetailField
          label="Decision"
          value={log.decision || (log.isBlocked ? 'BLOCK' : 'LOG')}
          badge
          badgeColor={decisionBadgeColor}
        />

        {/* Full width User Agent */}
        <DetailField
          label="User Agent"
          value={log.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
          mono
          full
        />

        {/* Full width IP Address */}
        <DetailField
          label="IP Address"
          value={maskIP(log.ipAddress)}
          mono
          full
        />

        {/* Yellow Payload Block matching Image 2 */}
        <div className="col-span-2 mt-2">
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">PAYLOAD</p>
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 font-mono rounded-xl p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all shadow-inner leading-relaxed">
            {payloadContent}
          </div>
        </div>
      </div>
    </div>
  );
}

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
    <div className="bg-[#0b1120] border border-slate-700/50 rounded-2xl shadow-xl shadow-black/20 overflow-hidden">
      {/* Section header */}
      <div className="px-6 pt-5 pb-3">
        <h2 className="text-lg font-bold text-slate-100">{t('dashboard.logsTitle')}</h2>
      </div>

      {/* Sub bar */}
      <div className="px-6 pb-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <Zap size={14} className="text-emerald-400" />
          <span className="text-emerald-400 uppercase tracking-wide">{t('dashboard.liveStream')}</span>
          <span className="text-slate-600 mx-0.5">|</span>
          <span className="text-slate-500 font-medium">{total} {t('dashboard.eventsCaptured')}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder={t('dashboard.filterLogs')}
              className="w-48 pl-8 pr-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs text-slate-300 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-400/40 focus:border-blue-600 font-mono"
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
            {/* Header — 8 cols: # | Time | Severity | IP | Attack Type | Action | EVENT ID | chevron */}
            <div className="grid grid-cols-[50px_160px_90px_minmax(140px,1fr)_150px_minmax(140px,1fr)_120px_36px] text-left text-[11px] text-slate-500 uppercase tracking-wider border-t border-b border-slate-700/40 bg-slate-800/30 font-semibold items-center">
              <div className="px-3 py-2.5">#</div>
              <div className="px-3 py-2.5">{t('dashboard.colCreatedAt')}</div>
              <div className="px-3 py-2.5">{t('dashboard.colSeverity')}</div>
              <div className="px-3 py-2.5">{t('dashboard.colIp')}</div>
              <div className="px-3 py-2.5">Attack Type</div>
              <div className="px-3 py-2.5">{t('dashboard.colAction')}</div>
              <div className="px-3 py-2.5">EVENT ID</div>
              <div className="px-2 py-2.5"></div>
            </div>

            <div className="divide-y divide-slate-800/50">
              {filteredLogs.map((log, idx) => {
                const isExpanded = expandedRows.has(log.id);
                const attackTypes = parseAttackTypes(log.matchedRules, log.action);
                const recordNumber = (page - 1) * limit + idx + 1;
                return (
                  <div key={`${log.id}-${log.createdAt}`} className="group relative">
                    {/* Main row — always clickable for expanded detail */}
                    <div
                      className="grid grid-cols-[50px_160px_90px_minmax(140px,1fr)_150px_minmax(140px,1fr)_120px_36px] items-center w-full hover:bg-slate-800/40 transition-colors cursor-pointer"
                      onClick={() => toggleRow(log.id)}
                    >
                      {/* Sequential record number 1..N */}
                      <div className="px-3 py-3 text-xs text-slate-400 font-mono font-bold">{recordNumber}</div>

                      {/* Singapore Time */}
                      <div className="px-3 py-3 text-xs text-slate-400 font-mono whitespace-nowrap">
                        {formatSingaporeTime(log.createdAt)}
                      </div>

                      {/* Severity */}
                      <div className="px-3 py-3">
                        <span
                          className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-md ${
                            log.severity === 'Critical'
                              ? 'bg-red-500/10 text-red-400'
                              : log.severity === 'High'
                              ? 'bg-amber-500/10 text-amber-400'
                              : log.severity === 'Medium'
                              ? 'bg-blue-500/10 text-blue-400'
                              : 'bg-cyan-500/10 text-cyan-400'
                          }`}
                        >
                          {t(`severity.${(log.severity || 'Low').toLowerCase()}`)}
                        </span>
                      </div>

                      {/* IP + Flag */}
                      <div className="px-3 py-3 text-xs font-mono whitespace-nowrap flex items-center gap-2">
                        {log.countryCode && log.countryCode !== 'LO' && log.countryCode !== '?' ? (
                          <ReactCountryFlag
                            countryCode={log.countryCode}
                            svg
                            style={{ width: '1.3em', height: '1em' }}
                            title={log.country ?? log.countryCode}
                            className="rounded-sm shadow-sm inline-block"
                          />
                        ) : (
                          <ReactCountryFlag
                            countryCode="ID"
                            svg
                            style={{ width: '1.3em', height: '1em' }}
                            title="Indonesia (ID)"
                            className="rounded-sm shadow-sm inline-block"
                          />
                        )}
                        <span className="text-cyan-400">{maskIP(log.ipAddress)}</span>
                      </div>

                      {/* Attack Type badges */}
                      <div className="px-3 py-3">
                        {attackTypes.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {attackTypes.slice(0, 2).map((at, i) => (
                              <span
                                key={i}
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${ATTACK_BADGE_COLORS[i % ATTACK_BADGE_COLORS.length]}`}
                              >
                                {shortAttackLabel(at)}
                              </span>
                            ))}
                            {attackTypes.length > 2 && (
                              <span className="text-[10px] text-slate-500">+{attackTypes.length - 2}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-600">—</span>
                        )}
                      </div>

                      {/* Action / Rule */}
                      <div className="px-3 py-3 text-xs font-semibold text-slate-300 whitespace-nowrap">
                        <span className="font-bold">
                          {log.action.toLowerCase() === 'crowdsec-detection' ? t('attackType.crowdsecDetection') : log.action}
                        </span>
                        {log.isBlocked && (
                          <div className="mt-1 inline-block ml-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border bg-red-500/10 text-red-400 border-red-500/20">
                              BLOCKED
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Event ID */}
                      <div className="px-3 py-3 text-xs text-slate-400 font-mono font-semibold min-w-0">
                        ID: {log.id}
                      </div>

                      {/* Chevron */}
                      <div className="px-2 py-3 flex justify-end text-slate-600 group-hover:text-slate-400">
                        <ChevronRight
                          size={14}
                          className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        />
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && <ExpandedDetail log={log} />}
                  </div>
                );
              })}
              {filteredLogs.length === 0 && !loading && (
                <div className="text-center py-10 text-sm text-slate-600">
                  No logs found.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer / Pagination */}
      <div className="px-6 py-3 border-t border-slate-700/40 flex flex-wrap items-center justify-between gap-4 bg-slate-800/20">
        <div className="text-xs text-slate-500">
          Page <span className="font-semibold text-slate-400">{page}</span> of <span className="font-semibold text-slate-400">{totalPages}</span>
          {' · '}{total} total events
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => fetchLogs(page - 1)}
            disabled={page <= 1}
            className="p-1 rounded hover:bg-slate-700/50 text-slate-500 disabled:opacity-30"
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
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-500 hover:bg-slate-700/50'
                }`}
              >
                {p}
              </button>
            );
          })}
          <button
            onClick={() => fetchLogs(page + 1)}
            disabled={page >= totalPages}
            className="p-1 rounded hover:bg-slate-700/50 text-slate-500 disabled:opacity-30"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────── Main Dashboard (content-only) ─────────────────── */

export const Dashboard: FC = () => {
  const { setSidebarOpen } = useSidebar();
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
    <div className="flex flex-col flex-1 min-h-0">
      {/* Top Bar */}
      <header className="h-16 border-b border-slate-800/70 bg-[#070b14]/80 backdrop-blur-md flex items-center px-4 lg:px-6 gap-4 shrink-0 sticky top-0 z-30">
        <button className="lg:hidden text-slate-500 hover:text-slate-300" onClick={() => setSidebarOpen(true)}>
          <Menu size={20} />
        </button>
        <div className="hidden lg:block w-px h-8 bg-slate-800 mr-2" />
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-slate-100 leading-tight truncate">
            {t('dashboard.title')}
          </h1>
          <p className="text-[11px] text-slate-500 font-medium leading-tight">
            {t('dashboard.subtitle')} {totalEvents > 0 && `· ${totalEvents} events`}
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-xs font-semibold shadow-md shadow-emerald-500/20 hover:shadow-lg transition-all">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ThreatGlobe />
          <AnalyticsCharts />
        </div>

        <LiveLogStream />
        <ActivityTable />
      </main>
    </div>
  );
};
