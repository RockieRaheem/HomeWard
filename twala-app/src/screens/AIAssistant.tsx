import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Animated, KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard, Modal, Dimensions, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { chatApi, isBackendOnline, notifyChange, type ChatMsg, type ChatSessionData, type NavigateAction, type HomewardLanguage } from '../services/api';
import DismissKeyboard from '../components/DismissKeyboard';
import { createVoiceRecognition, isVoiceRecognitionSupported, type VoiceRecognition } from '../services/voiceRecognition';
import { useLanguage } from '../i18n/LanguageContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.78;
const HOMEWARD_LANGUAGES: HomewardLanguage[] = [
  { code: 'eng', name: 'English' }, { code: 'lug', name: 'Luganda' }, { code: 'ach', name: 'Acholi' },
  { code: 'teo', name: 'Ateso' }, { code: 'lgg', name: 'Lugbara' }, { code: 'nyn', name: 'Runyankole' }, { code: 'swa', name: 'Swahili' },
];
const BROWSER_VOICE_LOCALES: Record<HomewardLanguage['code'], string> = { eng: 'en-UG', lug: 'lg-UG', ach: 'en-UG', teo: 'en-UG', lgg: 'en-UG', nyn: 'en-UG', swa: 'sw-KE' };

// ---------------------------------------------------------------------------
// Typing indicator
// ---------------------------------------------------------------------------

function TypingDots() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 400, useNativeDriver: true }),
        ])
      )
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, []);

  return (
    <View style={typingStyles.container}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={[typingStyles.dot, { opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }]}
        />
      ))}
    </View>
  );
}

const typingStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingHorizontal: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary + '99' },
});

// ---------------------------------------------------------------------------
// Markdown renderer
// ---------------------------------------------------------------------------

interface InlineSegment { t: 'text' | 'bold' | 'code'; v: string; }

