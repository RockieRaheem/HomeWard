import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard, Image } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { authApi } from '../services/api';
import LanguagePicker, { LanguageButton } from '../components/LanguagePicker';

interface Props {
  onProfileReady: (profile: { id: string; name: string; phone: string; accessToken?: string }) => void;
}

const HOMEWARD_LOGO = require('../../assets/branding/homeward-logo.png');

export default function ProfileScreen({ onProfileReady }: Props) {
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);

  const phoneRef = useRef<TextInput>(null);
  const pinRef = useRef<TextInput>(null);
  const pinConfirmRef = useRef<TextInput>(null);
  const submitInFlight = useRef(false);

  // Auto-detect: check if phone is registered on blur
  const handlePhoneBlur = async () => {
    if (phone.trim().length < 8) return;
    setChecking(true);
    try {
      const res = await authApi.check(phone.trim());
      if (res.success && res.data?.exists) {
        setMode('login');
      }
    } catch { /* ignore */ }
    setChecking(false);
  };

  const handleSubmit = async () => {
    if (submitInFlight.current || checking) return;
    Keyboard.dismiss();
    const trimmedPhone = phone.trim();
    const trimmedName = name.trim();

    if (!trimmedPhone) return Alert.alert('Phone Required', 'Enter your mobile money phone number.');
    if (!/^\+?\d{9,13}$/.test(trimmedPhone)) return Alert.alert('Invalid Phone', 'Enter a valid phone number (e.g. +256712345678).');
    if (mode === 'register') {
      if (!trimmedName) return Alert.alert('Name Required', 'Enter your full name.');
      if (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) return Alert.alert('Invalid PIN', 'Create a 4-6 digit PIN.');
      if (pin !== pinConfirm) return Alert.alert('PIN Mismatch', 'PINs do not match.');
    } else {
      if (!pin) return Alert.alert('PIN Required', 'Enter your PIN to log in.');
    }

    submitInFlight.current = true;
    setLoading(true);
    try {
      const res = mode === 'register'
        ? await authApi.register(trimmedName, trimmedPhone, pin)
        : await authApi.login(trimmedPhone, pin);
      if (res.success && res.data) {
        onProfileReady({ id: res.data.id, name: res.data.name, phone: res.data.phone, accessToken: res.data.accessToken });
      } else {
        Alert.alert('Error', res.message || 'Something went wrong. Try again.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Connection error. Check that the backend is running.');
    } finally {
      submitInFlight.current = false;
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <View style={styles.languageTop}><LanguageButton onPress={() => setLanguagePickerOpen(true)} /></View>
        <View style={styles.brand}>
          <Image source={HOMEWARD_LOGO} style={styles.logoCircle} accessibilityLabel="HomeWard logo" />
          <Text style={styles.brandName}>HomeWard</Text>
          <Text style={styles.tagline}>Send home with proof it reached the right hands.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{mode === 'register' ? 'Create Account' : 'Welcome Back'}</Text>
          <Text style={styles.cardSubtitle}>
            {mode === 'register' ? 'Set up your profile to start sending money' : 'Enter your PIN to continue'}
          </Text>

          {mode === 'register' && (
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor={Colors.outline}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()}
            />
          )}

          <TextInput
            ref={phoneRef}
            style={styles.input}
            placeholder="Phone Number (e.g. +256712345678)"
            placeholderTextColor={Colors.outline}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            returnKeyType={mode === 'register' ? 'next' : 'done'}
            onBlur={handlePhoneBlur}
            onSubmitEditing={() => pinRef.current?.focus()}
          />

          {checking && <ActivityIndicator color={Colors.primary} style={{ marginVertical: 8 }} />}

          <TextInput
            ref={pinRef}
            style={styles.input}
            placeholder={mode === 'register' ? 'Create PIN (4-6 digits)' : 'Enter PIN'}
            placeholderTextColor={Colors.outline}
            value={pin}
            onChangeText={setPin}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            returnKeyType={mode === 'register' ? 'next' : 'done'}
            onSubmitEditing={() => mode === 'register' ? pinConfirmRef.current?.focus() : handleSubmit()}
          />

          {mode === 'register' && (
            <TextInput
              ref={pinConfirmRef}
              style={styles.input}
              placeholder="Confirm PIN"
              placeholderTextColor={Colors.outline}
              value={pinConfirm}
              onChangeText={setPinConfirm}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading || checking}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={Colors.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>{checking ? 'Checking account…' : mode === 'register' ? 'Create Account' : 'Log In'}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => { setMode(mode === 'register' ? 'login' : 'register'); setPin(''); setPinConfirm(''); }}
          >
            <Text style={styles.switchText}>
              {mode === 'register' ? 'Already have an account? Log in' : "Don't have an account? Create one"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      <LanguagePicker visible={languagePickerOpen} onClose={() => setLanguagePickerOpen(false)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary },
  content: { flex: 1, justifyContent: 'center', padding: Spacing.containerPaddingMobile }, languageTop: { position: 'absolute', top: 18, right: Spacing.containerPaddingMobile, zIndex: 1 },
  brand: { alignItems: 'center', marginBottom: Spacing.gutter * 1.5 },
  logoCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.onPrimary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.stackMd,
  },
  logoText: { fontSize: 36, fontFamily: 'Montserrat', fontWeight: '800', color: Colors.primary },
  brandName: { fontSize: Typography.displayLgMobile.fontSize, fontFamily: 'Montserrat', fontWeight: '700', color: Colors.onPrimary },
  tagline: { fontSize: Typography.bodyMd.fontSize, fontFamily: 'Inter', color: Colors.primaryFixed, marginTop: 4 },
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.xl * 1.5,
    padding: Spacing.gutter, ...Shadow.level2,
  },
  cardTitle: { fontSize: Typography.headlineMd.fontSize, fontFamily: 'Montserrat', fontWeight: '700', color: Colors.primary },
  cardSubtitle: { fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', color: Colors.onSurfaceVariant, marginBottom: Spacing.gutter },
  input: {
    backgroundColor: Colors.surfaceContainerLowest, padding: Spacing.stackMd,
    borderRadius: BorderRadius.xl, fontSize: Typography.bodyMd.fontSize, fontFamily: 'Inter',
    color: Colors.onSurface, borderWidth: 1, borderColor: Colors.outlineVariant + '4D',
    marginBottom: Spacing.stackMd,
  },
  button: {
    backgroundColor: Colors.primary, paddingVertical: 16,
    borderRadius: BorderRadius.xl, alignItems: 'center',
    marginTop: Spacing.stackMd, ...Shadow.level1,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontSize: Typography.labelMd.fontSize, fontFamily: 'Inter', fontWeight: '700', color: Colors.onPrimary },
  switchButton: { alignItems: 'center', marginTop: Spacing.stackMd, padding: 8 },
  switchText: { fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', color: Colors.primary, fontWeight: '600' },
});
