import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  FlatList, Dimensions, Platform, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView, 
  Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { auth, db, registerListener, sessionState } from '../config/firebase';
import { 
  serverTimestamp 
} from 'firebase/firestore';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

interface Goal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  category: string;
  deadline?: any;
}

const CATEGORIES = [
  { id: 'fees', name: 'Tuition Fees', icon: 'school-outline', color: '#D9F15D' },
  { id: 'service', name: 'Service Capital', icon: 'briefcase-outline', color: '#D9F15D' },
  { id: 'emergency', name: 'Emergency Fund', icon: 'shield-checkmark-outline', color: '#D9F15D' },
  { id: 'personal', name: 'Personal Life', icon: 'heart-outline', color: '#D9F15D' },
  { id: 'custom', name: 'Custom Goal', icon: 'flag-outline', color: '#D9F15D' },
];

export default function SetGoalsScreen() {
  const router = useRouter();
  const { isDark, theme } = useTheme();
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUser = auth.currentUser;

  // New Goal State
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalAmount, setNewGoalAmount] = useState('');
  const [isAutoAllocEnabled, setIsAutoAllocEnabled] = useState(false);
  const [allocationAmount, setAllocationAmount] = useState('');
  const [lockDays, setLockDays] = useState(30); 
  const [isPriority, setIsPriority] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('fees');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'users', currentUser.uid, 'goals')
    );

    const unsub = registerListener(onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      setGoals(list);
      setLoading(false);
    }, (err) => {
      if (err.code === 'permission-denied' || sessionState.isEnding) return;
      console.error("Goals fetch error:", err);
      setLoading(false);
    }));

    return () => unsub();
  }, [currentUser]);

  const openCreateModal = (catId?: string) => {
    if (catId) setSelectedCategory(catId);
    else setSelectedCategory('custom');
    setIsModalVisible(true);
  };

  const handleCreateGoal = async () => {
    if (!currentUser || !newGoalTitle || !newGoalAmount) return;

    setCreating(true);
    try {
      const now = new Date();
      const unlockDate = new Date();
      unlockDate.setDate(now.getDate() + lockDays);

      await addDoc(collection(db, 'users', currentUser.uid, 'goals'), {
        title: newGoalTitle,
        targetAmount: parseFloat(newGoalAmount),
        currentAmount: 0,
        category: selectedCategory,
        autoAllocation: isAutoAllocEnabled ? (parseFloat(allocationAmount) || 0) : 0,
        lockDays: lockDays,
        unlockDate: unlockDate,
        isPriority: isPriority,
        createdAt: serverTimestamp(),
      });
      setIsModalVisible(false);
      setNewGoalTitle('');
      setNewGoalAmount('');
      setAllocationAmount('');
      setIsAutoAllocEnabled(false);
      setIsPriority(false);
    } catch (err) {
      console.error("Create goal error:", err);
    } finally {
      setCreating(false);
    }
  };

  const renderGoalItem = ({ item }: { item: any }) => {
    const progress = Math.min((item.currentAmount / item.targetAmount) * 100, 100);
    const isLocked = item.unlockDate && item.unlockDate.toDate() > new Date();
    
    return (
      <View style={[styles.goalCard, { backgroundColor: theme.card, borderColor: theme.border }, item.isPriority && styles.priorityCard]}>
        <View style={styles.goalHeader}>
          <View style={[styles.goalIconContainer, { backgroundColor: theme.cardAlt }]}>
            <Ionicons 
              name={CATEGORIES.find(c => c.id === item.category.toLowerCase())?.icon as any || 'flag-outline'} 
              size={20} 
              color={theme.text} 
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 5 }}>
            {item.isPriority && (
              <Ionicons name="star" size={16} color="#FFD700" />
            )}
            {isLocked && (
              <View style={[styles.lockBadge, { backgroundColor: theme.cardAlt }]}>
                 <Ionicons name="lock-closed" size={12} color={theme.subtext} />
                 <Text style={[styles.lockText, { color: theme.subtext }]}>Locked</Text>
              </View>
            )}
          </View>
        </View>
        
        <Text style={[styles.goalTitle, { color: theme.text }]}>{item.title}</Text>
        <View style={styles.amountContainer}>
           <Text style={[styles.goalAmount, { color: theme.text }]}>₵{item.currentAmount.toLocaleString()}</Text>
           <Text style={[styles.targetAmount, { color: theme.subtext }]}> / ₵{item.targetAmount.toLocaleString()}</Text>
        </View>

        <View style={styles.progressContainer}>
          <View style={[styles.progressBarBg, { backgroundColor: theme.cardAlt }]}>
            <View style={[styles.progressBarFill, { backgroundColor: '#D9F15D', width: `${progress}%` }]} />
          </View>
          <Text style={[styles.progressText, { color: theme.text }]}>{Math.round(progress)}%</Text>
        </View>

        {item.autoAllocation > 0 && (
          <View style={[styles.autoAllocBadge, { backgroundColor: theme.cardAlt }]}>
             <Feather name="refresh-cw" size={10} color={theme.text} />
             <Text style={[styles.autoAllocText, { color: theme.text }]}>₵{item.autoAllocation} auto-deposit</Text>
          </View>
        )}
      </View>
    );
  };

  const calculateCapabilityScore = () => {
    let score = 40; // Base score
    if (goals.length > 0) score += 15;
    if (goals.length > 2) score += 10;
    
    const hasPriority = goals.some(g => g.isPriority);
    if (hasPriority) score += 15;
    
    const hasLongLock = goals.some(g => g.lockDays >= 90);
    if (hasLongLock) score += 20;

    return Math.min(score, 100);
  };

  const capabilityScore = calculateCapabilityScore();

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.text} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Goal Intelligence</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Behavioral Nudge Card */}
        <View style={[styles.nudgeCard, { backgroundColor: theme.cardAlt, borderColor: theme.border }]}>
          <View style={styles.nudgeTextContainer}>
            <Text style={[styles.nudgeTitle, { color: theme.text }]}>Bridging the Gap</Text>
            <Text style={[styles.nudgeDescription, { color: theme.subtext }]}>
               {capabilityScore < 60 
                 ? "You've started. Now set a Priority Milestone to focus your intent and boost your score."
                 : "Excellent discipline. Your use of locks and priority goals is bridging the gap to success."}
            </Text>
          </View>
          <View style={[styles.capabilityScoreContainer, { backgroundColor: isDark ? '#D9F15D' : '#000' }]}>
             <Text style={[styles.scoreValue, { color: isDark ? '#000' : '#FFF' }]}>{capabilityScore}</Text>
             <Text style={[styles.scoreLabel, { color: isDark ? 'rgba(0,0,0,0.5)' : '#AAA' }]}>Capability</Text>
          </View>
        </View>

        {/* Section: Your Active Goals */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text, paddingHorizontal: 0 }]}>Active Milestones</Text>
          {goals.length > 0 && <Text style={[styles.viewAllText, { color: theme.subtext }]}>{goals.length} total</Text>}
        </View>

        {goals.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: theme.cardAlt }]}>
            <View style={[styles.emptyIconCircle, { backgroundColor: theme.card }]}>
              <Ionicons name="flag-outline" size={40} color={theme.border} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No goals set yet</Text>
            <Text style={[styles.emptySubtitle, { color: theme.subtext }]}>
              Start your journey to financial resilience by setting your first milestone.
            </Text>
          </View>
        ) : (
          <FlatList
            data={goals}
            renderItem={renderGoalItem}
            keyExtractor={item => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.goalsList}
            snapToInterval={width * 0.75 + 20}
            decelerationRate="fast"
          />
        )}

        {/* Section: Categories / Quick Set */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Set New Milestone</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity key={cat.id} style={[styles.categoryCard, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => openCreateModal(cat.id)}>
              <View style={[styles.catIconSquare, { backgroundColor: theme.cardAlt }]}>
                <Ionicons name={cat.icon as any} size={26} color={theme.text} />
              </View>
              <Text style={[styles.catName, { color: theme.text }]}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tip of the day */}
        <View style={[styles.tipCard, { backgroundColor: isDark ? 'rgba(217,241,93,0.1)' : '#F0F7FF' }]}>
           <Ionicons name="bulb-outline" size={20} color={isDark ? '#D9F15D' : '#003366'} />
           <Text style={[styles.tipText, { color: isDark ? theme.text : '#003366' }]}>
             Students who set specific deadlines for tuition fees are 40% more likely to save successfully.
           </Text>
        </View>

      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity style={[styles.fab, { backgroundColor: isDark ? '#D9F15D' : '#000' }]} onPress={() => openCreateModal()}>
        <Ionicons name="add" size={30} color={isDark ? '#000' : '#FFF'} />
      </TouchableOpacity>

      {/* Create Goal Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.bg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Set Milestone</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Goal Title</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.cardAlt, borderColor: theme.border, color: theme.inputText }]}
                placeholder="e.g. Semester 2 Fees"
                placeholderTextColor={theme.placeholder}
                value={newGoalTitle}
                onChangeText={setNewGoalTitle}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Target Amount (₵)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.cardAlt, borderColor: theme.border, color: theme.inputText }]}
                placeholder="e.g. 5000"
                placeholderTextColor={theme.placeholder}
                keyboardType="numeric"
                value={newGoalAmount}
                onChangeText={setNewGoalAmount}
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: theme.text }]}>Automated Savings</Text>
                  <Text style={[styles.switchSub, { color: theme.subtext }]}>Deduct money automatically on top-ups.</Text>
                </View>
                <Switch 
                  value={isAutoAllocEnabled}
                  onValueChange={setIsAutoAllocEnabled}
                  trackColor={{ false: theme.border, true: isDark ? '#D9F15D' : '#000' }}
                />
              </View>

              {isAutoAllocEnabled && (
                <TextInput
                  style={[styles.input, { marginTop: 10, backgroundColor: theme.cardAlt, borderColor: theme.border, color: theme.inputText }]}
                  placeholder="GH₵ per top-up (e.g. 20)"
                  placeholderTextColor={theme.placeholder}
                  keyboardType="numeric"
                  value={allocationAmount}
                  onChangeText={setAllocationAmount}
                />
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Strict Lock Duration</Text>
              <View style={styles.lockOptionRow}>
                {[7, 30, 90].map((days) => (
                  <TouchableOpacity 
                    key={days}
                    onPress={() => setLockDays(days)}
                    style={[
                      styles.lockOption,
                      { backgroundColor: theme.cardAlt, borderColor: theme.border },
                      lockDays === days && [styles.lockOptionActive, { backgroundColor: isDark ? '#D9F15D' : '#000', borderColor: isDark ? '#D9F15D' : '#000' }]
                    ]}
                  >
                    <Text style={[
                      styles.lockOptionText,
                      { color: theme.text },
                      lockDays === days && [styles.lockOptionTextActive, { color: isDark ? '#000' : '#FFF' }]
                    ]}>{days} Days</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.lockHint, { color: theme.subtext }]}>
                {lockDays === 90 ? "Maximum discipline for long-term goals." : "Funds will be strictly locked until the release date."}
              </Text>
            </View>

            <TouchableOpacity 
              style={[styles.priorityToggle, { backgroundColor: theme.cardAlt, borderColor: theme.border }]}
              onPress={() => setIsPriority(!isPriority)}
            >
              <Ionicons 
                name={isPriority ? "star" : "star-outline"} 
                size={22} 
                color={isPriority ? "#FFD700" : theme.subtext} 
              />
              <View>
                <Text style={[styles.priorityToggleTitle, { color: theme.text }]}>Priority Milestone</Text>
                <Text style={[styles.priorityToggleSub, { color: theme.subtext }]}>Highlight this as your #1 focus.</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.categoryPicker}>
              <Text style={[styles.label, { color: theme.text }]}>Category</Text>
              <View style={styles.catPickerRow}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity 
                    key={cat.id} 
                    onPress={() => setSelectedCategory(cat.id)}
                    style={[
                      styles.catPickerItem,
                      { backgroundColor: theme.cardAlt, borderColor: theme.border },
                      selectedCategory === cat.id && [styles.catPickerItemSelected, { backgroundColor: isDark ? '#D9F15D' : '#000', borderColor: isDark ? '#D9F15D' : '#000' }]
                    ]}
                  >
                    <Ionicons 
                      name={cat.icon as any} 
                      size={18} 
                      color={selectedCategory === cat.id ? (isDark ? "#000" : "#FFF") : theme.text} 
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.saveBtn, { backgroundColor: isDark ? '#D9F15D' : '#000' }, creating && { opacity: 0.7 }]} 
              onPress={handleCreateGoal}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color={isDark ? '#000' : '#FFF'} />
              ) : (
                <Text style={[styles.saveBtnText, { color: isDark ? '#000' : '#FFF' }]}>Activate Strict Milestone</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 20, 
    paddingVertical: 15 
  },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  backBtn: { padding: 5 },
  scrollContent: { paddingBottom: 100 },
  nudgeCard: { 
    margin: 20, 
    padding: 20, 
    backgroundColor: '#F9F9F9', 
    borderRadius: 24, 
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0F0F0'
  },
  nudgeTextContainer: { flex: 1, marginRight: 15 },
  nudgeTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 5 },
  nudgeDescription: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },
  capabilityScoreContainer: { 
    width: 70, 
    height: 70, 
    borderRadius: 35, 
    backgroundColor: '#000', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  scoreValue: { fontFamily: 'Inter_700Bold', fontSize: 22 },
  scoreLabel: { fontFamily: 'Inter_400Regular', fontSize: 8, marginTop: -2 },
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    marginBottom: 15 
  },
  sectionTitle: { 
    fontFamily: 'Inter_700Bold', 
    fontSize: 18, 
    paddingHorizontal: 20,
    marginBottom: 15,
    marginTop: 10
  },
  viewAllText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#AAA' },
  goalsList: { paddingHorizontal: 20, paddingBottom: 20 },
  goalCard: { 
    width: width * 0.75, 
    backgroundColor: '#FFF', 
    borderRadius: 24, 
    padding: 20, 
    marginRight: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#F5F5F5'
  },
  priorityCard: { borderColor: '#FFD700', borderWidth: 1.5, shadowOpacity: 0.1 },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  goalIconContainer: { 
    width: 40, 
    height: 40, 
    borderRadius: 12, 
    backgroundColor: '#F9F9F9', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  lockBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F5F5F5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  lockText: { fontFamily: 'Inter_400Regular', fontSize: 10, color: '#AAA' },
  goalTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, marginBottom: 8 },
  amountContainer: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 20 },
  goalAmount: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  targetAmount: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  progressContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressBarBg: { flex: 1, height: 8, backgroundColor: '#F0F0F0', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#000', borderRadius: 4 },
  progressText: { fontFamily: 'Inter_700Bold', fontSize: 12, width: 35 },
  autoAllocBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 15, backgroundColor: '#F0F0F0', padding: 8, borderRadius: 10 },
  autoAllocText: { fontFamily: 'Inter_700Bold', fontSize: 10 },
  categoryGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    paddingHorizontal: 15, 
    justifyContent: 'space-between' 
  },
  categoryCard: { 
    width: '47%', 
    backgroundColor: '#FFF', 
    borderRadius: 20, 
    padding: 20, 
    marginBottom: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0F0F0'
  },
  catIconSquare: { 
    width: 50, 
    height: 50, 
    borderRadius: 15, 
    backgroundColor: '#F9F9F9', 
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: 12
  },
  catName: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  emptyContainer: { 
    alignItems: 'center', 
    paddingVertical: 40, 
    marginHorizontal: 20,
    backgroundColor: '#F9F9F9',
    borderRadius: 24,
    marginBottom: 20
  },
  emptyIconCircle: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    backgroundColor: '#FFF', 
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: 15
  },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 8 },
  emptySubtitle: { 
    fontFamily: 'Inter_400Regular', 
    fontSize: 13, 
    color: '#999', 
    textAlign: 'center', 
    paddingHorizontal: 30,
    lineHeight: 18
  },
  tipCard: { 
    flexDirection: 'row', 
    padding: 20, 
    marginHorizontal: 20, 
    backgroundColor: '#F0F7FF', 
    borderRadius: 20,
    alignItems: 'center',
    gap: 15,
    marginTop: 10
  },
  tipText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 12, color: '#003366', lineHeight: 18 },
  fab: { 
    position: 'absolute', 
    bottom: 30, 
    right: 20, 
    width: 65, 
    height: 65, 
    borderRadius: 32.5, 
    backgroundColor: '#000', 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 25,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  modalTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#F9F9F9',
    borderRadius: 15,
    padding: 15,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#000',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchSub: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#AAA', marginTop: 2 },
  lockOptionRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  lockOption: { flex: 1, paddingVertical: 12, backgroundColor: '#F9F9F9', borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#F0F0F0' },
  lockOptionActive: { backgroundColor: '#000', borderColor: '#000' },
  lockOptionText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#000' },
  lockOptionTextActive: { color: '#FFF' },
  lockHint: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#AAA', lineHeight: 15 },
  priorityToggle: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, backgroundColor: '#F9F9F9', borderRadius: 15, marginBottom: 20, borderWidth: 1, borderColor: '#F0F0F0' },
  priorityToggleTitle: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  priorityToggleSub: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  categoryPicker: {
    marginBottom: 30,
  },
  catPickerRow: {
    flexDirection: 'row',
    gap: 15,
  },
  catPickerItem: {
    width: 45,
    height: 45,
    borderRadius: 12,
    backgroundColor: '#F9F9F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  catPickerItemSelected: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  saveBtn: {
    backgroundColor: '#000',
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
  },
});
