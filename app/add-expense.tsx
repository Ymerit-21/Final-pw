import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  TextInput, ScrollView, Platform, ActivityIndicator,
  Alert, KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { auth, db } from '../config/firebase';
import { 
  doc, updateDoc, increment, collection, 
  addDoc, serverTimestamp, getDoc,
  onSnapshot
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
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [userBalance, setUserBalance] = useState(0);
  const [budgets, setBudgets] = useState<any[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const fetchBalance = async () => {
      const snap = await getDoc(doc(db, 'users', auth.currentUser!.uid));
      if (snap.exists()) {
        setUserBalance(snap.data().balance || 0);
      }
    };
    fetchBalance();

    const budgetsUnsub = onSnapshot(collection(db, 'users', auth.currentUser.uid, 'budgets'), (snap) => {
        const fetchBudgets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setBudgets(fetchBudgets);
        if (fetchBudgets.length > 0 && !selectedCategory) {
            setSelectedCategory(fetchBudgets[0]);
        } else if (fetchBudgets.length === 0 && !selectedCategory) {
            setSelectedCategory(FALLBACK_CATEGORIES[0]);
        }
    });
    
    return () => budgetsUnsub();
  }, []);

  const handleLogExpense = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter how much you spent.');
      return;
    }

    const expenseAmount = parseFloat(amount);

    if (expenseAmount > userBalance) {
      Alert.alert(
        'Insufficient Balance', 
        `You only have GH₵ ${userBalance.toFixed(2)} in your wallet. You cannot log an expense greater than your balance.`
      );
      return;
    }

    setLoading(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      // 1. Log Transaction
      await addDoc(collection(db, 'users', uid, 'transactions'), {
        type: 'debit',
        description: description || `Spent on ${selectedCategory.name}`,
        amount: expenseAmount,
        category: selectedCategory.name,
        createdAt: serverTimestamp(),
      });

      // 2. Update Global Balance
      await updateDoc(doc(db, 'users', uid), {
        balance: increment(-expenseAmount),
        budgetUsed: increment(expenseAmount),
      });

      // 3. Directly hit the dynamic Budget target tracker if valid
      if (selectedCategory.limit) {
         await updateDoc(doc(db, 'users', uid, 'budgets', selectedCategory.id), {
           spent: increment(expenseAmount)
         });
      }

      Alert.alert('✅ Logged', 'Expense recorded successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to log expense. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={[styles.backBtn, { borderColor: theme.border, borderWidth: 1 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Log Expense</Text>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
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
                autoFocus
              />
            </View>
          </View>

          {/* Category Section */}
          <View style={styles.formSection}>
            <Text style={[styles.inputLabel, { color: theme.subtext }]}>CATEGORY</Text>
            <View style={styles.categoryGrid}>
              {(budgets.length > 0 ? budgets : FALLBACK_CATEGORIES).map(cat => {
                const isSelected = selectedCategory?.id === cat.id;
                return (
                  <TouchableOpacity 
                    key={cat.id} 
                    onPress={() => setSelectedCategory(cat)}
                    style={[
                      styles.categoryCard,
                      { backgroundColor: theme.cardAlt, borderColor: 'transparent', borderWidth: 1 },
                      isSelected && { borderColor: '#D9F15D', backgroundColor: 'rgba(217, 241, 93, 0.05)' }
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
                style={[styles.mainInput, { color: theme.text, fontSize: 18 }]}
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
            <TouchableOpacity style={[styles.selectBox, { backgroundColor: theme.cardAlt }]}>
              <Text style={[styles.selectText, { color: theme.text }]}>
                {new Date().toLocaleDateString('en-GB')}
              </Text>
              <Ionicons name="chevron-down" size={18} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* Budget Section */}
          <View style={styles.formSection}>
            <Text style={[styles.inputLabel, { color: theme.subtext }]}>Apply to budget</Text>
            <TouchableOpacity style={[styles.selectBox, { backgroundColor: theme.cardAlt }]}>
              <Text style={[styles.selectText, { color: theme.text }]}>
                {budgets.length > 0 ? 'No budget' : 'No budget'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={theme.text} />
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />

        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.saveBtn, { backgroundColor: isDark ? '#D9F15D' : '#000' }, loading && { opacity: 0.7 }]}
            onPress={handleLogExpense}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={isDark ? '#000' : '#FFF'} />
            ) : (
              <Text style={[styles.saveBtnText, { color: isDark ? '#000' : '#FFF' }]}>Save Expense</Text>
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
  
  formSection: { marginBottom: 25 },
  inputLabel: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#8E8E93', marginBottom: 10 },
  inputBox: { borderRadius: 12, padding: 16 },
  mainInput: { fontFamily: 'Inter_400Regular', fontSize: 24 },

  categoryGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 12, 
    justifyContent: 'space-between' 
  },
  categoryCard: { 
    width: '48%', 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 14, 
    borderRadius: 14,
    gap: 8
  },
  emoji: { fontSize: 18 },
  categoryName: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },

  selectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderRadius: 12,
  },
  selectText: { fontFamily: 'Inter_400Regular', fontSize: 22 },

  footer: { padding: 20 },
  saveBtn: { 
    paddingVertical: 18, 
    borderRadius: 16, 
    alignItems: 'center' 
  },
  saveBtnText: { fontFamily: 'Inter_700Bold', fontSize: 18 },
});
