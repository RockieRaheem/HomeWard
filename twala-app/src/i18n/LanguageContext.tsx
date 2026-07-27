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
const LUGANDA: Record<string, string> = {
  'Dashboard': 'Awaka', 'Goals': 'Ebigendererwa', 'Assistant': 'Muyambi', 'Transfer': 'Weereza', 'History': 'Ebyafaayo',
  'Choose your language': 'Londa olulimi lwo', 'This choice stays with HomeWard on this device.': 'Olulimi luno lujja kusigala mu HomeWard ku kyuma kino.',
  'Welcome Back': 'Kaale, mukomye', 'Set up your profile to start sending money': 'Teekateeka ebikwata ku ggwe otandike okuweereza ssente.', 'Enter your PIN to continue': 'Wandiika PIN yo okugenda mu maaso.',
  'Full Name': 'Amannya amatuufu', 'Phone Number (e.g. +256712345678)': 'Namba y’essimu (ng’ekyokulabirako +256712345678)', 'Create PIN (4-6 digits)': 'Tonda PIN (ennamba 4-6)', 'Confirm PIN': 'Kakasa PIN', 'Create Account': 'Ggulawo akawunti', 'Log In': 'Yingira', 'Already have an account? Log in': 'Olina akawunti dda? Yingira', "Don't have an account? Create one": 'Tolina akawunti? Ggulawo emu',
  'Good morning': 'Wasuze otya', 'Good afternoon': 'Osiibye otya', 'Good evening': 'Osiibye otya', 'Everything you send home, in one clear view.': 'Byonna by’oweereza awaka mu ndabika emu etegeerekeka.',
  'AVAILABLE TO SEND': 'SSENTE EZIRIWO OKUWEEREZA', 'USDC': 'USDC', 'Send money': 'Weereza ssente', 'Cash in': 'Teeka ssente', 'Ask HomeWard': 'Buuza HomeWard', 'Circles': 'Ebibiina',
  'Your goals': 'Ebigendererwa byo', 'See all': 'Laba byonna', 'Recent activity': 'Ebikoleddwa gye buvuddeko', 'View history': 'Laba ebyafaayo', 'Today’s exchange rate': 'Omuwendo gw’ensimbi ogwa leero',
  'Edit details': 'Kyusa ebikwata ku ggwe', 'My receipts': 'Obujulizi bwange', 'HomeWard Circles': 'Ebibiina bya HomeWard', 'Sign out': 'Fuluma',
  'HomeWard': 'HomeWard', 'New chat': 'Emboozi empya', 'Chats': 'Emboozi', 'How can I help you?': 'Nnyinza nkuyambe ntya?', 'Send Money': 'Weereza ssente', 'Savings': 'Kutereka',
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<HomewardLanguage['code']>('eng');
  useEffect(() => { if (Platform.OS === 'web' && typeof localStorage !== 'undefined') { const saved = localStorage.getItem(STORAGE_KEY) as HomewardLanguage['code'] | null; if (saved && HOMEWARD_LANGUAGES.some((item) => item.code === saved)) setLanguageState(saved); } }, []);
  const setLanguage = (next: HomewardLanguage['code']) => { setLanguageState(next); if (Platform.OS === 'web' && typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, next); };
  const value = useMemo(() => ({ language, setLanguage, languageName: HOMEWARD_LANGUAGES.find((item) => item.code === language)?.name || 'English', t: (english: string) => language === 'lug' ? (LUGANDA[english] || english) : english }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
export function useLanguage() { const value = useContext(LanguageContext); if (!value) throw new Error('useLanguage must be used within LanguageProvider'); return value; }
