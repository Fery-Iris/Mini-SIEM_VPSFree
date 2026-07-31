import { useState } from 'react';
import type { FC } from 'react';
import { ChevronDown, HelpCircle, MessageCircleQuestion } from 'lucide-react';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { useLanguage } from '../contexts/LanguageContext';

/* ─── Single FAQ Accordion Item ─── */
const FaqItem = ({ faq, index, isVisible }: { faq: { q: string; a: string }; index: number; isVisible: boolean }) => {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`scroll-fade-up scroll-hidden ${isVisible ? 'scroll-revealed' : ''}`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <div
        className={`rounded-2xl border backdrop-blur-md transition-all duration-300 overflow-hidden ${
          open
            ? 'bg-white/80 border-blue-200/70 shadow-xl shadow-blue-100/30 ring-1 ring-blue-100/40'
            : 'bg-white/60 border-white/40 shadow-lg shadow-slate-200/20 hover:shadow-xl hover:bg-white/70 hover:border-white/60'
        }`}
      >
        {/* Question */}
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-4 px-6 py-5 text-left cursor-pointer group"
        >
          <div
            className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
              open
                ? 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-200/50 scale-110'
                : 'bg-blue-50 text-blue-500 group-hover:bg-blue-100'
            }`}
          >
            <HelpCircle size={18} />
          </div>
          <span
            className={`flex-1 text-base font-semibold transition-colors duration-300 ${
              open ? 'text-blue-700' : 'text-slate-700 group-hover:text-slate-900'
            }`}
          >
            {faq.q}
          </span>
          <div
            className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${
              open ? 'bg-blue-100 text-blue-600 rotate-180' : 'bg-slate-100/80 text-slate-400 group-hover:bg-slate-200/80'
            }`}
          >
            <ChevronDown size={16} />
          </div>
        </button>

        {/* Answer */}
        <div
          className={`transition-all duration-400 ease-in-out overflow-hidden ${
            open ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="px-6 pb-5 pt-0 border-t border-slate-100/60">
            <p className="text-sm md:text-base text-slate-600 leading-relaxed pl-14 pt-4">
              {faq.a}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════ FAQ SECTION ═══════════════════ */
export const FaqSection: FC = () => {
  const headerReveal = useScrollReveal<HTMLDivElement>();
  const cardsReveal = useScrollReveal<HTMLDivElement>({ threshold: 0.08 });
  const { t } = useLanguage();

  const FAQS = [
    { q: t('faq.q1'), a: t('faq.a1') },
    { q: t('faq.q2'), a: t('faq.a2') },
    { q: t('faq.q3'), a: t('faq.a3') },
    { q: t('faq.q4'), a: t('faq.a4') },
  ];

  return (
    <section className="relative w-full py-24 overflow-hidden z-10">
      {/* Background Image & Overlays */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        {/* BG1 Background */}
        <div className="absolute inset-0 bg-[url('/BG1.png')] bg-cover bg-center bg-no-repeat opacity-100 bg-breathe"></div>

        {/* Soft overlay for readability */}
        <div className="absolute inset-0 bg-white/30"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-transparent to-white/80"></div>
      </div>

      <div className="container mx-auto px-4 max-w-4xl">
        {/* Section Header */}
        <div
          ref={headerReveal.ref}
          className={`text-center mb-14 space-y-4 scroll-fade-up scroll-hidden ${headerReveal.isVisible ? 'scroll-revealed' : ''}`}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-100/80 text-blue-700 text-xs font-bold uppercase tracking-wider border border-blue-200/60 backdrop-blur-sm">
            <MessageCircleQuestion size={14} />
            {t('faq.badge')}
          </div>

          <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-slate-800 leading-tight tracking-tight">
            {t('faq.title')}{' '}
            <span className="text-blue-600">{t('faq.titleHighlight')}</span>
          </h2>

          <p className="text-base md:text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
            {t('faq.subtitle')}
          </p>
        </div>

        {/* FAQ Accordion List */}
        <div
          ref={cardsReveal.ref}
          className="space-y-4"
        >
          {FAQS.map((faq, i) => (
            <FaqItem key={i} faq={faq} index={i} isVisible={cardsReveal.isVisible} />
          ))}
        </div>
      </div>
    </section>
  );
};