function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let remaining = text;
  let guard = 0;
  while (remaining.length > 0 && guard < 30) {
    guard++;
    const b = remaining.match(/\*\*(.+?)\*\*/);
    const c = remaining.match(/`([^`]+)`/);
    let first: RegExpMatchArray | null = null;
    let type: 'bold' | 'code' = 'bold';
    if (b && c) { if (b.index! <= c.index!) { first = b; type = 'bold'; } else { first = c; type = 'code'; } }
    else if (b) { first = b; type = 'bold'; } else if (c) { first = c; type = 'code'; }
    if (first && first.index !== undefined) {
      if (first.index > 0) segments.push({ t: 'text', v: remaining.substring(0, first.index) });
      segments.push({ t: type, v: first[1] });
      remaining = remaining.substring(first.index + first[0].length);
    } else { segments.push({ t: 'text', v: remaining }); remaining = ''; }
  }
  return segments;
}

function renderInline(segments: InlineSegment[], baseStyle: any, boldStyle: any, codeStyle: any): React.ReactNode[] {
  return segments.map((s, i) => {
    if (s.t === 'bold') return <Text key={i} style={boldStyle}>{s.v}</Text>;
    if (s.t === 'code') return <Text key={i} style={codeStyle}>{s.v}</Text>;
    return <Text key={i} style={baseStyle}>{s.v}</Text>;
  });
}

function renderRichText(content: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const lines = content.split('\n');
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let codeKey = 0;

  for (let idx = 0; idx < lines.length; idx++) {
    const raw = lines[idx];
    const trimmed = raw.trim();

    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        nodes.push(<View key={`cb-${codeKey++}`} style={richStyles.codeBlock}><Text style={richStyles.codeText}>{codeBuffer.join('\n')}</Text></View>);
        codeBuffer = []; inCodeBlock = false;
      } else { inCodeBlock = true; }
      continue;
    }
    if (inCodeBlock) { codeBuffer.push(raw); continue; }

    if (!trimmed) { nodes.push(<View key={`sp-${idx}`} style={{ height: 6 }} />); continue; }

    if (/^[-*_]{3,}$/.test(trimmed)) { nodes.push(<View key={`hr-${idx}`} style={richStyles.hr} />); continue; }

    const hm = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (hm) {
      const level = hm[1].length;
      nodes.push(<Text key={`h-${idx}`} style={level === 1 ? richStyles.h1 : level === 2 ? richStyles.h2 : richStyles.h3}>{renderInline(parseInline(hm[2]), level === 1 ? richStyles.h1 : level === 2 ? richStyles.h2 : richStyles.h3, richStyles.boldInline, richStyles.codeInline)}</Text>);
      continue;
    }

    if (trimmed.startsWith('> ')) {
      nodes.push(<View key={`bq-${idx}`} style={richStyles.blockquote}><Text style={richStyles.blockquoteText}>{renderInline(parseInline(trimmed.replace(/^>\s?/, '')), richStyles.blockquoteText, richStyles.boldInline, richStyles.codeInline)}</Text></View>);
      continue;
    }

    const ulMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    if (ulMatch) {
      nodes.push(<View key={`ul-${idx}`} style={richStyles.listRow}><Text style={richStyles.bullet}>•</Text><Text style={richStyles.listText}>{renderInline(parseInline(ulMatch[1]), richStyles.listText, richStyles.boldInline, richStyles.codeInline)}</Text></View>);
      continue;
    }

    const olMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (olMatch) {
      nodes.push(<View key={`ol-${idx}`} style={richStyles.listRow}><Text style={richStyles.olBullet}>{olMatch[1]}.</Text><Text style={richStyles.listText}>{renderInline(parseInline(olMatch[2]), richStyles.listText, richStyles.boldInline, richStyles.codeInline)}</Text></View>);
      continue;
    }

    const emojiMatch = trimmed.match(/^([✅❌⚠️🎯🎉💸💰🏠📋💱📅⏰🛡️💳🔒📊💡👋✨🔗🎓⭐]+)\s*/);
    if (emojiMatch) {
      const rest = trimmed.substring(emojiMatch[0].length);
      nodes.push(<View key={`em-${idx}`} style={richStyles.emojiRow}><Text style={richStyles.emojiChar}>{emojiMatch[1]}</Text><Text style={richStyles.emojiText}>{renderInline(parseInline(rest), richStyles.emojiText, richStyles.boldInline, richStyles.codeInline)}</Text></View>);
      continue;
    }

    const segs = parseInline(trimmed);
    nodes.push(<Text key={`p-${idx}`} style={richStyles.paragraph}>{renderInline(segs, richStyles.paragraph, richStyles.boldInline, richStyles.codeInline)}</Text>);
  }

  if (inCodeBlock && codeBuffer.length > 0) {
    nodes.push(<View key={`cb-${codeKey}`} style={richStyles.codeBlock}><Text style={richStyles.codeText}>{codeBuffer.join('\n')}</Text></View>);
  }
  return nodes;
}

const richStyles = StyleSheet.create({
  h1: { fontSize: Typography.headlineSm.fontSize, fontFamily: 'Montserrat', fontWeight: '700', color: Colors.primary, marginTop: 12, marginBottom: 4, lineHeight: 28 },
  h2: { fontSize: 16, fontFamily: 'Montserrat', fontWeight: '700', color: Colors.primary, marginTop: 10, marginBottom: 3, lineHeight: 24 },
  h3: { fontSize: 15, fontFamily: 'Inter', fontWeight: '600', color: Colors.onSurface, marginTop: 8, marginBottom: 2, lineHeight: 22 },
  paragraph: { fontSize: Typography.bodyMd.fontSize, fontFamily: 'Inter', color: Colors.onSurface, lineHeight: 22, marginBottom: 4 },
  boldInline: { fontWeight: '700', fontFamily: 'Inter', color: Colors.primary },
  codeInline: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13, backgroundColor: Colors.surfaceContainerHigh, color: Colors.tertiary, paddingHorizontal: 4, borderRadius: 4 },
  codeBlock: { backgroundColor: Colors.surfaceContainerHigh, padding: 12, borderRadius: BorderRadius.lg, marginVertical: 6, borderWidth: 1, borderColor: Colors.outlineVariant + '4D' },
  codeText: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13, color: Colors.onSurface, lineHeight: 20 },
  hr: { height: 1, backgroundColor: Colors.outlineVariant + '80', marginVertical: 10 },
  blockquote: { borderLeftWidth: 3, borderLeftColor: Colors.primary + '80', paddingLeft: 12, marginVertical: 4, backgroundColor: Colors.surfaceContainerLow, paddingVertical: 8, paddingRight: 12, borderRadius: 4 },
  blockquoteText: { fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', color: Colors.onSurfaceVariant, lineHeight: 20, fontStyle: 'italic' },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginVertical: 2, paddingLeft: 4 },
  bullet: { fontSize: Typography.bodyMd.fontSize, fontFamily: 'Inter', color: Colors.primary, lineHeight: 22, width: 10, textAlign: 'center' },
  olBullet: { fontSize: Typography.bodyMd.fontSize, fontFamily: 'Inter', fontWeight: '600', color: Colors.primary, lineHeight: 22, minWidth: 20, textAlign: 'right' },
  listText: { flex: 1, fontSize: Typography.bodyMd.fontSize, fontFamily: 'Inter', color: Colors.onSurface, lineHeight: 22 },
  emojiRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginVertical: 3, paddingLeft: 2 },
  emojiChar: { fontSize: 16, lineHeight: 22, width: 22, textAlign: 'center' },
  emojiText: { flex: 1, fontSize: Typography.bodyMd.fontSize, fontFamily: 'Inter', color: Colors.onSurface, lineHeight: 22 },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupSessionsByTime(sessions: ChatSessionData[]): { title: string; data: ChatSessionData[] }[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const weekStart = new Date(todayStart.getTime() - 6 * 86400000);

  const groups: Record<string, ChatSessionData[]> = { Today: [], Yesterday: [], 'Last 7 Days': [], Older: [] };
  for (const s of sessions) {
    const d = new Date(s.lastMessageAt);
    if (d >= todayStart) groups.Today.push(s);
    else if (d >= yesterdayStart) groups.Yesterday.push(s);
    else if (d >= weekStart) groups['Last 7 Days'].push(s);
    else groups.Older.push(s);
  }
  return Object.entries(groups).filter(([, v]) => v.length > 0).map(([title, data]) => ({ title, data }));
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  onNavigate?: (screen: string) => void;
  onNavigateGoal?: (id: string) => void;
  userName?: string;
  userPhone?: string;
}

export type { Props as AIAssistantProps };

export default function AIAssistant({ onNavigate, onNavigateGoal, userName, userPhone }: Props) {
  const { language, setLanguage } = useLanguage();
  const [sessions, setSessions] = useState<ChatSessionData[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleteChatCandidate, setDeleteChatCandidate] = useState<ChatSessionData | null>(null);
  const [deletingChat, setDeletingChat] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [sunbirdEnabled, setSunbirdEnabled] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  const listRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const recognitionRef = useRef<VoiceRecognition | null>(null);
  const recorderRef = useRef<any>(null);
  const recorderStreamRef = useRef<any>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToEnd = useCallback(() => {
    if (listRef.current && messages.length > 0) {
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: false });
      }, 50);
    }
  }, [messages.length]);

  useEffect(() => { scrollToEnd(); }, [messages, isTyping, scrollToEnd]);

  const loadSessions = useCallback(async () => {
    const [sessionsRes, sugRes, languageRes] = await Promise.all([chatApi.listSessions(), chatApi.suggestions(), chatApi.languages()]);
    if (sessionsRes.success && sessionsRes.data) {
      setSessions(sessionsRes.data);
      if (sessionsRes.data.length > 0 && !activeSessionId) {
        loadSessionIntoState(sessionsRes.data[0].id);
      } else if (sessionsRes.data.length === 0 && !activeSessionId) {
        const createRes = await chatApi.createSession();
        if (createRes.success && createRes.data) {
          setSessions([createRes.data]);
          setActiveSessionId(createRes.data.id);
        }
      }
    }
    if (sugRes.success && sugRes.data) setSuggestions(sugRes.data);
    if (languageRes.success && languageRes.data) setSunbirdEnabled(languageRes.data.configured);
    setLoading(false);
  }, []);

  useEffect(() => { loadSessions(); }, []);

  useEffect(() => () => { recognitionRef.current?.stop(); if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current); recorderStreamRef.current?.getTracks?.().forEach((track: any) => track.stop()); }, []);

  const loadSessionIntoState = async (id: string) => {
    setActiveSessionId(id);
    const res = await chatApi.getSession(id);
    if (res.success && res.data) setMessages(res.data.messages);
  };

  const switchSession = (id: string) => {
    setSidebarVisible(false);
    loadSessionIntoState(id);
  };

  const createNewSession = async () => {
    const res = await chatApi.createSession();
    if (res.success && res.data) {
      setSessions((prev) => [res.data, ...prev]);
      setActiveSessionId(res.data.id);
      setMessages([]);
      setSidebarVisible(false);
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  };

  const deleteSession = (id: string, title: string) => setDeleteChatCandidate({ id, title, createdAt: '', lastMessageAt: '' });

  const confirmDeleteChat = async () => {
    if (!deleteChatCandidate || deletingChat) return;
    setDeletingChat(true);
    try {
      const id = deleteChatCandidate.id;
      const result = await chatApi.deleteSession(id);
      if (!result.success) { Alert.alert('Could not delete chat', result.message || 'Please try again.'); return; }
      const remaining = sessions.filter((s) => s.id !== id);
          setSessions(remaining);
      setDeleteChatCandidate(null);
      if (activeSessionId === id) {
        if (remaining.length > 0) loadSessionIntoState(remaining[0].id);
        else {
          const createRes = await chatApi.createSession();
          if (createRes.success && createRes.data) { setSessions([createRes.data]); setActiveSessionId(createRes.data.id); setMessages([]); }
          }
      }
    } catch (err: any) { Alert.alert('Could not delete chat', err.message || 'Please try again.'); }
    finally { setDeletingChat(false); }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    let sid = activeSessionId;
    if (!sid) {
      const createRes = await chatApi.createSession();
      if (!createRes.success || !createRes.data) return;
      sid = createRes.data.id;
      setSessions((prev) => [createRes.data, ...prev]);
      setActiveSessionId(sid);
    }

    const userMsg = text.trim();
    setMessage('');
    setIsTyping(true);
    setError(null);

    const optimistic: ChatMsg = { role: 'user', content: userMsg, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, optimistic]);

    const [chatRes, sugRes] = await Promise.all([chatApi.send(sid, userMsg, userName, userPhone, language), chatApi.suggestions()]);
    if (chatRes.success && chatRes.data) {
      const { messages: msgs, navigate } = chatRes.data as any;
      if (Array.isArray(msgs) && msgs.length > 0) { setMessages(msgs); notifyChange(); }
      if (navigate) {
        const nav = navigate as NavigateAction;
        if (nav.screen === 'GoalDetail' && nav.goalId && onNavigateGoal) onNavigateGoal(nav.goalId);
        else if (onNavigate) onNavigate(nav.screen);
      }
      if (language !== 'eng' && !chatRes.data.translationAvailable) setVoiceHint('Sunbird translation is not configured yet, so HomeWard replied in English.');
      const sessionsRes = await chatApi.listSessions();
      if (sessionsRes.success && sessionsRes.data) setSessions(sessionsRes.data);
    } else {
      setError(chatRes.message || 'Failed to send');
    }
    if (sugRes.success && sugRes.data) setSuggestions(sugRes.data);
    setIsTyping(false);
    inputRef.current?.blur();
  };

  const stopSunbirdRecording = () => {
    if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
    const recorder = recorderRef.current;
    if (recorder?.state === 'recording') recorder.stop();
  };

  const startSunbirdRecording = async (): Promise<boolean> => {
    const BrowserMediaRecorder = (globalThis as any).MediaRecorder;
    if (Platform.OS !== 'web' || !BrowserMediaRecorder || !navigator.mediaDevices?.getUserMedia) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const recorder = new BrowserMediaRecorder(stream, BrowserMediaRecorder.isTypeSupported?.('audio/webm') ? { mimeType: 'audio/webm' } : undefined);
      recorderRef.current = recorder; recorderStreamRef.current = stream;
      recorder.ondataavailable = (event: any) => { if (event.data?.size) chunks.push(event.data); };
      recorder.onstop = async () => {
        recorderStreamRef.current?.getTracks?.().forEach((track: any) => track.stop());
        recorderStreamRef.current = null; recorderRef.current = null; setIsListening(false);
        if (!chunks.length) return setVoiceHint('No audio was captured. Please try again.');
        setTranscribing(true); setVoiceHint('Sunbird AI is transcribing your voice…');
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); });
          const result = await chatApi.transcribe(dataUrl.split(',')[1] || '', blob.type || 'audio/webm', language);
          if (!result.success || !result.data?.text) throw new Error(result.message || 'Sunbird could not understand that recording');
          setMessage((current) => current ? `${current} ${result.data.text}` : result.data.text);
          setVoiceHint('Voice captured by Sunbird. Review the text, then tap send.');
        } catch (error: any) { setVoiceHint(error?.message || 'Sunbird could not transcribe the recording. Please try again.'); }
        finally { setTranscribing(false); }
      };
      recorder.start(); setIsListening(true); setVoiceHint('Listening with Sunbird AI… tap again when you finish.');
      recordingTimerRef.current = setTimeout(() => { setVoiceHint('Recording stopped after 45 seconds. Transcribing now…'); stopSunbirdRecording(); }, 45_000);
      return true;
    } catch (error: any) { setVoiceHint(error?.name === 'NotAllowedError' ? 'Microphone access was blocked. Allow it in browser settings and try again.' : 'Could not start recording. Please try again.'); return true; }
  };

  const speakWithDevice = (text: string, id: string, notice?: string) => {
    const speech = (globalThis as any).speechSynthesis;
    const Utterance = (globalThis as any).SpeechSynthesisUtterance;
    if (Platform.OS !== 'web' || !speech || !Utterance) { setSpeakingMessageId(null); return setVoiceHint('Voice playback needs the deployed web app in a browser with audio enabled.'); }
    speech.cancel();
    const utterance = new Utterance(text.replace(/[*_`#]/g, '').replace(/https?:\/\/\S+/g, ''));
    utterance.lang = BROWSER_VOICE_LOCALES[language]; utterance.rate = 0.92;
    utterance.onend = () => { setSpeakingMessageId(null); setVoiceHint(null); };
    utterance.onerror = () => { setSpeakingMessageId(null); setVoiceHint('Your browser could not play this voice. Check media permissions and volume.'); };
    setSpeakingMessageId(id); setVoiceHint(notice || 'Reading the reply aloud…'); speech.speak(utterance);
  };

  const speakResponse = async (text: string, id: string) => {
    if (!sunbirdEnabled) return speakWithDevice(text, id, 'Sunbird is not connected yet; using your device voice.');
    if (Platform.OS !== 'web' || !(globalThis as any).Audio) return speakWithDevice(text, id, 'Using your device voice.');
    setSpeakingMessageId(id); setVoiceHint('Sunbird AI is preparing a spoken reply…');
    try { const response = await chatApi.speech(text, language); if (!response.success || !response.data?.audioUrl) throw new Error(response.message || 'Could not create speech'); const audio = new (globalThis as any).Audio(response.data.audioUrl); audio.onended = () => { setSpeakingMessageId(null); setVoiceHint(null); }; audio.onerror = () => speakWithDevice(text, id, 'Sunbird audio could not play; using your device voice.'); await audio.play(); setVoiceHint(null); } catch { speakWithDevice(text, id, 'Sunbird voice is unavailable; using your device voice.'); }
  };

  const toggleVoiceInput = async () => {
    if (recorderRef.current?.state === 'recording') return stopSunbirdRecording();
    if (sunbirdEnabled && await startSunbirdRecording()) return;
    if (Platform.OS !== 'web' || !isVoiceRecognitionSupported()) {
      Alert.alert('Voice input unavailable', 'Use HomeWard voice input in Chrome or Edge on a mobile device, then allow microphone access.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = createVoiceRecognition();
    if (!recognition) return;
    recognition.lang = BROWSER_VOICE_LOCALES[language];
    recognitionRef.current = recognition;
    setVoiceHint('Listening… speak naturally, then review your text before sending.');
    setIsListening(true);

    recognition.onresult = (event) => {
      let transcript = '';
      for (let index = event.results.length - 1; index >= 0; index--) {
        const result = event.results[index];
        if (result.isFinal) {
          transcript = result[0].transcript.trim();
          break;
        }
      }
      if (transcript) {
        setMessage((current) => current ? `${current} ${transcript}` : transcript);
        setVoiceHint('Voice captured. Review it, then tap send.');
      }
    };
    recognition.onerror = (event) => {
      const messages: Record<string, string> = {
        'not-allowed': 'Microphone access was blocked. Allow it in your browser settings and try again.',
        'no-speech': 'No speech was detected. Try again and speak after the listening indicator appears.',
        'network': 'Voice recognition needs an internet connection. Please try again.',
      };
      setVoiceHint(messages[event.error] || 'Voice input could not start. Please try again.');
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };
    try {
      recognition.start();
    } catch {
      setIsListening(false);
      setVoiceHint('Voice input is already starting. Please try again in a moment.');
    }
  };

  const groupedSessions = groupSessionsByTime(sessions);
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const showQuickActions = messages.length <= 1 && !isTyping && !loading;

  // --- Render helpers ---

  const renderChatItem = ({ item }: { item: ChatMsg }) => {
    if (item.role === 'user') {
      return (
        <View style={msgStyles.userMessage}>
          <Text style={msgStyles.userMessageText}>{item.content}</Text>
          <Text style={msgStyles.userMsgTime}>
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      );
    }
    return (
      <View style={msgStyles.aiRow}>
        <View style={msgStyles.aiAvatarSmall}>
          <MaterialCommunityIcons name="robot" size={18} color={Colors.onSecondaryContainer} />
        </View>
        <View style={msgStyles.aiBlock}>
          <View style={msgStyles.aiMessage}>
            {renderRichText(item.content)}
            <View style={msgStyles.aiMessageFooter}><Text style={msgStyles.aiMsgTime}>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text><TouchableOpacity style={msgStyles.speakButton} onPress={() => speakResponse(item.content, item.id || item.timestamp)} accessibilityLabel="Listen to this answer"><MaterialCommunityIcons name={speakingMessageId === (item.id || item.timestamp) ? 'volume-high' : 'volume-medium'} size={16} color={Colors.primary} /></TouchableOpacity></View>
          </View>
        </View>
      </View>
    );
  };

  const renderSidebarItem = (s: ChatSessionData) => {
    const isActive = activeSessionId === s.id;
    return (
      <TouchableOpacity
        key={s.id}
        style={[sidebarStyles.item, isActive && sidebarStyles.itemActive]}
        onPress={() => switchSession(s.id)}
        onLongPress={() => deleteSession(s.id, s.title)}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons
          name="message-text-outline"
          size={18}
          color={isActive ? Colors.primary : Colors.onSurfaceVariant}
        />
        <View style={sidebarStyles.itemContent}>
          <Text style={[sidebarStyles.itemTitle, isActive && { color: Colors.primary }]} numberOfLines={1}>
            {s.title}
          </Text>
          <Text style={sidebarStyles.itemTime}>{formatRelativeTime(s.lastMessageAt)}</Text>
        </View>
        <TouchableOpacity style={sidebarStyles.itemDelete} onPress={() => deleteSession(s.id, s.title)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MaterialCommunityIcons name="delete-outline" size={18} color={Colors.error} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // --- Main render ---

  return (
    <View style={styles.container}>
      {/* Sidebar */}
      <Modal visible={sidebarVisible} animationType="none" transparent onRequestClose={() => setSidebarVisible(false)}>
        <View style={sidebarStyles.overlay}>
          <TouchableOpacity style={sidebarStyles.backdrop} activeOpacity={1} onPress={() => setSidebarVisible(false)} />
          <View style={sidebarStyles.panel}>
            <View style={sidebarStyles.headerRow}>
              <Text style={sidebarStyles.headerTitle}>Chats</Text>
              <TouchableOpacity onPress={() => setSidebarVisible(false)} style={sidebarStyles.closeBtn}>
                <MaterialCommunityIcons name="close" size={22} color={Colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={sidebarStyles.newChatBtn} onPress={createNewSession} activeOpacity={0.7}>
              <MaterialCommunityIcons name="plus" size={20} color={Colors.onPrimary} />
              <Text style={sidebarStyles.newChatLabel}>New chat</Text>
            </TouchableOpacity>

            <FlatList
              data={groupedSessions}
              keyExtractor={(g) => g.title}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={sidebarStyles.listContent}
              renderItem={({ item: group }) => (
                <View style={sidebarStyles.group}>
                  <Text style={sidebarStyles.groupTitle}>{group.title}</Text>
                  {group.data.map(renderSidebarItem)}
                </View>
              )}
              ListEmptyComponent={
                loading ? null : (
                  <View style={sidebarStyles.empty}>
                    <MaterialCommunityIcons name="message-outline" size={36} color={Colors.outlineVariant} />
                    <Text style={sidebarStyles.emptyText}>No chats yet</Text>
                  </View>
                )
              }
            />
          </View>
        </View>
      </Modal>

      <Modal visible={!!deleteChatCandidate} transparent animationType="fade" onRequestClose={() => !deletingChat && setDeleteChatCandidate(null)}>
        <View style={styles.deleteOverlay}><View style={styles.deleteSheet}><View style={styles.deleteIcon}><MaterialCommunityIcons name="trash-can-outline" size={27} color={Colors.error} /></View><Text style={styles.deleteTitle}>Delete this chat?</Text><Text style={styles.deleteText}>“{deleteChatCandidate?.title}” and its messages will be permanently removed.</Text><View style={styles.deleteActions}><TouchableOpacity disabled={deletingChat} style={styles.deleteCancel} onPress={() => setDeleteChatCandidate(null)}><Text style={styles.deleteCancelText}>Keep chat</Text></TouchableOpacity><TouchableOpacity disabled={deletingChat} style={styles.deleteConfirm} onPress={confirmDeleteChat}>{deletingChat ? <ActivityIndicator size="small" color={Colors.onError} /> : <Text style={styles.deleteConfirmText}>Delete chat</Text>}</TouchableOpacity></View></View></View>
      </Modal>

      <Modal visible={languageMenuOpen} transparent animationType="fade" onRequestClose={() => setLanguageMenuOpen(false)}>
        <View style={styles.languageOverlay}><TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setLanguageMenuOpen(false)} /><View style={styles.languageSheet}><View style={styles.languageSheetHead}><View style={{ flex: 1 }}><Text style={styles.languageTitle}>Choose your language</Text><Text style={styles.languageSubtitle}>HomeWard Assistant uses Sunbird AI to understand and reply in Ugandan languages.</Text></View><TouchableOpacity onPress={() => setLanguageMenuOpen(false)}><MaterialCommunityIcons name="close" size={22} color={Colors.onSurfaceVariant} /></TouchableOpacity></View>{HOMEWARD_LANGUAGES.map((option) => <TouchableOpacity key={option.code} style={[styles.languageOption, language === option.code && styles.languageOptionSelected]} onPress={() => { setLanguage(option.code); setLanguageMenuOpen(false); }}><View style={styles.languageOptionIcon}><MaterialCommunityIcons name="translate" size={18} color={language === option.code ? Colors.onPrimary : Colors.primary} /></View><Text style={[styles.languageOptionText, language === option.code && { color: Colors.onPrimary }]}>{option.name}</Text>{language === option.code ? <MaterialCommunityIcons name="check" size={19} color={Colors.onPrimary} /> : null}</TouchableOpacity>)}{!sunbirdEnabled ? <View style={styles.languageNotice}><MaterialCommunityIcons name="information-outline" size={17} color={Colors.secondary} /><Text style={styles.languageNoticeText}>Sunbird is awaiting its server access token. English stays available until translation is connected.</Text></View> : <View style={styles.languageReady}><MaterialCommunityIcons name="check-circle-outline" size={17} color={Colors.primary} /><Text style={styles.languageReadyText}>Sunbird AI language support is connected.</Text></View>}</View></View>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.menuButton} onPress={() => setSidebarVisible(true)}>
            <MaterialCommunityIcons name="menu" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>HomeWard</Text>
            {activeSession && (
              <Text style={styles.headerSessionTitle} numberOfLines={1}>{activeSession.title}</Text>
            )}
          </View>
        </View>
        <View style={styles.headerActions}><TouchableOpacity style={styles.languageButton} onPress={() => setLanguageMenuOpen(true)} activeOpacity={0.7}><MaterialCommunityIcons name="translate" size={18} color={Colors.primary} /><Text numberOfLines={1} style={styles.languageButtonText}>{HOMEWARD_LANGUAGES.find((option) => option.code === language)?.name || 'English'}</Text></TouchableOpacity><TouchableOpacity style={styles.newChatButton} onPress={createNewSession} activeOpacity={0.7}><MaterialCommunityIcons name="plus" size={22} color={Colors.onPrimary} /></TouchableOpacity></View>
      </View>

      {/* Chat */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <View style={{ flex: 1 }}>
          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(item, i) => item.id || String(i)}
              renderItem={renderChatItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                <>
                  {error && (
                    <View style={styles.errorBanner}>
                      <MaterialCommunityIcons name="alert-circle" size={16} color={Colors.onError} />
                      <Text style={styles.errorText}>{error}</Text>
                      <TouchableOpacity onPress={() => setError(null)}>
                        <MaterialCommunityIcons name="close" size={16} color={Colors.onError} />
                      </TouchableOpacity>
                    </View>
                  )}

                  {showQuickActions && (
                    <View style={styles.emptyState}>
                      <View style={styles.emptyIconWrap}>
                        <MaterialCommunityIcons name="robot" size={44} color={Colors.onPrimary} />
                      </View>
                      <Text style={styles.emptyTitle}>How can I help you?</Text>
                      <Text style={styles.emptyDesc}>Send money, track savings, check balances</Text>
                      <View style={styles.quickActionRow}>
                        <TouchableOpacity style={styles.quickActionChip} activeOpacity={0.7} onPress={() => sendMessage('Send money to Uganda')}>
                          <MaterialCommunityIcons name="send" size={16} color={Colors.primary} />
                          <Text style={styles.quickActionLabel}>Send Money</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.quickActionChip} activeOpacity={0.7} onPress={() => sendMessage('Check my goal progress')}>
                          <MaterialCommunityIcons name="piggy-bank" size={16} color={Colors.primary} />
                          <Text style={styles.quickActionLabel}>Savings</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.quickActionChip} activeOpacity={0.7} onPress={() => sendMessage('How much do I have?')}>
                          <MaterialCommunityIcons name="wallet" size={16} color={Colors.primary} />
                          <Text style={styles.quickActionLabel}>Balance</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {messages.length > 0 && (
                    <View style={styles.dateMarker}>
                      <MaterialCommunityIcons name="calendar-today" size={12} color={Colors.onSurfaceVariant} />
                      <Text style={styles.dateText}>
                        {activeSession
                          ? new Date(activeSession.lastMessageAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                          : 'Today'}
                      </Text>
                    </View>
                  )}
                </>
              }
              ListFooterComponent={
                isTyping ? (
                  <View style={msgStyles.aiRow}>
                    <View style={msgStyles.aiAvatarSmall}>
                      <MaterialCommunityIcons name="robot" size={18} color={Colors.onSecondaryContainer} />
                    </View>
                    <View style={msgStyles.typingBubble}>
                      <TypingDots />
                    </View>
                  </View>
                ) : messages.length > 0 && suggestions.length > 0 ? (
                  <View style={styles.suggestedRow}>
                    {suggestions.slice(0, 4).map((reply) => (
                      <TouchableOpacity key={reply} style={styles.suggestedChip} activeOpacity={0.7} onPress={() => sendMessage(reply)}>
                        <MaterialCommunityIcons name="flash-outline" size={12} color={Colors.primary} />
                        <Text style={styles.chipText}>{reply.length > 35 ? reply.substring(0, 32) + '...' : reply}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null
              }
              onContentSizeChange={scrollToEnd}
              onLayout={scrollToEnd}
            />
          )}
        </View>

        {/* Input */}
        <View style={styles.inputArea}>
          {voiceHint && (
            <View style={styles.voiceHint}>
              <MaterialCommunityIcons name={isListening ? 'microphone' : 'information-outline'} size={15} color={isListening ? Colors.error : Colors.primary} />
              <Text style={styles.voiceHintText}>{voiceHint}</Text>
            </View>
          )}
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Ask HomeWard anything..."
              placeholderTextColor={Colors.outline}
              value={message}
              onChangeText={setMessage}
              multiline
              blurOnSubmit
              returnKeyType="send"
              onSubmitEditing={() => { if (message.trim()) sendMessage(message); }}
            />
            <TouchableOpacity
              accessibilityLabel={isListening ? 'Stop voice input' : 'Start voice input'}
              style={[styles.voiceButton, isListening && styles.voiceButtonListening]}
              onPress={toggleVoiceInput}
              disabled={isTyping || transcribing}
            >
              <MaterialCommunityIcons name={isListening ? 'stop' : 'microphone-outline'} size={22} color={isListening ? Colors.onError : Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sendButton, !message.trim() && styles.sendButtonDisabled]}
              onPress={() => sendMessage(message)}
              disabled={!message.trim()}
            >
              <MaterialCommunityIcons name="arrow-up" size={24} color={message.trim() ? Colors.onPrimary : Colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  deleteOverlay: { flex: 1, backgroundColor: 'rgba(0,32,25,0.48)', justifyContent: 'center', padding: 24 },
  deleteSheet: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: 24, padding: 22, ...Shadow.level2 },
  deleteIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: Colors.errorContainer, alignItems: 'center', justifyContent: 'center' },
  deleteTitle: { color: Colors.onSurface, fontFamily: 'Montserrat', fontSize: 21, fontWeight: '800', marginTop: 16 },
  deleteText: { color: Colors.onSurfaceVariant, fontFamily: 'Inter', fontSize: 13, lineHeight: 19, marginTop: 8 },
  deleteActions: { flexDirection: 'row', gap: 10, marginTop: 23 },
  deleteCancel: { flex: 1, minHeight: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surfaceContainerLow },
  deleteCancelText: { color: Colors.onSurface, fontFamily: 'Inter', fontWeight: '800', fontSize: 13 },
  deleteConfirm: { flex: 1, minHeight: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.error },
  deleteConfirmText: { color: Colors.onError, fontFamily: 'Inter', fontWeight: '800', fontSize: 13 },
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.containerPaddingMobile, paddingVertical: Spacing.stackSm,
    backgroundColor: Colors.surface, ...Shadow.level1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.stackSm, flex: 1 },
  menuButton: { padding: 8, borderRadius: BorderRadius.full, marginLeft: -4 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: Typography.headlineMd.fontSize, fontFamily: 'Montserrat', fontWeight: '600', color: Colors.primary },
  headerSessionTitle: { fontSize: Typography.labelSm.fontSize, fontFamily: 'Inter', color: Colors.onSurfaceVariant, marginTop: -2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  languageButton: { maxWidth: 112, height: 40, paddingHorizontal: 10, borderRadius: 20, backgroundColor: Colors.primaryFixed, flexDirection: 'row', alignItems: 'center', gap: 5 },
  languageButtonText: { fontFamily: 'Inter', fontSize: 10, fontWeight: '800', color: Colors.primary, flexShrink: 1 },
  newChatButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', ...Shadow.level1 },
  languageOverlay: { flex: 1, backgroundColor: 'rgba(0,32,25,0.45)', justifyContent: 'flex-end' },
  languageSheet: { backgroundColor: Colors.surfaceContainerLowest, borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20, paddingBottom: 30 },
  languageSheetHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, marginBottom: 14 },
  languageTitle: { fontFamily: 'Montserrat', fontWeight: '800', fontSize: 19, color: Colors.onSurface },
  languageSubtitle: { fontFamily: 'Inter', fontSize: 12, lineHeight: 17, color: Colors.onSurfaceVariant, marginTop: 5, maxWidth: 290 },
  languageOption: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 10, borderRadius: 13, marginTop: 4 },
  languageOptionSelected: { backgroundColor: Colors.primary },
  languageOptionIcon: { width: 33, height: 33, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primaryFixed },
  languageOptionText: { flex: 1, fontFamily: 'Inter', fontSize: 14, fontWeight: '800', color: Colors.onSurface },
  languageNotice: { marginTop: 12, backgroundColor: Colors.secondaryContainer, borderRadius: 12, padding: 11, flexDirection: 'row', gap: 7 },
  languageNoticeText: { flex: 1, fontFamily: 'Inter', fontSize: 11, lineHeight: 16, color: Colors.onSecondaryContainer },
  languageReady: { marginTop: 12, backgroundColor: Colors.primaryFixed, borderRadius: 12, padding: 11, flexDirection: 'row', gap: 7 },
  languageReadyText: { flex: 1, fontFamily: 'Inter', fontSize: 11, lineHeight: 16, color: Colors.primary },
  listContent: { paddingHorizontal: Spacing.containerPaddingMobile, paddingBottom: 12 },
  dateMarker: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.surfaceContainerHighest + '80', paddingHorizontal: 16, paddingVertical: 6, borderRadius: BorderRadius.full, marginVertical: Spacing.gutter },
  dateText: { fontSize: Typography.labelSm.fontSize, fontFamily: 'Inter', fontWeight: '500', color: Colors.onSurfaceVariant },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: Spacing.stackSm },
  emptyIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.stackMd, ...Shadow.level2 },
  emptyTitle: { fontSize: Typography.headlineSm.fontSize, fontFamily: 'Montserrat', fontWeight: '600', color: Colors.primary },
  emptyDesc: { fontSize: Typography.bodyMd.fontSize, fontFamily: 'Inter', color: Colors.onSurfaceVariant, textAlign: 'center' },
  quickActionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: Spacing.stackMd },
  quickActionChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.surfaceContainerLowest, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.outlineVariant + '4D', ...Shadow.level1 },
  quickActionLabel: { fontSize: Typography.labelSm.fontSize, fontFamily: 'Inter', fontWeight: '500', color: Colors.primary },
  suggestedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: Spacing.containerPaddingMobile, paddingBottom: 8 },
  suggestedChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Colors.surfaceContainerLow, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.primaryFixedDim + '4D', ...Shadow.level1 },
  chipText: { fontSize: Typography.labelSm.fontSize, fontFamily: 'Inter', fontWeight: '500', color: Colors.primary },
  inputArea: { paddingHorizontal: Spacing.containerPaddingMobile, paddingVertical: Spacing.stackSm, backgroundColor: Colors.background, borderTopWidth: 1, borderTopColor: Colors.outlineVariant + '4D' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, backgroundColor: Colors.surfaceContainerLowest, padding: 8, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.outlineVariant + '4D', ...Shadow.level2 },
  input: { flex: 1, fontSize: Typography.bodyMd.fontSize, fontFamily: 'Inter', color: Colors.onSurface, paddingVertical: 8, paddingHorizontal: 4, maxHeight: 100 },
  voiceButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primaryFixed, borderRadius: BorderRadius.lg },
  voiceButtonListening: { backgroundColor: Colors.error },
  sendButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primary, borderRadius: BorderRadius.lg, ...Shadow.level1 },
  sendButtonDisabled: { backgroundColor: Colors.surfaceContainerHigh },
  voiceHint: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingBottom: 8 },
  voiceHintText: { flex: 1, fontSize: Typography.labelSm.fontSize, fontFamily: 'Inter', color: Colors.onSurfaceVariant },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.errorContainer, padding: Spacing.stackMd, borderRadius: BorderRadius.lg, marginBottom: Spacing.gutter },
  errorText: { flex: 1, fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', color: Colors.onError },
});

