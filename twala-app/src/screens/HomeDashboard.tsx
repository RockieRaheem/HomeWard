import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet, Dimensions, ActivityIndicator, AppState, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState, useCallback, useEffect } from 'react';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import type { AppScreen } from '../components/BottomNavBar';
import { walletApi, ratesApi, historyApi, goalsApi, eventsApi, type GoalData } from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HOMEWARD_LOGO = require('../../assets/branding/homeward-logo.png');

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatAmount(usdc: number): string {
  return usdc.toFixed(2);
}

function formatUgx(ugx: number): string {
  if (ugx >= 1_000_000) return `${(ugx / 1_000_000).toFixed(1)}M`;
  if (ugx >= 1_000) return `${(ugx / 1_000).toFixed(1)}K`;
  return ugx.toLocaleString();
}

function getGoalIcon(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('home') || t.includes('house')) return 'home';
  if (t.includes('land') || t.includes('wakiso')) return 'grass';
  if (t.includes('school') || t.includes('fees') || t.includes('education')) return 'school';
  if (t.includes('car') || t.includes('vehicle')) return 'car';
  if (t.includes('business') || t.includes('shop')) return 'store';
  return 'piggy-bank';
}

const GOAL_COLORS = [
  { iconBg: Colors.primaryFixed, iconColor: Colors.primary, progressColor: Colors.primary },
  { iconBg: Colors.tertiaryFixed, iconColor: Colors.tertiary, progressColor: Colors.tertiaryContainer },
  { iconBg: Colors.secondaryFixed, iconColor: Colors.secondary, progressColor: Colors.secondary },
];

function getTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function HomeDashboard({ onNavigate, onNavigateGoal, user }: { onNavigate: (route: AppScreen) => void; onNavigateGoal?: (id: string) => void; user?: { id: string; name: string; phone: string } }) {
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [goals, setGoals] = useState<GoalData[]>([]);
  const [recentTxs, setRecentTxs] = useState<any[]>([]);
  const [ratePairs, setRatePairs] = useState<{ from: string; to: string }[]>([]);
  const [rateIndex, setRateIndex] = useState(0);
  const [changeVer, setChangeVer] = useState(0);

  const fetchData = useCallback(() => {
    setError(null);
    Promise.all([
      walletApi.info(),
      goalsApi.list(),
      ratesApi.get(),
      historyApi.list('all'),
    ]).then(([walRes, goalsRes, rateRes, historyRes]) => {
      if (walRes.success && walRes.data) {
        setBalance(walRes.data.balanceUsdc);
      }
      if (goalsRes.success && Array.isArray(goalsRes.data)) {
        setGoals(goalsRes.data);
      }
      if (rateRes.success && rateRes.data) {
        const pairs = [
          { from: '1 USD', to: `${rateRes.data.usdToUgx.toLocaleString()} UGX` },
          { from: '1 USDC', to: `${(rateRes.data.usdcToUgx / 1000).toFixed(1)}K UGX` },
          { from: '1 GBP', to: `${(rateRes.data.usdToUgx * 1.28).toLocaleString()} UGX` },
        ];
        setRatePairs(pairs);
      }
      if (historyRes.success && historyRes.data) {
        setRecentTxs(historyRes.data.transactions?.slice(0, 3) || []);
      }
    }).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    }).finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { fetchData(); }, []);

  // A hosted Transak checkout temporarily backgrounds the app. Refreshing when
  // it becomes active reads the wallet balance directly from Stellar again.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') fetchData();
    });
    return () => subscription.remove();
  }, [fetchData]);

  // Poll for backend-triggered changes every 3s
  useEffect(() => {
    let lastVer = 0;
    const interval = setInterval(async () => {
      try {
        const res = await eventsApi.version();
        if (res.success && res.data && res.data.version !== lastVer) {
          lastVer = res.data.version;
          fetchData();
        }
      } catch { /* offline — skip */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const cycleRate = () => setRateIndex((i) => (i + 1) % (ratePairs.length || 1));

  const overallProgress = goals.length > 0
    ? Math.round(goals.reduce((s, g) => s + (g.savedAmountUgx / g.targetAmountUgx) * 100, 0) / goals.length)
    : 0;

  const totalSavedUgx = goals.reduce((s, g) => s + g.savedAmountUgx, 0);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image source={HOMEWARD_LOGO} style={styles.brandLogo} accessibilityLabel="HomeWard logo" />
            <View>
              <Text style={styles.appTitle}>HomeWard</Text>
              <Text style={styles.appSub}>Your home money companion</Text>
            </View>
          </View>
        </View>

        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeSub}>{getGreeting()},</Text>
          <Text style={styles.welcomeName}>{user?.name || 'Welcome'}</Text>
          <Text style={styles.welcomeTagline}>Your financial journey continues here</Text>
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <MaterialCommunityIcons name="alert-circle" size={18} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.progressCard}>
              <View style={styles.progressRing}>
                <View style={styles.ringOuter}>
                  <View style={styles.ringInner}>
                    <Text style={styles.ringPercent}>{overallProgress}%</Text>
                    <Text style={styles.ringLabel}>overall</Text>
                  </View>
                </View>
                <View style={styles.progressRight}>
                  <View style={styles.onTrackBadge}>
                    <MaterialCommunityIcons name="check-circle" size={14} color={Colors.onSecondaryContainer} />
                    <Text style={styles.onTrackText}>On Track</Text>
                  </View>
                  <View style={styles.progressStatItem}>
                    <MaterialCommunityIcons name="calendar-check" size={16} color={Colors.onPrimary} />
                    <Text style={styles.progressStatText}>Balance: ${formatAmount(balance)}</Text>
                  </View>
                  <View style={styles.progressStatItem}>
                    <MaterialCommunityIcons name="trophy" size={16} color={Colors.onPrimary} />
                    <Text style={styles.progressStatText}>{formatUgx(totalSavedUgx)} UGX saved</Text>
                  </View>
                </View>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${overallProgress}%` }]} />
              </View>
            </View>

            <View style={styles.goalsSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Active Goals</Text>
                <TouchableOpacity>
                  <Text style={styles.seeAll}>Manage</Text>
                </TouchableOpacity>
              </View>
              {goals.length === 0 ? (
                <Text style={{ textAlign: 'center', color: Colors.onSurfaceVariant, fontFamily: 'Inter', paddingVertical: 20 }}>No goals yet</Text>
              ) : (
                goals.map((goal, index) => {
                  const gc = GOAL_COLORS[index % GOAL_COLORS.length];
                  const pct = Math.round((goal.savedAmountUgx / goal.targetAmountUgx) * 100);
                  return (
                    <TouchableOpacity
                      key={goal.id || index}
                      style={styles.goalCard}
                      activeOpacity={0.7}
                      onPress={() => onNavigateGoal?.(goal.id)}
                    >
                      <View style={styles.goalTop}>
                        <View style={styles.goalInfo}>
                          <View style={[styles.goalIconBox, { backgroundColor: gc.iconBg }]}>
                            <MaterialCommunityIcons name={getGoalIcon(goal.title) as any} size={22} color={gc.iconColor} />
                          </View>
                          <View style={styles.goalTextWrap}>
                            <Text style={styles.goalTitle}>{goal.title}</Text>
                            <View style={styles.goalPhaseRow}>
                              <View style={[styles.goalPhaseDot, { backgroundColor: gc.progressColor }]} />
                              <Text style={styles.goalPhase}>{goal.status || 'In Progress'}</Text>
                            </View>
                          </View>
                        </View>
                        <Text style={[styles.goalPercent, { color: gc.progressColor }]}>{pct}%</Text>
                      </View>
                      <View style={styles.goalProgressRow}>
                        <Text style={styles.goalSaved}>{formatUgx(goal.savedAmountUgx)} <Text style={styles.goalUnit}>UGX</Text></Text>
                        <Text style={styles.goalTarget}>Target: {formatUgx(goal.targetAmountUgx)}</Text>
                      </View>
                      <View style={styles.goalBarBg}>
                        <View style={[styles.goalBarFill, { width: `${pct}%`, backgroundColor: gc.progressColor }]} />
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>

            <View style={styles.infoGrid}>
              <TouchableOpacity style={styles.infoCard} onPress={cycleRate} activeOpacity={0.7}>
                <View style={styles.infoCardHeader}>
                  <MaterialCommunityIcons name="currency-usd" size={20} color={Colors.secondary} />
                  <Text style={styles.infoCardBadge}>
                    <MaterialCommunityIcons name="sync" size={12} color={Colors.secondary} /> Live
                  </Text>
                </View>
                <Text style={styles.infoLabel}>Exchange Rate</Text>
                <Text style={styles.infoValue}>
                  {ratePairs.length > 0
                    ? `${ratePairs[rateIndex % ratePairs.length].from} = ${ratePairs[rateIndex % ratePairs.length].to}`
                    : '1 USD = 3,750 UGX'}
                </Text>
                <Text style={styles.infoTap}>Tap to cycle</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.supportCard} activeOpacity={0.7} onPress={() => onNavigate('Assistant')}>
                <MaterialCommunityIcons name="robot" size={28} color={Colors.onTertiary} style={styles.supportIconTop} />
                <Text style={styles.supportLabel}>Need help?</Text>
                <Text style={styles.supportValue}>Chat with HomeWard</Text>
                <View style={styles.supportArrow}>
                  <MaterialCommunityIcons name="arrow-right" size={20} color={Colors.onTertiary} />
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.activityPreview}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Activity</Text>
                <TouchableOpacity onPress={() => onNavigate('History')}>
                  <Text style={styles.seeAll}>View all</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.activityCard}>
                {recentTxs.length === 0 ? (
                  <Text style={{ textAlign: 'center', color: Colors.onSurfaceVariant, fontFamily: 'Inter', paddingVertical: 10 }}>No recent activity</Text>
                ) : (
                  recentTxs.map((tx, i) => (
                    <React.Fragment key={tx.id || i}>
                      <View style={styles.activityItem}>
                        <View style={[styles.activityDot, { backgroundColor: tx.type === 'received' ? Colors.secondary : Colors.primary }]} />
                        <Text style={styles.activityText}>{tx.type === 'received' ? 'Received' : 'Sent'} ${formatAmount(tx.amountUsdc)} to {tx.recipientName}</Text>
                        <Text style={styles.activityTime}>{getTimeAgo(tx.createdAt)}</Text>
                      </View>
                      {i < recentTxs.length - 1 && <View style={styles.activityDivider} />}
                    </React.Fragment>
                  ))
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 120 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.containerPaddingMobile, paddingVertical: Spacing.stackSm,
    backgroundColor: Colors.surface, ...Shadow.level1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.stackSm },
  brandLogo: { width: 42, height: 42, borderRadius: 13 },
  appTitle: { fontSize: Typography.headlineMd.fontSize, fontFamily: 'Montserrat', fontWeight: '600', color: Colors.primary },
  appSub: { fontSize: 11, fontFamily: 'Inter', fontWeight: '500', color: Colors.onSurfaceVariant, marginTop: -2 },
  welcomeSection: { paddingHorizontal: Spacing.containerPaddingMobile, paddingTop: Spacing.gutter },
  welcomeSub: { fontSize: Typography.bodyMd.fontSize, fontFamily: 'Inter', color: Colors.onSurfaceVariant },
  welcomeName: { fontSize: Typography.displayLgMobile.fontSize, fontFamily: 'Montserrat', fontWeight: '700', color: Colors.primary, marginTop: 2 },
  welcomeTagline: { fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', color: Colors.onSurfaceVariant, marginTop: 4, opacity: 0.8 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.errorContainer, marginHorizontal: Spacing.containerPaddingMobile, marginTop: Spacing.stackMd, padding: Spacing.stackMd, borderRadius: BorderRadius.lg },
  errorText: { flex: 1, fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', color: Colors.error },
  progressCard: {
    marginHorizontal: Spacing.containerPaddingMobile, marginTop: Spacing.gutter,
    backgroundColor: Colors.primary, borderRadius: BorderRadius.xl,
    padding: Spacing.gutter, ...Shadow.level2, overflow: 'hidden',
  },
  progressRing: { flexDirection: 'row', gap: Spacing.stackLg, alignItems: 'center' },
  ringOuter: { width: 100, height: 100, borderRadius: 50, borderWidth: 6, borderColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  ringInner: { alignItems: 'center' },
  ringPercent: { fontSize: 28, fontFamily: 'Montserrat', fontWeight: '700', color: Colors.onPrimary },
  ringLabel: { fontSize: 10, fontFamily: 'Inter', fontWeight: '500', color: Colors.onPrimary, opacity: 0.7, marginTop: -2 },
  progressRight: { flex: 1, gap: Spacing.stackSm },
  onTrackBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.secondaryContainer, paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full, alignSelf: 'flex-start' },
  onTrackText: { fontSize: Typography.labelSm.fontSize, fontFamily: 'Inter', fontWeight: '600', color: Colors.onSecondaryContainer },
  progressStatItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressStatText: { fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', color: Colors.onPrimary, opacity: 0.85 },
  progressBarBg: { width: '100%', height: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: BorderRadius.full, marginTop: Spacing.gutter, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: Colors.secondaryContainer, borderRadius: BorderRadius.full },
  goalsSection: { paddingHorizontal: Spacing.containerPaddingMobile, marginTop: Spacing.gutter },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: Spacing.containerPaddingMobile, marginBottom: Spacing.stackMd },
  sectionTitle: { fontSize: Typography.headlineSm.fontSize, fontFamily: 'Montserrat', fontWeight: '600', color: Colors.primary },
  seeAll: { fontSize: Typography.labelMd.fontSize, fontFamily: 'Inter', fontWeight: '600', color: Colors.secondary },
  goalCard: { backgroundColor: Colors.surface, padding: Spacing.stackMd, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.outlineVariant + '33', ...Shadow.level1, marginBottom: Spacing.stackMd },
  goalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.stackSm },
  goalInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.stackSm },
  goalIconBox: { width: 44, height: 44, borderRadius: BorderRadius.lg, justifyContent: 'center', alignItems: 'center' },
  goalTextWrap: {},
  goalTitle: { fontSize: Typography.labelMd.fontSize, fontFamily: 'Inter', fontWeight: '600', color: Colors.onSurface },
  goalPhaseRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  goalPhaseDot: { width: 6, height: 6, borderRadius: 3 },
  goalPhase: { fontSize: 10, fontFamily: 'Inter', color: Colors.onSurfaceVariant, letterSpacing: 0.3, textTransform: 'uppercase' },
  goalPercent: { fontSize: Typography.headlineSm.fontSize, fontFamily: 'Montserrat', fontWeight: '700' },
  goalProgressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  goalSaved: { fontSize: Typography.labelSm.fontSize, fontFamily: 'Inter', fontWeight: '500', color: Colors.onSurfaceVariant },
  goalUnit: { fontSize: 10 },
  goalTarget: { fontSize: Typography.labelSm.fontSize, fontFamily: 'Inter', color: Colors.outline },
  goalBarBg: { width: '100%', height: 8, backgroundColor: Colors.surfaceContainerHigh, borderRadius: BorderRadius.full, overflow: 'hidden' },
  goalBarFill: { height: '100%', borderRadius: BorderRadius.full },
  infoGrid: { flexDirection: 'row', gap: Spacing.stackMd, paddingHorizontal: Spacing.containerPaddingMobile, marginTop: Spacing.gutter },
  infoCard: { flex: 1, backgroundColor: Colors.surfaceContainerLowest, padding: Spacing.stackMd, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.outlineVariant + '1A', ...Shadow.level1 },
  infoCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.stackSm },
  infoCardBadge: { fontSize: 10, fontFamily: 'Inter', fontWeight: '600', color: Colors.secondary, flexDirection: 'row', alignItems: 'center' },
  infoLabel: { fontSize: Typography.labelSm.fontSize, fontFamily: 'Inter', fontWeight: '500', color: Colors.onSurfaceVariant },
  infoValue: { fontSize: Typography.headlineSm.fontSize, fontFamily: 'Montserrat', fontWeight: '600', color: Colors.primary, marginTop: 4 },
  infoTap: { fontSize: 10, fontFamily: 'Inter', color: Colors.outline, marginTop: 4, fontStyle: 'italic' },
  supportCard: { flex: 1, backgroundColor: Colors.tertiary, padding: Spacing.stackMd, borderRadius: BorderRadius.xl, overflow: 'hidden', position: 'relative', justifyContent: 'space-between' },
  supportIconTop: { marginBottom: Spacing.stackSm },
  supportLabel: { fontSize: Typography.labelSm.fontSize, fontFamily: 'Inter', fontWeight: '500', color: Colors.onTertiary, opacity: 0.8 },
  supportValue: { fontSize: Typography.headlineSm.fontSize, fontFamily: 'Montserrat', fontWeight: '600', color: Colors.onTertiary, marginTop: 2 },
  supportArrow: { position: 'absolute', bottom: 12, right: 12, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  activityPreview: { paddingHorizontal: Spacing.containerPaddingMobile, marginTop: Spacing.gutter },
  activityCard: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: BorderRadius.xl, padding: Spacing.stackMd, borderWidth: 1, borderColor: Colors.outlineVariant + '1A', ...Shadow.level1 },
  activityItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.stackSm, paddingVertical: 6 },
  activityDot: { width: 8, height: 8, borderRadius: 4 },
  activityText: { flex: 1, fontSize: Typography.bodySm.fontSize, fontFamily: 'Inter', color: Colors.onSurface },
  activityTime: { fontSize: 11, fontFamily: 'Inter', color: Colors.outline },
  activityDivider: { height: 1, backgroundColor: Colors.outlineVariant + '33', marginVertical: 2 },
});
