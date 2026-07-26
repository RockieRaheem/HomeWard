import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState, useCallback } from 'react';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { historyApi, eventsApi, type TransactionItem } from '../services/api';
import TransactionReceipt from '../components/TransactionReceipt';
import { downloadTransactions, shareOnWhatsApp } from '../utils/transactionActions';

const FILTERS = ['All', 'Sent', 'Received'];
const STATUS_FILTERS = ['All', 'Completed', 'Pending', 'Failed'];
const DATE_FILTERS = ['All time', 'Today', '7 days', '30 days'];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  completed: { label: 'Completed', color: Colors.primary, bg: Colors.primaryFixed + '99' },
  pending: { label: 'Pending', color: Colors.secondary, bg: Colors.secondaryContainer + '66' },
  failed: { label: 'Failed', color: Colors.error, bg: Colors.errorContainer },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return 'Today';
  if (diff < 172800000) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getAvatarIcon(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('maama') || lower.includes('sarah')) return 'face-woman-profile';
  if (lower.includes('ssekandi') || lower.includes('taata')) return 'face-man-profile';
  if (lower.includes('contractor') || lower.includes('sula')) return 'hard-hat';
  if (lower.includes('school') || lower.includes('junior')) return 'school';
  if (lower.includes('refund') || lower.includes('kotani')) return 'refresh';
  if (lower.includes('hardware') || lower.includes('store')) return 'store';
  if (lower.includes('savings') || lower.includes('vault')) return 'piggy-bank';
  return 'account';
}

