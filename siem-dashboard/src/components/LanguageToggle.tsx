import type { FC } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface LanguageToggleProps {
  variant?: 'light' | 'dark';
}

export const LanguageToggle: FC<LanguageToggleProps> = ({ variant = 'light' }) => {
  const { lang, setLang } = useLanguage();

  const isEn = lang === 'en';

  // Toggle handlers
  const handleToggle = (selectedLang: 'en' | 'id') => {
    if (lang !== selectedLang) {
      setLang(selectedLang);
    }
  };

  const isLight = variant === 'light';

  return (
    <div
      className={`relative flex items-center p-1 overflow-hidden cursor-pointer w-[76px] h-[34px] group transition-all duration-300 ${
        isLight
          ? 'bg-slate-100/80 backdrop-blur-sm border border-slate-200/60 shadow-inner rounded-full hover:shadow-md hover:bg-white'
          : 'bg-slate-100 border border-slate-200/80 shadow-inner rounded-xl hover:shadow-md hover:bg-white'
      }`}
      onClick={() => handleToggle(isEn ? 'id' : 'en')}
      title={isEn ? 'Switch to Bahasa Indonesia' : 'Switch to English'}
    >
      {/* Animated Background Pill */}
      <div
        className={`absolute h-[26px] w-[34px] transition-all duration-500 bg-white shadow-[0_2px_8px_-2px_rgba(0,0,0,0.15)] border border-slate-200/80 ${
          isEn ? 'translate-x-0' : 'translate-x-[34px]'
        } ${isLight ? 'rounded-full' : 'rounded-lg'}`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
      />

      {/* Flag Labels */}
      <div className="relative z-10 flex-1 flex justify-center items-center h-full">
        <img
          src="https://flagcdn.com/w20/gb.png"
          alt="English"
          className={`w-[18px] h-[14px] object-cover rounded-[2px] transition-all duration-500 ${
            isEn
              ? 'opacity-100 scale-110 drop-shadow-sm'
              : 'opacity-40 grayscale scale-90 group-hover:scale-100 group-hover:grayscale-[50%] group-hover:opacity-70'
          }`}
        />
      </div>
      <div className="relative z-10 flex-1 flex justify-center items-center h-full">
        <img
          src="https://flagcdn.com/w20/id.png"
          alt="Indonesia"
          className={`w-[18px] h-[14px] object-cover border border-slate-200/50 rounded-[2px] transition-all duration-500 ${
            !isEn
              ? 'opacity-100 scale-110 drop-shadow-sm'
              : 'opacity-40 grayscale scale-90 group-hover:scale-100 group-hover:grayscale-[50%] group-hover:opacity-70'
          }`}
        />
      </div>
    </div>
  );
};
