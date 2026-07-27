import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import type { HomewardLanguage } from '../services/api';

export const HOMEWARD_LANGUAGES: HomewardLanguage[] = [
  { code: 'eng', name: 'English' }, { code: 'lug', name: 'Luganda' }, { code: 'ach', name: 'Acholi' },
  { code: 'teo', name: 'Ateso' }, { code: 'lgg', name: 'Lugbara' }, { code: 'nyn', name: 'Runyankole' }, { code: 'swa', name: 'Swahili' },
];

type LanguageContextValue = { language: HomewardLanguage['code']; setLanguage: (language: HomewardLanguage['code']) => void; languageName: string; t: (english: string) => string; };
const LanguageContext = createContext<LanguageContextValue | null>(null);
const STORAGE_KEY = 'homeward-language';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<HomewardLanguage['code']>('eng');
  useEffect(() => { if (Platform.OS === 'web' && typeof localStorage !== 'undefined') { const saved = localStorage.getItem(STORAGE_KEY) as HomewardLanguage['code'] | null; if (saved && HOMEWARD_LANGUAGES.some((item) => item.code === saved)) setLanguageState(saved); } }, []);
  const setLanguage = (next: HomewardLanguage['code']) => { setLanguageState(next); if (Platform.OS === 'web' && typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, next); };
  const value = useMemo(() => ({ language, setLanguage, languageName: HOMEWARD_LANGUAGES.find((item) => item.code === language)?.name || 'English', t: (english: string) => english }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
export function useLanguage() { const value = useContext(LanguageContext); if (!value) throw new Error('useLanguage must be used within LanguageProvider'); return value; }
