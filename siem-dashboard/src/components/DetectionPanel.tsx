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
  Activity,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  ExternalLink,
} from 'lucide-react';

const API = '';
const POLL_INTERVAL = 10_000;
const PAGE_SIZE = 7;

import { authFetch } from '../utils/auth';
import { useLanguage } from '../contexts/LanguageContext';
import { useSidebar } from '../contexts/SidebarContext';
import {
  DASHBOARD_WAF_RULES,
  RULES_BY_CATEGORY,
  CATEGORY_ORDER,
  CATEGORY_STYLES,
  type DashboardWAFRule,
} from '../lib/wafRules';

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
  detail: string;
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

/* ─────────────────── Sub-Components ─────────────────── */

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

/* ─────────────────── ThreatTable with Pagination ─────────────────── */

const ThreatTable: FC<{
  threats: ThreatRow[];
  loading: boolean;
  onRefresh: () => void;
  onBlock: (ip: string) => void;
  blockingIps: Set<string>;
  blockThreshold: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  onRuleClick: (ruleName: string, detail: string) => void;
}> = ({ threats, loading, onRefresh, onBlock, blockingIps, blockThreshold, currentPage, totalPages, onPageChange, onRuleClick }) => {
  const { t } = useLanguage();

  return (
    <div className="bg-[#0b1120] border border-slate-800 rounded-2xl shadow-xl shadow-black/20 overflow-hidden">
      {/* Header */}
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

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-800 bg-slate-900/30">
              <th className="px-4 py-3 font-semibold pl-6">{t('detection.colAttack')}</th>
              <th className="px-4 py-3 font-semibold">{t('detection.colSource')}</th>
              <th className="px-4 py-3 font-semibold">Rules <span className="normal-case text-slate-600 font-normal">(click to view)</span></th>
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

                {/* Clickable rule badges */}
                <td className="px-4 py-3.5">
                  <div className="flex flex-wrap gap-1 max-w-[220px]">
                    {(row.matchedRules || []).slice(0, 3).map((rule, idx) => (
                      <button
                        key={idx}
                        onClick={() => onRuleClick(rule, row.detail || '')}
                        title={`Click to view rule: ${rule}`}
                        className="text-[9px] font-mono bg-slate-800 text-indigo-300 px-1.5 py-0.5 rounded border border-slate-700 hover:border-indigo-500/50 hover:bg-indigo-500/10 hover:text-indigo-200 truncate max-w-[120px] transition-all cursor-pointer"
                      >
                        {rule}
                      </button>
                    ))}
                    {(row.matchedRules || []).length > 3 && (
                      <button
                        onClick={() => onRuleClick(row.matchedRules[3], row.detail || '')}
                        className="text-[9px] font-mono text-slate-500 hover:text-indigo-400 transition-colors"
                      >
                        +{row.matchedRules.length - 3} more
                      </button>
                    )}
                    {(row.matchedRules || []).length === 0 && (
                      <span className="text-[9px] text-slate-600 italic">—</span>
                    )}
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

      {/* Pagination Footer */}
      <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/30 flex items-center justify-between gap-4">
        <p className="text-[11px] text-slate-500">
          Page <span className="font-semibold text-slate-400">{currentPage}</span> of <span className="font-semibold text-slate-400">{totalPages}</span>
          <span className="mx-1.5 text-slate-700">·</span>
          <span className="text-slate-500">{threats.length} records on this page</span>
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${
                p === currentPage
                  ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20'
                  : 'text-slate-500 hover:bg-slate-700/50 hover:text-slate-300'
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────── WAF Rules Dictionary ─────────────────── */

/**
 * Single expandable rule row — table-style layout.
 * Default state: green left-border (teal).
 * Highlighted state (triggered from threat record): rose/red, auto-expanded.
 */
const RuleRow: FC<{
  rule: DashboardWAFRule;
  isHighlighted: boolean;
  highlightedPayload: string | null;
  ruleRef: (el: HTMLDivElement | null) => void;
  onClearHighlight: () => void;
}> = ({ rule, isHighlighted, highlightedPayload, ruleRef, onClearHighlight }) => {
  // Auto-expand when highlighted from outside, otherwise user controls it
  const [expanded, setExpanded] = useState(false);
  const catStyles = CATEGORY_STYLES[rule.category];

  useEffect(() => {
    if (isHighlighted) setExpanded(true);
  }, [isHighlighted]);

  return (
    <div
      ref={ruleRef}
      className="border-l-2 border-l-emerald-500/50 hover:border-l-emerald-400 transition-all duration-500"
    >
      {/* ── Row header (always visible) ── */}
      <button
        onClick={() => {
          setExpanded((v) => {
            const next = !v;
            // Clear highlight if they collapse the row manually
            if (!next && isHighlighted) onClearHighlight();
            return next;
          });
        }}
        className="w-full flex items-center gap-4 px-5 py-3 hover:bg-slate-800/30 transition-colors text-left"
      >
        {/* Severity badge */}
        <span
          className={`shrink-0 w-20 text-[10px] font-bold uppercase px-2 py-0.5 rounded border text-center ${catStyles.badge}`}
        >
          {rule.category}
        </span>

        {/* ID */}
        <span className="shrink-0 w-28 font-mono text-[11px] font-semibold text-emerald-400">
          {rule.id}
        </span>

        {/* Rule name */}
        <span className="flex-1 text-[12px] font-semibold text-slate-200">
          {rule.name}
        </span>

        {/* Level badge */}
        <span className="shrink-0 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded text-emerald-500 bg-emerald-500/10">
          L{rule.level}
        </span>

        {/* Chevron */}
        <ChevronDown
          size={14}
          className={`shrink-0 transition-transform duration-200 text-slate-500 ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* ── Expanded panel: pattern token badges + meta ── */}
      {expanded && (
        <div className="px-5 pb-4 pt-1 border-t border-slate-800/60 bg-slate-900/20">
          {/* Description */}
          <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">{rule.description}</p>

          {/* Pattern token badges — red if it matches the payload */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {(() => {
              const matchedIndices = new Set<number>();
              if (isHighlighted) {
                if (highlightedPayload) {
                  rule.patternTokens.forEach((token, idx) => {
                    if (rule.id === 'UA_001' && (highlightedPayload === '' || highlightedPayload === 'unknown' || highlightedPayload.toLowerCase().includes('unknown'))) {
                      matchedIndices.add(idx);
                    } else if (token !== '[Empty String]' && token !== '[No User-Agent]') {
                      if (highlightedPayload.toLowerCase().includes(token.toLowerCase())) {
                        matchedIndices.add(idx);
                      }
                    }
                  });
                }
                // Fallback: If no token explicitly matched (or payload was empty), highlight the first one so the user sees something.
                if (matchedIndices.size === 0 && rule.patternTokens.length > 0) {
                  matchedIndices.add(0);
                }
              }

              return rule.patternTokens.map((token, idx) => {
                const matched = matchedIndices.has(idx);
                return (
                  <span
                    key={token}
                    className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded border transition-colors ${
                      matched
                        ? 'bg-rose-500/15 text-rose-400 border-rose-500/30 ring-1 ring-rose-500/50 shadow-[0_0_8px_rgba(244,63,94,0.3)] scale-[1.02]'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 opacity-75'
                    }`}
                  >
                    {token}
                  </span>
                );
              });
            })()}
          </div>

          {/* Targets + OWASP row */}
          <div className="flex flex-wrap items-center gap-3 text-[9px]">
            <div className="flex items-center gap-1">
              <span className="text-slate-600 uppercase font-bold tracking-wider">Targets:</span>
              {rule.targets.map((t) => (
                <span key={t} className="font-mono text-slate-500 bg-slate-800/70 px-1.5 py-0.5 rounded border border-slate-700/60">
                  {t}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <ExternalLink size={8} className="text-slate-600" />
              <span className="text-slate-600">{rule.owasp}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const RulesDictionary: FC<{
  highlightedRuleId: string | null;
  highlightedPayload: string | null;
  ruleRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  onClearHighlight: () => void;
}> = ({ highlightedRuleId, highlightedPayload, ruleRefs, onClearHighlight }) => {
  const [expanded, setExpanded] = useState(false);
  const totalRules = DASHBOARD_WAF_RULES.length;

  // Auto-expand the accordion when a rule is highlighted from outside
  useEffect(() => {
    if (highlightedRuleId) setExpanded(true);
  }, [highlightedRuleId]);

  return (
    <div className="bg-[#0b1120] border border-slate-800 rounded-2xl shadow-xl shadow-black/20 overflow-hidden">

      {/* ── Accordion header ── */}
      <button
        onClick={() => {
          setExpanded((v) => {
            const next = !v;
            // Clear highlight if they collapse the entire dictionary
            if (!next && highlightedRuleId) onClearHighlight();
            return next;
          });
        }}
        className="w-full px-6 py-4 flex items-center justify-between border-b border-slate-800/60 bg-slate-900/40 hover:bg-slate-900/70 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-emerald-500/10">
            <BookOpen size={15} className="text-emerald-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-slate-100">WAF Rules Dictionary</p>
            <p className="text-[10px] text-slate-500 font-medium">
              {totalRules} detection rules · click a rule badge in the table above to highlight it here
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5">
            {CATEGORY_ORDER.map((cat) => (
              <span key={cat} className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${CATEGORY_STYLES[cat].badge}`}>
                {RULES_BY_CATEGORY[cat].length} {cat}
              </span>
            ))}
          </div>
          <ChevronDown
            size={16}
            className={`text-slate-500 group-hover:text-slate-300 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>
      {/* ── Expandable body ── */}
      {expanded && (
        <div>
          {/* Column header row */}
          <div className="flex items-center gap-4 px-5 py-2 border-b border-slate-800/60 bg-slate-900/30">
            <span className="w-20 text-[10px] text-slate-500 uppercase font-bold tracking-wider">Severity</span>
            <span className="w-28 text-[10px] text-slate-500 uppercase font-bold tracking-wider">ID</span>
            <span className="flex-1 text-[10px] text-slate-500 uppercase font-bold tracking-wider">Rule Name</span>
          </div>

          {/* All rule rows in order: Critical → High → Medium → Low */}
          <div className="divide-y divide-slate-800/40">
            {CATEGORY_ORDER.flatMap((cat) =>
              RULES_BY_CATEGORY[cat].map((rule) => (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  isHighlighted={highlightedRuleId === rule.id}
                  highlightedPayload={highlightedPayload}
                  ruleRef={(el) => { ruleRefs.current[rule.id] = el; }}
                  onClearHighlight={onClearHighlight}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ─────────────────── Other Sub-Components (unchanged) ─────────────────── */

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

/* ─────────────────── Main Component ─────────────────── */

export const DetectionPanel: FC = () => {
  const { setSidebarOpen } = useSidebar();
  const { t } = useLanguage();

  // Data state
  const [threats, setThreats] = useState<ThreatRow[]>([]);
  const [threatsLoading, setThreatsLoading] = useState(true);
  const [csStatus, setCsStatus] = useState<CrowdSecStatus | null>(null);
  const [csLoading, setCsLoading] = useState(true);
  const [blockingIps, setBlockingIps] = useState<Set<string>>(new Set());
  const [blockThreshold, setBlockThreshold] = useState(10);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Rule highlight state
  const [highlightedRuleId, setHighlightedRuleId] = useState<string | null>(null);
  const [highlightedPayload, setHighlightedPayload] = useState<string | null>(null);
  const ruleRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const rulesDictRef = useRef<HTMLDivElement>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pagination derived values
  const totalPages = Math.max(1, Math.ceil(threats.length / PAGE_SIZE));
  const paginatedThreats = threats.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

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

  // Clamp currentPage when threats shrink
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  const handleBlockIP = useCallback(async (ip: string) => {
    setBlockingIps((prev) => new Set(prev).add(ip));
    try {
      const res = await authFetch(`${API}/api/detection/block`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ip }) });
      if (res.ok) fetchThreats();
    } catch (err) { console.error('Failed to block IP:', err); } finally {
      setBlockingIps((prev) => { const next = new Set(prev); next.delete(ip); return next; });
    }
  }, [fetchThreats]);

  /**
   * Called when user clicks a rule badge in ThreatTable.
   * Finds the matching WAF rule by name, highlights it, and scrolls to it.
   */
  const handleRuleClick = useCallback((ruleName: string, detail: string) => {
    // Find rule by exact name match, then fallback to partial
    const rule =
      DASHBOARD_WAF_RULES.find(r => r.name === ruleName) ||
      DASHBOARD_WAF_RULES.find(r => ruleName.toLowerCase().includes(r.name.toLowerCase())) ||
      DASHBOARD_WAF_RULES.find(r => r.name.toLowerCase().includes(ruleName.toLowerCase()));

    if (!rule) {
      // Still scroll to dictionary even if no match found
      rulesDictRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    // Clear any existing highlight timer
    if (highlightTimer.current) clearTimeout(highlightTimer.current);

    setHighlightedRuleId(rule.id);
    setHighlightedPayload(detail);

    // Scroll to dictionary section first, then to the specific rule card
    rulesDictRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Small delay to allow accordion to open before scrolling to card
    setTimeout(() => {
      const ruleEl = ruleRefs.current[rule.id];
      if (ruleEl) {
        ruleEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 350);
  }, []);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <header className="h-16 border-b border-slate-800 bg-[#0b1120]/80 backdrop-blur-md flex items-center px-4 lg:px-6 gap-4 shrink-0 sticky top-0 z-30">
        <button className="lg:hidden text-slate-400 hover:text-slate-200" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
        <div className="hidden lg:block w-px h-8 bg-slate-800 mr-2" />
        <h1 className="text-lg font-bold text-slate-100 tracking-tight">{t('detection.title')}</h1>
        <div className="ml-auto"><CrowdSecStatusBadge status={csStatus} loading={csLoading} /></div>
      </header>

      <main className="flex-1 p-4 lg:p-6 space-y-6 overflow-y-auto">
        {/* Threat Table with pagination */}
        <ThreatTable
          threats={paginatedThreats}
          loading={threatsLoading}
          onRefresh={fetchThreats}
          onBlock={handleBlockIP}
          blockingIps={blockingIps}
          blockThreshold={blockThreshold}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onRuleClick={handleRuleClick}
        />

        {/* WAF Rules Dictionary — accordion, default collapsed */}
        <div ref={rulesDictRef}>
          <RulesDictionary
            highlightedRuleId={highlightedRuleId}
            highlightedPayload={highlightedPayload}
            ruleRefs={ruleRefs}
            onClearHighlight={() => {
              setHighlightedRuleId(null);
              setHighlightedPayload(null);
            }}
          />
        </div>

        {/* Globe + Active Response Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2"><LiveThreatViz threats={threats} /></div>
          <div className="lg:col-span-1"><ActiveResponseFeed threats={threats} blockThreshold={blockThreshold} /></div>
        </div>
      </main>
    </div>
  );
};
