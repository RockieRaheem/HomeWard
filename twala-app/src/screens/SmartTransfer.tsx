import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Animated, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard, Linking, Modal } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRef, useEffect, useState, useCallback } from 'react';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { transferApi, moneygramApi, ratesApi, goalsApi, getPendingGoalId, setPendingGoalId, type GoalData, type StellarProof } from '../services/api';
import SendSuccess from '../components/SendSuccess';

type TransferMode = 'send' | 'deposit';
type CashInStep = 'identity' | 'location' | 'review' | 'processing' | 'success' | null;

interface PurposeOption {
  label: string;
  value: string;
  icon: string;
  desc: string;
  goalId?: string;
}

const PURPOSES: PurposeOption[] = [
  { label: 'Family Support', value: 'family', icon: 'face-woman-profile' as const, desc: 'Send to parents or spouse' },
  { label: 'Construction Milestone', value: 'construction', icon: 'hard-hat' as const, desc: 'Release payment to contractor' },
  { label: 'Savings', value: 'savings', icon: 'piggy-bank' as const, desc: 'Deposit to your HomeWard Vault' },
  { label: 'School Fees', value: 'education', icon: 'school' as const, desc: 'Pay tuition directly' },
  { label: 'Business Investment', value: 'business', icon: 'briefcase' as const, desc: 'Invoice or partnership payment' },
];

const NETWORKS = ['MTN', 'AIRTEL'];

const DEMO_CASH_LOCATIONS = [
  { id: 'downtown', name: 'Dubai Central cash-in location', area: 'Dubai, UAE', detail: 'Illustrative MoneyGram Ramps Testnet location' },
  { id: 'al-nahda', name: 'Al Nahda cash-in location', area: 'Dubai, UAE', detail: 'Illustrative MoneyGram Ramps Testnet location' },
];

const PATH_NODES_SEND = [
  { label: 'Your Wallet', icon: 'wallet' as const, color: 'rgba(255,255,255,0.2)' },
  { label: 'Stellar', icon: 'circle-multiple' as const, color: Colors.secondaryContainer },
  { label: 'Processor', icon: 'lan' as const, color: 'rgba(255,255,255,0.2)' },
  { label: 'M-Money', icon: 'cellphone' as const, color: Colors.surfaceContainerLowest },
];

const PATH_NODES_DEPOSIT = [
  { label: 'M-Money', icon: 'cellphone' as const, color: 'rgba(255,255,255,0.2)' },
  { label: 'Processor', icon: 'lan' as const, color: 'rgba(255,255,255,0.2)' },
  { label: 'Stellar', icon: 'circle-multiple' as const, color: Colors.secondaryContainer },
  { label: 'Your Wallet', icon: 'wallet' as const, color: Colors.surfaceContainerLowest },
];

function StellarPath({ mode }: { mode: TransferMode }) {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const nodes = mode === 'send' ? PATH_NODES_SEND : PATH_NODES_DEPOSIT;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [mode]);

  return (
    <View style={stellarStyles.card}>
      <View style={stellarStyles.decorBg} />
      <View style={stellarStyles.pathRow}>
        {nodes.map((node, i) => (
          <View key={node.label}>
            <View style={stellarStyles.nodeCol}>
              <View style={[stellarStyles.nodeIcon, { backgroundColor: node.color }]}>
                <MaterialCommunityIcons
                  name={node.icon}
                  size={22}
                  color={Colors.onPrimary}
                />
              </View>
              <Text style={stellarStyles.nodeLabel}>
                {node.label}
              </Text>
            </View>
            {i < nodes.length - 1 && (
              <View style={stellarStyles.connectorWrap}>
                <View style={stellarStyles.connectorBase}>
                  <Animated.View style={[stellarStyles.connectorPulse, { opacity: pulseAnim }]} />
                </View>
              </View>
            )}
          </View>
        ))}
      </View>
      <Text style={stellarStyles.footer}>
        {mode === 'send'
          ? 'Your Wallet → Secured → Mobile Money (1-2 min)'
          : 'Mobile Money → Secured → Your Wallet'}
      </Text>
    </View>
  );
}

const stellarStyles = StyleSheet.create({
  card: { backgroundColor: Colors.primary, padding: Spacing.gutter, borderRadius: BorderRadius.xl * 1.5, overflow: 'hidden', ...Shadow.level2 },
  decorBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.08 },
  pathRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nodeCol: { alignItems: 'center', gap: 8, zIndex: 2 },
  nodeIcon: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  nodeLabel: { fontSize: 10, fontWeight: '700', color: Colors.onPrimary, letterSpacing: 0.5, textTransform: 'uppercase' },
  connectorWrap: { position: 'absolute', top: 22, left: 52, right: -20, height: 4, zIndex: 0 },
  connectorBase: { height: 2, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 1, overflow: 'hidden' },
  connectorPulse: { height: '100%', backgroundColor: Colors.secondaryContainer, borderRadius: 1 },
  footer: { marginTop: Spacing.gutter, textAlign: 'center', fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', fontWeight: '500', color: Colors.onPrimary },
});

interface CashInJourneyProps {
  step: Exclude<CashInStep, null>;
  amountAed: number;
  userName?: string;
  proof: StellarProof | null;
  onClose: () => void;
  onAdvance: () => void;
  onComplete: () => void;
  onContinueToSend: () => void;
}

