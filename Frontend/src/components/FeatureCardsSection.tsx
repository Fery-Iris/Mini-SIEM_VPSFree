import type { FC } from 'react';
import { Shield, Zap, Settings } from 'lucide-react';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { useLanguage } from '../contexts/LanguageContext';

export const FeatureCardsSection: FC = () => {
  const headerReveal = useScrollReveal<HTMLDivElement>();
  const cardsReveal = useScrollReveal<HTMLDivElement>({ threshold: 0.1 });
  const { t } = useLanguage();

  const cards = [
    {
      title: t('cards.card1.title'),
      description: t('cards.card1.desc'),
      icon: <Shield size={32} className="text-blue-600" />,
      bgIcon: 'bg-blue-100',
    },
    {
      title: t('cards.card2.title'),
      description: t('cards.card2.desc'),
      icon: <Zap size={32} className="text-amber-500" />,
      bgIcon: 'bg-amber-100',
    },
    {
      title: t('cards.card3.title'),
      description: t('cards.card3.desc'),
      icon: <Settings size={32} className="text-emerald-600" />,
      bgIcon: 'bg-emerald-100',
    },
  ];

  return (
    <section className="relative min-h-screen w-full flex items-center py-24 overflow-hidden z-10">
      {/* Background Image & Overlays */}
      <div className="absolute inset-0 -z-10 overflow-hidden bg-slate-50">
        {/* Background Image */}
        <div className="absolute inset-0 bg-[url('/BG3.png')] bg-cover bg-center bg-no-repeat opacity-100 bg-breathe"></div>

        {/* Soft elegant gradient haze over the background for readability */}
        <div className="absolute inset-0 bg-white/40"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-transparent to-white/90"></div>
      </div>

      <div className="container mx-auto px-4 max-w-7xl">
        {/* Section Header */}
        <div
          ref={headerReveal.ref}
          className={`text-center max-w-4xl mx-auto mb-16 space-y-4 scroll-fade-up scroll-hidden ${headerReveal.isVisible ? 'scroll-revealed' : ''}`}
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-slate-800 leading-tight tracking-tight">
            {t('cards.heading')} <span className="text-blue-600">Mini-SIEM</span>
          </h2>
        </div>

        {/* Feature Cards Grid */}
        <div
          ref={cardsReveal.ref}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8"
        >
          {cards.map((card, idx) => (
            <div
              key={idx}
              className={`bg-white/90 backdrop-blur-md rounded-2xl p-8 shadow-lg border border-slate-100 hover:-translate-y-2 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300 flex flex-col items-start text-left group cursor-pointer scroll-fade-up scroll-hidden scroll-delay-${(idx + 1) * 100} ${cardsReveal.isVisible ? 'scroll-revealed' : ''}`}
            >
              {/* Icon Container */}
              <div className={`w-16 h-16 rounded-2xl mb-6 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform ${card.bgIcon}`}>
                {card.icon}
              </div>

              <h3 className="text-2xl font-bold text-slate-800 mb-4">{card.title}</h3>

              <p className="text-slate-600 text-lg leading-relaxed">
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
