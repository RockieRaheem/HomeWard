type RecognitionResultEvent = {
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

type RecognitionErrorEvent = { error: string };

export interface VoiceRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type VoiceRecognitionConstructor = new () => VoiceRecognition;

function getConstructor(): VoiceRecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  const browserWindow = window as typeof window & {
    SpeechRecognition?: VoiceRecognitionConstructor;
    webkitSpeechRecognition?: VoiceRecognitionConstructor;
  };
  return browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
}

export function isVoiceRecognitionSupported(): boolean {
  return !!getConstructor();
}

export function createVoiceRecognition(): VoiceRecognition | null {
  const Recognition = getConstructor();
  if (!Recognition) return null;

  const recognition = new Recognition();
  recognition.lang = 'en-UG';
  recognition.continuous = false;
  recognition.interimResults = true;
  return recognition;
}
