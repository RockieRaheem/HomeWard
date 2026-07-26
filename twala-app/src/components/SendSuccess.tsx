import { View, Text, TouchableOpacity, StyleSheet, Animated, Modal, Linking, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';

interface SendSuccessProps {
  visible: boolean;
  amountUsdc: number;
  amountUgx: number;
  recipientName: string;
  recipientPhone?: string;
  recipientNetwork?: string;
  referenceId: string;
  newBalance: number;
  goalTitle?: string;
  purpose?: string;
  recipientRelationship?: string;
  confirmedAt?: string;
  feeUsdc: number;
  rate: number;
  stellarTxHash?: string;
  stellarExplorerUrl?: string;
  onDone: () => void;
}

export default function SendSuccess({
  visible, amountUsdc, amountUgx, recipientName, recipientPhone,
  recipientNetwork, referenceId, newBalance, goalTitle, purpose, recipientRelationship, confirmedAt,
  feeUsdc, rate, stellarTxHash, stellarExplorerUrl, onDone,
}: SendSuccessProps) {
  const scale = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const detailsOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scale.setValue(0);
      checkOpacity.setValue(0);
      detailsOpacity.setValue(0);

      Animated.sequence([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 4 }),
        Animated.timing(checkOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(detailsOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);


  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.checkSection}>
            <Animated.View style={[styles.checkCircle, { opacity: checkOpacity }]}>
              <MaterialCommunityIcons name="check" size={48} color={Colors.onPrimary} />
            </Animated.View>
            <Text style={styles.title}>Transfer Successful!</Text>
            <Text style={styles.subtitle}>Money is on its way to {recipientName}</Text>
          </View>

          <Animated.View style={[styles.detailsSection, { opacity: detailsOpacity }]}>
            <View style={styles.amountRow}>
              <Text style={styles.sentLabel}>You Sent</Text>
              <Text style={styles.sentAmount}>${amountUsdc.toFixed(2)} USDC</Text>
            </View>

            <View style={styles.amountRow}>
              <Text style={styles.sentLabel}>Recipient Gets</Text>
              <Text style={styles.receiveAmount}>UGX {amountUgx.toLocaleString()}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="account" size={16} color={Colors.onSurfaceVariant} />
              <Text style={styles.detailLabel}>Recipient</Text>
              <Text style={styles.detailValue}>{recipientName}</Text>
            </View>

            {recipientPhone ? (
              <View style={styles.detailRow}>
                <MaterialCommunityIcons name="phone" size={16} color={Colors.onSurfaceVariant} />
                <Text style={styles.detailLabel}>Phone</Text>
                <Text style={styles.detailValue}>{recipientPhone}</Text>
              </View>
            ) : null}

            {recipientNetwork ? (
              <View style={styles.detailRow}>
                <MaterialCommunityIcons name="signal-cellular-3" size={16} color={Colors.onSurfaceVariant} />
                <Text style={styles.detailLabel}>Network</Text>
                <Text style={styles.detailValue}>{recipientNetwork}</Text>
              </View>
            ) : null}

            {recipientRelationship ? <View style={styles.detailRow}><MaterialCommunityIcons name="account-heart-outline" size={16} color={Colors.onSurfaceVariant} /><Text style={styles.detailLabel}>Relationship</Text><Text style={styles.detailValue}>{recipientRelationship}</Text></View> : null}

            {purpose ? <View style={styles.detailRow}><MaterialCommunityIcons name="target" size={16} color={Colors.onSurfaceVariant} /><Text style={styles.detailLabel}>Purpose</Text><Text style={styles.detailValue}>{purpose}</Text></View> : null}

            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="receipt" size={16} color={Colors.onSurfaceVariant} />
              <Text style={styles.detailLabel}>Fee</Text>
              <Text style={styles.detailValue}>${feeUsdc.toFixed(2)} USDC</Text>
            </View>

            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="currency-usd" size={16} color={Colors.onSurfaceVariant} />
              <Text style={styles.detailLabel}>Rate</Text>
              <Text style={styles.detailValue}>1 USDC = UGX {rate.toLocaleString()}</Text>
            </View>

            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="wallet" size={16} color={Colors.onSurfaceVariant} />
              <Text style={styles.detailLabel}>New Balance</Text>
              <Text style={[styles.detailValue, { color: Colors.primary, fontWeight: '700' }]}>${newBalance.toFixed(2)} USDC</Text>
            </View>

            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="barcode-scan" size={16} color={Colors.onSurfaceVariant} />
              <Text style={styles.detailLabel}>Reference</Text>
              <Text style={[styles.detailValue, { fontSize: 11 }]}>{referenceId.slice(-8).toUpperCase()}</Text>
            </View>

            {goalTitle ? (
              <View style={styles.goalImpact}><MaterialCommunityIcons name="flag-checkered" size={20} color={Colors.primary} /><View style={{ flex: 1 }}><Text style={styles.goalImpactLabel}>FAMILY OUTCOME UPDATED</Text><Text style={styles.goalImpactTitle}>{goalTitle}</Text><Text style={styles.goalImpactText}>This transfer has been linked to the family goal.</Text></View></View>
            ) : null}

            {confirmedAt ? <View style={styles.consentNote}><MaterialCommunityIcons name="shield-check-outline" size={15} color={Colors.primary} /><Text style={styles.consentText}>Confirmed by you {new Date(confirmedAt).toLocaleString('en-UG', { timeZone: 'Africa/Kampala', dateStyle: 'medium', timeStyle: 'short' })}</Text></View> : null}

            {stellarTxHash && stellarExplorerUrl ? (
              <TouchableOpacity
                style={styles.proofCard}
                onPress={() => Linking.openURL(stellarExplorerUrl)}
                accessibilityRole="link"
              >
                <MaterialCommunityIcons name="shield-check" size={18} color={Colors.onPrimary} />
                <View style={styles.proofText}>
                  <Text style={styles.proofTitle}>Verified on Stellar Testnet</Text>
                  <Text style={styles.proofHash}>{stellarTxHash.slice(0, 12)}...{stellarTxHash.slice(-8)}</Text>
                </View>
                <MaterialCommunityIcons name="open-in-new" size={18} color={Colors.onPrimary} />
              </TouchableOpacity>
            ) : null}

          </Animated.View>
          </ScrollView>

          <TouchableOpacity style={styles.doneButton} onPress={onDone} activeOpacity={0.8}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
    padding: Spacing.containerPaddingMobile,
  },
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.xl * 1.5,
    width: '100%', maxWidth: 400, maxHeight: '88%',
    padding: Spacing.gutter,
    ...Shadow.level2,
  },
  scrollArea: { flexGrow: 0 },
  scrollContent: { paddingBottom: 4 },
  checkSection: { alignItems: 'center', marginBottom: Spacing.gutter },
  checkCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.stackMd,
    ...Shadow.level2,
  },
  title: {
    fontSize: Typography.headlineMd.fontSize, fontFamily: 'Montserrat', fontWeight: '700',
    color: Colors.primary, textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.bodyMd.fontSize, fontFamily: 'Inter',
    color: Colors.onSurfaceVariant, textAlign: 'center', marginTop: 4,
  },
  detailsSection: { gap: Spacing.stackSm },
  amountRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: Spacing.stackSm,
  },
  sentLabel: { fontSize: Typography.bodyMd.fontSize, fontFamily: 'Inter', color: Colors.onSurfaceVariant },
  sentAmount: { fontSize: Typography.headlineSm.fontSize, fontFamily: 'Montserrat', fontWeight: '700', color: Colors.primary },
  receiveAmount: { fontSize: Typography.headlineSm.fontSize, fontFamily: 'Montserrat', fontWeight: '700', color: Colors.secondary },
  divider: { height: 1, backgroundColor: Colors.outlineVariant + '66', marginVertical: Spacing.stackSm },
  detailRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 4,
  },
  detailLabel: { fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', color: Colors.onSurfaceVariant, width: 80 },
  detailValue: { flex: 1, fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', fontWeight: '600', color: Colors.onSurface, textAlign: 'right' },
  proofCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, marginTop: 8, borderRadius: BorderRadius.lg, backgroundColor: Colors.primaryContainer },
  proofText: { flex: 1 },
  proofTitle: { fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', fontWeight: '700', color: Colors.onPrimary },
  proofHash: { fontSize: 10, fontFamily: 'Inter', color: Colors.onPrimary, marginTop: 2 },
  goalImpact: { flexDirection: 'row', gap: 9, backgroundColor: '#EAF6F1', padding: 12, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: '#C5E7D8' },
  goalImpactLabel: { color: Colors.primary, fontSize: 9, letterSpacing: 0.8, fontFamily: 'Inter', fontWeight: '800' },
  goalImpactTitle: { color: Colors.onSurface, fontSize: 13, fontFamily: 'Inter', fontWeight: '800', marginTop: 2 },
  goalImpactText: { color: Colors.onSurfaceVariant, fontSize: 10, fontFamily: 'Inter', marginTop: 3 },
  consentNote: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 9, borderRadius: 10, backgroundColor: Colors.surfaceContainerLow },
  consentText: { flex: 1, color: Colors.primary, fontSize: 10, fontFamily: 'Inter', fontWeight: '600' },
  doneButton: {
    backgroundColor: Colors.primary, paddingVertical: 16,
    borderRadius: BorderRadius.full, alignItems: 'center',
    marginTop: Spacing.gutter, ...Shadow.level1,
  },
  doneButtonText: { fontSize: Typography.labelMd.fontSize, fontFamily: 'Inter', fontWeight: '700', color: Colors.onPrimary },
});
