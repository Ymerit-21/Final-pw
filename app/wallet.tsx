import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  Platform, ActivityIndicator, Dimensions, Modal, 
  TextInput, KeyboardAvoidingView, Switch, FlatList
} from 'react-native';
import Animated, { FadeInUp, FadeInDown, FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { auth, db, registerListener, sessionState } from '../config/firebase';
import { doc, onSnapshot, collection, query, orderBy, limit, addDoc, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { Stack, useRouter } from 'expo-router';
import { Shimmer, GoalSkeleton } from '../components/Shimmer';
import { LinearGradient } from 'expo-linear-gradient';
import { PieChart } from 'react-native-chart-kit';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

// Existing GOAL_CATEGORIES (from current wallet.tsx)
const GOAL_CATEGORIES = [
  { id: 'fees', name: 'Tuition Fees', icon: 'school-outline' },
  { id: 'service', name: 'Service Capital', icon: 'briefcase-outline' },
  { id: 'emergency', name: 'Emergency Fund', icon: 'shield-checkmark-outline' },
  { id: 'personal', name: 'Personal Life', icon: 'heart-outline' },
  { id: 'custom', name: 'Custom Goal', icon: 'flag-outline' },
];

const PRESET_COLORS = ['#FF2D55', '#FF9500', '#FFCC00', '#34C759', '#5AC8FA', '#007AFF', '#5856D6', '#AF52DE'];
const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Gifts', 'Investments', 'Other'];

interface Budget {
  id: string;
  name: string;
  limit: number;
  spent: number;
  color: string;
  createdAt?: any;
}

interface Goal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  category: string;
  isPriority?: boolean;
  createdAt?: any;
}

interface Transaction {
  id: string;
  type: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  createdAt?: any;
}

export default function WalletScreen() {
  const router = useRouter();
  const { isDark, theme } = useTheme();
  const [loading, setLoading] = useState(true);

  // Milestone State
  const [goals, setGoals] = useState<Goal[]>([]);
  const [userData, setUserData] = useState<any>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalAmount, setNewGoalAmount] = useState('');
  const [isAutoAllocEnabled, setIsAutoAllocEnabled] = useState(false);
  const [allocationAmount, setAllocationAmount] = useState('');
  const [lockDays, setLockDays] = useState(30); 
  const [isPriority, setIsPriority] = useState(false);
  const [selectedGoalCategory, setSelectedGoalCategory] = useState('fees');
  const [creating, setCreating] = useState(false);

  // Budgets & Transactions State (Now bound to Firebase)
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  // Modals
  const [isAddTxVisible, setIsAddTxVisible] = useState(false);
  const [isAddBudgetVisible, setIsAddBudgetVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Add Transaction Form
  const [txType, setTxType] = useState<'income' | 'expense'>('expense');
  const [txAmount, setTxAmount] = useState('');
  const [txCategory, setTxCategory] = useState('');
  const [txDesc, setTxDesc] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);

  // Add/Edit Budget Form
  const [budgetName, setBudgetName] = useState('');
  const [budgetLimit, setBudgetLimit] = useState('');
  const [budgetColor, setBudgetColor] = useState(PRESET_COLORS[0]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    const profileUnsub = registerListener(onSnapshot(doc(db, 'users', uid), (snap) => {
      if (snap.exists()) setUserData(snap.data());
    }, () => {}));

    const goalsUnsub = registerListener(onSnapshot(collection(db, 'users', uid, 'goals'), (snap) => {
      setGoals(snap.docs.map(d => ({ id: d.id, ...d.data() } as Goal)));
    }, () => {}));

    const txQuery = query(collection(db, 'users', uid, 'transactions'), orderBy('createdAt', 'desc'), limit(15));
    const txUnsub = registerListener(onSnapshot(txQuery, (snap) => {
      setTransactions(snap.docs.map(d => {
        const data = d.data();
        let fallbackDate = data.date;
        if (!fallbackDate && data.createdAt) {
          fallbackDate = data.createdAt.toDate().toISOString().split('T')[0];
        }
        return { id: d.id, ...data, date: fallbackDate || new Date().toISOString().split('T')[0] } as Transaction;
      }));
    }, () => {}));

    const budgetsUnsub = registerListener(onSnapshot(collection(db, 'users', uid, 'budgets'), (snap) => {
        const fetchBudgets = snap.docs.map(d => ({ id: d.id, ...d.data() } as Budget));
        setBudgets(fetchBudgets);
        // Default select the first category if none typed
        if (fetchBudgets.length > 0 && !txCategory && txType === 'expense') {
            setTxCategory(fetchBudgets[0].name);
        }
    }, () => {}));

    // Setting timeout on loading
    setTimeout(() => {
        if (txType === 'income' && !txCategory) setTxCategory(INCOME_CATEGORIES[0]);
        setLoading(false);
    }, 500);

    return () => {
      profileUnsub();
      goalsUnsub();
      txUnsub();
      budgetsUnsub();
    };
  }, [auth.currentUser]);

  // Calculations
  const totalIncome = transactions.filter(t => t.type === 'income' || t.type === 'credit').reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalExpense = transactions.filter(t => t.type === 'expense' || t.type === 'debit').reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalBalance = totalIncome - totalExpense;

  // Milestone Creators
  const handleCreateGoal = async () => {
    if (!auth.currentUser || !newGoalTitle || !newGoalAmount) return;
    setCreating(true);
    try {
      const now = new Date();
      const unlockDate = new Date();
      unlockDate.setDate(now.getDate() + lockDays);
      await addDoc(collection(db, 'users', auth.currentUser.uid, 'goals'), {
        title: newGoalTitle,
        targetAmount: parseFloat(newGoalAmount),
        currentAmount: 0,
        category: selectedGoalCategory,
        autoAllocation: isAutoAllocEnabled ? (parseFloat(allocationAmount) || 0) : 0,
        lockDays: lockDays,
        unlockDate: unlockDate,
        isPriority: isPriority,
        createdAt: serverTimestamp(),
      });
      setIsModalVisible(false);
      resetGoalForm();
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const resetGoalForm = () => {
    setNewGoalTitle('');
    setNewGoalAmount('');
    setAllocationAmount('');
    setIsAutoAllocEnabled(false);
    setIsPriority(false);
  };

  const handleAddTransaction = async () => {
    if (!auth.currentUser || !txAmount || !txCategory || !txDesc || !txDate) return;
    setIsSaving(true);
    const uid = auth.currentUser.uid;
    const amountNum = parseFloat(txAmount);
    
    try {
        if (txType === 'expense') {
            const relatedBudget = budgets.find(b => b.name === txCategory);
            if (relatedBudget) {
              await updateDoc(doc(db, 'users', uid, 'budgets', relatedBudget.id), {
                spent: (relatedBudget.spent || 0) + amountNum
              });
            }
        }
      
        await addDoc(collection(db, 'users', uid, 'transactions'), {
            type: txType,
            category: txCategory,
            description: txDesc,
            amount: amountNum,
            date: txDate,
            createdAt: serverTimestamp(),
        });
      
        setIsAddTxVisible(false);
        setTxAmount('');
        setTxDesc('');
    } catch(err) {
        console.error(err);
    } finally {
        setIsSaving(false);
    }
  };

  const handleDeleteTransaction = async (tx: any) => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    
    try {
        if (tx.type === 'expense') {
            const relatedBudget = budgets.find(b => b.name === tx.category);
            if (relatedBudget) {
                const newSpent = Math.max(0, (relatedBudget.spent || 0) - tx.amount);
                await updateDoc(doc(db, 'users', uid, 'budgets', relatedBudget.id), {
                    spent: newSpent
                });
            }
        }
        await deleteDoc(doc(db, 'users', uid, 'transactions', tx.id));
    } catch(err) {
        console.error(err);
    }
  };

  const handleAddBudget = async () => {
    if (!auth.currentUser || !budgetName || !budgetLimit) return;
    setIsSaving(true);
    const uid = auth.currentUser.uid;
    const limitNum = parseFloat(budgetLimit);

    try {
        await addDoc(collection(db, 'users', uid, 'budgets'), {
            name: budgetName,
            limit: limitNum,
            spent: 0,
            color: budgetColor,
            createdAt: serverTimestamp(),
        });
        
        setIsAddBudgetVisible(false);
        setBudgetName('');
        setBudgetLimit('');
    } catch(err) {
        console.error(err);
    } finally {
        setIsSaving(false);
    }
  };

  const handleDeleteBudget = async (id: string) => {
    if (!auth.currentUser) return;
    try {
        await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'budgets', id));
    } catch(err) {
        console.error(err);
    }
  };

  const renderGoalItem = ({ item }: { item: any }) => {
    const progress = Math.min((item.currentAmount / item.targetAmount) * 100, 100) || 0;
    return (
      <View style={[styles.goalCard, { backgroundColor: theme.card }, item.isPriority && styles.priorityCard]}>
        <View style={styles.goalHeader}>
          <View style={[styles.goalIconContainer, { backgroundColor: theme.cardAlt }]}>
            <Ionicons 
              name={GOAL_CATEGORIES.find(c => c.id === item.category.toLowerCase())?.icon as any || 'flag-outline'} 
              size={18} 
              color={theme.text} 
            />
          </View>
          {item.isPriority && <Ionicons name="star" size={16} color={theme.text} />}
        </View>
        <Text style={[styles.goalCardTitle, { color: theme.text }]} numberOfLines={1}>{item.title}</Text>
        <Text style={[styles.goalCardAmount, { color: theme.text }]}>₵{item.currentAmount.toLocaleString()} <Text style={[styles.goalCardTarget, { color: theme.subtext }]}>/ ₵{item.targetAmount.toLocaleString()}</Text></Text>
        <View style={[styles.miniProgressBarBg, { backgroundColor: theme.cardAlt }]}>
          <View style={[styles.miniProgressBarFill, { width: `${progress}%` }]} />
        </View>
      </View>
    );
  };

  const pieData = budgets.map(b => ({
    name: b.name,
    amount: b.spent || 0,
    color: b.color || '#000',
    legendFontColor: '#7F7F7F',
    legendFontSize: 12,
  })).filter(b => b.amount > 0);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={{ padding: 20, paddingTop: 40 }}>
          <Shimmer width="100%" height={160} borderRadius={24} style={{ marginBottom: 30 }} />
          <Shimmer width={200} height={30} style={{ marginBottom: 20 }} />
          <View style={{flexDirection: 'row', gap: 15, marginBottom: 40}}>
             <Shimmer width={150} height={160} borderRadius={16} />
             <Shimmer width={150} height={160} borderRadius={16} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { backgroundColor: theme.bg }]}>
         <Animated.Text entering={FadeIn.delay(100)} style={[styles.headerTitle, { color: theme.text }]}>Financial Hub</Animated.Text>
         <TouchableOpacity onPress={() => setIsAddTxVisible(true)} style={[styles.addBtn, { backgroundColor: isDark ? '#D9F15D' : '#000' }]}>
            <Ionicons name="add" size={24} color={isDark ? '#000' : '#FFF'} />
         </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* 1. Balance Card */}
        <Animated.View entering={FadeInUp.delay(150)}>
          <LinearGradient
            colors={['#1E1E1E', '#3A3A3C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.balanceCard}
          >
            <Text style={styles.balanceLabel}>Total Balance</Text>
            <Text style={styles.balanceAmount}>₵{totalBalance.toLocaleString()}</Text>
            
            <View style={styles.balanceMetricsRow}>
               <View style={styles.metricBox}>
                  <View style={styles.metricHeaderRow}>
                      <Ionicons name="arrow-down-circle" size={16} color="#32D74B" style={{marginRight: 6}}/>
                      <Text style={styles.metricLabel}>Income</Text>
                  </View>
                  <Text style={styles.metricValue}>₵{totalIncome.toLocaleString()}</Text>
               </View>
               <View style={styles.metricDiv} />
               <View style={styles.metricBox}>
                  <View style={styles.metricHeaderRow}>
                      <Ionicons name="arrow-up-circle" size={16} color="#FF3B30" style={{marginRight: 6}}/>
                      <Text style={styles.metricLabel}>Expenses</Text>
                  </View>
                  <Text style={styles.metricValue}>₵{totalExpense.toLocaleString()}</Text>
               </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* 2. Spending Overview */}
        <Animated.View entering={FadeInUp.delay(200)} style={styles.cardSection}>
            <View style={styles.sectionRow}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Spending Overview</Text>
            </View>
            {pieData.length > 0 ? (
                <View style={[styles.chartContainer, { backgroundColor: theme.card, shadowColor: isDark ? '#000' : '#000', shadowOpacity: isDark ? 0.3 : 0.05 }]}>
                    <PieChart
                        data={pieData}
                        width={width - 40}
                        height={200}
                        chartConfig={{
                          color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                        }}
                        accessor={"amount"}
                        backgroundColor={"transparent"}
                        paddingLeft={"15"}
                        center={[0, 0]}
                        absolute
                    />
                </View>
            ) : (
                <Text style={[styles.emptyText, { color: theme.subtext }]}>No spending data available. Add expenses to see your pie chart.</Text>
            )}
        </Animated.View>

        {/* Milestones Section */}
        <Animated.View entering={FadeInUp.delay(250)}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Active Milestones</Text>
            <TouchableOpacity onPress={() => setIsModalVisible(true)}>
               <Text style={[styles.linkText, { color: isDark ? '#D9F15D' : '#007AFF' }]}>+ New</Text>
            </TouchableOpacity>
          </View>
          {goals.length === 0 ? (
            <TouchableOpacity style={[styles.emptyGoals, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => setIsModalVisible(true)}>
              <Ionicons name="flag-outline" size={30} color={theme.subtext} />
              <Text style={[styles.emptyGoalsText, { color: theme.subtext }]}>No milestones set. Tap to start.</Text>
            </TouchableOpacity>
          ) : (
            <FlatList
              data={goals}
              renderItem={renderGoalItem}
              keyExtractor={item => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.goalsHorizontalList}
            />
          )}
        </Animated.View>
        <View style={{height: 15}} />

        {/* 3. Budget Categories Section */}
        <Animated.View entering={FadeInUp.delay(300)} style={styles.cardSection}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Budgets</Text>
            <TouchableOpacity onPress={() => setIsAddBudgetVisible(true)}>
               <Text style={[styles.linkText, { color: isDark ? '#D9F15D' : '#007AFF' }]}>Add Budget</Text>
            </TouchableOpacity>
          </View>
          
          {budgets.length === 0 && <Text style={[styles.emptyText, { color: theme.subtext }]}>No budget categories defined.</Text>}
          {budgets.map((b) => {
             const limit = b.limit || 0;
             const spent = b.spent || 0;
             const progress = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
             const isAlert = progress >= 80;
             const amountLeft = limit - spent;

             return (
                 <View key={b.id} style={[styles.budgetCard, { backgroundColor: theme.card }]}>
                    <View style={styles.budgetHeader}>
                        <View style={styles.budgetTitleRow}>
                            <View style={[styles.colorDot, { backgroundColor: b.color }]} />
                            <Text style={[styles.budgetName, { color: theme.text }]}>{b.name}</Text>
                        </View>
                        <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
                            <TouchableOpacity onPress={() => handleDeleteBudget(b.id)}>
                                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                            </TouchableOpacity>
                        </View>
                    </View>
                    
                    <View style={styles.budgetProgressRow}>
                       <Text style={[styles.budgetAmount, { color: theme.text }]}>₵{spent.toLocaleString()} <Text style={[styles.budgetLimitText, { color: theme.subtext }]}>/ ₵{limit.toLocaleString()}</Text></Text>
                       {isAlert && (
                           <View style={styles.alertBadge}>
                              <Ionicons name="warning" size={12} color="#FFF" />
                              <Text style={styles.alertText}>Over {progress.toFixed(0)}%</Text>
                           </View>
                       )}
                    </View>

                    <View style={[styles.progressBarBg, { backgroundColor: theme.cardAlt }]}>
                       <View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: isAlert ? '#FF3B30' : (isDark && b.color === '#000' ? '#D9F15D' : b.color) }]} />
                    </View>
                    <View style={styles.budgetFooter}>
                        <Text style={[styles.budgetPercentage, { color: theme.subtext }]}>{progress.toFixed(1)}% Used</Text>
                        <Text style={[styles.budgetRemaining, { color: theme.subtext }, amountLeft < 0 && {color: '#FF3B30'}]}>
                           {amountLeft >= 0 ? `₵${amountLeft} left` : `₵${Math.abs(amountLeft)} over budget`}
                        </Text>
                    </View>
                 </View>
             );
          })}
        </Animated.View>

        {/* 4. Recent Transactions */}
        <Animated.View entering={FadeInUp.delay(350)} style={styles.cardSection}>
          <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Transactions</Text>
          </View>
          <View style={[styles.ledger, { backgroundColor: theme.card }]}>
             {transactions.length === 0 && <Text style={[styles.emptyText, { color: theme.subtext }]}>No recent transactions.</Text>}
             {transactions.map((tx) => (
                 <View key={tx.id} style={[styles.txItem, { borderBottomColor: theme.divider }]}>
                    <View style={styles.txLeft}>
                        <View style={[styles.txIconBg, { backgroundColor: (tx.type === 'income' || tx.type === 'credit') ? (isDark ? 'rgba(50,215,75,0.1)' : '#E8F5E9') : (isDark ? 'rgba(255,59,48,0.1)' : '#FFEBEE') }]}>
                            <Ionicons 
                                name={(tx.type === 'income' || tx.type === 'credit') ? 'arrow-down' : 'arrow-up'} 
                                size={16} 
                                color={(tx.type === 'income' || tx.type === 'credit') ? '#32D74B' : '#FF3B30'} 
                            />
                        </View>
                        <View>
                            <Text style={[styles.txDesc, { color: theme.text }]}>{tx.description || 'Unknown Transaction'}</Text>
                            <Text style={[styles.txCategory, { color: theme.subtext }]}>{tx.category || 'Transfer'} • {tx.date}</Text>
                        </View>
                    </View>
                    <View style={styles.txRight}>
                        <Text style={[styles.txAmount, { color: (tx.type === 'income' || tx.type === 'credit') ? '#32D74B' : theme.text }]}>
                           {(tx.type === 'income' || tx.type === 'credit') ? '+' : '-'}₵{(tx.amount || 0).toLocaleString()}
                        </Text>
                        <TouchableOpacity onPress={() => handleDeleteTransaction(tx)} style={styles.trashCircleBtn}>
                            <Ionicons name="trash" size={14} color="#FF3B30" />
                        </TouchableOpacity>
                    </View>
                 </View>
             ))}
          </View>
        </Animated.View>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Forms (Bottom Sheets) */}
      
      {/* Add Transaction Bottom Sheet */}
      <Modal animationType="slide" transparent={true} visible={isAddTxVisible} onRequestClose={() => setIsAddTxVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.bg }]}>
             <View style={styles.modalHeader}>
                 <Text style={[styles.modalTitle, { color: theme.text }]}>Add Transaction</Text>
                 <TouchableOpacity onPress={() => setIsAddTxVisible(false)}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity>
             </View>
             <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.tabsRow}>
                   <TouchableOpacity style={[styles.tabBtn, { backgroundColor: theme.cardAlt }, txType === 'expense' && styles.tabBtnActiveE]} onPress={() => {setTxType('expense'); setTxCategory(budgets?.[0]?.name || '');}}>
                      <Text style={[styles.tabBtnText, { color: theme.text }, txType === 'expense' && {color: '#FFF'}]}>Expense</Text>
                   </TouchableOpacity>
                   <TouchableOpacity style={[styles.tabBtn, { backgroundColor: theme.cardAlt }, txType === 'income' && styles.tabBtnActiveI]} onPress={() => {setTxType('income'); setTxCategory(INCOME_CATEGORIES[0]);}}>
                      <Text style={[styles.tabBtnText, { color: theme.text }, txType === 'income' && {color: '#FFF'}]}>Income</Text>
                   </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                   <Text style={[styles.label, { color: theme.text }]}>Amount</Text>
                   <View style={[styles.inputWithIcon, { backgroundColor: theme.card }]}>
                      <Text style={[styles.currencySymbol, { color: theme.text }]}>₵</Text>
                      <TextInput style={[styles.inputInner, { color: theme.inputText }]} placeholderTextColor={theme.placeholder} placeholder="0.00" keyboardType="numeric" value={txAmount} onChangeText={setTxAmount} />
                   </View>
                </View>
                
                <View style={styles.inputGroup}>
                   <Text style={[styles.label, { color: theme.text }]}>Category</Text>
                   {txType === 'expense' && budgets.length === 0 ? (
                       <Text style={{fontFamily: 'Inter_400Regular', color: theme.subtext, fontSize: 13}}>You must add a budget category first.</Text>
                   ) : (
                       <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8}}>
                          {(txType === 'expense' ? budgets.map(b=>b.name) : INCOME_CATEGORIES).map(cat => (
                              <TouchableOpacity 
                                 key={cat} 
                                 style={[styles.categoryChip, { backgroundColor: theme.chipBg }, txCategory === cat && styles.categoryChipActive]}
                                 onPress={() => setTxCategory(cat)}
                               >
                                 <Text style={[styles.categoryChipText, { color: txCategory === cat ? '#FFF' : theme.text }]}>{cat}</Text>
                              </TouchableOpacity>
                          ))}
                       </ScrollView>
                   )}
                </View>

                <View style={styles.inputGroup}>
                   <Text style={[styles.label, { color: theme.text }]}>Description</Text>
                   <TextInput style={[styles.input, { backgroundColor: theme.card, color: theme.inputText }]} placeholderTextColor={theme.placeholder} placeholder="e.g. Lunch at KFC" value={txDesc} onChangeText={setTxDesc} />
                </View>

                <View style={styles.inputGroup}>
                   <Text style={[styles.label, { color: theme.text }]}>Date</Text>
                   <TextInput style={[styles.input, { backgroundColor: theme.card, color: theme.inputText }]} placeholderTextColor={theme.placeholder} placeholder="YYYY-MM-DD" value={txDate} onChangeText={setTxDate} />
                </View>

                <TouchableOpacity style={[styles.saveBtn, { backgroundColor: isDark ? '#D9F15D' : '#000' }]} onPress={handleAddTransaction} disabled={isSaving || (txType === 'expense' && !txCategory)}>
                   {isSaving ? <ActivityIndicator color={isDark ? '#000' : '#FFF'} /> : <Text style={[styles.saveBtnText, { color: isDark ? '#000' : '#FFF' }]}>Save Transaction</Text>}
                </TouchableOpacity>
             </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Budget Bottom Sheet */}
      <Modal animationType="slide" transparent={true} visible={isAddBudgetVisible} onRequestClose={() => setIsAddBudgetVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.bg }]}>
             <View style={styles.modalHeader}>
                 <Text style={[styles.modalTitle, { color: theme.text }]}>Add Budget Category</Text>
                 <TouchableOpacity onPress={() => setIsAddBudgetVisible(false)}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity>
             </View>
             <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.inputGroup}>
                   <Text style={[styles.label, { color: theme.text }]}>Category Name</Text>
                   <TextInput style={[styles.input, { backgroundColor: theme.card, color: theme.inputText }]} placeholderTextColor={theme.placeholder} placeholder="e.g. Subscriptions" value={budgetName} onChangeText={setBudgetName} />
                </View>

                <View style={styles.inputGroup}>
                   <Text style={[styles.label, { color: theme.text }]}>Monthly Limit</Text>
                   <View style={[styles.inputWithIcon, { backgroundColor: theme.card }]}>
                      <Text style={[styles.currencySymbol, { color: theme.text }]}>$</Text>
                      <TextInput style={[styles.inputInner, { color: theme.inputText }]} placeholderTextColor={theme.placeholder} placeholder="0" keyboardType="numeric" value={budgetLimit} onChangeText={setBudgetLimit} />
                   </View>
                </View>

                <View style={styles.inputGroup}>
                   <Text style={[styles.label, { color: theme.text }]}>Select Color</Text>
                   <View style={styles.colorRow}>
                      {PRESET_COLORS.map(color => (
                          <TouchableOpacity 
                             key={color} 
                             onPress={() => setBudgetColor(color)}
                             style={[styles.colorCircle, {backgroundColor: color, borderWidth: budgetColor === color ? 3 : 0, borderColor: '#000'}]} 
                          />
                      ))}
                   </View>
                </View>

                <TouchableOpacity style={[styles.saveBtn, { backgroundColor: isDark ? '#D9F15D' : '#000' }]} onPress={handleAddBudget} disabled={isSaving}>
                   {isSaving ? <ActivityIndicator color={isDark ? '#000' : '#FFF'} /> : <Text style={[styles.saveBtnText, { color: isDark ? '#000' : '#FFF' }]}>Create Budget</Text>}
                </TouchableOpacity>
             </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Original Milestones Create Modal */}
      <Modal animationType="slide" transparent={true} visible={isModalVisible} onRequestClose={() => setIsModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.bg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Set Milestone</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Title</Text>
                <TextInput style={[styles.input, { backgroundColor: theme.card, color: theme.inputText }]} placeholderTextColor={theme.placeholder} placeholder="e.g. Fees" value={newGoalTitle} onChangeText={setNewGoalTitle} />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Target (₵)</Text>
                <TextInput style={[styles.input, { backgroundColor: theme.card, color: theme.inputText }]} placeholderTextColor={theme.placeholder} placeholder="e.g. 1000" keyboardType="numeric" value={newGoalAmount} onChangeText={setNewGoalAmount} />
              </View>
              <View style={[styles.switchRow, { backgroundColor: theme.card }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: theme.text }]}>Auto-Allocation</Text>
                  <Text style={[styles.switchSub, { color: theme.subtext }]}>Deduct on each top-up.</Text>
                </View>
                <Switch value={isAutoAllocEnabled} onValueChange={setIsAutoAllocEnabled} trackColor={{ false: theme.border, true: isDark ? '#D9F15D' : '#000' }} />
              </View>
              {isAutoAllocEnabled && (
                <TextInput style={[styles.input, { marginTop: 10, backgroundColor: theme.card, color: theme.inputText }]} placeholderTextColor={theme.placeholder} placeholder="₵ per top-up" keyboardType="numeric" value={allocationAmount} onChangeText={setAllocationAmount} />
              )}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { marginTop: 20, color: theme.text }]}>Lock Duration</Text>
                <View style={styles.lockRow}>
                  {[7, 30, 90].map(d => (
                    <TouchableOpacity key={d} onPress={() => setLockDays(d)} style={[styles.lockBtn, { backgroundColor: theme.card }, lockDays === d && styles.lockBtnActive]}>
                      <Text style={[styles.lockBtnText, { color: lockDays === d ? '#FFF' : theme.text }]}>{d}d</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <TouchableOpacity style={[styles.priorityToggle, { backgroundColor: theme.card }]} onPress={() => setIsPriority(!isPriority)}>
                <Ionicons name={isPriority ? "star" : "star-outline"} size={20} color={isPriority ? theme.text : theme.subtext} />
                <Text style={[styles.priorityText, { color: theme.text }]}>Priority focus</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: isDark ? '#D9F15D' : '#000' }]} onPress={handleCreateGoal} disabled={creating}>
                {creating ? <ActivityIndicator color={isDark ? '#000' : '#FFF'} /> : <Text style={[styles.saveBtnText, { color: isDark ? '#000' : '#FFF' }]}>Activate Milestone</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Bottom Navigation */}
      <View style={[styles.tabBar, { backgroundColor: theme.tabBar, borderTopColor: theme.border }]}>
        <TouchableOpacity style={styles.tabItem} onPress={() => router.push('/dashboard')}>
          <Ionicons name="home-outline" size={22} color={theme.tabIcon} />
          <Text style={[styles.tabText, { color: theme.tabIcon }]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => router.push('/messages')}>
          <Ionicons name="chatbubble-ellipses-outline" size={22} color={theme.tabIcon} />
          <Text style={[styles.tabText, { color: theme.tabIcon }]}>Messages</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => router.push('/marketplace')}>
          <Ionicons name="storefront-outline" size={22} color={theme.tabIcon} />
          <Text style={[styles.tabText, { color: theme.tabIcon }]}>Marketplace</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <View style={[styles.activeTabIconBg, { backgroundColor: isDark ? '#D9F15D' : '#000' }]}>
             <Ionicons name="wallet" size={20} color={isDark ? '#000' : '#FFF'} />
          </View>
          <Text style={[styles.activeTabText, { color: theme.text }]}>Hub</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => router.push('/profile')}>
          <Feather name="user" size={22} color={theme.tabIcon} />
          <Text style={[styles.tabText, { color: theme.tabIcon }]}>Profile</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 24, letterSpacing: -0.5 },
  addBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 10 },
  
  balanceCard: { borderRadius: 24, padding: 25, marginBottom: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 15, elevation: 5 },
  balanceLabel: { fontFamily: 'Inter_400Regular', fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 8 },
  balanceAmount: { fontFamily: 'Inter_700Bold', fontSize: 40, color: '#FFF', letterSpacing: -1, marginBottom: 25 },
  balanceMetricsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metricBox: { flex: 1 },
  metricHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  metricLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  metricValue: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#FFF' },
  metricDiv: { width: 1, height: 35, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 20 },

  cardSection: { marginBottom: 30 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  linkText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  
  chartContainer: { borderRadius: 20, padding: 15, alignItems: 'center', elevation: 2 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 14, textAlign: 'center', marginTop: 10, paddingVertical: 10 },

  budgetCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5 },
  budgetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  budgetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  colorDot: { width: 14, height: 14, borderRadius: 7 },
  budgetName: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  budgetProgressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
  budgetAmount: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  budgetLimitText: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  alertBadge: { backgroundColor: '#FF3B30', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  alertText: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#FFF' },
  progressBarBg: { height: 8, backgroundColor: '#F2F2F7', borderRadius: 4, marginBottom: 10, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  budgetFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  budgetPercentage: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#8E8E93' },
  budgetRemaining: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#8E8E93' },

  ledger: { borderRadius: 16, padding: 16 },
  txItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1 },
  txLeft: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  txIconBg: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  txDesc: { fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 2 },
  txCategory: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  txRight: { alignItems: 'flex-end', gap: 6 },
  txAmount: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  trashCircleBtn: { padding: 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#F2F2F7', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 25, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  
  tabsRow: { flexDirection: 'row', backgroundColor: '#E5E5EA', borderRadius: 12, padding: 4, marginBottom: 20 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabBtnActiveE: { backgroundColor: '#FF3B30' },
  tabBtnActiveI: { backgroundColor: '#32D74B' },
  tabBtnText: { fontFamily: 'Inter_700Bold', fontSize: 14 },

  inputGroup: { marginBottom: 15 },
  label: { fontFamily: 'Inter_700Bold', fontSize: 14, marginBottom: 8 },
  input: { borderRadius: 12, padding: 15, fontFamily: 'Inter_400Regular', fontSize: 16 },
  inputWithIcon: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 15 },
  currencySymbol: { fontFamily: 'Inter_700Bold', fontSize: 18, marginRight: 10 },
  inputInner: { flex: 1, paddingVertical: 15, fontFamily: 'Inter_400Regular', fontSize: 16 },
  
  categoryChip: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 20, backgroundColor: '#E5E5EA', marginRight: 8 },
  categoryChipActive: { backgroundColor: '#000' },
  categoryChipText: { fontFamily: 'Inter_700Bold', fontSize: 13 },

  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, marginTop: 5 },
  colorCircle: { width: 35, height: 35, borderRadius: 17.5 },
  
  saveBtn: { borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 10, marginBottom: 20 },
  saveBtnText: { fontFamily: 'Inter_700Bold', fontSize: 17 },

  // Milestone Preserved Styles
  emptyGoals: { padding: 30, backgroundColor: '#FFF', borderRadius: 16, alignItems: 'center', marginBottom: 25, borderStyle: 'dashed', borderWidth: 1, borderColor: '#E5E5EA' },
  emptyGoalsText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#8E8E93', marginTop: 10 },
  goalsHorizontalList: { paddingBottom: 15 },
  goalCard: { width: 160, backgroundColor: '#FFF', borderRadius: 16, padding: 15, marginRight: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10 },
  priorityCard: { borderWidth: 2, borderColor: '#D9F15D' },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  goalIconContainer: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F2F2F7', justifyContent: 'center', alignItems: 'center' },
  goalCardTitle: { fontFamily: 'Inter_700Bold', fontSize: 13, marginBottom: 4 },
  goalCardAmount: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  goalCardTarget: { fontFamily: 'Inter_400Regular', fontSize: 9, color: '#8E8E93' },
  miniProgressBarBg: { height: 6, backgroundColor: '#F2F2F7', borderRadius: 3, marginTop: 10, overflow: 'hidden' },
  miniProgressBarFill: { height: '100%', backgroundColor: '#D9F15D' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', padding: 15, borderRadius: 12, marginBottom: 10 },
  switchSub: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#8E8E93' },
  lockRow: { flexDirection: 'row', gap: 10 },
  lockBtn: { flex: 1, padding: 12, backgroundColor: '#FFF', borderRadius: 10, alignItems: 'center' },
  lockBtnActive: { backgroundColor: '#000' },
  lockBtnText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  priorityToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 15, backgroundColor: '#FFF', borderRadius: 12, marginTop: 15, marginBottom: 20 },
  priorityText: { fontFamily: 'Inter_700Bold', fontSize: 14 },

  tabBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 90, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingBottom: Platform.OS === 'ios' ? 20 : 0, borderTopWidth: 1 },
  tabItem: { alignItems: 'center', justifyContent: 'center', minWidth: 60 },
  activeTabIconBg: { width: 42, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  activeTabText: { fontFamily: 'Inter_700Bold', fontSize: 10 },
  tabText: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 4 },
});
