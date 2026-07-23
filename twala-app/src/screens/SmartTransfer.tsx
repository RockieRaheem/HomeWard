import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Animated, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard, Linking } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRef, useEffect, useState, useCallback } from 'react';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { transferApi, ratesApi, goalsApi, getPendingGoalId, setPendingGoalId, type GoalData, type StellarProof } from '../services/api';
import SendSuccess from '../components/SendSuccess';

type TransferMode = 'send' | 'deposit';

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
  { label: 'Savings', value: 'savings', icon: 'piggy-bank' as const, desc: 'Deposit to your Twaala Vault' },
  { label: 'School Fees', value: 'education', icon: 'school' as const, desc: 'Pay tuition directly' },
  { label: 'Business Investment', value: 'business', icon: 'briefcase' as const, desc: 'Invoice or partnership payment' },
];

const NETWORKS = ['MTN', 'AIRTEL'];

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
                  color={node.label === 'Stellar' ? Colors.onSecondaryContainer : Colors.onPrimary}
                />
              </View>
              <Text style={[stellarStyles.nodeLabel, node.label === 'Stellar' && { color: Colors.secondaryFixed }]}>
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
  footer: { marginTop: Spacing.gutter, textAlign: 'center', fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', fontWeight: '500', color: Colors.primaryFixed },
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
      if (usdAmount < 1) return Alert.alert('Minimum 1 USDC', 'Enter a demo funding amount of at least 1 USDC.');
      setSubmitting(true);
      try {
        const res = await transferApi.demoFund(usdAmount);
        if (res.success && res.data) {
          setFundingProof(res.data.proof);
          Alert.alert('Funded on Stellar Testnet', res.data.message);
          setAmount('500');
        } else {
          Alert.alert('Error', res.message || 'Demo funding failed.');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        Alert.alert('Deposit Failed', msg);
      } finally {
        setSubmitting(false);
      }
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
              <Text style={styles.amountLabel}>{mode === 'send' ? 'You Send' : 'Demo Funding Amount'}</Text>
              <View style={styles.amountRow}>
                <Text style={styles.currencySign}>
                  $
                </Text>
                <TextInput
                  ref={amountRef}
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="500"
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
                <Text style={styles.quoteTitle}>Judge Demo: Fiat Simulation + Real Blockchain</Text>
                <View style={styles.quoteRow}>
                  <Text style={styles.quoteLabel}>Fiat funding</Text>
                  <Text style={styles.quoteValue}>Simulated partner checkout</Text>
                </View>
                <View style={styles.quoteRow}>
                  <Text style={styles.quoteLabel}>On-chain action</Text>
                  <Text style={styles.quoteValue}>${usdAmount.toFixed(2)} test USDC issued</Text>
                </View>
                <View style={styles.quoteRow}>
                  <Text style={styles.quoteLabel}>Network</Text>
                  <Text style={styles.quoteValue}>Stellar Testnet</Text>
                </View>
                <View style={styles.quoteDivider} />
                <View style={styles.quoteRow}>
                  <Text style={styles.quoteLabel}>Rate</Text>
                  <Text style={styles.quoteValue}>1 USDC ≈ UGX {liveRate.toLocaleString()}</Text>
                </View>
              </View>
            )}

            {mode === 'deposit' && fundingProof && (
              <TouchableOpacity style={styles.proofBanner} onPress={() => Linking.openURL(fundingProof.explorerUrl)} accessibilityRole="link">
                <MaterialCommunityIcons name="shield-check" size={22} color={Colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.proofBannerTitle}>Confirmed in Stellar ledger #{fundingProof.ledger}</Text>
                  <Text style={styles.proofBannerHash}>{fundingProof.hash.slice(0, 14)}...{fundingProof.hash.slice(-8)}</Text>
                </View>
                <MaterialCommunityIcons name="open-in-new" size={18} color={Colors.primary} />
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

              {mode === 'deposit' && <Text style={styles.demoFlowText}>A production customer completes KYC and payment with a regulated on-ramp such as Transak. Its staging environment cannot issue Stellar test assets, so this action performs the equivalent USDC funding leg directly on Stellar Testnet and exposes the independently verifiable ledger record.</Text>}

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
                    {mode === 'send' ? 'Send Money' : 'Fund Demo Wallet on Testnet'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

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
  proofBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.primaryContainer, padding: Spacing.stackMd, borderRadius: BorderRadius.xl, marginTop: Spacing.stackMd },
  proofBannerTitle: { fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', fontWeight: '700', color: Colors.primary },
  proofBannerHash: { fontSize: 10, fontFamily: 'Inter', color: Colors.onSurfaceVariant, marginTop: 3 },
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
