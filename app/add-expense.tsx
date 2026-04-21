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
  { id: 'fees', name: 'Tuition Fees', icon: 'school-outline', color: '#D9F15D' },
  { id: 'service', name: 'Service Capital', icon: 'briefcase-outline', color: '#D9F15D' },
  { id: 'emergency', name: 'Emergency Fund', icon: 'shield-checkmark-outline', color: '#D9F15D' },
  { id: 'personal', name: 'Personal Life', icon: 'heart-outline', color: '#D9F15D' },
  { id: 'custom', name: 'Custom Goal', icon: 'flag-outline', color: '#D9F15D' },
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
      
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={28} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Log Expense</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          <View style={styles.amountSection}>
            <Text style={[styles.amountLabel, { color: theme.subtext }]}>How much did you spend?</Text>
            <View style={styles.amountInptWrapper}>
              <Text style={[styles.currency, { color: theme.text }]}>GH₵</Text>
              <TextInput
                style={[styles.amountInput, { color: theme.text }]}
                placeholder="0"
                placeholderTextColor={theme.placeholder}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                autoFocus
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
              {(budgets.length > 0 ? budgets : FALLBACK_CATEGORIES).map(cat => (
                <TouchableOpacity 
                  key={cat.id} 
                  onPress={() => setSelectedCategory(cat)}
                  style={[
                    styles.catPill,
                    { backgroundColor: theme.cardAlt, borderColor: theme.border },
                    selectedCategory?.id === cat.id && { backgroundColor: cat.color || '#000', borderColor: cat.color || '#000' }
                  ]}
                >
                  {cat.icon && (
                      <Ionicons 
                        name={cat.icon as any} 
                        size={16} 
                        color={selectedCategory?.id === cat.id ? "#FFF" : theme.text} 
                      />
                  )}
                  <Text style={[
                    styles.catText,
                    { color: theme.text },
                    selectedCategory?.id === cat.id && { color: "#FFF" }
                  ]}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Note (Optional)</Text>
            <TextInput
              style={[styles.noteInput, { backgroundColor: theme.cardAlt, borderColor: theme.border, color: theme.inputText }]}
              placeholder="What was this for? (e.g. Lunch at SRC)"
              placeholderTextColor={theme.placeholder}
              value={description}
              onChangeText={setDescription}
            />
          </View>

          <View style={styles.balanceInfo}>
            <Ionicons name="information-circle-outline" size={16} color={theme.subtext} />
            <Text style={[styles.balanceInfoText, { color: theme.subtext }]}>
              Balance after: GH₵ {(userBalance - (parseFloat(amount) || 0)).toFixed(2)}
            </Text>
          </View>

        </ScrollView>

        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <TouchableOpacity 
            style={[styles.saveBtn, { backgroundColor: isDark ? '#D9F15D' : '#000' }, loading && { opacity: 0.7 }]}
            onPress={handleLogExpense}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={isDark ? '#000' : '#FFF'} />
            ) : (
              <Text style={[styles.saveBtnText, { color: isDark ? '#000' : '#FFF' }]}>Log Expense Now</Text>
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
    justifyContent: 'space-between', 
    paddingHorizontal: 20, 
    paddingVertical: 15,
    borderBottomWidth: 1
  },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  backBtn: { padding: 5 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 30 },
  amountSection: { alignItems: 'center', marginBottom: 40 },
  amountLabel: { fontFamily: 'Inter_400Regular', fontSize: 14, marginBottom: 15 },
  amountInptWrapper: { flexDirection: 'row', alignItems: 'center' },
  currency: { fontFamily: 'Inter_700Bold', fontSize: 32, marginRight: 10 },
  amountInput: { 
    fontFamily: 'Inter_700Bold', 
    fontSize: 56, 
    minWidth: 100,
    textAlign: 'center'
  },
  section: { marginBottom: 30 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, marginBottom: 15 },
  catScroll: { marginHorizontal: -20, paddingHorizontal: 20 },
  catPill: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 25, 
    borderWidth: 1, 
    marginRight: 10,
    gap: 8
  },
  catText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  noteInput: { 
    borderRadius: 15, 
    padding: 18, 
    fontFamily: 'Inter_400Regular', 
    fontSize: 15,
    borderWidth: 1
  },
  balanceInfo: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    justifyContent: 'center',
    marginTop: 10
  },
  balanceInfoText: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  footer: { padding: 20, borderTopWidth: 1 },
  saveBtn: { 
    paddingVertical: 18, 
    borderRadius: 20, 
    alignItems: 'center' 
  },
  saveBtnText: { fontFamily: 'Inter_700Bold', fontSize: 16 },
});
