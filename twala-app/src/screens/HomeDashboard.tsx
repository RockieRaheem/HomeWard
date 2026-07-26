import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet, ActivityIndicator, AppState, Image, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState, useCallback, useEffect } from 'react';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import type { AppScreen } from '../components/BottomNavBar';
import { walletApi, ratesApi, historyApi, goalsApi, eventsApi, notificationsApi, type GoalData, type TransactionItem, type AppNotificationData } from '../services/api';

const HOMEWARD_LOGO = require('../../assets/branding/homeward-logo.png');

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatUgx(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toLocaleString();
}

function initials(name?: string) {
  return (name || 'H').split(' ').filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
}

function goalIcon(title: string) {
  const value = title.toLowerCase();
  if (value.includes('home') || value.includes('house')) return 'home-variant';
  if (value.includes('land')) return 'grass';
  if (value.includes('school') || value.includes('fees')) return 'school';
  if (value.includes('car')) return 'car';
  if (value.includes('business')) return 'storefront-outline';
  return 'flag-variant';
}

function timeAgo(date: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60_000));
  if (minutes < 60) return `${minutes || 1}m ago`;
  if (minutes < 1_440) return `${Math.floor(minutes / 60)}h ago`;
  if (minutes < 10_080) return `${Math.floor(minutes / 1_440)}d ago`;
  return new Date(date).toLocaleDateString('en-UG', { month: 'short', day: 'numeric' });
}

const goalAccents = [
  { wash: '#E0F5EC', accent: Colors.primary, icon: Colors.primary },
  { wash: '#DDF4FF', accent: Colors.tertiary, icon: Colors.tertiary },
  { wash: '#FFF0D9', accent: Colors.secondary, icon: Colors.secondary },
];

