import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  TextInput, ScrollView, Platform, ActivityIndicator,
  Alert, KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { auth, db } from '../config/firebase';
import { 
  doc, updateDoc, increment, collection, 
  addDoc, serverTimestamp, getDoc,
  onSnapshot, getDocs, query, where
} from 'firebase/firestore';
import { useTheme } from '../context/ThemeContext';

const FALLBACK_CATEGORIES = [
  { id: 'food', name: 'Food', emoji: '🍔', color: '#FF9500' },
  { id: 'transport', name: 'Transport', emoji: '🚗', color: '#5856D6' },
  { id: 'housing', name: 'Housing', emoji: '🏠', color: '#FF2D55' },
  { id: 'education', name: 'Education', emoji: '📚', color: '#007AFF' },
  { id: 'health', name: 'Health', emoji: '💊', color: '#32D74B' },
  { id: 'other', name: 'Other', emoji: '📦', color: '#D9F15D' },
];

export default function AddExpenseScreen() {
  const router = useRouter();
  const { isDark, theme } = useTheme();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<any>(FALLBACK_CATEGORIES[0]);
  const [loading, setLoading] = useState(false);
  const [userBalance, setUserBalance] = useState(0);
  const [budgets, setBudgets] = useState<any[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    const fetchBalance = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', uid));
        if (snap.exists()) {
          setUserBalance(snap.data().balance || 0);
        }
      } catch (e) { /* silent */ }
    };
    fetchBalance();

    const budgetsUnsub = onSnapshot(
      collection(db, 'users', uid, 'budgets'),
      (snap) => {
        const fetchedBudgets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setBudgets(fetchedBudgets);
      },
      () => { /* silent */ }
    );
    
    return () => budgetsUnsub();
  }, []);

  const handleLogExpense = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      if (Platform.OS === 'web') {
        window.alert('Please enter a valid amount.');
      } else {
        Alert.alert('Invalid Amount', 'Please enter how much you spent.');
      }
      return;
    }

    const expenseAmount = parseFloat(amount);

    if (expenseAmount > userBalance) {
      if (Platform.OS === 'web') {
        window.alert(`Insufficient balance. You only have ₵${userBalance.toFixed(2)}.`);
      } else {
        Alert.alert('Insufficient Balance', `You only have ₵${userBalance.toFixed(2)} in your wallet.`);
      }
      return;
    }

    if (!selectedCategory) {
      if (Platform.OS === 'web') {
        window.alert('Please select a category.');
      } else {
        Alert.alert('No Category', 'Please select a category.');
      }
      return;
    }

    setLoading(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const today = new Date().toISOString().split('T')[0];

      // 1. Write the transaction (feeds Line Chart + transaction list)
      await addDoc(collection(db, 'users', uid, 'transactions'), {
        type: 'debit',
        description: description.trim() || `Spent on ${selectedCategory.name}`,
        amount: expenseAmount,
        category: selectedCategory.name,
        date: today,
        createdAt: serverTimestamp(),
      });

      // 2. Decrement user wallet balance
      await updateDoc(doc(db, 'users', uid), {
        balance: increment(-expenseAmount),
        budgetUsed: increment(expenseAmount),
      });

      // 3. Find or auto-create a matching budget entry
      //    This feeds the Bar Chart and Pie Chart in Financial Hub
      const budgetsSnap = await getDocs(collection(db, 'users', uid, 'budgets'));
      const existingBudget = budgetsSnap.docs.find(
        d => d.data().name?.toLowerCase() === selectedCategory.name.toLowerCase()
      );

      if (existingBudget) {
        // Budget exists — just increment spent
        await updateDoc(doc(db, 'users', uid, 'budgets', existingBudget.id), {
          spent: increment(expenseAmount),
        });
      } else {
        // Auto-create a budget entry so charts populate immediately
        await addDoc(collection(db, 'users', uid, 'budgets'), {
          name: selectedCategory.name,
          limit: 300,          // sensible student default
          spent: expenseAmount,
          color: selectedCategory.color || '#D9F15D',
          createdAt: serverTimestamp(),
        });
      }

      if (Platform.OS === 'web') {
        window.alert('Expense logged successfully!');
        router.back();
      } else {
        Alert.alert('✅ Logged', 'Expense recorded successfully!', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      }
    } catch (err) {
      console.error(err);
      if (Platform.OS === 'web') {
        window.alert('Failed to log expense. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to log expense. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const categories = budgets.length > 0 ? budgets : FALLBACK_CATEGORIES;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backBtn, { borderColor: theme.border, borderWidth: 1 }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Log Expense</Text>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          
          {/* Amount Section */}
          <View style={styles.formSection}>
            <Text style={[styles.inputLabel, { color: theme.subtext }]}>Amount (₵)</Text>
            <View style={[styles.inputBox, { backgroundColor: theme.cardAlt }]}>
              <TextInput
                style={[styles.mainInput, { color: theme.text }]}
                placeholder="0.00"
                placeholderTextColor={theme.placeholder}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                autoFocus={Platform.OS !== 'web'}
              />
            </View>
          </View>

          {/* Category Section */}
          <View style={styles.formSection}>
            <Text style={[styles.inputLabel, { color: theme.subtext }]}>CATEGORY</Text>
            <View style={styles.categoryGrid}>
              {categories.map(cat => {
                const isSelected = selectedCategory?.id === cat.id;
                return (
                  <TouchableOpacity 
                    key={cat.id} 
                    onPress={() => setSelectedCategory(cat)}
                    style={[
                      styles.categoryCard,
                      { backgroundColor: theme.cardAlt, borderColor: 'transparent', borderWidth: 1.5 },
                      isSelected && { borderColor: isDark ? '#D9F15D' : '#000', backgroundColor: isDark ? 'rgba(217,241,93,0.08)' : 'rgba(0,0,0,0.04)' }
                    ]}
                  >
                    <Text style={styles.emoji}>{cat.emoji || '💰'}</Text>
                    <Text style={[styles.categoryName, { color: theme.text }]}>{cat.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Description Section */}
          <View style={styles.formSection}>
            <Text style={[styles.inputLabel, { color: theme.subtext }]}>Description</Text>
            <View style={[styles.inputBox, { backgroundColor: theme.cardAlt }]}>
              <TextInput
                style={[styles.descInput, { color: theme.text }]}
                placeholder="What did you spend on?"
                placeholderTextColor={theme.placeholder}
                value={description}
                onChangeText={setDescription}
              />
            </View>
          </View>

          {/* Date Section */}
          <View style={styles.formSection}>
            <Text style={[styles.inputLabel, { color: theme.subtext }]}>Date</Text>
            <View style={[styles.selectBox, { backgroundColor: theme.cardAlt }]}>
              <Text style={[styles.selectText, { color: theme.text }]}>
                {new Date().toLocaleDateString('en-GB')}
              </Text>
              <Ionicons name="chevron-down" size={18} color={theme.subtext} />
            </View>
          </View>

          {/* Balance preview */}
          <View style={styles.balanceRow}>
            <Ionicons name="information-circle-outline" size={15} color={theme.subtext} />
            <Text style={[styles.balanceText, { color: theme.subtext }]}>
              Balance after: GH₵{(userBalance - (parseFloat(amount) || 0)).toFixed(2)}
            </Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <TouchableOpacity 
            style={[
              styles.saveBtn,
              { backgroundColor: isDark ? '#D9F15D' : '#000' },
              loading && { opacity: 0.6 }
            ]}
            onPress={handleLogExpense}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={isDark ? '#000' : '#FFF'} />
            ) : (
              <Text style={[styles.saveBtnText, { color: isDark ? '#000' : '#FFF' }]}>
                Save Expense
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 15,
    gap: 15
  },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 24 },
  backBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  
  scrollContent: { paddingHorizontal: 20, paddingTop: 10 },
  
  formSection: { marginBottom: 24 },
  inputLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginBottom: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase'
  },
  inputBox: { borderRadius: 14, padding: 16 },
  mainInput: { fontFamily: 'Inter_400Regular', fontSize: 28 },
  descInput: { fontFamily: 'Inter_400Regular', fontSize: 18 },

  categoryGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 12,
  },
  categoryCard: { 
    width: '47%', 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 14, 
    borderRadius: 14,
    gap: 10
  },
  emoji: { fontSize: 20 },
  categoryName: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },

  selectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderRadius: 14,
  },
  selectText: { fontFamily: 'Inter_400Regular', fontSize: 20 },

  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    marginBottom: 10,
  },
  balanceText: { fontFamily: 'Inter_400Regular', fontSize: 13 },

  footer: { padding: 20, borderTopWidth: StyleSheet.hairlineWidth },
  saveBtn: { 
    paddingVertical: 18, 
    borderRadius: 16, 
    alignItems: 'center' 
  },
  saveBtnText: { fontFamily: 'Inter_700Bold', fontSize: 18 },
});
