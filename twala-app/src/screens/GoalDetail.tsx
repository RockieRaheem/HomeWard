import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, useEffect, useCallback } from 'react';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { goalsApi, historyApi, setPendingGoalId, type GoalData, type TransactionItem } from '../services/api';
import TransactionReceipt from '../components/TransactionReceipt';
import { downloadTransactions, shareOnWhatsApp } from '../utils/transactionActions';

const TABS = ['Overview', 'Milestones', 'Transactions'];

function formatUgx(ugx: number): string {
  if (ugx >= 1_000_000) return `UGX ${(ugx / 1_000_000).toFixed(1)}M`;
  if (ugx >= 1_000) return `UGX ${(ugx / 1_000).toFixed(1)}K`;
  return `UGX ${ugx.toLocaleString()}`;
}

function formatUsdc(ugx: number, rate: number): string {
  return `$${(ugx / rate).toFixed(2)}`;
}

function getGoalIcon(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('home') || t.includes('house')) return 'home';
  if (t.includes('school') || t.includes('education')) return 'school';
  if (t.includes('car')) return 'car';
  if (t.includes('business') || t.includes('shop')) return 'store';
  if (t.includes('land') || t.includes('wakiso')) return 'grass';
  return 'piggy-bank';
}

function formatTimestamp(iso: string): string {
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

function getTxIcon(type: string, status: string): string {
  if (status === 'failed') return 'close-circle';
  if (type === 'sent') return 'send';
  return 'download';
}

function getTxColor(status: string): string {
  if (status === 'completed') return Colors.primary;
  if (status === 'failed') return Colors.error;
  return Colors.secondary;
}

export default function GoalDetail({ goalId, onBack, onNavigate }: { goalId?: string | null; onBack?: () => void; onNavigate?: (screen: 'Dashboard' | 'Goals' | 'Assistant' | 'Transfer' | 'History') => void }) {
  const [activeTab, setActiveTab] = useState('Overview');
  const [goal, setGoal] = useState<GoalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txStatusFilter, setTxStatusFilter] = useState<'all' | 'completed' | 'pending' | 'failed'>('all');
  const [selectedTx, setSelectedTx] = useState<TransactionItem | null>(null);

  const fetchGoal = useCallback(() => {
    if (!goalId) { setLoading(false); return; }
    goalsApi.get(goalId).then((res) => {
      if (res.success && res.data) {
        setGoal(res.data);
      } else {
        setError(res.message || 'Goal not found');
      }
      setLoading(false);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load goal');
      setLoading(false);
    });
  }, [goalId]);

  const fetchTransactions = useCallback(() => {
    if (!goalId) return;
    setTxLoading(true);
    historyApi.list('all', 1, goalId).then((res) => {
      if (res.success && res.data) {
        setTransactions(res.data.transactions || []);
      }
      setTxLoading(false);
    }).catch(() => setTxLoading(false));
  }, [goalId]);

  useEffect(() => { fetchGoal(); }, [fetchGoal]);

  useEffect(() => {
    if (activeTab === 'Transactions') fetchTransactions();
  }, [activeTab, fetchTransactions]);

  const handleSendToGoal = () => {
    if (goalId) {
      setPendingGoalId(goalId);
      onNavigate?.('Transfer');
    }
  };

  const pct = goal && goal.targetAmountUgx > 0 ? Math.round((goal.savedAmountUgx / goal.targetAmountUgx) * 100) : 0;
  const visibleTransactions = transactions.filter((tx) => txStatusFilter === 'all' || tx.status === txStatusFilter);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (error || !goal) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={onBack} style={styles.backButton}>
              <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Goal details</Text>
          </View>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Colors.error} />
          <Text style={{ marginTop: 16, fontSize: 16, fontFamily: 'Inter', color: Colors.error, textAlign: 'center' }}>{error || 'Goal not found'}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Goal details</Text>
        </View>
        <TouchableOpacity style={styles.sendButton} onPress={handleSendToGoal} activeOpacity={0.8}>
          <MaterialCommunityIcons name="send" size={16} color={Colors.onPrimary} />
          <Text style={styles.sendButtonText}>Send Money</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={activeTab === 'Transactions' ? <RefreshControl refreshing={txLoading} onRefresh={fetchTransactions} tintColor={Colors.primary} /> : undefined}
      >
        <View style={styles.heroSection}>
          <View style={styles.heroBanner}>
            <View style={styles.heroTop}><View style={styles.heroIconWrap}><MaterialCommunityIcons name={getGoalIcon(goal.title) as any} size={30} color={Colors.onPrimary} /></View><View style={styles.heroBadge}><View style={styles.heroBadgeDot} /><Text style={styles.heroBadgeText}>{goal.status === 'completed' ? 'Goal completed' : 'Active project'}</Text></View></View>
            <Text style={styles.heroTitle}>{goal.title}</Text>
            <Text style={styles.heroDescription}>{goal.description || 'A HomeWard savings project'}</Text>
            <View style={styles.heroProgressHeader}><Text style={styles.heroProgressLabel}>UGX {formatUgx(goal.savedAmountUgx)} saved</Text><Text style={styles.heroProgressPercent}>{pct}%</Text></View><View style={styles.heroProgressTrack}><View style={[styles.heroProgressFill, { width: `${Math.min(100, pct)}%` }]} /></View><Text style={styles.heroTargetLabel}>Target: {formatUgx(goal.targetAmountUgx)}</Text>
          </View>

          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{formatUgx(goal.targetAmountUgx)}</Text>
              <Text style={styles.heroStatLabel}>Target</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{formatUsdc(goal.savedAmountUgx || 0, 3700)}</Text>
              <Text style={styles.heroStatLabel}>Saved (USDC)</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{pct}%</Text>
              <Text style={styles.heroStatLabel}>Funded</Text>
            </View>
          </View>
        </View>

        <View style={styles.tabRow}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'Overview' && (
          <View style={styles.tabContent}>
            <View style={styles.overviewGrid}>
              <View style={styles.overviewCard}>
                <MaterialCommunityIcons name="calendar-month" size={24} color={Colors.primary} />
                <Text style={styles.overviewCardLabel}>Created</Text>
                <Text style={styles.overviewCardValue}>
                  {new Date(goal.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
              <View style={styles.overviewCard}>
                <MaterialCommunityIcons name="flag-checkered" size={24} color={Colors.secondary} />
                <Text style={styles.overviewCardLabel}>Target Date</Text>
                <Text style={styles.overviewCardValue}>
                  {new Date(goal.targetDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </Text>
              </View>
              <View style={styles.overviewCard}>
                <MaterialCommunityIcons name="finance" size={24} color={Colors.tertiary} />
                <Text style={styles.overviewCardLabel}>Saved</Text>
                <Text style={styles.overviewCardValue}>{formatUgx(goal.savedAmountUgx)}</Text>
              </View>
              <View style={[styles.overviewCard, { backgroundColor: Colors.primaryContainer }]}>
                <MaterialCommunityIcons name="shield-check" size={24} color={Colors.onPrimary} />
                <Text style={[styles.overviewCardLabel, { color: Colors.onPrimary, opacity: 0.7 }]}>Status</Text>
                <Text style={[styles.overviewCardValue, { color: Colors.onPrimary }]}>
                  {goal.status === 'completed' ? 'Completed' : 'Active'}
                </Text>
              </View>
            </View>

            <View style={styles.progressDetail}>
              <View style={styles.progressDetailHeader}>
                <Text style={styles.progressDetailTitle}>Goal Progress</Text>
                <Text style={styles.progressDetailPercent}>{pct}% complete</Text>
              </View>
              <View style={styles.progressDetailBarBg}>
                <View style={[styles.progressDetailBarFill, { width: `${pct}%` }]} />
              </View>
              <View style={styles.progressDetailLabels}>
                <Text style={styles.progressDetailLabel}>Saved: {formatUgx(goal.savedAmountUgx)}</Text>
                <Text style={[styles.progressDetailLabel, { color: Colors.outline }]}>Target: {formatUgx(goal.targetAmountUgx)}</Text>
              </View>
            </View>

            {goal.milestones && goal.milestones.length > 0 && (
              <View style={styles.milestoneSummary}>
                <Text style={styles.sectionTitle}>Milestones ({goal.milestones.filter((m: any) => m.completed).length}/{goal.milestones.length})</Text>
                {goal.milestones.map((ms: any, index: number) => (
                  <View key={ms.id || index} style={styles.milestoneMiniItem}>
                    <MaterialCommunityIcons
                      name={ms.completed ? 'check-circle' : 'circle-outline'}
                      size={20}
                      color={ms.completed ? Colors.primary : Colors.outline}
                    />
                    <View style={styles.milestoneMiniInfo}>
                      <Text style={[styles.milestoneMiniTitle, ms.completed && { color: Colors.primary }]}>{ms.title}</Text>
                      {ms.description ? <Text style={styles.milestoneMiniDesc}>{ms.description}</Text> : null}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {activeTab === 'Milestones' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Milestone Tracker</Text>
            {(!goal.milestones || goal.milestones.length === 0) ? (
              <Text style={{ textAlign: 'center', color: Colors.onSurfaceVariant, fontFamily: 'Inter', paddingVertical: 20 }}>No milestones set for this goal</Text>
            ) : (
              goal.milestones.map((ms: any, index: number) => (
                <View key={ms.id || index} style={styles.milestoneItem}>
                  <View style={styles.milestoneLine} />
                  <View style={[styles.milestoneDot, { backgroundColor: ms.completed ? Colors.primary : Colors.surfaceContainerHighest }]}>
                    <MaterialCommunityIcons
                      name={ms.completed ? 'check' : 'timer-sand'}
                      size={14}
                      color={ms.completed ? Colors.onPrimary : Colors.outline}
                    />
                  </View>
                  <View style={styles.milestoneContent}>
                    <View style={styles.milestoneTop}>
                      <Text style={[styles.milestoneTitle, ms.completed ? { color: Colors.primary } : { color: Colors.outline }]}>{ms.title}</Text>
                      <View style={[styles.milestoneStatus, { backgroundColor: ms.completed ? Colors.primaryFixed + '99' : Colors.surfaceContainerHighest }]}>
                        <Text style={[styles.milestoneStatusText, { color: ms.completed ? Colors.primary : Colors.outline }]}>
                          {ms.completed ? 'Done' : 'Pending'}
                        </Text>
                      </View>
                    </View>
                    {ms.description ? <Text style={styles.milestoneDesc}>{ms.description}</Text> : null}
                    {ms.targetAmountUgx ? (
                      <Text style={styles.milestoneTarget}>Target: {formatUgx(ms.targetAmountUgx)}</Text>
                    ) : null}
                    {ms.completedAt ? (
                      <View style={styles.milestoneDateRow}>
                        <MaterialCommunityIcons name="calendar" size={12} color={Colors.outline} />
                        <Text style={styles.milestoneDate}>{new Date(ms.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'Transactions' && (
          <View style={styles.tabContent}>
            <View style={styles.paymentsHeader}><Text style={styles.sectionTitle}>Goal payments ({visibleTransactions.length})</Text><View style={styles.paymentActions}><TouchableOpacity style={styles.paymentAction} onPress={() => shareOnWhatsApp(['HOMEWARD GOAL PAYMENT LIST', goal.title, '', ...visibleTransactions.map((tx) => `$${tx.amountUsdc.toFixed(2)} • ${tx.recipientName} • ${tx.status}`)].join('\n'))}><MaterialCommunityIcons name="whatsapp" size={17} color={Colors.primary} /></TouchableOpacity><TouchableOpacity style={styles.paymentAction} onPress={() => downloadTransactions(`${goal.title.replace(/\s+/g, '-').toLowerCase()}-payments.csv`, visibleTransactions)}><MaterialCommunityIcons name="download" size={17} color={Colors.primary} /></TouchableOpacity></View></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.paymentFilterRow}>{(['all', 'completed', 'pending', 'failed'] as const).map((status) => <TouchableOpacity key={status} style={[styles.paymentFilter, txStatusFilter === status && styles.paymentFilterActive]} onPress={() => setTxStatusFilter(status)}><Text style={[styles.paymentFilterText, txStatusFilter === status && styles.paymentFilterTextActive]}>{status === 'all' ? 'All' : status[0].toUpperCase() + status.slice(1)}</Text></TouchableOpacity>)}</ScrollView>
            {transactions.length === 0 ? (
              <View style={styles.emptyTx}>
                <MaterialCommunityIcons name="swap-horizontal-bold" size={48} color={Colors.outlineVariant} />
                <Text style={styles.emptyTxTitle}>No transactions yet</Text>
                <Text style={styles.emptyTxDesc}>Send money to this goal to see it here</Text>
                <TouchableOpacity style={styles.emptyTxButton} onPress={handleSendToGoal} activeOpacity={0.8}>
                  <MaterialCommunityIcons name="send" size={16} color={Colors.onPrimary} />
                  <Text style={styles.emptyTxButtonText}>Send Money</Text>
                </TouchableOpacity>
              </View>
            ) : (
              visibleTransactions.map((tx) => (
                <TouchableOpacity key={tx.id} style={styles.txItem} onPress={() => setSelectedTx(tx)} activeOpacity={0.75}>
                  <View style={[styles.txIconWrap, { backgroundColor: getTxColor(tx.status) + '1A' }]}>
                    <MaterialCommunityIcons
                      name={getTxIcon(tx.type, tx.status) as any}
                      size={20}
                      color={getTxColor(tx.status)}
                    />
                  </View>
                  <View style={styles.txInfo}>
                    <View style={styles.txTop}>
                      <Text style={styles.txRecipient} numberOfLines={1}>{tx.recipientName}</Text>
                      <Text style={styles.txAmount}>
                        {tx.type === 'sent' ? '-' : '+'}${tx.amountUsdc.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.txBottom}>
                      <View style={[styles.txStatusBadge, { backgroundColor: getTxColor(tx.status) + '1A' }]}>
                        <Text style={[styles.txStatusText, { color: getTxColor(tx.status) }]}>{tx.status}</Text>
                      </View>
                      {tx.amountUgx ? (
                        <Text style={styles.txUgx}>UGX {tx.amountUgx.toLocaleString()}</Text>
                      ) : null}
                      <Text style={styles.txTime}>{formatTimestamp(tx.createdAt)}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </ScrollView>
      <TransactionReceipt transaction={selectedTx} onClose={() => setSelectedTx(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11, backgroundColor: Colors.surface },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.stackSm },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surfaceContainerLow, borderRadius: 13 },
  headerTitle: { fontSize: 17, fontFamily: 'Montserrat', fontWeight: '800', color: Colors.onSurface },
  sendButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary, paddingHorizontal: 15, paddingVertical: 10,
    borderRadius: 13, ...Shadow.level1,
  },
  sendButtonText: { fontSize: Typography.labelSm.fontSize, fontFamily: 'Inter', fontWeight: '600', color: Colors.onPrimary },
  scrollContent: { paddingBottom: 100 },
  heroSection: { paddingHorizontal: 16, paddingTop: 12 },
  heroBanner: {
    backgroundColor: Colors.primary, borderRadius: 24, padding: 20, ...Shadow.level2, overflow: 'hidden',
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroIconWrap: { width: 52, height: 52, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.14)', justifyContent: 'center', alignItems: 'center' },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, paddingVertical: 7, borderRadius: BorderRadius.full },
  heroBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.secondaryContainer },
  heroBadgeText: { fontSize: 11, fontFamily: 'Inter', fontWeight: '700', color: Colors.onPrimary },
  heroTitle: { fontSize: 25, fontFamily: 'Montserrat', fontWeight: '800', color: Colors.onPrimary, marginTop: 20 },
  heroDescription: { color: Colors.primaryFixed, fontFamily: 'Inter', fontSize: 12, lineHeight: 17, marginTop: 5 },
  heroProgressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 },
  heroProgressLabel: { color: Colors.onPrimary, fontFamily: 'Inter', fontWeight: '700', fontSize: 12 },
  heroProgressPercent: { color: Colors.secondaryContainer, fontFamily: 'Montserrat', fontWeight: '800', fontSize: 18 },
  heroProgressTrack: { height: 8, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 4, overflow: 'hidden', marginTop: 7 },
  heroProgressFill: { height: '100%', backgroundColor: Colors.secondaryContainer, borderRadius: 4 },
  heroTargetLabel: { color: Colors.primaryFixed, fontFamily: 'Inter', fontSize: 11, marginTop: 7 },
  heroStats: { flexDirection: 'row', backgroundColor: Colors.surfaceContainerLowest, marginTop: 12, borderRadius: 18, padding: 15, ...Shadow.level1, borderWidth: 1, borderColor: Colors.outlineVariant + '33' },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatDivider: { width: 1, backgroundColor: Colors.outlineVariant + '4D', marginVertical: 4 },
  heroStatValue: { fontSize: Typography.headlineSm.fontSize, fontFamily: 'Montserrat', fontWeight: '700', color: Colors.primary },
  heroStatLabel: { fontSize: 11, fontFamily: 'Inter', fontWeight: '500', color: Colors.onSurfaceVariant, marginTop: 2 },
  tabRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 4, marginTop: 22, backgroundColor: Colors.surfaceContainerLow, marginHorizontal: 16, borderRadius: 14, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: BorderRadius.md, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.surfaceContainerLowest, ...Shadow.level1 },
  tabText: { fontSize: Typography.labelMd.fontSize, fontFamily: 'Inter', fontWeight: '500', color: Colors.onSurfaceVariant },
  tabTextActive: { color: Colors.primary, fontWeight: '600' },
  tabContent: { paddingHorizontal: 16, marginTop: 18, gap: Spacing.stackMd },
  overviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.stackSm },
  overviewCard: { width: '48%', backgroundColor: Colors.surfaceContainerLowest, padding: Spacing.stackMd, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.outlineVariant + '33', ...Shadow.level1, gap: 4 },
  overviewCardLabel: { fontSize: Typography.labelSm.fontSize, fontFamily: 'Inter', fontWeight: '500', color: Colors.onSurfaceVariant },
  overviewCardValue: { fontSize: Typography.headlineSm.fontSize, fontFamily: 'Montserrat', fontWeight: '600', color: Colors.primary },
  progressDetail: { backgroundColor: Colors.surfaceContainerLowest, padding: Spacing.stackMd, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.outlineVariant + '33', ...Shadow.level1 },
  progressDetailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.stackSm },
  progressDetailTitle: { fontSize: Typography.labelMd.fontSize, fontFamily: 'Inter', fontWeight: '600', color: Colors.onSurface },
  progressDetailPercent: { fontSize: Typography.labelSm.fontSize, fontFamily: 'Inter', fontWeight: '600', color: Colors.secondary },
  progressDetailBarBg: { width: '100%', height: 10, backgroundColor: Colors.surfaceContainerHigh, borderRadius: BorderRadius.full, overflow: 'hidden' },
  progressDetailBarFill: { height: '100%', backgroundColor: Colors.secondaryContainer, borderRadius: BorderRadius.full },
  progressDetailLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  progressDetailLabel: { fontSize: 10, fontFamily: 'Inter', fontWeight: '500', color: Colors.primary },
  sectionTitle: { fontSize: Typography.headlineSm.fontSize, fontFamily: 'Montserrat', fontWeight: '600', color: Colors.primary },
  paymentsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  paymentActions: { flexDirection: 'row', gap: 6 },
  paymentAction: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center', borderRadius: 17, backgroundColor: Colors.surfaceContainerLow },
  paymentFilterRow: { gap: 8, paddingBottom: 4 },
  paymentFilter: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.outlineVariant, backgroundColor: Colors.surfaceContainerLowest },
  paymentFilterActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  paymentFilterText: { fontSize: Typography.labelSm.fontSize, fontFamily: 'Inter', color: Colors.onSurfaceVariant, fontWeight: '600' },
  paymentFilterTextActive: { color: Colors.onPrimary },
  milestoneSummary: { backgroundColor: Colors.surfaceContainerLowest, padding: Spacing.stackMd, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.outlineVariant + '33', ...Shadow.level1 },
  milestoneMiniItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.stackSm, paddingVertical: 6 },
  milestoneMiniInfo: { flex: 1 },
  milestoneMiniTitle: { fontSize: Typography.labelMd.fontSize, fontFamily: 'Inter', fontWeight: '500', color: Colors.onSurface },
  milestoneMiniDesc: { fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', color: Colors.onSurfaceVariant },
  milestoneItem: { flexDirection: 'row', gap: Spacing.stackMd, position: 'relative', marginBottom: Spacing.stackLg },
  milestoneLine: { position: 'absolute', left: 11, top: 24, bottom: -8, width: 2, backgroundColor: Colors.outlineVariant },
  milestoneDot: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', zIndex: 1, flexShrink: 0 },
  milestoneContent: { flex: 1, paddingBottom: Spacing.stackMd, borderBottomWidth: 1, borderBottomColor: Colors.outlineVariant + '33' },
  milestoneTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  milestoneTitle: { fontSize: Typography.labelMd.fontSize, fontFamily: 'Inter', fontWeight: '600' },
  milestoneStatus: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: BorderRadius.full },
  milestoneStatusText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  milestoneDesc: { fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', color: Colors.onSurfaceVariant, marginBottom: 4 },
  milestoneTarget: { fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', color: Colors.secondary, fontWeight: '500' },
  milestoneDateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  milestoneDate: { fontSize: 11, fontFamily: 'Inter', color: Colors.outline },
  emptyTx: { alignItems: 'center', paddingVertical: 40, gap: Spacing.stackSm },
  emptyTxTitle: { fontSize: Typography.headlineSm.fontSize, fontFamily: 'Montserrat', fontWeight: '600', color: Colors.onSurfaceVariant },
  emptyTxDesc: { fontSize: Typography.bodyMd.fontSize, fontFamily: 'Inter', color: Colors.outline, textAlign: 'center' },
  emptyTxButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: BorderRadius.full, marginTop: Spacing.stackMd, ...Shadow.level1 },
  emptyTxButtonText: { fontSize: Typography.labelMd.fontSize, fontFamily: 'Inter', fontWeight: '600', color: Colors.onPrimary },
  txItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.stackSm, backgroundColor: Colors.surfaceContainerLowest, padding: Spacing.stackMd, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.outlineVariant + '33', ...Shadow.level1 },
  txIconWrap: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  txInfo: { flex: 1 },
  txTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  txRecipient: { fontSize: Typography.bodyMd.fontSize, fontFamily: 'Inter', fontWeight: '600', color: Colors.onSurface, flex: 1, marginRight: 8 },
  txAmount: { fontSize: Typography.bodyMd.fontSize, fontFamily: 'Inter', fontWeight: '700', color: Colors.primary },
  txBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  txStatusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full },
  txStatusText: { fontSize: 10, fontFamily: 'Inter', fontWeight: '700' },
  txUgx: { fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', color: Colors.onSurfaceVariant },
  txTime: { fontSize: 10, fontFamily: 'Inter', color: Colors.outline, marginLeft: 'auto' },
});
