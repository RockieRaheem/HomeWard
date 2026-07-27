import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, Linking } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import type { TransactionItem } from '../services/api';
import { downloadReceipt, shareReceiptOnWhatsApp } from '../utils/transactionActions';
import { useLanguage } from '../i18n/LanguageContext';

export default function TransactionReceipt({ transaction, onClose }: { transaction: TransactionItem | null; onClose: () => void }) {
  const { t } = useLanguage();
  if (!transaction) return null;
  const tx = transaction;
  const isSent = tx.type === 'sent';
  const statusColor = tx.status === 'completed' ? Colors.primary : tx.status === 'failed' ? Colors.error : Colors.secondary;
  const receiptId = `HW-${tx.id.replace(/-/g, '').slice(-8).toUpperCase()}`;

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}><View><Text style={styles.eyebrow}>HOMEWARD {t('RECEIPT')}</Text><Text style={styles.title}>{t('Transaction details')}</Text></View><TouchableOpacity onPress={onClose}><MaterialCommunityIcons name="close" size={24} color={Colors.onSurfaceVariant} /></TouchableOpacity></View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.amountPanel}>
              <MaterialCommunityIcons name={isSent ? 'send-check' : 'download-circle'} size={26} color={Colors.onPrimary} />
              <Text style={styles.amountLabel}>{isSent ? t('You sent') : t('You received')}</Text>
              <Text style={styles.amount}>${tx.amountUsdc.toFixed(2)} USDC</Text>
              {tx.amountUgx ? <Text style={styles.ugx}>UGX {tx.amountUgx.toLocaleString()}</Text> : null}
            </View>
            <View style={styles.status}><View style={[styles.dot, { backgroundColor: statusColor }]} /><Text style={[styles.statusText, { color: statusColor }]}>{tx.status === 'completed' ? t('Completed') : tx.status === 'failed' ? t('Failed') : t('Pending confirmation')}</Text></View>
            <View style={styles.details}>
              <Row icon="account" label={isSent ? t('Recipient') : t('Source')} value={tx.recipientName || t('HomeWard wallet')} />
              {tx.recipientPhone ? <Row icon="phone" label={t('Mobile')} value={tx.recipientPhone} /> : null}
              {tx.recipientNetwork ? <Row icon="signal-cellular-3" label={t('Network')} value={tx.recipientNetwork} /> : null}
              <Row icon="target" label={t('Purpose')} value={tx.purpose || t('Transfer')} />
              <Row icon="barcode-scan" label={t('Receipt')} value={receiptId} />
              <Row icon="calendar-clock" label={t('Date')} value={new Date(tx.createdAt).toLocaleString('en-UG', { timeZone: 'Africa/Kampala', dateStyle: 'medium', timeStyle: 'short' })} />
              {tx.stellarTxHash ? <TouchableOpacity style={styles.stellarRow} onPress={() => Linking.openURL(`https://stellar.expert/explorer/testnet/tx/${tx.stellarTxHash}`)}><MaterialCommunityIcons name="shield-check" size={18} color={Colors.onPrimary} /><View style={{ flex: 1 }}><Text style={styles.stellarTitle}>{t('Verified on Stellar Testnet')}</Text><Text style={styles.stellarHash}>{tx.stellarTxHash.slice(0, 14)}...{tx.stellarTxHash.slice(-8)}</Text></View><MaterialCommunityIcons name="open-in-new" size={17} color={Colors.onPrimary} /></TouchableOpacity> : null}
            </View>
            <View style={styles.actions}><TouchableOpacity style={styles.secondaryButton} onPress={() => shareReceiptOnWhatsApp(tx)}><MaterialCommunityIcons name="whatsapp" size={18} color={Colors.primary} /><Text style={styles.secondaryText}>WhatsApp</Text></TouchableOpacity><TouchableOpacity style={styles.secondaryButton} onPress={() => downloadReceipt(`${receiptId}.html`, tx)}><MaterialCommunityIcons name="download" size={18} color={Colors.primary} /><Text style={styles.secondaryText}>{t('Download receipt')}</Text></TouchableOpacity></View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Row({ icon, label, value }: { icon: string; label: string; value: string }) { return <View style={styles.row}><MaterialCommunityIcons name={icon as any} size={17} color={Colors.onSurfaceVariant} /><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View>; }

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }, sheet: { maxHeight: '90%', backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: Spacing.gutter, paddingBottom: 28 }, handle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: Colors.outlineVariant, marginBottom: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, eyebrow: { fontSize: 10, fontFamily: 'Inter', fontWeight: '800', letterSpacing: 1, color: Colors.primary }, title: { fontSize: Typography.headlineSm.fontSize, fontFamily: 'Montserrat', fontWeight: '700', color: Colors.onSurface, marginTop: 3 },
  amountPanel: { alignItems: 'center', backgroundColor: Colors.primary, padding: 18, borderRadius: BorderRadius.xl, marginTop: 18 }, amountLabel: { fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', color: Colors.primaryFixed, marginTop: 5 }, amount: { fontSize: Typography.headlineMd.fontSize, fontFamily: 'Montserrat', fontWeight: '800', color: Colors.onPrimary, marginTop: 2 }, ugx: { fontSize: Typography.labelMd.fontSize, fontFamily: 'Inter', color: Colors.onPrimary, marginTop: 3 },
  status: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.surfaceContainerLow, borderRadius: BorderRadius.full, paddingHorizontal: 10, paddingVertical: 6, marginTop: 12 }, dot: { width: 7, height: 7, borderRadius: 4 }, statusText: { fontSize: Typography.labelSm.fontSize, fontFamily: 'Inter', fontWeight: '800' },
  details: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: BorderRadius.xl, padding: 14, marginTop: 14, gap: 11, borderWidth: 1, borderColor: Colors.outlineVariant + '44' }, row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, rowLabel: { width: 68, fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', color: Colors.onSurfaceVariant }, rowValue: { flex: 1, fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', fontWeight: '700', color: Colors.onSurface, textAlign: 'right' },
  stellarRow: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: Colors.primaryContainer, padding: 11, borderRadius: BorderRadius.lg, marginTop: 2 }, stellarTitle: { fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', fontWeight: '800', color: Colors.onPrimary }, stellarHash: { fontSize: 10, fontFamily: 'Inter', color: Colors.onPrimary, marginTop: 2 }, actions: { flexDirection: 'row', gap: 10, marginTop: 16 }, secondaryButton: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, paddingVertical: 13, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.primary }, secondaryText: { fontSize: Typography.labelMd.fontSize, fontFamily: 'Inter', fontWeight: '800', color: Colors.primary },
});
