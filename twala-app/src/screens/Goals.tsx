import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Modal, Alert, ActivityIndicator, RefreshControl, Dimensions, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, useCallback, useEffect } from 'react';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { goalsApi, notifyChange, type GoalData } from '../services/api';

const { width } = Dimensions.get('window');

function formatUgx(ugx: number): string {
  if (ugx >= 1_000_000) return `${(ugx / 1_000_000).toFixed(1)}M`;
  if (ugx >= 1_000) return `${(ugx / 1_000).toFixed(1)}K`;
  return ugx.toLocaleString();
}

function getGoalIcon(category: string): string {
  const c = category.toLowerCase();
  if (c.includes('home') || c.includes('house')) return 'home';
  if (c.includes('land')) return 'grass';
  if (c.includes('school') || c.includes('education')) return 'school';
  if (c.includes('car')) return 'car';
  if (c.includes('business') || c.includes('shop')) return 'store';
  if (c.includes('savings')) return 'piggy-bank';
  return 'flag';
}

const CATEGORIES = [
  { value: 'home', label: 'Home', icon: 'home' },
  { value: 'land', label: 'Land', icon: 'grass' },
  { value: 'education', label: 'Education', icon: 'school' },
  { value: 'business', label: 'Business', icon: 'store' },
  { value: 'savings', label: 'Savings', icon: 'piggy-bank' },
  { value: 'other', label: 'Other', icon: 'flag' },
];

