const SUNBIRD_URL = 'https://api.sunbird.ai/tasks/translate';
const SUNBIRD_BASE = 'https://api.sunbird.ai/tasks';

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

function authHeaders(json = false) { const token = process.env.SUNBIRD_API_TOKEN?.trim(); if (!token) throw new Error('Sunbird AI is not configured'); return { Accept: 'application/json', Authorization: `Bearer ${token}`, ...(json ? { 'Content-Type': 'application/json' } : {}) }; }

export async function transcribe(audioBase64: string, mimeType: string, language: SunbirdLanguage): Promise<string> {
  const bytes = Buffer.from(audioBase64, 'base64');
  if (!bytes.length || bytes.length > 6 * 1024 * 1024) throw new Error('Audio must be between 1 byte and 6 MB');
  const form = new FormData();
  form.append('audio', new Blob([bytes], { type: mimeType || 'audio/webm' }), `homeward-voice.${mimeType.includes('ogg') ? 'ogg' : mimeType.includes('wav') ? 'wav' : 'webm'}`);
  form.append('language', language);
  const response = await fetch(`${SUNBIRD_BASE}/audio/transcriptions`, { method: 'POST', headers: authHeaders(), body: form, signal: AbortSignal.timeout(30_000) });
  const payload = await response.json().catch(() => ({})) as any;
  if (!response.ok || !payload?.audio_transcription?.trim()) throw new Error(payload?.detail || payload?.message || `Sunbird transcription failed (${response.status})`);
  return payload.audio_transcription.trim();
}

const VOICES: Partial<Record<SunbirdLanguage, string>> = { eng: 'salt_eng_0001', lug: 'salt_lug_0001', ach: 'salt_ach_0001', teo: 'salt_teo_0001', nyn: 'salt_nyn_0001', swa: 'waxal_swa_0006' };
export async function synthesize(text: string, language: SunbirdLanguage): Promise<{ audioUrl: string; expiresAt?: string }> {
  const response = await fetch(`${SUNBIRD_BASE}/audio/speech`, { method: 'POST', headers: authHeaders(true), body: JSON.stringify({ text: text.slice(0, 2500), language, ...(VOICES[language] ? { voice: VOICES[language] } : {}), response_mode: 'url' }), signal: AbortSignal.timeout(45_000) });
  const payload = await response.json().catch(() => ({})) as any;
  if (!response.ok || !payload?.audio_url) throw new Error(payload?.detail || payload?.message || `Sunbird speech synthesis failed (${response.status})`);
  return { audioUrl: payload.audio_url, expiresAt: payload.audio_url_expires_at };
}

export async function converse(message: string, language: SunbirdLanguage): Promise<string> {
  const response = await fetch(`${SUNBIRD_BASE}/chat/completions`, { method: 'POST', headers: authHeaders(true), body: JSON.stringify({ model: 'sunflower-14b', temperature: 0.2, max_tokens: 450, messages: [{ role: 'system', content: 'You are HomeWard’s multilingual guide. Explain the app simply. Never claim money was sent, request PINs, or perform a financial action. Tell users to use the HomeWard confirmation screen for transfers.' }, { role: 'user', content: message }] }), signal: AbortSignal.timeout(30_000) });
  const payload = await response.json().catch(() => ({})) as any;
  const reply = payload?.choices?.[0]?.message?.content;
  if (!response.ok || typeof reply !== 'string' || !reply.trim()) throw new Error(payload?.detail || payload?.message || `Sunbird conversation failed (${response.status})`);
  return reply.trim();
}
