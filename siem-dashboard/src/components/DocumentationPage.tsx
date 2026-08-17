import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Copy, Check, ChevronDown,
  Terminal, Server, FileText, Key, RotateCcw,
  ArrowRight, ExternalLink,
} from 'lucide-react';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { Footer } from './Footer';
import { LanguageToggle } from './LanguageToggle';
import { useLanguage } from '../contexts/LanguageContext';
import { Terminal as TerminalAnim, TypingAnimation, AnimatedSpan } from './ui/terminal';

const CodeBlock = ({ code }: { code: string; lang?: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const lines = code.split('\n');

  return (
    <div className="relative group my-3">
      
      <div className="absolute top-2.5 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-md bg-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-600 transition-all"
        >
          {copied ? <><Check size={12} className="text-emerald-400" /> Copied!</> : <><Copy size={12} /> Copy</>}
        </button>
      </div>

      <TerminalAnim>
        {lines.map((line, i) => {
          if (line.trim().startsWith('#') || !line.trim()) {
            return (
              <AnimatedSpan key={i} delay={50} className="text-slate-500 font-mono">
                {line}
              </AnimatedSpan>
            );
          }
          return (
            <TypingAnimation key={i} delay={50} duration={15}>
              {line}
            </TypingAnimation>
          );
        })}
      </TerminalAnim>
    </div>
  );
};

const STEP_ICONS = [Terminal, Server, FileText, Key, RotateCcw];

/* ─── Step Card Component ─── */
const StepCard = ({ step, index }: { step: { num: number; icon: typeof Terminal; title: string; desc: string; content: { label: string; code: string }[] }; index: number }) => {
  const [open, setOpen] = useState(index === 0);
  const reveal = useScrollReveal<HTMLDivElement>({ threshold: 0.08 });
  const Icon = step.icon;
  const { t } = useLanguage();

  return (
    <div
      ref={reveal.ref}
      className={`scroll-fade-up scroll-hidden ${reveal.isVisible ? 'scroll-revealed' : ''}`}
      style={{ transitionDelay: `${index * 80}ms` }}
    >
      
      
      <div
        className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
          open
            ? 'bg-white border-blue-200/70 shadow-xl shadow-blue-100/40 ring-1 ring-blue-100/50'
            : 'bg-white/70 border-slate-200/60 shadow-md shadow-slate-200/30 hover:shadow-lg hover:border-slate-300/60'
        }`}
      >
        {/* Header */}
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-4 p-5 md:p-6 text-left cursor-pointer"
        >
          <div
            className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg transition-all duration-300 ${
              open
                ? 'bg-gradient-to-br from-blue-500 to-cyan-500 shadow-blue-200/60 scale-110'
                : 'bg-gradient-to-br from-slate-400 to-slate-500 shadow-slate-200/40'
            }`}
          >
            {open ? <Check size={22} /> : step.num}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`text-base md:text-lg font-bold transition-colors ${open ? 'text-blue-700' : 'text-slate-800'}`}>
              {step.title}
            </h3>
            <p className="text-sm text-slate-500 mt-0.5 line-clamp-1">{step.desc}</p>
          </div>
          <div className="shrink-0 ml-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${open ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
              <ChevronDown size={16} className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
            </div>
          </div>
          
        </button>

        {/* Content */}
        <div
          className={`transition-all duration-400 ease-in-out overflow-hidden ${
            open ? 'max-h-[4000px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="px-5 md:px-6 pb-6 pt-0 space-y-4 border-t border-slate-100">
            
            <div className="flex items-center gap-2 pt-4 text-xs text-slate-400 font-semibold uppercase tracking-wider">
              <Icon size={14} />
              <span>Step {step.num} {t('docs.stepInstructions')}</span>
            </div>
            {step.content.map((item, i) => (
              <div key={i}>
                <p className="text-sm text-slate-600 font-medium mb-1">{item.label}</p>
                {item.code && <CodeBlock code={item.code} />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};



/* ─── Architecture Diagram ─── */
const ArchDiagram = () => {
  const reveal = useScrollReveal<HTMLDivElement>({ threshold: 0.1 });
  const { t } = useLanguage();
  const boxes = [
    { label: t('docs.webServer'), sub: 'Apache / Nginx', color: 'from-slate-600 to-slate-700', icon: '🌐' },
    { label: 'CrowdSec Engine', sub: t('docs.detectsAttacks'), color: 'from-indigo-500 to-blue-600', icon: '🛡️' },
    { label: 'Mini-SIEM Backend', sub: t('docs.processesAlerts'), color: 'from-blue-500 to-cyan-500', icon: '⚡' },
    { label: 'Dashboard', sub: t('docs.realTimeMonitoring'), color: 'from-emerald-500 to-teal-500', icon: '📊' },
  ];

  return (
    <div
      ref={reveal.ref}
      className={`scroll-scale-up scroll-hidden ${reveal.isVisible ? 'scroll-revealed' : ''}`}
    >
      <div className="bg-white/70 backdrop-blur-sm border border-slate-200/60 rounded-2xl p-6 md:p-8 shadow-lg shadow-slate-200/30">
        <h3 className="text-lg font-bold text-slate-800 mb-6 text-center">{t('docs.howItWorks')}</h3>
        <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-2">
          {boxes.map((box, i) => (
            <div key={i} className="flex items-center gap-2 md:gap-2">
              <div className={`bg-gradient-to-br ${box.color} rounded-xl p-4 text-white text-center min-w-[140px] shadow-lg`}>
                <div className="text-2xl mb-1">{box.icon}</div>
                <div className="text-xs font-bold">{box.label}</div>
                <div className="text-[10px] opacity-80 mt-0.5">{box.sub}</div>
              </div>
              {i < boxes.length - 1 && (
                <ArrowRight size={18} className="text-slate-300 shrink-0 hidden md:block" />
              )}
              {i < boxes.length - 1 && (
                <ChevronDown size={18} className="text-slate-300 shrink-0 md:hidden" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════ MAIN PAGE ═══════════════════ */
export const DocumentationPage = () => {
  const router = useRouter();
  const heroReveal = useScrollReveal<HTMLDivElement>({ threshold: 0.05 });
  const { t } = useLanguage();

  const STEP_CONTENT = [
    [
      { label: t('docs.step1.l1'), code: `curl -s https://install.crowdsec.net | sudo sh\nsudo apt install crowdsec` },
      { label: t('docs.step1.l2'), code: `sudo cscli collections install crowdsecurity/apache2\n# Or for Nginx:\n# sudo cscli collections install crowdsecurity/nginx` },
      { label: t('docs.step1.l3'), code: `sudo cscli collections list | grep -E "apache2|nginx"` },
    ],
    [
      { label: t('docs.step2.l1'), code: `sudo apt install crowdsec-firewall-bouncer-iptables` },
      { label: t('docs.step2.l2'), code: `sudo cscli bouncers list` },
    ],
    [
      { label: t('docs.step3.l1'), code: `sudo nano /etc/crowdsec/acquis.yaml` },
      { label: t('docs.step3.l2'), code: `# ── Apache ──\nfilenames:\n  - /var/log/apache2/access.log\nlabels:\n  type: apache2\n---\n# ── Or Nginx ──\n# filenames:\n#   - /var/log/nginx/access.log\n# labels:\n#   type: nginx` },
    ],
    [
      { label: t('docs.step4.l1'), code: '' },
      { label: t('docs.step4.l2'), code: `sudo nano /etc/crowdsec/notifications/http.yaml` },
      { label: t('docs.step4.l3'), code: `type: http\nname: http_default\nlog_level: info\n\nformat: |\n  [{{ range $i, $alert := . }}{{ if $i }},{{ end }}{\n    "id": {{ $alert.ID }},\n    "scenario": "{{ $alert.Scenario }}",\n    "message": "{{ $alert.Message }}",\n    "events_count": {{ $alert.EventsCount }},\n    "source": { "ip": "{{ $alert.Source.IP }}", "scope": "{{ $alert.Source.Scope }}", "value": "{{ $alert.Source.Value }}" },\n    "decisions": [{{ range $j, $d := $alert.Decisions }}{{ if $j }},{{ end }}{ "type": "{{ $d.Type }}", "value": "{{ $d.Value }}" }{{ end }}]\n  }{{ end }}]\n\nurl: https://mini-siem.prodevweb.my.id/api/alerts/webhook\nmethod: POST\nheaders:\n  Authorization: "Bearer YOUR_API_KEY"\n  Content-Type: "application/json"` },
      { label: t('docs.step4.l4'), code: `sudo nano /etc/crowdsec/profiles.yaml` },
      { label: t('docs.step4.l5'), code: `name: default_ip_remediation\nfilters:\n  - Alert.Remediation == true && Alert.GetScope() == "Ip"\ndecisions:\n  - type: ban\n    duration: 4h\nnotifications:\n  - http_default\non_success: break` },
    ],
    [
      { label: t('docs.step5.l1'), code: `sudo systemctl restart crowdsec` },
      { label: t('docs.step5.l2'), code: `sudo systemctl status crowdsec` },
      { label: t('docs.step5.l3'), code: `sudo cscli decisions add -i 1.2.3.4 -d 1m -t ban -R "test"\n# Check your Mini-SIEM dashboard — the alert should appear!\n# Then remove the test:\nsudo cscli decisions delete -i 1.2.3.4` },
    ],
  ];

  const STEPS = [
    { num: 1, icon: STEP_ICONS[0], title: t('docs.step1.title'), desc: t('docs.step1.desc'), content: STEP_CONTENT[0] },
    { num: 2, icon: STEP_ICONS[1], title: t('docs.step2.title'), desc: t('docs.step2.desc'), content: STEP_CONTENT[1] },
    { num: 3, icon: STEP_ICONS[2], title: t('docs.step3.title'), desc: t('docs.step3.desc'), content: STEP_CONTENT[2] },
    { num: 4, icon: STEP_ICONS[3], title: t('docs.step4.title'), desc: t('docs.step4.desc'), content: STEP_CONTENT[3] },
    { num: 5, icon: STEP_ICONS[4], title: t('docs.step5.title'), desc: t('docs.step5.desc'), content: STEP_CONTENT[4] },
  ];

  return (
    <div className="min-h-screen font-sans bg-slate-50 text-slate-900 selection:bg-blue-200">
      {/* ── Sticky Nav ── */}
      <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/')} className="flex items-center gap-2 group cursor-pointer">
              <img src="/logo-siem.png" alt="Mini-SIEM Logo" className="h-8 w-auto" />
              <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-900 tracking-tight">
                XR Security
              </span>
            </button>
            <LanguageToggle />
          </div>
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
            {t('docs.backHome')}
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative pt-28 pb-24 overflow-hidden min-h-[400px] flex flex-col justify-center">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          {/* Background Image - no white overlays so it's fully visible */}
          <div className="absolute inset-0 bg-[url('/BG3.png')] bg-cover bg-bottom bg-no-repeat bg-breathe opacity-100 mix-blend-multiply"></div>
        </div>
        <div
          ref={heroReveal.ref}
          className={`container mx-auto px-4 text-center scroll-fade-up scroll-hidden ${heroReveal.isVisible ? 'scroll-revealed' : ''}`}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-100/80 text-blue-700 text-xs font-bold uppercase tracking-wider mb-6 border border-blue-200/60">
            <FileText size={13} />
            {t('docs.badge')}
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-slate-800 leading-tight tracking-tight mb-4">
            {t('docs.title1')} <br className="hidden md:block" />
            {t('docs.title2')} <span className="text-blue-600">Mini-SIEM</span>
          </h1>
          <p className="text-base md:text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
            {t('docs.subtitle')}
          </p>
          <div className="mt-8 flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2 text-slate-400">
              <Terminal size={15} /> Linux / Ubuntu
            </div>
            <div className="w-px h-5 bg-slate-200" />
            <div className="flex items-center gap-2 text-slate-400">
              <Server size={15} /> Apache / Nginx
            </div>
            <div className="w-px h-5 bg-slate-200" />
            <div className="flex items-center gap-2 text-slate-400">
              {t('docs.setup')}
            </div>
          </div>
        </div>
        
      </section>

      {/* ── Architecture ── */}
      <section className="container mx-auto px-4 pb-10">
        <ArchDiagram />
      </section>

      {/* ── Steps ── */}
      <section className="container mx-auto px-4 pb-16">
        <div className="max-w-3xl mx-auto space-y-4">
          {STEPS.map((step, i) => (
            <StepCard key={step.num} step={step} index={i} />
          ))}
        </div>
      </section>

      {/* ── Prerequisites Box ── */}
      <section className="container mx-auto px-4 pb-16">
        <div className="max-w-3xl mx-auto bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-8 text-white shadow-xl shadow-blue-200/40 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
          <h3 className="text-xl font-bold mb-3 relative z-10">{t('docs.prerequisites')}</h3>
          <ul className="space-y-2 text-sm text-blue-100 relative z-10">
            <li className="flex items-start gap-2"><Check size={16} className="shrink-0 mt-0.5 text-emerald-300" /> {t('docs.prereq1')}</li>
            <li className="flex items-start gap-2"><Check size={16} className="shrink-0 mt-0.5 text-emerald-300" /> {t('docs.prereq2')}</li>
            <li className="flex items-start gap-2"><Check size={16} className="shrink-0 mt-0.5 text-emerald-300" /> {t('docs.prereq3')}</li>
            <li className="flex items-start gap-2"><Check size={16} className="shrink-0 mt-0.5 text-emerald-300" /> {t('docs.prereq4')}</li>
          </ul>
          <button
            onClick={() => router.push('/signin')}
            className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 bg-white text-blue-600 font-bold text-sm rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer"
          >
            {t('docs.createAccount')} <ExternalLink size={14} />
          </button>
        </div>
      </section>



      {/* ── Footer ── */}
      <Footer />
    </div>
  );
};