export default function Goals({ onNavigateGoal }: { onNavigateGoal?: (id: string) => void }) {
  const [goals, setGoals] = useState<GoalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<string | null>(null);

  // Create form
  const [newTitle, setNewTitle] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newCategory, setNewCategory] = useState('other');
  const [newDesc, setNewDesc] = useState('');

  // Edit form
  const [editGoalId, setEditGoalId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [editCategory, setEditCategory] = useState('other');
  const [editDesc, setEditDesc] = useState('');

  const fetchGoals = useCallback(() => {
    goalsApi.list().then((res) => {
      if (res.success && Array.isArray(res.data)) setGoals(res.data);
    }).finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { fetchGoals(); }, []);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchGoals(); }, [fetchGoals]);

  const resetForm = () => {
    setNewTitle(''); setNewTarget(''); setNewCategory('other'); setNewDesc('');
  };

  const handleCreate = async () => {
    if (!newTitle.trim() || !newTarget.trim()) {
      Alert.alert('Required', 'Title and target amount are required');
      return;
    }
    const target = parseFloat(newTarget.replace(/,/g, ''));
    if (isNaN(target) || target <= 0) {
      Alert.alert('Invalid', 'Enter a valid target amount');
      return;
    }
    try {
      const res = await goalsApi.create({ title: newTitle.trim(), targetAmountUgx: target, category: newCategory, description: newDesc.trim() });
      if (res.success) {
        setShowCreate(false); resetForm(); notifyChange(); fetchGoals();
      } else Alert.alert('Error', res.message || 'Failed to create goal');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleDelete = (goalId: string, title: string) => {
    Alert.alert('Delete Goal', `Permanently delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const res = await goalsApi.remove(goalId);
          if (res.success) { notifyChange(); fetchGoals(); }
          else Alert.alert('Error', res.message || 'Delete failed');
        } catch (err: any) { Alert.alert('Error', err.message); }
      }},
    ]);
  };

  const handleEdit = async () => {
    if (!editGoalId || !editTitle.trim() || !editTarget.trim()) {
      Alert.alert('Required', 'Title and target amount are required');
      return;
    }
    const target = parseFloat(editTarget.replace(/,/g, ''));
    if (isNaN(target) || target <= 0) {
      Alert.alert('Invalid', 'Enter a valid target amount');
      return;
    }
    try {
      const res = await goalsApi.update(editGoalId, { title: editTitle.trim(), targetAmountUgx: target, category: editCategory, description: editDesc.trim() });
      if (res.success) {
        setShowEdit(null); setEditGoalId(null); notifyChange(); fetchGoals();
      } else Alert.alert('Error', res.message || 'Failed to update goal');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const totalSaved = goals.reduce((s, g) => s + g.savedAmountUgx, 0);
  const totalTarget = goals.reduce((s, g) => s + g.targetAmountUgx, 0);
  const overallPct = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}><Text style={styles.eyebrow}>HOME PROJECTS</Text><Text style={styles.headerTitle}>Your goals</Text><Text style={styles.headerSub}>Turn every transfer into visible progress.</Text></View>
            <TouchableOpacity style={styles.headerAdd} onPress={() => { resetForm(); setShowCreate(true); }}><MaterialCommunityIcons name="plus" size={23} color={Colors.primary} /></TouchableOpacity>
          </View>
          <Text style={styles.headerSub}>{goals.length} goal{goals.length !== 1 ? 's' : ''} · {overallPct}% funded</Text>
        </View>

        <View style={styles.listHeading}><Text style={styles.listHeadingTitle}>{goals.length ? 'All goals' : 'Start a goal'}</Text>{goals.length ? <Text style={styles.listHeadingMeta}>{goals.length} project{goals.length === 1 ? '' : 's'}</Text> : null}</View>
        {goals.length === 0 ? (
          <TouchableOpacity style={styles.emptyState} onPress={() => { resetForm(); setShowCreate(true); }}><View style={styles.emptyIcon}><MaterialCommunityIcons name="flag-outline" size={30} color={Colors.primary} /></View><Text style={styles.emptyTitle}>Build something meaningful</Text><Text style={styles.emptyDesc}>Set a goal for a family project, school fees, land, or a brighter home.</Text><View style={styles.emptyCta}><Text style={styles.emptyCtaText}>Create a goal</Text><MaterialCommunityIcons name="arrow-right" size={17} color={Colors.onPrimary} /></View></TouchableOpacity>
        ) : (
          goals.map((goal) => {
            const pct = goal.targetAmountUgx > 0 ? Math.min(100, Math.round((goal.savedAmountUgx / goal.targetAmountUgx) * 100)) : 0;
            const remaining = Math.max(0, goal.targetAmountUgx - goal.savedAmountUgx);
            const icon = getGoalIcon(goal.category);

            return (
              <TouchableOpacity
                key={goal.id}
                style={styles.goalCard}
                activeOpacity={0.7}
                onPress={() => onNavigateGoal?.(goal.id)}
              >
                <View style={styles.goalHeader}>
                  <View style={[styles.goalIcon, { backgroundColor: goal.status === 'completed' ? '#DDF2E9' : '#EAF4F0' }]}>
                    <MaterialCommunityIcons name={icon as any} size={22} color={Colors.primary} />
                  </View>
                  <View style={styles.goalHeaderInfo}>
                    <Text style={styles.goalTitle}>{goal.title}</Text>
                    <Text style={styles.goalStatus}>
                      {goal.status === 'completed' ? '✅ Completed' : goal.status === 'cancelled' ? '❌ Cancelled' : `${pct}% funded`}
                    </Text>
                  </View>
                  <View style={styles.goalActions}>
                    <TouchableOpacity onPress={(event) => { event.stopPropagation(); setEditGoalId(goal.id); setEditTitle(goal.title); setEditTarget(String(goal.targetAmountUgx)); setEditCategory(goal.category); setEditDesc(goal.description || ''); setShowEdit(goal.id); }} style={styles.actionBtn}>
                      <MaterialCommunityIcons name="pencil" size={18} color={Colors.outline} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={(event) => { event.stopPropagation(); handleDelete(goal.id, goal.title); }} style={styles.actionBtn}>
                      <MaterialCommunityIcons name="delete-outline" size={18} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.goalProgressRow}>
                  <Text style={styles.goalSaved}>UGX {formatUgx(goal.savedAmountUgx)}</Text>
                  <Text style={styles.goalTarget}>Target UGX {formatUgx(goal.targetAmountUgx)}</Text>
                </View>

                <View style={styles.goalBarBg}>
                  <View style={[styles.goalBarFill, { width: `${pct}%`, backgroundColor: pct >= 100 ? Colors.primary : Colors.secondaryContainer }]} />
                </View>

                <View style={styles.goalFooter}>
                  <Text style={styles.goalRemaining}>
                    {remaining > 0 ? `${formatUgx(remaining)} UGX remaining` : '🎉 Fully funded!'}
                  </Text>
                  <Text style={styles.goalMilestones}>
                    {goal.milestones?.length || 0} milestone{(goal.milestones?.length || 0) !== 1 ? 's' : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.8} onPress={() => { resetForm(); setShowCreate(true); }}>
        <MaterialCommunityIcons name="plus" size={28} color={Colors.onPrimary} />
      </TouchableOpacity>

      {/* Create Modal */}
      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => { Keyboard.dismiss(); setShowCreate(false); }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => { Keyboard.dismiss(); setShowCreate(false); }}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.modalContent}>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>New Savings Goal</Text>
                  <TouchableOpacity onPress={() => { Keyboard.dismiss(); setShowCreate(false); }}>
                    <MaterialCommunityIcons name="close" size={24} color={Colors.onSurfaceVariant} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>Title</Text>
                <TextInput style={styles.input} placeholder="e.g. Buy Land in Wakiso" placeholderTextColor={Colors.outline} value={newTitle} onChangeText={setNewTitle} returnKeyType="next" />

                <Text style={styles.inputLabel}>Target Amount (UGX)</Text>
                <TextInput style={styles.input} placeholder="e.g. 50000000" placeholderTextColor={Colors.outline} keyboardType="numeric" value={newTarget} onChangeText={setNewTarget} returnKeyType="next" />

                <Text style={styles.inputLabel}>Category</Text>
                <View style={styles.categoryRow}>
                  {CATEGORIES.map((c) => (
                    <TouchableOpacity key={c.value} style={[styles.categoryChip, newCategory === c.value && styles.categoryChipActive]} onPress={() => { Keyboard.dismiss(); setNewCategory(c.value); }}>
                      <MaterialCommunityIcons name={c.icon as any} size={16} color={newCategory === c.value ? Colors.onPrimary : Colors.onSurfaceVariant} />
                      <Text style={[styles.categoryChipText, newCategory === c.value && { color: Colors.onPrimary }]}>{c.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>Description (optional)</Text>
                <TextInput style={[styles.input, { height: 60 }]} placeholder="What is this goal for?" placeholderTextColor={Colors.outline} multiline value={newDesc} onChangeText={setNewDesc} />

                <TouchableOpacity style={styles.createBtn} onPress={handleCreate}>
                  <Text style={styles.createBtnText}>Create Goal</Text>
                </TouchableOpacity>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={showEdit !== null} animationType="slide" transparent onRequestClose={() => { Keyboard.dismiss(); setShowEdit(null); setEditGoalId(null); }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => { Keyboard.dismiss(); setShowEdit(null); setEditGoalId(null); }}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.modalContent}>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Edit Goal</Text>
                  <TouchableOpacity onPress={() => { Keyboard.dismiss(); setShowEdit(null); setEditGoalId(null); }}>
                    <MaterialCommunityIcons name="close" size={24} color={Colors.onSurfaceVariant} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>Title</Text>
                <TextInput style={styles.input} placeholder="e.g. Buy Land in Wakiso" placeholderTextColor={Colors.outline} value={editTitle} onChangeText={setEditTitle} returnKeyType="next" />

                <Text style={styles.inputLabel}>Target Amount (UGX)</Text>
                <TextInput style={styles.input} placeholder="e.g. 50000000" placeholderTextColor={Colors.outline} keyboardType="numeric" value={editTarget} onChangeText={setEditTarget} returnKeyType="next" />

                <Text style={styles.inputLabel}>Category</Text>
                <View style={styles.categoryRow}>
                  {CATEGORIES.map((c) => (
                    <TouchableOpacity key={c.value} style={[styles.categoryChip, editCategory === c.value && styles.categoryChipActive]} onPress={() => { Keyboard.dismiss(); setEditCategory(c.value); }}>
                      <MaterialCommunityIcons name={c.icon as any} size={16} color={editCategory === c.value ? Colors.onPrimary : Colors.onSurfaceVariant} />
                      <Text style={[styles.categoryChipText, editCategory === c.value && { color: Colors.onPrimary }]}>{c.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>Description (optional)</Text>
                <TextInput style={[styles.input, { height: 60 }]} placeholder="What is this goal for?" placeholderTextColor={Colors.outline} multiline value={editDesc} onChangeText={setEditDesc} />

                <TouchableOpacity style={styles.createBtn} onPress={handleEdit}>
                  <Text style={styles.createBtnText}>Save Changes</Text>
                </TouchableOpacity>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 120 },
  header: { marginHorizontal: 16, marginTop: 16, padding: 20, backgroundColor: Colors.primary, borderRadius: 24, overflow: 'hidden', ...Shadow.level2 },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.stackSm },
  eyebrow: { color: Colors.primaryFixed, fontSize: 10, fontFamily: 'Inter', fontWeight: '800', letterSpacing: 1.1 },
  headerAdd: { width: 43, height: 43, borderRadius: 14, backgroundColor: Colors.primaryFixed, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 29, fontFamily: 'Montserrat', fontWeight: '800', color: Colors.onPrimary, marginTop: 3 },
  headerSub: { fontSize: 12, fontFamily: 'Inter', color: Colors.primaryFixed, marginTop: 4 },
  headerEmpty: { marginTop: 17, paddingTop: 13, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)', flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerEmptyText: { color: Colors.primaryFixed, fontFamily: 'Inter', fontSize: 12, flex: 1 },
  summaryCard: { marginHorizontal: Spacing.containerPaddingMobile, backgroundColor: Colors.primary, borderRadius: BorderRadius.xl, padding: Spacing.stackMd, ...Shadow.level2, marginBottom: Spacing.gutter },
  summaryRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' },
  summaryValue: { fontSize: 18, fontFamily: 'Montserrat', fontWeight: '800', color: Colors.onPrimary },
  summaryLabel: { fontSize: 10, fontFamily: 'Inter', color: Colors.primaryFixed, marginTop: 3 },
  summaryBarBg: { height: 7, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 4, marginTop: 17, overflow: 'hidden' },
  summaryBarFill: { height: '100%', backgroundColor: Colors.secondaryContainer, borderRadius: 4 },
  listHeading: { marginTop: 26, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  listHeadingTitle: { color: Colors.onSurface, fontFamily: 'Montserrat', fontSize: 20, fontWeight: '800' },
  listHeadingMeta: { color: Colors.outline, fontFamily: 'Inter', fontSize: 11 },
  emptyState: { marginHorizontal: 20, alignItems: 'center', paddingVertical: 35, paddingHorizontal: 25, backgroundColor: '#F0F8F5', borderRadius: 20, borderWidth: 1, borderColor: '#C5E7D8' },
  emptyIcon: { width: 58, height: 58, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: '#DDF2E9' },
  emptyTitle: { fontSize: 18, fontFamily: 'Montserrat', fontWeight: '800', color: Colors.primary, marginTop: 14 },
  emptyDesc: { fontSize: 12, lineHeight: 18, textAlign: 'center', fontFamily: 'Inter', color: Colors.onSurfaceVariant, marginTop: 6 },
  emptyCta: { marginTop: 18, paddingHorizontal: 15, paddingVertical: 10, borderRadius: BorderRadius.full, backgroundColor: Colors.primary, flexDirection: 'row', gap: 6, alignItems: 'center' },
  emptyCtaText: { color: Colors.onPrimary, fontFamily: 'Inter', fontSize: 12, fontWeight: '800' },
  goalCard: { marginHorizontal: 20, backgroundColor: Colors.surfaceContainerLowest, borderRadius: 19, padding: 15, ...Shadow.level1, marginBottom: 12, borderWidth: 1, borderColor: Colors.outlineVariant + '4A' },
  goalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  goalIcon: { width: 43, height: 43, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  goalHeaderInfo: { flex: 1, marginLeft: Spacing.stackSm },
  goalTitle: { fontSize: 14, fontFamily: 'Inter', fontWeight: '800', color: Colors.onSurface },
  goalStatus: { fontSize: 11, fontFamily: 'Inter', color: Colors.onSurfaceVariant, marginTop: 3 },
  goalActions: { flexDirection: 'row', gap: 4 },
  actionBtn: { padding: 7, borderRadius: 10, backgroundColor: Colors.surfaceContainerLow },
  goalProgressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  goalSaved: { fontSize: 13, fontFamily: 'Inter', fontWeight: '800', color: Colors.primary },
  goalTarget: { fontSize: 11, fontFamily: 'Inter', color: Colors.outline },
  goalBarBg: { height: 7, backgroundColor: Colors.surfaceContainerHigh, borderRadius: 4, overflow: 'hidden' },
  goalBarFill: { height: '100%', borderRadius: 4 },
  goalFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  goalRemaining: { fontSize: 11, fontFamily: 'Inter', fontWeight: '500', color: Colors.secondary },
  goalMilestones: { fontSize: 11, fontFamily: 'Inter', color: Colors.outline },
  fab: { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 20, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', ...Shadow.level2, borderWidth: 3, borderColor: Colors.surface },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.gutter, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.gutter },
  modalTitle: { fontSize: Typography.headlineMd.fontSize, fontFamily: 'Montserrat', fontWeight: '600', color: Colors.primary },
  inputLabel: { fontSize: Typography.labelMd.fontSize, fontFamily: 'Inter', fontWeight: '500', color: Colors.onSurfaceVariant, marginBottom: 6, marginTop: Spacing.stackSm },
  input: { backgroundColor: Colors.surfaceContainerLow, borderRadius: BorderRadius.lg, padding: 14, fontSize: Typography.bodyMd.fontSize, fontFamily: 'Inter', color: Colors.onSurface, borderWidth: 1, borderColor: Colors.outlineVariant + '4D' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: BorderRadius.full, backgroundColor: Colors.surfaceContainerLow, borderWidth: 1, borderColor: Colors.outlineVariant + '4D' },
  categoryChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  categoryChipText: { fontSize: 12, fontFamily: 'Inter', fontWeight: '500', color: Colors.onSurfaceVariant },
  createBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.xl, paddingVertical: 16, alignItems: 'center', marginTop: Spacing.gutter },
  createBtnText: { fontSize: Typography.labelMd.fontSize, fontFamily: 'Inter', fontWeight: '600', color: Colors.onPrimary },
});