export default function History() {
  const [filter, setFilter] = useState('all');
  const [txs, setTxs] = useState<TransactionItem[]>([]);
  const [stats, setStats] = useState({ totalSent: 0, totalReceived: 0, thisMonth: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all time');
  const [selectedTx, setSelectedTx] = useState<TransactionItem | null>(null);

  const fetchHistory = useCallback((f: string, isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    historyApi.list(f).then((res) => {
      if (res.success && res.data) {
        setTxs(res.data.transactions);
        setStats(res.data.stats);
      }
      setLoading(false);
      setRefreshing(false);
    }).catch(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { fetchHistory(filter); }, [filter, fetchHistory]);

  // Auto-refresh when backend signals changes
  useEffect(() => {
    let lastVer = 0;
    const interval = setInterval(async () => {
      try {
        const res = await eventsApi.version();
        if (res.success && res.data && res.data.version !== lastVer) {
          lastVer = res.data.version;
          fetchHistory(filter, true);
        }
      } catch { /* skip */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [filter, fetchHistory]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHistory(filter, true);
  }, [filter, fetchHistory]);

  const visibleTransactions = txs.filter((tx) => {
    if (statusFilter !== 'all' && tx.status !== statusFilter) return false;
    const age = Date.now() - new Date(tx.createdAt).getTime();
    if (dateFilter === 'today') return age < 86400000;
    if (dateFilter === '7 days') return age < 7 * 86400000;
    if (dateFilter === '30 days') return age < 30 * 86400000;
    return true;
  });

  const shareList = () => shareOnWhatsApp([
    'HOMEWARD TRANSACTION LIST', '',
    ...visibleTransactions.map((tx) => `${tx.type === 'sent' ? 'Sent' : 'Received'} $${tx.amountUsdc.toFixed(2)} • ${tx.recipientName} • ${tx.status}`),
  ].join('\n'));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>History</Text>
        <View style={styles.headerActions}><TouchableOpacity style={styles.searchButton} onPress={shareList}><MaterialCommunityIcons name="whatsapp" size={20} color={Colors.primary} /></TouchableOpacity><TouchableOpacity style={styles.searchButton} onPress={() => downloadTransactions('homeward-transactions.csv', visibleTransactions)}><MaterialCommunityIcons name="download" size={20} color={Colors.primary} /></TouchableOpacity></View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
          {FILTERS.map((f) => {
            const val = f.toLowerCase();
            return (
              <TouchableOpacity key={f} style={[styles.filterChip, filter === val && styles.filterChipActive]} onPress={() => setFilter(val)}>
                <Text style={[styles.filterText, filter === val && styles.filterTextActive]}>{f}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.filterLabel}>Status</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
          {STATUS_FILTERS.map((f) => { const val = f.toLowerCase(); return <TouchableOpacity key={f} style={[styles.filterChip, statusFilter === val && styles.filterChipActive]} onPress={() => setStatusFilter(val)}><Text style={[styles.filterText, statusFilter === val && styles.filterTextActive]}>{f}</Text></TouchableOpacity>; })}
        </ScrollView>
        <Text style={styles.filterLabel}>Period</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
          {DATE_FILTERS.map((f) => { const val = f.toLowerCase(); return <TouchableOpacity key={f} style={[styles.filterChip, dateFilter === val && styles.filterChipActive]} onPress={() => setDateFilter(val)}><Text style={[styles.filterText, dateFilter === val && styles.filterTextActive]}>{f}</Text></TouchableOpacity>; })}
        </ScrollView>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statCardLabel}>Total Sent</Text>
            <Text style={styles.statCardValue}>${stats.totalSent.toLocaleString()}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: Colors.primary }]}>
            <Text style={[styles.statCardLabel, { color: Colors.onPrimary, opacity: 0.7 }]}>This Month</Text>
            <Text style={[styles.statCardValue, { color: Colors.onPrimary }]}>{stats.thisMonth} TX</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Transactions ({visibleTransactions.length})</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
        ) : visibleTransactions.length === 0 ? (
          <Text style={{ textAlign: 'center', color: Colors.onSurfaceVariant, marginTop: 40, fontFamily: 'Inter' }}>No transactions yet</Text>
        ) : (
          visibleTransactions.map((tx, i) => {
            const cfg = STATUS_CONFIG[tx.status] || STATUS_CONFIG.completed;
            return (
              <TouchableOpacity key={tx.id} style={styles.txCard} activeOpacity={0.7} onPress={() => setSelectedTx(tx)}>
                <View style={styles.txLeft}>
                  <View style={[styles.txAvatar, { backgroundColor: tx.type === 'received' ? Colors.tertiaryFixed : Colors.surfaceContainer }]}>
                    <MaterialCommunityIcons name={getAvatarIcon(tx.recipientName) as any} size={20} color={tx.type === 'received' ? Colors.tertiary : Colors.primary} />
                  </View>
                  <View style={styles.txInfo}>
                    <View style={styles.txNameRow}>
                      <Text style={styles.txName}>{tx.recipientName}</Text>
                      {i === 0 && (
                        <View style={styles.newBadge}>
                          <Text style={styles.newBadgeText}>NEW</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.txPurpose}>{tx.purpose}</Text>
                    <View style={styles.txMeta}>
                      <MaterialCommunityIcons name="clock-outline" size={12} color={Colors.outline} />
                      <Text style={styles.txDate}>{formatDate(tx.createdAt)}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.txRight}>
                  <Text style={[styles.txAmount, tx.type === 'received' && { color: Colors.tertiary }]}>
                    {tx.type === 'received' ? '+' : '-'}${tx.amountUsdc.toFixed(2)}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                    <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
                    <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
      <TransactionReceipt transaction={selectedTx} onClose={() => setSelectedTx(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.containerPaddingMobile, paddingVertical: Spacing.stackMd,
    backgroundColor: Colors.surface, ...Shadow.level1,
  },
  headerTitle: { fontSize: Typography.headlineMd.fontSize, fontFamily: 'Montserrat', fontWeight: '600', color: Colors.primary },
  headerActions: { flexDirection: 'row', gap: 4 },
  searchButton: { padding: 8, borderRadius: BorderRadius.full, backgroundColor: Colors.surfaceContainerLow },
  scrollContent: { paddingBottom: 100 },
  filterRow: { paddingVertical: Spacing.stackSm, paddingLeft: Spacing.containerPaddingMobile },
  filterContent: { flexDirection: 'row', gap: 8, paddingRight: Spacing.containerPaddingMobile },
  filterLabel: { paddingHorizontal: Spacing.containerPaddingMobile, marginTop: 4, fontSize: Typography.labelSm.fontSize, fontFamily: 'Inter', fontWeight: '700', color: Colors.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.6 },
  filterChip: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: BorderRadius.full, backgroundColor: Colors.surfaceContainerLow, borderWidth: 1, borderColor: Colors.outlineVariant + '66' },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: Typography.labelSm.fontSize, fontFamily: 'Inter', fontWeight: '500', color: Colors.onSurfaceVariant },
  filterTextActive: { color: Colors.onPrimary },
  statsRow: { flexDirection: 'row', gap: Spacing.stackMd, paddingHorizontal: Spacing.containerPaddingMobile, marginTop: 12 },
  statCard: {
    flex: 1, backgroundColor: Colors.surfaceContainerLowest, padding: Spacing.stackMd,
    borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.outlineVariant + '33', ...Shadow.level1,
  },
  statCardLabel: { fontSize: Typography.labelSm.fontSize, fontFamily: 'Inter', fontWeight: '500', color: Colors.onSurfaceVariant },
  statCardValue: { fontSize: Typography.headlineSm.fontSize, fontFamily: 'Montserrat', fontWeight: '600', color: Colors.primary, marginTop: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.containerPaddingMobile, marginTop: Spacing.gutter, marginBottom: Spacing.stackSm },
  sectionTitle: { fontSize: Typography.headlineSm.fontSize, fontFamily: 'Montserrat', fontWeight: '600', color: Colors.primary },
  exportText: { fontSize: Typography.labelMd.fontSize, fontFamily: 'Inter', fontWeight: '600', color: Colors.secondary },
  txCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.stackSm, paddingHorizontal: Spacing.containerPaddingMobile,
    marginHorizontal: Spacing.containerPaddingMobile, marginBottom: 4,
    backgroundColor: Colors.surfaceContainerLowest, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.outlineVariant + '1A', ...Shadow.level1,
  },
  txLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.stackSm, flex: 1 },
  txAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  txInfo: { flex: 1 },
  txNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  txName: { fontSize: Typography.labelMd.fontSize, fontFamily: 'Inter', fontWeight: '600', color: Colors.onSurface },
  newBadge: { backgroundColor: Colors.secondaryContainer, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  newBadgeText: { fontSize: 8, fontWeight: '700', color: Colors.onSecondaryContainer, letterSpacing: 0.5 },
  txPurpose: { fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', color: Colors.onSurfaceVariant, marginTop: 1 },
  txMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  txDate: { fontSize: 11, fontFamily: 'Inter', color: Colors.outline },
  txRight: { alignItems: 'flex-end', gap: 4 },
  txAmount: { fontSize: Typography.labelMd.fontSize, fontFamily: 'Inter', fontWeight: '600', color: Colors.onSurface },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 10, fontFamily: 'Inter', fontWeight: '600' },
});