function CashInJourney({ step, amountAed, userName, proof, onClose, onAdvance, onComplete, onContinueToSend }: CashInJourneyProps) {
  const [selectedLocation, setSelectedLocation] = useState(DEMO_CASH_LOCATIONS[0].id);
  const selected = DEMO_CASH_LOCATIONS.find((location) => location.id === selectedLocation) || DEMO_CASH_LOCATIONS[0];
  const estimatedUsdc = Math.max(1, Math.round((amountAed / 3.67) * 100) / 100);
  const isProcessing = step === 'processing';

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={cashInStyles.overlay}>
        <View style={cashInStyles.sheet}>
          <View style={cashInStyles.handle} />
          <View style={cashInStyles.topRow}>
            <View>
              <Text style={cashInStyles.eyebrow}>HOMEWARD × MONEYGRAM RAMPS</Text>
              <Text style={cashInStyles.title}>Cash-in demonstration</Text>
            </View>
            {!isProcessing && step !== 'success' && (
              <TouchableOpacity onPress={onClose} accessibilityLabel="Close cash-in demonstration">
                <MaterialCommunityIcons name="close" size={24} color={Colors.onSurfaceVariant} />
              </TouchableOpacity>
            )}
          </View>

          <View style={cashInStyles.testnetBadge}>
            <MaterialCommunityIcons name="flask-outline" size={15} color={Colors.onPrimary} />
            <Text style={cashInStyles.testnetBadgeText}>TESTNET DEMONSTRATION — NO REAL CASH IS COLLECTED</Text>
          </View>

          {step === 'identity' && (
            <>
              <View style={cashInStyles.heroIcon}><MaterialCommunityIcons name="shield-account" size={34} color={Colors.onPrimary} /></View>
              <Text style={cashInStyles.stepTitle}>Confirm your identity</Text>
              <Text style={cashInStyles.description}>A live MoneyGram journey verifies identity before showing eligible cash-in locations. This screen demonstrates that required step.</Text>
              <View style={cashInStyles.identityCard}>
                <View style={cashInStyles.identityRow}>
                  <MaterialCommunityIcons name="account-check" size={20} color={Colors.primary} />
                  <View><Text style={cashInStyles.identityLabel}>Customer</Text><Text style={cashInStyles.identityValue}>{userName || 'HomeWard customer'}</Text></View>
                </View>
                <View style={cashInStyles.identityRow}>
                  <MaterialCommunityIcons name="check-decagram" size={20} color={Colors.primary} />
                  <View><Text style={cashInStyles.identityLabel}>Demo verification</Text><Text style={cashInStyles.identityValue}>Ready for Testnet cash-in</Text></View>
                </View>
              </View>
              <TouchableOpacity style={cashInStyles.primaryButton} onPress={onAdvance}><Text style={cashInStyles.primaryButtonText}>Continue to location</Text><MaterialCommunityIcons name="arrow-right" size={20} color={Colors.onPrimary} /></TouchableOpacity>
            </>
          )}

          {step === 'location' && (
            <>
              <View style={cashInStyles.heroIcon}><MaterialCommunityIcons name="map-marker-radius" size={34} color={Colors.onPrimary} /></View>
              <Text style={cashInStyles.stepTitle}>Choose a cash-in location</Text>
              <Text style={cashInStyles.description}>Live availability is supplied by MoneyGram after approval. Select an illustrative UAE location for this Testnet demonstration.</Text>
              {DEMO_CASH_LOCATIONS.map((location) => (
                <TouchableOpacity key={location.id} style={[cashInStyles.locationCard, selectedLocation === location.id && cashInStyles.locationCardActive]} onPress={() => setSelectedLocation(location.id)}>
                  <MaterialCommunityIcons name={selectedLocation === location.id ? 'radiobox-marked' : 'radiobox-blank'} size={22} color={Colors.primary} />
                  <View style={{ flex: 1 }}><Text style={cashInStyles.locationName}>{location.name}</Text><Text style={cashInStyles.locationDetail}>{location.area} · {location.detail}</Text></View>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={cashInStyles.primaryButton} onPress={onAdvance}><Text style={cashInStyles.primaryButtonText}>Review cash-in</Text><MaterialCommunityIcons name="arrow-right" size={20} color={Colors.onPrimary} /></TouchableOpacity>
            </>
          )}

          {step === 'review' && (
            <>
              <View style={cashInStyles.heroIcon}><MaterialCommunityIcons name="cash-check" size={34} color={Colors.onPrimary} /></View>
              <Text style={cashInStyles.stepTitle}>Review cash-in</Text>
              <Text style={cashInStyles.description}>In production, the agent collects AED cash only after the regulated MoneyGram flow is approved and completed.</Text>
              <View style={cashInStyles.reviewCard}>
                <View style={cashInStyles.reviewRow}><Text style={cashInStyles.reviewLabel}>Cash handed to agent</Text><Text style={cashInStyles.reviewValue}>AED {amountAed.toLocaleString()}</Text></View>
                <View style={cashInStyles.reviewRow}><Text style={cashInStyles.reviewLabel}>Selected location</Text><Text style={cashInStyles.reviewValue}>{selected.name}</Text></View>
                <View style={cashInStyles.reviewRow}><Text style={cashInStyles.reviewLabel}>HomeWard receives</Text><Text style={cashInStyles.reviewValue}>≈ {estimatedUsdc.toFixed(2)} USDC</Text></View>
                <View style={cashInStyles.reviewRow}><Text style={cashInStyles.reviewLabel}>Settlement network</Text><Text style={cashInStyles.reviewValue}>Stellar Testnet</Text></View>
              </View>
              <TouchableOpacity style={cashInStyles.primaryButton} onPress={onComplete}><Text style={cashInStyles.primaryButtonText}>Confirm demo cash handover</Text><MaterialCommunityIcons name="shield-check" size={20} color={Colors.onPrimary} /></TouchableOpacity>
            </>
          )}

          {step === 'processing' && (
            <View style={cashInStyles.centeredState}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={cashInStyles.stepTitle}>Settling on Stellar Testnet</Text>
              <Text style={cashInStyles.description}>Creating a real Testnet USDC transaction and waiting for its ledger confirmation.</Text>
            </View>
          )}

          {step === 'success' && proof && (
            <>
              <View style={cashInStyles.successIcon}><MaterialCommunityIcons name="check" size={38} color={Colors.onPrimary} /></View>
              <Text style={cashInStyles.stepTitle}>USDC received in HomeWard</Text>
              <Text style={cashInStyles.description}>The cash-in demonstration is confirmed on Stellar Testnet. In production, this confirmation follows MoneyGram’s approved cash collection.</Text>
              <TouchableOpacity style={cashInStyles.ledgerCard} onPress={() => Linking.openURL(proof.explorerUrl)} accessibilityRole="link">
                <MaterialCommunityIcons name="shield-check" size={22} color={Colors.onPrimary} />
                <View style={{ flex: 1 }}><Text style={cashInStyles.ledgerTitle}>Verified in Stellar ledger #{proof.ledger}</Text><Text style={cashInStyles.ledgerHash}>{proof.hash.slice(0, 14)}...{proof.hash.slice(-8)}</Text></View>
                <MaterialCommunityIcons name="open-in-new" size={18} color={Colors.onPrimary} />
              </TouchableOpacity>
              <TouchableOpacity style={cashInStyles.primaryButton} onPress={onContinueToSend}><Text style={cashInStyles.primaryButtonText}>Continue to send home</Text><MaterialCommunityIcons name="send" size={20} color={Colors.onPrimary} /></TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const cashInStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: Spacing.gutter, paddingBottom: 30, minHeight: '70%' },
  handle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: Colors.outlineVariant, marginBottom: 18 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  eyebrow: { fontSize: 10, fontFamily: 'Inter', fontWeight: '800', color: Colors.primary, letterSpacing: 1 },
  title: { fontSize: Typography.headlineSm.fontSize, fontFamily: 'Montserrat', fontWeight: '700', color: Colors.onSurface, marginTop: 3 },
  testnetBadge: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginTop: 16 },
  testnetBadgeText: { flex: 1, fontSize: 10, fontFamily: 'Inter', fontWeight: '800', color: Colors.onPrimary, letterSpacing: 0.3 },
  heroIcon: { width: 66, height: 66, borderRadius: 33, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginTop: 22, marginBottom: 14 },
  successIcon: { width: 74, height: 74, borderRadius: 37, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginTop: 22, marginBottom: 14 },
  stepTitle: { fontSize: Typography.headlineSm.fontSize, fontFamily: 'Montserrat', fontWeight: '700', color: Colors.onSurface, textAlign: 'center' },
  description: { fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', lineHeight: 20, color: Colors.onSurfaceVariant, textAlign: 'center', marginTop: 8 },
  identityCard: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: BorderRadius.xl, padding: 14, gap: 14, marginTop: 20, borderWidth: 1, borderColor: Colors.outlineVariant + '55' },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  identityLabel: { fontSize: 11, fontFamily: 'Inter', color: Colors.onSurfaceVariant },
  identityValue: { fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', fontWeight: '700', color: Colors.onSurface, marginTop: 2 },
  locationCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.outlineVariant, marginTop: 12 },
  locationCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryContainer + '22' },
  locationName: { fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', fontWeight: '700', color: Colors.onSurface },
  locationDetail: { fontSize: 11, fontFamily: 'Inter', color: Colors.onSurfaceVariant, marginTop: 3 },
  reviewCard: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: BorderRadius.xl, padding: 14, gap: 12, marginTop: 20 },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 },
  reviewLabel: { flex: 1, fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', color: Colors.onSurfaceVariant },
  reviewValue: { flex: 1, fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', fontWeight: '700', color: Colors.onSurface, textAlign: 'right' },
  centeredState: { alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 340, gap: 14 },
  ledgerCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.primaryContainer, padding: 14, borderRadius: BorderRadius.xl, marginTop: 20 },
  ledgerTitle: { fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', fontWeight: '800', color: Colors.onPrimary },
  ledgerHash: { fontSize: 10, fontFamily: 'Inter', color: Colors.onPrimary, marginTop: 3 },
  primaryButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: BorderRadius.full, paddingVertical: 15, marginTop: 24 },
  primaryButtonText: { fontSize: Typography.labelMd.fontSize, fontFamily: 'Inter', fontWeight: '800', color: Colors.onPrimary },
});

interface Props {
  user?: { id: string; name: string; phone: string };
}

export default function SmartTransfer({ user }: Props = {}) {
  const [mode, setMode] = useState<TransferMode>('send');
  const [selectedPurpose, setSelectedPurpose] = useState<PurposeOption>(PURPOSES[1]);
  const [showPicker, setShowPicker] = useState(false);
  const [amount, setAmount] = useState('500');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientNetwork, setRecipientNetwork] = useState<'MTN' | 'AIRTEL'>('MTN');
  const [liveRate, setLiveRate] = useState(3750);
  const [quote, setQuote] = useState<{ sendAmountUsdc: number; receiveAmountUgx: number; feeUsdc: number; feeUgx: number; rate: number; estimatedArrival: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [goals, setGoals] = useState<GoalData[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    amountUsdc: number; amountUgx: number; recipientName: string;
    recipientPhone?: string; recipientNetwork?: string;
    referenceId: string; newBalance: number; feeUsdc: number; rate: number;
    goalTitle?: string; stellarTxHash?: string; stellarExplorerUrl?: string;
  } | null>(null);
  const [fundingProof, setFundingProof] = useState<StellarProof | null>(null);
  const [moneygramStatus, setMoneygramStatus] = useState<{ configured: boolean; environment: 'TESTNET' | 'PRODUCTION'; walletDomain: string | null } | null>(null);
  const [cashInStep, setCashInStep] = useState<CashInStep>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView>(null);
  const amountRef = useRef<TextInput>(null);
  const nameRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const submitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissKeyboard = useCallback(() => Keyboard.dismiss(), []);

  const switchMode = useCallback((nextMode: TransferMode) => {
    dismissKeyboard();
    setMode(nextMode);
    // Reset after the conditional Deposit content has been laid out.
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: true }));
  }, [dismissKeyboard]);

  const usdAmount = parseFloat(amount) || 0;
  const fundingCurrency = 'AED';

  // Build dynamic purpose list: static purposes + user's goals
  const goalPurposes: PurposeOption[] = goals.map((g) => ({
    label: `🎯 ${g.title}`,
    value: `goal_${g.id}`,
    icon: 'flag-checkered',
    desc: `Goal: ${g.savedAmountUgx.toLocaleString()} / ${g.targetAmountUgx.toLocaleString()} UGX`,
    goalId: g.id,
  }));
  const allPurposes = [...goalPurposes, ...PURPOSES];

  // Auto-select goal if navigated from GoalDetail
  useEffect(() => {
    const pendingId = getPendingGoalId();
    if (pendingId && goals.length > 0) {
      const match = goalPurposes.find((gp) => gp.goalId === pendingId);
      if (match) {
        setPendingGoalId(null);
        setSelectedPurpose(match);
        setSelectedGoalId(pendingId);
      }
    }
  }, [goals]);

  useEffect(() => {
    ratesApi.get().then((res) => {
      if (res.success && res.data) setLiveRate(res.data.usdcToUgx);
    });
    goalsApi.list().then((res) => {
      if (res.success && Array.isArray(res.data)) setGoals(res.data);
    });
    moneygramApi.status().then((res) => {
      if (res.success && res.data) setMoneygramStatus(res.data);
    }).catch(() => setMoneygramStatus(null));
  }, []);

  useEffect(() => {
    if (mode === 'deposit') { setQuote(null); return; }
    if (usdAmount < 10) { setQuote(null); return; }
    setLoading(true);
    const timer = setTimeout(() => {
      transferApi.quote(usdAmount).then((res) => {
        if (res.success && res.data) setQuote(res.data);
        setLoading(false);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [usdAmount, mode]);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.03, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  }, [amount]);

  const handleSubmit = async () => {
    if (mode === 'send') {
      if (usdAmount < 10) return Alert.alert('Minimum 10 USDC', 'Enter at least 10 USDC to send.');
      if (!quote) return Alert.alert('No quote', 'Unable to get exchange rate. Try again.');
      if (!recipientName.trim()) return Alert.alert('Recipient Name', 'Enter the recipient name.');
      if (!recipientPhone.trim()) return Alert.alert('Recipient Phone', 'A phone number is required for Mobile Money and SMS notification.');
      if (!/^\+[1-9]\d{7,14}$/.test(recipientPhone.trim())) return Alert.alert('Invalid Phone', 'Use international format, for example +256712345678.');
      setSubmitting(true);
      // Safety timeout: force-stop loading if something goes wrong
      submitTimeoutRef.current = setTimeout(() => setSubmitting(false), 35000);
      try {
        const res = await transferApi.offramp({
          amountUsdc: usdAmount,
          recipientName: recipientName.trim(),
          recipientPhone: recipientPhone.trim() || undefined,
          recipientNetwork,
          purpose: selectedPurpose.label,
          goalId: selectedGoalId || undefined,
          senderName: user?.name,
          senderPhone: user?.phone,
        });
        if (res.success && res.data) {
          const g = goals.find((x) => x.id === selectedGoalId);
          const bal = res.data.balance ?? 0;
          setSuccessData({
            amountUsdc: quote!.sendAmountUsdc,
            amountUgx: quote!.receiveAmountUgx,
            recipientName: recipientName.trim(),
            recipientPhone: recipientPhone.trim() || undefined,
            recipientNetwork,
            referenceId: res.data.kotaniReferenceId,
            newBalance: bal,
            feeUsdc: quote!.feeUsdc,
            rate: quote!.rate,
            goalTitle: g?.title,
            stellarTxHash: res.data.stellarTxHash,
            stellarExplorerUrl: res.data.stellarExplorerUrl,
          });
          setAmount('500');
          setRecipientName('');
          setRecipientPhone('');
          setSelectedGoalId(null);
          setQuote(null);
        } else if ((res as any).selfSend) {
          Alert.alert(
            'Send to Yourself?',
            res.message || 'This is your own phone number. Proceed?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Send Anyway', style: 'destructive', onPress: async () => {
                const retryRes = await transferApi.offramp({
                  amountUsdc: usdAmount, recipientName: recipientName.trim(),
                  recipientPhone: recipientPhone.trim() || undefined, recipientNetwork,
                  purpose: selectedPurpose.label, goalId: selectedGoalId || undefined,
                  senderName: user?.name, senderPhone: user?.phone,
                  confirmSelfSend: true,
                });
                if (retryRes.success && retryRes.data) {
                  const g = goals.find((x) => x.id === selectedGoalId);
                  setSuccessData({
                    amountUsdc: quote!.sendAmountUsdc, amountUgx: quote!.receiveAmountUgx,
                    recipientName: recipientName.trim(), recipientPhone: recipientPhone.trim() || undefined,
                    recipientNetwork, referenceId: retryRes.data.kotaniReferenceId,
                    newBalance: retryRes.data.balance ?? 0, feeUsdc: quote!.feeUsdc,
                    rate: quote!.rate, goalTitle: g?.title,
                    stellarTxHash: retryRes.data.stellarTxHash,
                    stellarExplorerUrl: retryRes.data.stellarExplorerUrl,
                  });
                  setAmount('500'); setRecipientName(''); setRecipientPhone('');
                  setSelectedGoalId(null); setQuote(null);
                } else {
                  Alert.alert('Error', retryRes.message || 'Transfer failed.');
                }
              }},
            ]
          );
        } else {
          Alert.alert('Error', res.message || 'Transfer failed.');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        Alert.alert('Transfer Failed', msg);
      } finally {
        if (submitTimeoutRef.current) clearTimeout(submitTimeoutRef.current);
        setSubmitting(false);
      }
    } else {
      const fiatAmount = parseFloat(amount.replace(/,/g, '')) || 0;
      if (fiatAmount < 1) return Alert.alert('Enter an amount', 'Enter at least AED 1 to continue.');
      // Until MoneyGram approves HomeWard and supplies its hosted cash-in
      // journey, keep the demo useful by performing the matching real
      // Stellar Testnet funding transaction rather than returning a 503.
      if (!moneygramStatus?.configured) {
        setCashInStep('identity');
        return;
      }
      setSubmitting(true);
      try {
        const res = await moneygramApi.cashIn(fiatAmount);
        if (res.success && res.data) {
          await Linking.openURL(res.data.cashInUrl);
          Alert.alert(
            'Complete MoneyGram cash-in',
            'Complete the identity checks, select an eligible MoneyGram location, and pay AED cash. Return to HomeWard after MoneyGram confirms the USDC deposit.'
          );
        } else {
          Alert.alert('MoneyGram cash-in unavailable', res.message || 'Unable to open MoneyGram cash-in.');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        Alert.alert('MoneyGram cash-in failed', msg);
      } finally {
        setSubmitting(false);
      }
    }
  };

  const completeTestnetCashIn = async () => {
    const fiatAmount = parseFloat(amount.replace(/,/g, '')) || 0;
    const testUsdc = Math.max(1, Math.round((fiatAmount / 3.67) * 100) / 100);
    setCashInStep('processing');
    setSubmitting(true);
    try {
      const res = await transferApi.demoFund(testUsdc);
      if (!res.success || !res.data) {
        setCashInStep('review');
        return Alert.alert('Testnet funding failed', res.message || 'Stellar Testnet did not accept the transaction.');
      }
      setFundingProof(res.data.proof);
      setCashInStep('success');
    } catch (err) {
      setCashInStep('review');
      Alert.alert('Testnet funding failed', err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Smart Transfer</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>KZ</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          onScrollBeginDrag={dismissKeyboard}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          nestedScrollEnabled
          scrollEventThrottle={16}
          overScrollMode="always"
        >
            <StellarPath mode={mode} />

            <View style={styles.modeToggle}>
              <TouchableOpacity
                style={[styles.modeButton, mode === 'send' && styles.modeButtonActive]}
                onPress={() => switchMode('send')}
              >
                <MaterialCommunityIcons name="send" size={18} color={mode === 'send' ? Colors.onPrimary : Colors.primary} />
                <Text style={[styles.modeText, mode === 'send' && styles.modeTextActive]}>Send</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeButton, mode === 'deposit' && styles.modeButtonActive]}
                onPress={() => switchMode('deposit')}
              >
                <MaterialCommunityIcons name="download" size={18} color={mode === 'deposit' ? Colors.onPrimary : Colors.primary} />
                <Text style={[styles.modeText, mode === 'deposit' && styles.modeTextActive]}>Deposit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.rateBanner}>
              <MaterialCommunityIcons name="currency-usd" size={16} color={Colors.onPrimary} />
              <Text style={styles.rateText}>
                1 USDC ≈ UGX {liveRate.toLocaleString()}
              </Text>
              <View style={styles.rateLiveDot} />
              <Text style={styles.rateLiveLabel}>Live</Text>
            </View>

            <Animated.View style={[styles.amountCard, { transform: [{ scale: scaleAnim }] }]}>
              <Text style={styles.amountLabel}>{mode === 'send' ? 'You Send' : 'Cash-in amount at MoneyGram'}</Text>
              <View style={styles.amountRow}>
                <Text style={styles.currencySign}>
                  {mode === 'send' ? '$' : fundingCurrency}
                </Text>
                <TextInput
                  ref={amountRef}
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder={mode === 'send' ? '500' : '500 AED'}
                  placeholderTextColor={Colors.outline}
                  onFocus={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
                  returnKeyType="next"
                  onSubmitEditing={() => nameRef.current?.focus()}
                />
              </View>
              {mode === 'send' && (
                <View style={styles.amountMeta}>
                  <Text style={styles.amountMetaText}>≈ UGX {((usdAmount * liveRate) || 0).toLocaleString()}</Text>
                </View>
              )}
            </Animated.View>

            {mode === 'send' && quote && (
              <View style={styles.quoteCard}>
                <Text style={styles.quoteTitle}>Transfer Breakdown</Text>
                <View style={styles.quoteRow}>
                  <Text style={styles.quoteLabel}>Amount</Text>
                  <Text style={styles.quoteValue}>${quote.sendAmountUsdc.toFixed(2)} USDC</Text>
                </View>
                <View style={styles.quoteRow}>
                  <Text style={styles.quoteLabel}>Fee (0.5%)</Text>
                  <Text style={styles.quoteValue}>${quote.feeUsdc.toFixed(2)} USDC</Text>
                </View>
                <View style={styles.quoteDivider} />
                <View style={styles.quoteRow}>
                  <Text style={[styles.quoteLabel, { fontWeight: '700' }]}>Recipient Gets</Text>
                  <Text style={[styles.quoteValue, { color: Colors.primary, fontWeight: '700' }]}>
                    UGX {quote.receiveAmountUgx.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.quoteRow}>
                  <Text style={styles.quoteLabel}>Rate</Text>
                  <Text style={styles.quoteValue}>1 USDC = UGX {quote.rate.toLocaleString()}</Text>
                </View>
                <View style={styles.quoteRow}>
                  <Text style={styles.quoteLabel}>Delivery</Text>
                  <Text style={styles.quoteValue}>{quote.estimatedArrival}</Text>
                </View>
              </View>
            )}

            {mode === 'deposit' && (
              <View style={styles.quoteCard}>
                <Text style={styles.quoteTitle}>Cash in with MoneyGram</Text>
                <View style={styles.quoteRow}>
                  <Text style={styles.quoteLabel}>Funding method</Text>
                  <Text style={styles.quoteValue}>AED cash at MoneyGram</Text>
                </View>
                <View style={styles.quoteRow}>
                  <Text style={styles.quoteLabel}>You fund</Text>
                  <Text style={styles.quoteValue}>AED {(parseFloat(amount.replace(/,/g, '')) || 0).toLocaleString()}</Text>
                </View>
                <View style={styles.quoteRow}>
                  <Text style={styles.quoteLabel}>Asset destination</Text>
                  <Text style={styles.quoteValue}>USDC on Stellar</Text>
                </View>
                <View style={styles.quoteDivider} />
                <View style={styles.quoteRow}>
                  <Text style={styles.quoteLabel}>Status</Text>
                  <Text style={styles.quoteValue}>{moneygramStatus?.configured ? `MoneyGram ${moneygramStatus.environment}` : 'Testnet proof available'}</Text>
                </View>
              </View>
            )}

            {mode === 'deposit' && fundingProof && (
              <TouchableOpacity style={styles.proofBanner} onPress={() => Linking.openURL(fundingProof.explorerUrl)} accessibilityRole="link">
                <MaterialCommunityIcons name="shield-check" size={22} color={Colors.onPrimary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.proofBannerTitle}>Confirmed in Stellar ledger #{fundingProof.ledger}</Text>
                  <Text style={styles.proofBannerHash}>{fundingProof.hash.slice(0, 14)}...{fundingProof.hash.slice(-8)}</Text>
                </View>
                <MaterialCommunityIcons name="open-in-new" size={18} color={Colors.onPrimary} />
              </TouchableOpacity>
            )}

            {loading && <ActivityIndicator color={Colors.primary} style={{ marginTop: 12 }} />}

            <View style={styles.recipientCard}>
              <Text style={styles.sectionLabel}>{mode === 'send' ? 'Recipient Details' : 'Demo flow'}</Text>

              {mode === 'send' && (
                <>
                  <TextInput
                    ref={nameRef}
                    style={styles.input}
                    placeholder="Full name (e.g., Maama Namubiru)"
                    placeholderTextColor={Colors.outline}
                    value={recipientName}
                    onChangeText={setRecipientName}
                    onFocus={() => scrollRef.current?.scrollTo({ y: 400, animated: true })}
                    returnKeyType="next"
                    onSubmitEditing={() => phoneRef.current?.focus()}
                  />
                  <TextInput
                    ref={phoneRef}
                    style={styles.input}
                    placeholder="Phone (required, e.g., +256712345678)"
                    placeholderTextColor={Colors.outline}
                    value={recipientPhone}
                    onChangeText={setRecipientPhone}
                    keyboardType="phone-pad"
                    onFocus={() => scrollRef.current?.scrollTo({ y: 400, animated: true })}
                    returnKeyType="done"
                    onSubmitEditing={dismissKeyboard}
                  />
                </>
              )}

              {mode === 'deposit' && <Text style={styles.demoFlowText}>HomeWard uses MoneyGram Ramps for AED cash-in at an eligible location. MoneyGram handles identity checks and cash collection, then deposits USDC on Stellar. Until MoneyGram approves HomeWard’s UAE programme, select “Run MoneyGram Testnet cash-in” below to perform the equivalent Stellar Testnet funding leg and view its independent ledger record.</Text>}

              {mode === 'send' && <View style={styles.networkRow}>
                {NETWORKS.map((net) => (
                  <TouchableOpacity
                    key={net}
                    style={[styles.networkChip, recipientNetwork === net && styles.networkChipActive]}
                    onPress={() => setRecipientNetwork(net as 'MTN' | 'AIRTEL')}
                  >
                    <MaterialCommunityIcons
                      name={net === 'MTN' ? 'signal-cellular-3' : 'signal-cellular-2'}
                      size={16}
                      color={recipientNetwork === net ? Colors.onPrimary : Colors.primary}
                    />
                    <Text style={[styles.networkText, recipientNetwork === net && styles.networkTextActive]}>
                      {net}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>}

              {mode === 'send' && (
                <>
                  <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Purpose</Text>
                  <TouchableOpacity style={styles.purposePicker} onPress={() => setShowPicker(!showPicker)}>
                    <View style={styles.purposeRow}>
                      <MaterialCommunityIcons name={selectedPurpose.icon as any} size={20} color={Colors.primary} />
                      <View style={styles.purposeTextWrap}>
                        <Text style={styles.purposeLabel}>{selectedPurpose.label}</Text>
                        <Text style={styles.purposeDesc}>{selectedPurpose.desc}</Text>
                      </View>
                      <MaterialCommunityIcons name={showPicker ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.outline} />
                    </View>
                  </TouchableOpacity>

                  {showPicker && (
                    <View style={styles.pickerList}>
                      {allPurposes.map((p) => (
                        <TouchableOpacity
                          key={p.value}
                          style={[styles.pickerItem, selectedPurpose.value === p.value && styles.pickerItemActive]}
                          onPress={() => { setSelectedPurpose(p); setSelectedGoalId(p.goalId || null); setShowPicker(false); }}
                        >
                          <MaterialCommunityIcons name={p.icon as any} size={20} color={selectedPurpose.value === p.value ? Colors.primary : Colors.onSurfaceVariant} />
                          <View>
                            <Text style={[styles.pickerLabel, selectedPurpose.value === p.value && { color: Colors.primary }]}>{p.label}</Text>
                            <Text style={styles.pickerDesc}>{p.desc}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </>
              )}
            </View>

            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              activeOpacity={0.8}
              onPress={() => { dismissKeyboard(); handleSubmit(); }}
              disabled={submitting}
            >
              {submitting ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator color={Colors.onPrimary} />
                  <Text style={styles.submitText}>Processing...</Text>
                </View>
              ) : (
                <>
                  <MaterialCommunityIcons
                    name={mode === 'send' ? 'send' : 'download'}
                    size={20}
                    color={Colors.onPrimary}
                  />
                  <Text style={styles.submitText}>
                    {mode === 'send'
                      ? 'Send Money'
                      : moneygramStatus?.configured
                        ? 'Continue to MoneyGram'
                        : 'Run MoneyGram Testnet cash-in'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {cashInStep && (
        <CashInJourney
          step={cashInStep}
          amountAed={parseFloat(amount.replace(/,/g, '')) || 0}
          userName={user?.name}
          proof={fundingProof}
          onClose={() => setCashInStep(null)}
          onAdvance={() => setCashInStep((current) => current === 'identity' ? 'location' : 'review')}
          onComplete={completeTestnetCashIn}
          onContinueToSend={() => { setCashInStep(null); switchMode('send'); }}
        />
      )}

      <SendSuccess
        visible={!!successData}
        amountUsdc={successData?.amountUsdc ?? 0}
        amountUgx={successData?.amountUgx ?? 0}
        recipientName={successData?.recipientName ?? ''}
        recipientPhone={successData?.recipientPhone}
        recipientNetwork={successData?.recipientNetwork}
        referenceId={successData?.referenceId ?? ''}
        newBalance={successData?.newBalance ?? 0}
        feeUsdc={successData?.feeUsdc ?? 0}
        rate={successData?.rate ?? 0}
        goalTitle={successData?.goalTitle}
        stellarTxHash={successData?.stellarTxHash}
        stellarExplorerUrl={successData?.stellarExplorerUrl}
        onDone={() => setSuccessData(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.containerPaddingMobile, paddingVertical: Spacing.stackSm,
    backgroundColor: Colors.surface, ...Shadow.level1,
  },
  headerLeft: {},
  headerTitle: { fontSize: Typography.headlineMd.fontSize, fontFamily: 'Montserrat', fontWeight: '600', color: Colors.primary },
  headerRight: {},
  headerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryContainer, justifyContent: 'center', alignItems: 'center' },
  headerAvatarText: { fontSize: 14, fontWeight: '700', color: Colors.onPrimary },
  scrollContent: { padding: Spacing.containerPaddingMobile, paddingBottom: 96, flexGrow: 1 },
  modeToggle: { flexDirection: 'row', gap: 8, marginTop: Spacing.gutter, marginBottom: Spacing.stackMd },
  modeButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: BorderRadius.xl, backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1, borderColor: Colors.outlineVariant + '4D', ...Shadow.level1,
  },
  modeButtonActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  modeText: { fontSize: Typography.labelMd.fontSize, fontFamily: 'Inter', fontWeight: '600', color: Colors.primary },
  modeTextActive: { color: Colors.onPrimary },
  rateBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: BorderRadius.xl, marginBottom: Spacing.gutter, ...Shadow.level1,
  },
  rateText: { flex: 1, fontSize: Typography.bodyMd.fontSize, fontFamily: 'Inter', fontWeight: '600', color: Colors.onPrimary },
  rateLiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.secondaryContainer },
  rateLiveLabel: { fontSize: Typography.labelSm.fontSize, fontFamily: 'Inter', fontWeight: '600', color: Colors.secondaryContainer },
  amountCard: { backgroundColor: Colors.surfaceContainerLowest, padding: Spacing.gutter, borderRadius: BorderRadius.xl, ...Shadow.level1, borderWidth: 1, borderColor: Colors.outlineVariant + '33' },
  amountLabel: { fontSize: Typography.labelSm.fontSize, fontFamily: 'Inter', fontWeight: '500', color: Colors.onSurfaceVariant, letterSpacing: 1, textTransform: 'uppercase' },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  currencySign: { fontSize: Typography.displayLgMobile.fontSize, fontFamily: 'Montserrat', fontWeight: '700', color: Colors.primary },
  amountInput: { flex: 1, fontSize: Typography.displayLgMobile.fontSize, fontFamily: 'Montserrat', fontWeight: '700', color: Colors.primary },
  amountMeta: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.outlineVariant + '33' },
  amountMetaText: { fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', color: Colors.onSurfaceVariant },
  quoteCard: { backgroundColor: Colors.surfaceContainerLowest, padding: Spacing.stackMd, borderRadius: BorderRadius.xl, marginTop: Spacing.gutter, borderWidth: 1, borderColor: Colors.outlineVariant + '33' },
  quoteTitle: { fontSize: Typography.labelMd.fontSize, fontFamily: 'Inter', fontWeight: '600', color: Colors.primary, marginBottom: Spacing.stackSm },
  quoteRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  quoteLabel: { fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', color: Colors.onSurfaceVariant },
  quoteValue: { fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', fontWeight: '600', color: Colors.onSurface },
  quoteDivider: { height: 1, backgroundColor: Colors.outlineVariant + '4D', marginVertical: 4 },
  testnetButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: Spacing.stackMd, paddingVertical: 12, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.primaryContainer },
  testnetButtonText: { fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', fontWeight: '700', color: Colors.primary },
  proofBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.primaryContainer, padding: Spacing.stackMd, borderRadius: BorderRadius.xl, marginTop: Spacing.stackMd },
  proofBannerTitle: { fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', fontWeight: '700', color: Colors.onPrimary },
  proofBannerHash: { fontSize: 10, fontFamily: 'Inter', color: Colors.onPrimary, marginTop: 3 },
  recipientCard: { marginTop: Spacing.gutter, gap: 12 },
  sectionLabel: { fontSize: Typography.labelMd.fontSize, fontFamily: 'Inter', fontWeight: '600', color: Colors.primary },
  demoFlowText: { fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', lineHeight: 20, color: Colors.onSurfaceVariant, backgroundColor: Colors.surfaceContainerLowest, padding: Spacing.stackMd, borderRadius: BorderRadius.xl },
  input: {
    backgroundColor: Colors.surfaceContainerLowest, padding: Spacing.stackMd,
    borderRadius: BorderRadius.xl, fontSize: Typography.bodyMd.fontSize, fontFamily: 'Inter',
    color: Colors.onSurface, borderWidth: 1, borderColor: Colors.outlineVariant + '4D',
  },
  networkRow: { flexDirection: 'row', gap: 8 },
  networkChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: BorderRadius.xl, backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1, borderColor: Colors.outlineVariant + '4D',
  },
  networkChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  networkText: { fontSize: Typography.labelMd.fontSize, fontFamily: 'Inter', fontWeight: '600', color: Colors.primary },
  networkTextActive: { color: Colors.onPrimary },
  purposePicker: { backgroundColor: Colors.surfaceContainerLowest, padding: Spacing.stackMd, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.outlineVariant + '4D' },
  purposeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  purposeTextWrap: { flex: 1 },
  purposeLabel: { fontSize: Typography.bodyMd.fontSize, fontFamily: 'Inter', fontWeight: '600', color: Colors.onSurface },
  purposeDesc: { fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', color: Colors.onSurfaceVariant },
  pickerList: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: BorderRadius.xl, overflow: 'hidden', ...Shadow.level2 },
  pickerItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: Spacing.stackMd, borderBottomWidth: 1, borderBottomColor: Colors.outlineVariant + '33' },
  pickerItemActive: { backgroundColor: Colors.primaryFixed + '1A' },
  pickerLabel: { fontSize: Typography.bodyMd.fontSize, fontFamily: 'Inter', fontWeight: '500', color: Colors.onSurface },
  pickerDesc: { fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', color: Colors.onSurfaceVariant },
  submitButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: BorderRadius.xl,
    marginTop: Spacing.gutter, ...Shadow.level2,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitText: { fontSize: Typography.labelMd.fontSize, fontFamily: 'Inter', fontWeight: '700', color: Colors.onPrimary },
});
