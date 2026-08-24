'use client';
import type { FC } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { Button } from './Button';
import { LanguageToggle } from './LanguageToggle';
import { useLanguage } from '../contexts/LanguageContext';

interface NavbarProps {
  onGetDemo?: () => void;
}

export const Navbar: FC<NavbarProps> = ({ onGetDemo }) => {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { t } = useLanguage();

  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-slate-100">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/logo-siem.png" alt="Mini-SIEM Logo" className="h-10 w-auto" />
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-900 tracking-tight">
            MicroGaze
          </span>
          <LanguageToggle />
        </div>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-4">
          <Button variant="outline" className="text-slate-600 font-semibold border-slate-200/60 shadow-sm" onClick={() => router.push('/docs')}>
            {t('nav.documentation')}
          </Button>
          <Button variant="primary" className="font-semibold shadow-md shadow-blue-500/20" onClick={() => router.push('/login')}>
            {t('nav.getFreeDemo')}
          </Button>
        </div>

        {/* Mobile Hamburger Toggle */}
        <button 
          className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white px-4 py-4 space-y-4 shadow-lg absolute w-full">
          <Button 
            variant="outline" 
            className="w-full text-slate-600 font-semibold border-slate-200/60 shadow-sm justify-center flex" 
            onClick={() => {
              router.push('/docs');
              setIsMenuOpen(false);
            }}
          >
            {t('nav.documentation')}
          </Button>
          <Button 
            variant="primary" 
            className="w-full font-semibold shadow-md shadow-blue-500/20 justify-center flex" 
            onClick={() => {
              router.push('/login');
              setIsMenuOpen(false);
            }}
          >
            {t('nav.getFreeDemo')}
          </Button>
        </div>
      )}
    </header>
  );
};



