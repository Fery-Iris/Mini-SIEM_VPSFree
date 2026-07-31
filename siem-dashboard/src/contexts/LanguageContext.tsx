'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import type { FC, ReactNode } from 'react';

export type Language = 'en' | 'id';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    if (typeof window !== 'undefined') { return (localStorage.getItem('app_lang') as Language) || 'en'; } return 'en';
  });

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('app_lang', newLang);
  };

  // Dynamic import translations
  const [translations, setTranslations] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    import('../translations').then((mod) => {
      setTranslations(mod.translations);
    });
  }, []);

  const t = (key: string): string => {
    return translations[lang]?.[key] || translations['en']?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

