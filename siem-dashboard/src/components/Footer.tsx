'use client';
import type { FC } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '../contexts/LanguageContext';

export const Footer: FC = () => {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <footer className="bg-slate-900 text-slate-400 relative overflow-hidden">
      {/* Subtle gradient accent */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />

      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <img src="/logo-siem.png" alt="Mini-SIEM Logo" className="h-8 w-auto" />
              <span className="text-lg font-bold text-white tracking-tight">
                MicroGaze
              </span>
            </div>
            <p className="text-sm leading-relaxed text-slate-500 max-w-xs">
              {t('footer.desc')}
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4">
              {t('footer.product')}
            </h4>
            <ul className="space-y-2.5">
              <li>
                <button
                  onClick={() => router.push('/docs')}
                  className="text-sm hover:text-blue-400 transition-colors cursor-pointer"
                >
                  {t('footer.documentation')}
                </button>
              </li>
              <li>
                <button
                  onClick={() => router.push('/signin')}
                  className="text-sm hover:text-blue-400 transition-colors cursor-pointer"
                >
                  {t('footer.getStarted')}
                </button>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4">
              {t('footer.resources')}
            </h4>
            <ul className="space-y-2.5">
              <li>
                <a
                  href="https://docs.crowdsec.net"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm hover:text-blue-400 transition-colors"
                >
                  CrowdSec Docs
                </a>
              </li>
              <li>
                <a
                  href="https://app.crowdsec.net"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm hover:text-blue-400 transition-colors"
                >
                  CrowdSec Console
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4">
              {t('footer.contact')}
            </h4>
            <ul className="space-y-2.5">
              <li className="text-sm">support@xrsecurity.io</li>
              <li>
                <a
                  href="https://github.com/FamilyJewelsRuined"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm hover:text-blue-400 transition-colors"
                >
                  GitHub
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-14 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-600">
            &copy; {new Date().getFullYear()} {t('footer.copyright')}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {t('footer.status')}
          </div>
        </div>
      </div>
    </footer>
  );
};