const sidebarStyles = StyleSheet.create({
  overlay: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.5)' },
  backdrop: { flex: 1 },
  panel: {
    width: SIDEBAR_WIDTH,
    backgroundColor: Colors.surface,
    paddingTop: Platform.OS === 'ios' ? 54 : 24,
    ...Shadow.level2,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.gutter, paddingBottom: Spacing.stackSm },
  headerTitle: { fontSize: Typography.headlineMd.fontSize, fontFamily: 'Montserrat', fontWeight: '600', color: Colors.primary },
  closeBtn: { padding: 4, borderRadius: BorderRadius.full },
  newChatBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: Spacing.gutter, marginBottom: Spacing.stackMd,
    paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: Colors.primary, borderRadius: BorderRadius.lg,
    ...Shadow.level1,
  },
  newChatLabel: { fontSize: Typography.labelMd.fontSize, fontFamily: 'Inter', fontWeight: '600', color: Colors.onPrimary },
  listContent: { paddingHorizontal: Spacing.gutter, paddingBottom: 40 },
  group: { marginBottom: 8 },
  groupTitle: {
    fontSize: 11, fontFamily: 'Inter', fontWeight: '600', color: Colors.onSurfaceVariant,
    textTransform: 'uppercase', letterSpacing: 0.8, paddingVertical: 10, paddingHorizontal: 4,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 12, borderRadius: BorderRadius.lg, marginBottom: 2 },
  itemActive: { backgroundColor: Colors.primaryFixed + '1A' },
  itemContent: { flex: 1 },
  itemTitle: { fontSize: Typography.bodyMd.fontSize, fontFamily: 'Inter', fontWeight: '500', color: Colors.onSurface },
  itemTime: { fontSize: 10, fontFamily: 'Inter', color: Colors.outline, marginTop: 2 },
  itemDelete: { padding: 4, opacity: 0.6 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: Typography.bodyMd.fontSize, fontFamily: 'Inter', color: Colors.outline, marginTop: 8 },
});

