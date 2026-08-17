'use client';
import { useState } from 'react';
import { 
  Search, 
  ShieldAlert, 
  ShieldCheck, 
  Globe, 
  MapPin, 
  Network, 
  Server,
  AlertTriangle,
  Loader2
} from 'lucide-react';

export default function ThreatIntelPage() {
  const [ip, setIp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ip.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/virustotal?ip=${encodeURIComponent(ip)}`);
      const data = await res.json();

      if (!res.ok) {
        let errorMsg = data.error || 'Failed to fetch reputation data';
        if (data.details && data.details.error && data.details.error.message) {
          errorMsg = `VirusTotal: ${data.details.error.message}`;
        } else if (data.details && data.details.message) {
          errorMsg = `VirusTotal: ${data.details.message}`;
        }
        
        if (res.status === 404) {
           errorMsg = 'IP address not found in VirusTotal database (No reputation data available).';
        }

        throw new Error(errorMsg);
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderStats = (stats: any) => {
    const malicious = stats.malicious || 0;
    const suspicious = stats.suspicious || 0;
    const harmless = stats.harmless || 0;
    const total = malicious + suspicious + harmless + (stats.undetected || 0);

    const isDangerous = malicious > 0;
    const isWarning = suspicious > 0 && malicious === 0;

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        {/* Main Score Card */}
        <div className={`p-6 rounded-2xl border flex flex-col items-center justify-center relative overflow-hidden ${
          isDangerous 
            ? 'bg-rose-500/10 border-rose-500/30' 
            : isWarning
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-emerald-500/10 border-emerald-500/30'
        }`}>
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          
          <div className={`p-4 rounded-full mb-4 ${
            isDangerous ? 'bg-rose-500/20 text-rose-400' :
            isWarning ? 'bg-amber-500/20 text-amber-400' :
            'bg-emerald-500/20 text-emerald-400'
          }`}>
            {isDangerous ? <ShieldAlert size={40} /> :
             isWarning ? <AlertTriangle size={40} /> :
             <ShieldCheck size={40} />}
          </div>
          
          <h3 className="text-sm text-slate-400 font-medium tracking-wider uppercase mb-1">Reputation Score</h3>
          <div className="flex items-baseline gap-2">
            <span className={`text-5xl font-black tracking-tighter ${
               isDangerous ? 'text-rose-400' :
               isWarning ? 'text-amber-400' :
               'text-emerald-400'
            }`}>
              {malicious}
            </span>
            <span className="text-slate-500 font-bold text-xl">/ {total}</span>
          </div>
          <p className="mt-2 text-sm text-slate-300 font-medium">Security Vendors Flagged this IP</p>
        </div>

        {/* Breakdown Card */}
        <div className="md:col-span-2 p-6 rounded-2xl bg-[#0b1221] border border-slate-800 flex flex-col justify-center">
          <h3 className="text-lg font-bold text-slate-100 mb-6 flex items-center gap-2">
            <ActivityIcon />
            Analysis Breakdown
          </h3>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-24 text-sm font-medium text-rose-400">Malicious</div>
              <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-rose-500 rounded-full transition-all" style={{ width: `${(malicious / total) * 100}%` }} />
              </div>
              <div className="w-8 text-right font-bold text-slate-200">{malicious}</div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="w-24 text-sm font-medium text-amber-400">Suspicious</div>
              <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${(suspicious / total) * 100}%` }} />
              </div>
              <div className="w-8 text-right font-bold text-slate-200">{suspicious}</div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-24 text-sm font-medium text-emerald-400">Harmless</div>
              <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(harmless / total) * 100}%` }} />
              </div>
              <div className="w-8 text-right font-bold text-slate-200">{harmless}</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDetails = (attributes: any) => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-4">
          <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 mt-0.5">
            <MapPin size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Country</p>
            <p className="text-slate-200 font-semibold">{attributes.country || 'Unknown'}</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-4">
          <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 mt-0.5">
            <Network size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">AS Network</p>
            <p className="text-slate-200 font-semibold">{attributes.network || 'Unknown'}</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-4 lg:col-span-2">
          <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400 mt-0.5">
            <Server size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">AS Owner</p>
            <p className="text-slate-200 font-semibold truncate" title={attributes.as_owner}>
              {attributes.as_owner || 'Unknown'} (ASN: {attributes.asn || '?'})
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <Globe size={14} /> Global Threat Intelligence
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-2">
            IP Reputation Search
          </h1>
          <p className="text-slate-400 max-w-2xl text-lg">
            Scan and analyze IP addresses using the VirusTotal API to determine their risk level and geographic origin.
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative group z-20">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
        <form onSubmit={handleSearch} className="relative bg-[#070d1a] border border-slate-700/50 rounded-2xl p-2 flex items-center shadow-2xl">
          <div className="pl-4 pr-2 text-slate-400">
            <Search size={24} />
          </div>
          <input
            type="text"
            placeholder="Enter an IP address (e.g. 8.8.8.8)"
            className="flex-1 bg-transparent border-none outline-none text-slate-100 text-lg py-3 px-2 placeholder:text-slate-600 focus:ring-0"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !ip.trim()}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-8 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Scan IP'}
          </button>
        </form>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-8 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3">
          <AlertTriangle className="text-rose-400 shrink-0 mt-0.5" size={20} />
          <div>
            <h4 className="text-rose-400 font-bold mb-1">Scan Failed</h4>
            <p className="text-rose-400/80 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Results Section */}
      {result && result.data && result.data.attributes && (
        <div className="mt-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              Analysis Results
            </h2>
            <div className="text-sm text-slate-500 font-medium">
              Target: <span className="text-slate-300 font-mono bg-white/5 px-2 py-0.5 rounded ml-1">{ip}</span>
            </div>
          </div>
          
          {renderStats(result.data.attributes.last_analysis_stats)}
          {renderDetails(result.data.attributes)}
        </div>
      )}
    </div>
  );
}

// Just a small helper icon component
function ActivityIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