export default function HomeDashboard({ onNavigate, onNavigateGoal, onSignOut, user }: { onNavigate: (route: AppScreen) => void; onNavigateGoal?: (id: string) => void; onSignOut?: () => void; user?: { id: string; name: string; phone: string } }) {
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [goals, setGoals] = useState<GoalData[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [rate, setRate] = useState(0);
  const [rateUpdated, setRateUpdated] = useState('');
  const [notifications, setNotifications] = useState<AppNotificationData[]>([]);

  const fetchData = useCallback(() => {
    setError(null);
    Promise.all([walletApi.info(), goalsApi.list(), ratesApi.get(), historyApi.list('all'), notificationsApi.list()])
      .then(([wallet, goalResponse, rateResponse, history, notificationResponse]) => {
        if (wallet.success && wallet.data) setBalance(wallet.data.balanceUsdc);
        if (goalResponse.success && Array.isArray(goalResponse.data)) setGoals(goalResponse.data);
        if (rateResponse.success && rateResponse.data) {
          setRate(rateResponse.data.usdcToUgx);
          setRateUpdated(new Date(rateResponse.data.lastUpdated).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' }));
        }
        if (history.success && history.data) setTransactions(history.data.transactions?.slice(0, 3) || []);
        if (notificationResponse.success && Array.isArray(notificationResponse.data)) setNotifications(notificationResponse.data);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'We could not refresh your dashboard.'))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') fetchData(); });
    return () => subscription.remove();
  }, [fetchData]);
  useEffect(() => {
    let lastVersion = 0;
    const interval = setInterval(async () => {
      try {
        const response = await eventsApi.version();
        if (response.success && response.data && response.data.version !== lastVersion) {
          lastVersion = response.data.version;
          fetchData();
        }
      } catch { /* offline: retain the last reliable view */ }
    }, 3_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const overallProgress = goals.length
    ? Math.round(goals.reduce((total, goal) => total + Math.min(100, (goal.savedAmountUgx / Math.max(1, goal.targetAmountUgx)) * 100), 0) / goals.length)
    : 0;
  const totalSaved = goals.reduce((total, goal) => total + goal.savedAmountUgx, 0);
  const featuredGoals = [...goals].sort((a, b) => (b.savedAmountUgx / Math.max(1, b.targetAmountUgx)) - (a.savedAmountUgx / Math.max(1, a.targetAmountUgx))).slice(0, 3);
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const showNotifications = async () => {
    const copy = notifications.length ? notifications.slice(0, 5).map((item) => `• ${item.title}\n${item.body}`).join('\n\n') : 'You are all caught up.';
    Alert.alert('HomeWard updates', copy, [
      ...notifications.slice(0, 2).map((notification) => ({ text: notification.category === 'goal' ? 'Open goal' : 'Open receipt', onPress: () => openNotification(notification) })),
      { text: 'Close', style: 'cancel' as const },
    ]);
    // Opening the bell never clears notifications; each update remains until opened.
  };

  const openNotification = async (notification: AppNotificationData) => {
    if (!notification.readAt) {
      const result = await notificationsApi.markRead(notification.id);
      if (result.success) setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item));
    }
    onNavigate(notification.category === 'goal' ? 'Goals' : 'History');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={Colors.primary} />}>
        <View style={styles.topBar}>
          <View style={styles.brandLockup}>
            <Image source={HOMEWARD_LOGO} style={styles.logo} accessibilityLabel="HomeWard logo" />
            <Text style={styles.brand}>HomeWard</Text>
          </View>
          <View style={styles.topActions}>
            <View style={styles.networkPill}><View style={styles.liveDot} /><Text style={styles.networkText}>Testnet</Text></View>
            <TouchableOpacity style={styles.notificationButton} onPress={() => { const latest = notifications.find((notification) => !notification.readAt); if (latest) openNotification(latest); else showNotifications(); }} accessibilityLabel="Open latest notification"><MaterialCommunityIcons name="bell-outline" size={20} color={Colors.primary} />{unreadCount ? <View style={styles.notificationBadge}><Text style={styles.notificationBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View> : null}</TouchableOpacity>
            <TouchableOpacity style={styles.avatar} onPress={() => Alert.alert('Account', user?.name || 'HomeWard user', [{ text: 'Sign out', style: 'destructive', onPress: onSignOut }, { text: 'Cancel', style: 'cancel' }])} accessibilityLabel="Account options"><Text style={styles.avatarText}>{initials(user?.name)}</Text></TouchableOpacity>
          </View>
        </View>

        <View style={styles.welcome}>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.name}>{user?.name?.split(' ')[0] || 'there'} <Text style={styles.wave}>👋</Text></Text>
          <Text style={styles.subtitle}>Everything you send home, in one clear view.</Text>
        </View>

        {error ? <TouchableOpacity style={styles.errorBanner} onPress={fetchData}><MaterialCommunityIcons name="refresh" size={18} color={Colors.error} /><Text style={styles.errorText}>{error} Tap to retry.</Text></TouchableOpacity> : null}

        {loading ? <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} /> : <>
          <View style={styles.balanceCard}>
            <View style={styles.balanceGlowOne} /><View style={styles.balanceGlowTwo} />
            <View style={styles.balanceHeader}><View><Text style={styles.balanceCaption}>AVAILABLE TO SEND</Text><View style={styles.balanceTitleRow}><Text style={styles.balanceValue}>${balance.toFixed(2)}</Text><Text style={styles.balanceCurrency}>USDC</Text></View></View><View style={styles.walletIcon}><MaterialCommunityIcons name="wallet-outline" size={23} color={Colors.primaryFixed} /></View></View>
            <View style={styles.balanceFooter}><View style={styles.balanceFootItem}><MaterialCommunityIcons name="swap-horizontal" size={16} color={Colors.primaryFixed} /><Text style={styles.balanceFootText}>{rate ? `≈ UGX ${(balance * rate).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : 'Rate updating...'}</Text></View><View style={styles.secureChip}><MaterialCommunityIcons name="shield-check-outline" size={15} color={Colors.onPrimary} /><Text style={styles.secureText}>Secured on Stellar</Text></View></View>
          </View>

          <View style={styles.quickActions}>
            <QuickAction icon="send" label="Send money" tint="#E0F5EC" color={Colors.primary} onPress={() => onNavigate('Transfer')} />
            <QuickAction icon="cash-plus" label="Cash in" tint="#FFF0D9" color={Colors.secondary} onPress={() => onNavigate('Transfer')} />
            <QuickAction icon="message-processing-outline" label="Ask HomeWard" tint="#DDF4FF" color={Colors.tertiary} onPress={() => onNavigate('Assistant')} />
          </View>

          <View style={styles.sectionHeader}>
            <View><Text style={styles.sectionEyebrow}>HOME PROJECTS</Text><Text style={styles.sectionTitle}>Your goals</Text></View>
            <TouchableOpacity style={styles.textAction} onPress={() => onNavigate('Goals')}><Text style={styles.textActionLabel}>See all</Text><MaterialCommunityIcons name="arrow-right" size={16} color={Colors.primary} /></TouchableOpacity>
          </View>

          {featuredGoals.length ? <>
            <View style={styles.goalSummary}><View style={styles.summaryRing}><Text style={styles.summaryRingValue}>{overallProgress}%</Text></View><View style={styles.summaryCopy}><Text style={styles.summaryTitle}>{goals.length} active goal{goals.length === 1 ? '' : 's'}</Text><Text style={styles.summaryText}>UGX {formatUgx(totalSaved)} saved across your home projects</Text></View><TouchableOpacity style={styles.summaryArrow} onPress={() => onNavigate('Goals')}><MaterialCommunityIcons name="chevron-right" size={22} color={Colors.primary} /></TouchableOpacity></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.goalRail}>
              {featuredGoals.map((goal, index) => {
                const accent = goalAccents[index % goalAccents.length];
                const progress = Math.min(100, Math.round((goal.savedAmountUgx / Math.max(1, goal.targetAmountUgx)) * 100));
                return <TouchableOpacity key={goal.id} style={styles.goalCard} activeOpacity={0.8} onPress={() => onNavigateGoal?.(goal.id)}>
                  <View style={styles.goalCardHeader}><View style={[styles.goalIcon, { backgroundColor: accent.wash }]}><MaterialCommunityIcons name={goalIcon(goal.title) as any} size={21} color={accent.icon} /></View><View style={[styles.goalStatus, { backgroundColor: accent.wash }]}><View style={[styles.goalStatusDot, { backgroundColor: accent.accent }]} /><Text style={[styles.goalStatusText, { color: accent.accent }]}>{progress}%</Text></View></View>
                  <Text numberOfLines={1} style={styles.goalName}>{goal.title}</Text><Text style={styles.goalAmount}>UGX {formatUgx(goal.savedAmountUgx)} <Text style={styles.goalTarget}>of {formatUgx(goal.targetAmountUgx)}</Text></Text>
                  <View style={styles.goalProgress}><View style={[styles.goalProgressFill, { width: `${progress}%`, backgroundColor: accent.accent }]} /></View><Text style={styles.goalHint}>{progress >= 100 ? 'Goal reached — well done' : `${100 - progress}% left to reach this goal`}</Text>
                </TouchableOpacity>;
              })}
              <TouchableOpacity style={styles.newGoalCard} onPress={() => onNavigate('Goals')}><View style={styles.newGoalIcon}><MaterialCommunityIcons name="plus" size={25} color={Colors.primary} /></View><Text style={styles.newGoalTitle}>Create a goal</Text><Text style={styles.newGoalText}>Plan your next project</Text></TouchableOpacity>
            </ScrollView>
          </> : <TouchableOpacity style={styles.emptyGoalCard} onPress={() => onNavigate('Goals')}><View style={styles.newGoalIcon}><MaterialCommunityIcons name="flag-plus" size={24} color={Colors.primary} /></View><View style={{ flex: 1 }}><Text style={styles.emptyGoalTitle}>Build something meaningful</Text><Text style={styles.emptyGoalText}>Create a goal for land, school fees or a family project.</Text></View><MaterialCommunityIcons name="arrow-right" size={20} color={Colors.primary} /></TouchableOpacity>}

          <TouchableOpacity style={styles.rateCard} onPress={() => onNavigate('Transfer')} activeOpacity={0.8}>
            <View style={styles.rateIcon}><MaterialCommunityIcons name="chart-line" size={21} color={Colors.tertiary} /></View><View style={{ flex: 1 }}><Text style={styles.rateLabel}>Today’s exchange rate</Text><Text style={styles.rateValue}>{rate ? `1 USDC = UGX ${rate.toLocaleString()}` : 'Fetching the latest rate'}</Text></View><View style={styles.rateMeta}><Text style={styles.rateMetaText}>{rateUpdated || 'Live'}</Text><MaterialCommunityIcons name="chevron-right" size={18} color={Colors.outline} /></View>
          </TouchableOpacity>

          <View style={styles.sectionHeader}>
            <View><Text style={styles.sectionEyebrow}>MONEY MOVEMENT</Text><Text style={styles.sectionTitle}>Recent activity</Text></View>
            <TouchableOpacity style={styles.textAction} onPress={() => onNavigate('History')}><Text style={styles.textActionLabel}>View history</Text><MaterialCommunityIcons name="arrow-right" size={16} color={Colors.primary} /></TouchableOpacity>
          </View>
          <View style={styles.activityCard}>
            {transactions.length ? transactions.map((transaction, index) => <React.Fragment key={transaction.id}><TouchableOpacity style={styles.activityRow} onPress={() => onNavigate('History')}><View style={[styles.activityIcon, { backgroundColor: transaction.type === 'sent' ? '#E0F5EC' : '#FFF0D9' }]}><MaterialCommunityIcons name={transaction.type === 'sent' ? 'arrow-top-right' : 'arrow-bottom-left'} size={21} color={transaction.type === 'sent' ? Colors.primary : Colors.secondary} /></View><View style={styles.activityInfo}><Text style={styles.activityName} numberOfLines={1}>{transaction.type === 'sent' ? `To ${transaction.recipientName}` : `From ${transaction.recipientName || 'HomeWard'}`}</Text><Text style={styles.activitySub}>{transaction.purpose || 'Transfer'} · {timeAgo(transaction.createdAt)}</Text></View><View style={styles.activityAmount}><Text style={styles.activityUsdc}>{transaction.type === 'sent' ? '−' : '+'}${transaction.amountUsdc.toFixed(2)}</Text><Text style={[styles.activityStatus, { color: transaction.status === 'completed' ? Colors.primary : transaction.status === 'failed' ? Colors.error : Colors.secondary }]}>{transaction.status === 'completed' ? 'Completed' : transaction.status === 'failed' ? 'Failed' : 'Pending'}</Text></View></TouchableOpacity>{index < transactions.length - 1 ? <View style={styles.divider} /> : null}</React.Fragment>) : <View style={styles.emptyActivity}><MaterialCommunityIcons name="receipt-text-outline" size={26} color={Colors.outline} /><Text style={styles.emptyActivityText}>Your transfers will appear here.</Text></View>}
          </View>
        </>}
      </ScrollView>
    </View>
  );
}

function QuickAction({ icon, label, tint, color, onPress }: { icon: string; label: string; tint: string; color: string; onPress: () => void }) {
  return <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.78}><View style={[styles.quickIcon, { backgroundColor: tint }]}><MaterialCommunityIcons name={icon as any} size={21} color={color} /></View><Text style={styles.quickLabel}>{label}</Text></TouchableOpacity>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background }, content: { paddingBottom: 124 },
  topBar: { paddingHorizontal: 20, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 9 }, logo: { width: 36, height: 36, borderRadius: 11 }, brand: { fontFamily: 'Montserrat', fontWeight: '800', fontSize: 19, color: Colors.primary }, topActions: { flexDirection: 'row', alignItems: 'center', gap: 10 }, networkPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: '#E0F5EC', borderRadius: BorderRadius.full }, liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#1E9A70' }, networkText: { color: Colors.primary, fontFamily: 'Inter', fontWeight: '700', fontSize: 10 }, notificationButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E0F5EC', alignItems: 'center', justifyContent: 'center', position: 'relative' }, notificationBadge: { position: 'absolute', right: -4, top: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: Colors.error, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }, notificationBadgeText: { color: Colors.onPrimary, fontSize: 9, fontWeight: '800' }, avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.primaryFixed }, avatarText: { color: Colors.onPrimary, fontFamily: 'Inter', fontWeight: '800', fontSize: 12 },
  welcome: { paddingHorizontal: 20, paddingTop: 25, paddingBottom: 20 }, greeting: { color: Colors.onSurfaceVariant, fontFamily: 'Inter', fontSize: 14 }, name: { color: Colors.onSurface, fontFamily: 'Montserrat', fontWeight: '800', fontSize: 29, marginTop: 2 }, wave: { fontSize: 23 }, subtitle: { color: Colors.onSurfaceVariant, fontFamily: 'Inter', fontSize: 13, marginTop: 6 }, errorBanner: { marginHorizontal: 20, backgroundColor: Colors.errorContainer, borderRadius: 14, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 8 }, errorText: { flex: 1, color: Colors.error, fontFamily: 'Inter', fontSize: 12 }, loader: { marginTop: 70 },
  balanceCard: { marginHorizontal: 20, backgroundColor: Colors.primary, borderRadius: 24, padding: 21, overflow: 'hidden', ...Shadow.level2 }, balanceGlowOne: { position: 'absolute', width: 190, height: 190, borderRadius: 95, backgroundColor: '#08725B', opacity: 0.65, right: -74, top: -95 }, balanceGlowTwo: { position: 'absolute', width: 100, height: 100, borderRadius: 50, borderWidth: 18, borderColor: '#0A725C', opacity: 0.55, right: 42, bottom: -54 }, balanceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, balanceCaption: { color: Colors.primaryFixed, fontFamily: 'Inter', fontSize: 10, letterSpacing: 1.15, fontWeight: '800' }, balanceTitleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: 7 }, balanceValue: { color: Colors.onPrimary, fontFamily: 'Montserrat', fontWeight: '800', fontSize: 34 }, balanceCurrency: { color: Colors.primaryFixed, fontFamily: 'Inter', fontWeight: '800', fontSize: 13 }, walletIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.10)', justifyContent: 'center', alignItems: 'center' }, balanceFooter: { marginTop: 25, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.16)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, balanceFootItem: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }, balanceFootText: { color: Colors.primaryFixed, fontFamily: 'Inter', fontSize: 12, fontWeight: '600' }, secureChip: { flexDirection: 'row', alignItems: 'center', gap: 5 }, secureText: { color: Colors.onPrimary, fontFamily: 'Inter', fontSize: 10, fontWeight: '700' },
  quickActions: { flexDirection: 'row', marginHorizontal: 20, marginTop: 16, gap: 10 }, quickAction: { flex: 1, backgroundColor: Colors.surfaceContainerLowest, borderRadius: 17, paddingVertical: 12, alignItems: 'center', gap: 7, borderWidth: 1, borderColor: Colors.outlineVariant + '40' }, quickIcon: { width: 39, height: 39, borderRadius: 13, justifyContent: 'center', alignItems: 'center' }, quickLabel: { color: Colors.onSurface, fontFamily: 'Inter', fontWeight: '700', fontSize: 11, textAlign: 'center' },
  sectionHeader: { marginTop: 30, marginBottom: 13, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }, sectionEyebrow: { color: Colors.outline, fontFamily: 'Inter', fontWeight: '800', fontSize: 10, letterSpacing: 1 }, sectionTitle: { color: Colors.onSurface, fontFamily: 'Montserrat', fontWeight: '800', fontSize: 21, marginTop: 2 }, textAction: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 5 }, textActionLabel: { color: Colors.primary, fontFamily: 'Inter', fontWeight: '800', fontSize: 12 },
  goalSummary: { marginHorizontal: 20, borderRadius: 17, padding: 13, flexDirection: 'row', alignItems: 'center', backgroundColor: '#EAF6F1', borderWidth: 1, borderColor: '#C5E7D8' }, summaryRing: { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: Colors.primaryFixed }, summaryRingValue: { color: Colors.onPrimary, fontFamily: 'Montserrat', fontWeight: '800', fontSize: 12 }, summaryCopy: { flex: 1, marginLeft: 11 }, summaryTitle: { color: Colors.primary, fontFamily: 'Inter', fontWeight: '800', fontSize: 13 }, summaryText: { color: Colors.onSurfaceVariant, fontFamily: 'Inter', fontSize: 11, marginTop: 3 }, summaryArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surfaceContainerLowest, justifyContent: 'center', alignItems: 'center' }, goalRail: { paddingHorizontal: 20, paddingTop: 13, gap: 12, paddingRight: 36 }, goalCard: { width: 235, backgroundColor: Colors.surfaceContainerLowest, borderWidth: 1, borderColor: Colors.outlineVariant + '45', borderRadius: 19, padding: 15, ...Shadow.level1 }, goalCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, goalIcon: { width: 40, height: 40, borderRadius: 13, justifyContent: 'center', alignItems: 'center' }, goalStatus: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 5, borderRadius: BorderRadius.full }, goalStatusDot: { width: 5, height: 5, borderRadius: 3 }, goalStatusText: { fontFamily: 'Inter', fontWeight: '800', fontSize: 10 }, goalName: { color: Colors.onSurface, fontFamily: 'Montserrat', fontWeight: '800', fontSize: 15, marginTop: 15 }, goalAmount: { color: Colors.onSurface, fontFamily: 'Inter', fontWeight: '800', fontSize: 12, marginTop: 6 }, goalTarget: { color: Colors.outline, fontWeight: '500' }, goalProgress: { height: 7, marginTop: 15, backgroundColor: Colors.surfaceContainerHigh, borderRadius: BorderRadius.full, overflow: 'hidden' }, goalProgressFill: { height: '100%', borderRadius: BorderRadius.full }, goalHint: { color: Colors.onSurfaceVariant, fontFamily: 'Inter', fontSize: 10, marginTop: 8 }, newGoalCard: { width: 176, minHeight: 170, borderRadius: 19, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.primary + '80', backgroundColor: '#F0F8F5', padding: 14 }, newGoalIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#DDF2E9', justifyContent: 'center', alignItems: 'center' }, newGoalTitle: { color: Colors.primary, fontFamily: 'Inter', fontWeight: '800', fontSize: 13, marginTop: 11 }, newGoalText: { color: Colors.onSurfaceVariant, textAlign: 'center', fontFamily: 'Inter', fontSize: 10, marginTop: 4 }, emptyGoalCard: { marginHorizontal: 20, borderRadius: 18, backgroundColor: '#F0F8F5', padding: 17, flexDirection: 'row', gap: 12, alignItems: 'center', borderWidth: 1, borderColor: '#C5E7D8' }, emptyGoalTitle: { color: Colors.primary, fontFamily: 'Inter', fontWeight: '800', fontSize: 14 }, emptyGoalText: { color: Colors.onSurfaceVariant, fontFamily: 'Inter', fontSize: 11, marginTop: 4, lineHeight: 16 },
  rateCard: { marginHorizontal: 20, marginTop: 25, borderRadius: 17, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: Colors.surfaceContainerLowest, borderWidth: 1, borderColor: Colors.outlineVariant + '45' }, rateIcon: { width: 41, height: 41, borderRadius: 13, backgroundColor: '#DDF4FF', justifyContent: 'center', alignItems: 'center' }, rateLabel: { color: Colors.onSurfaceVariant, fontFamily: 'Inter', fontSize: 11 }, rateValue: { color: Colors.onSurface, fontFamily: 'Inter', fontSize: 13, fontWeight: '800', marginTop: 3 }, rateMeta: { alignItems: 'flex-end', gap: 3 }, rateMetaText: { color: Colors.outline, fontFamily: 'Inter', fontSize: 10 },
  activityCard: { marginHorizontal: 20, backgroundColor: Colors.surfaceContainerLowest, borderRadius: 19, paddingHorizontal: 15, borderWidth: 1, borderColor: Colors.outlineVariant + '45' }, activityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, gap: 10 }, activityIcon: { width: 40, height: 40, borderRadius: 13, justifyContent: 'center', alignItems: 'center' }, activityInfo: { flex: 1, minWidth: 0 }, activityName: { color: Colors.onSurface, fontFamily: 'Inter', fontWeight: '800', fontSize: 13 }, activitySub: { color: Colors.onSurfaceVariant, fontFamily: 'Inter', fontSize: 10, marginTop: 4 }, activityAmount: { alignItems: 'flex-end' }, activityUsdc: { color: Colors.onSurface, fontFamily: 'Inter', fontWeight: '800', fontSize: 13 }, activityStatus: { fontFamily: 'Inter', fontSize: 10, fontWeight: '700', marginTop: 4 }, divider: { height: 1, backgroundColor: Colors.outlineVariant + '42', marginLeft: 50 }, emptyActivity: { paddingVertical: 28, alignItems: 'center', gap: 8 }, emptyActivityText: { color: Colors.onSurfaceVariant, fontFamily: 'Inter', fontSize: 12 },
});
