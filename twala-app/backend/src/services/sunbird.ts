const SUNBIRD_URL = 'https://api.sunbird.ai/tasks/translate';

export const SUNBIRD_LANGUAGES = [
  { code: 'eng', name: 'English' }, { code: 'lug', name: 'Luganda' },
  { code: 'ach', name: 'Acholi' }, { code: 'teo', name: 'Ateso' },
  { code: 'lgg', name: 'Lugbara' }, { code: 'nyn', name: 'Runyankole' },
  { code: 'swa', name: 'Swahili' },
] as const;
export type SunbirdLanguage = typeof SUNBIRD_LANGUAGES[number]['code'];

export function isSunbirdConfigured(): boolean { return !!process.env.SUNBIRD_API_TOKEN?.trim(); }
export function isSunbirdLanguage(value: unknown): value is SunbirdLanguage { return typeof value === 'string' && SUNBIRD_LANGUAGES.some((language) => language.code === value); }

export async function translate(text: string, source: SunbirdLanguage, target: SunbirdLanguage): Promise<string> {
  if (source === target || !text.trim()) return text;
  const token = process.env.SUNBIRD_API_TOKEN?.trim();
  if (!token) throw new Error('Sunbird AI is not configured');
  const response = await fetch(SUNBIRD_URL, { method: 'POST', headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ source_language: source, target_language: target, text: text.slice(0, 5000) }), signal: AbortSignal.timeout(15_000) });
  const payload = await response.json().catch(() => ({})) as any;
  const translated = payload?.output?.translated_text || payload?.translated_text || payload?.output?.text;
  if (!response.ok || typeof translated !== 'string' || !translated.trim()) throw new Error(payload?.message || payload?.detail || `Sunbird translation failed (${response.status})`);
  return translated.trim();
}
