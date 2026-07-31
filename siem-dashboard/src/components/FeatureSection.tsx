import type { FC } from 'react';
import { Check } from 'lucide-react';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { useLanguage } from '../contexts/LanguageContext';

export const FeatureSection: FC = () => {
  const sectionLeft = useScrollReveal<HTMLDivElement>();
  const sectionRight = useScrollReveal<HTMLDivElement>();
  const { t } = useLanguage();

  return (
    <section id="demo-video-section" className="relative min-h-screen w-full flex items-center py-20 overflow-hidden z-10">
      {/* Background Image / Gradient */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 bg-[url('/BG2.png')] bg-cover bg-center bg-no-repeat opacity-100 bg-breathe"></div>
        
        {/* Subtle Haze to ensure text readability without hiding the image */}
        <div className="absolute inset-0 bg-white/20"></div>
      </div>

      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex flex-col lg:flex-row items-center gap-16">

          {/* Left Column: Content */}
          <div
            ref={sectionLeft.ref}
            className={`w-full lg:w-1/2 flex flex-col space-y-8 z-a0 scroll-fade-left scroll-hidden ${sectionLeft.isVisible ? 'scroll-revealed' : ''}`}
          >
            <h2 className="text-4xl lg:text-5xl font-extrabold text-slate-800 leading-tight tracking-tight">
              {t('feature.title')} <span className="font-light text-slate-500">{t('feature.subtitle')}</span>
            </h2>

            <ul className="space-y-6 pt-4">
              {[
                t('feature.check1'),
                t('feature.check2'),
                t('feature.check3'),
              ].map((feature, idx) => (
                <li key={idx} className="flex items-start gap-4">
                  <div className="mt-1 flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <Check size={14} strokeWidth={3} />
                  </div>
                  <span className="text-xl text-slate-700 font-medium">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right Column: Video Mockup */}
          <div
            ref={sectionRight.ref}
            className={`w-full lg:w-1/2 relative z-10 scroll-fade-right scroll-hidden ${sectionRight.isVisible ? 'scroll-revealed' : ''}`}
          >
            {/* Background Glow for Video */}
            <div className="absolute -inset-4 bg-blue-400/20 blur-2xl rounded-3xl -z-10"></div>

            <div className="relative w-full aspect-video bg-slate-900 rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
              <iframe
                className="absolute top-0 left-0 w-full h-full"
                src="https://www.youtube.com/embed/r4YfvS6BIjg?si=HoKPE2GJCIkWH4l9"
                title="Mini-SIEM Demonstration"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              ></iframe>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
