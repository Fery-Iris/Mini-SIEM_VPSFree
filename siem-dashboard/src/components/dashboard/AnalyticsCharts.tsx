'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { BarChart3, RefreshCw, TrendingUp } from 'lucide-react';
import { authFetch } from '@/utils/auth';

interface TimeSeriesPoint {
  time: string;
  safe: number;
  blocked: number;
}

interface AttackType {
  type: string;
  count: number;
  percentage: number;
}

interface AnalyticsData {
  timeSeries: TimeSeriesPoint[];
  attackTypes: AttackType[];
  summary: {
    totalSafe: number;
    totalBlocked: number;
    range: string;
  };
}

const RANGE_OPTIONS = [
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
];

const ATTACK_COLORS = [
  '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6',
  '#ec4899', '#06b6d4', '#10b981', '#f97316',
];

// Short display name for time axis
function formatTimeLabel(time: string, range: string): string {
  if (range === '24h') {
    // "2026-08-04T14:00" → "14:00"
    const parts = time.split('T');
    return parts[1] || time;
  }
  // "2026-08-04" → "08/04"
  const parts = time.split('-');
  return `${parts[1]}/${parts[2]}`;
}

// Short attack type name
function shortAttackName(name: string): string {
  return name
    .replace('SQL Injection (SQLi)', 'SQLi')
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
    .replace('RATE_LIMIT_EXCEEDED', 'Rate Limit');
}

// Custom tooltip for area chart
function TrafficTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1e293b] border border-slate-600/50 rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-slate-400 font-mono mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="font-semibold" style={{ color: p.color }}>
          {p.dataKey === 'safe' ? '✓ Safe' : '✕ Blocked'}: {p.value}
        </p>
      ))}
    </div>
  );
}

export default function AnalyticsCharts() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [range, setRange] = useState('24h');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/dashboard/analytics?range=${range}`);
      if (!res.ok) { setData(null); return; }
      const json = await res.json();
      if (json.timeSeries) setData(json);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const chartData = data?.timeSeries?.map((p) => ({
    ...p,
    label: formatTimeLabel(p.time, range),
  })) || [];

  const attackData = data?.attackTypes?.map((a) => ({
    ...a,
    name: shortAttackName(a.type),
  })) || [];

  return (
    <div className="bg-[#0b1120] border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl shadow-black/20 flex flex-col">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-slate-700/40">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-blue-500/10">
            <TrendingUp size={16} className="text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">Traffic Analytics</h3>
            <p className="text-[10px] text-slate-500 font-medium">
              {data?.summary
                ? `${data.summary.totalSafe} safe · ${data.summary.totalBlocked} blocked`
                : 'Loading...'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Range selector */}
          <div className="flex bg-slate-800/60 rounded-lg p-0.5">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRange(opt.value)}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                  range === opt.value
                    ? 'bg-blue-500/20 text-blue-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={fetchData}
            className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-500 hover:text-slate-300 transition-colors ml-1"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        {/* Area Chart — Traffic Overview */}
        <div className="flex-1 p-4 min-h-[240px]">
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-3">
            Traffic Over Time
          </p>
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <RefreshCw size={20} className="animate-spin text-blue-400" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gradSafe" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradBlocked" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={{ stroke: '#1e293b' }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={35}
                />
                <Tooltip content={<TrafficTooltip />} />
                <Area
                  type="monotone"
                  dataKey="safe"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  fill="url(#gradSafe)"
                  dot={false}
                  animationDuration={800}
                />
                <Area
                  type="monotone"
                  dataKey="blocked"
                  stroke="#ef4444"
                  strokeWidth={2}
                  fill="url(#gradBlocked)"
                  dot={false}
                  animationDuration={800}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Bar Chart — Attack Distribution */}
        <div className="w-full lg:w-64 border-t lg:border-t-0 lg:border-l border-slate-700/40 p-4">
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-3">
            Attack Types
          </p>
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <RefreshCw size={20} className="animate-spin text-blue-400" />
            </div>
          ) : attackData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={attackData} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: '#64748b', fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={65}
                />
                <Tooltip
                  formatter={(value: any, _name: any, props: any) => [
                    `${value} (${props?.payload?.percentage ?? 0}%)`,
                    'Attacks',
                  ]}
                  contentStyle={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: 8,
                    fontSize: 11,
                    color: '#e2e8f0',
                  }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={14}>
                  {attackData.map((_, i) => (
                    <Cell key={i} fill={ATTACK_COLORS[i % ATTACK_COLORS.length]} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40">
              <div className="text-center">
                <BarChart3 size={24} className="mx-auto mb-2 text-slate-700" />
                <p className="text-[11px] text-slate-600">No attacks recorded</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