const msgStyles = StyleSheet.create({
  userMessage: { alignSelf: 'flex-end', maxWidth: '85%', backgroundColor: Colors.primary, padding: Spacing.stackMd, borderRadius: 20, borderTopRightRadius: 4, marginBottom: Spacing.gutter, ...Shadow.level1 },
  userMessageText: { fontSize: Typography.bodyMd.fontSize, fontFamily: 'Inter', color: Colors.onPrimary },
  userMsgTime: { fontSize: 10, color: Colors.onPrimary, opacity: 0.7, textAlign: 'right', marginTop: 4 },
  aiRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 8, paddingRight: 48 },
  aiAvatarSmall: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.secondaryContainer, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  aiBlock: { flex: 1, gap: 8 },
  aiMessage: { backgroundColor: Colors.surfaceContainerLowest, padding: Spacing.stackMd, borderRadius: 20, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: Colors.outlineVariant + '1A', ...Shadow.level1 },
  aiMessageFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  aiMsgTime: { fontSize: 10, color: Colors.onSurfaceVariant, opacity: 0.6 },
  speakButton: { width: 29, height: 29, borderRadius: 15, backgroundColor: Colors.primaryFixed, alignItems: 'center', justifyContent: 'center' },
  typingBubble: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: 20, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: Colors.outlineVariant + '1A', paddingHorizontal: 16, ...Shadow.level1 },
});
