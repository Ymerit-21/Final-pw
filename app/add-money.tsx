import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { auth } from '../config/firebase';
import { db } from '../config/firebase';
import { doc, updateDoc, increment, collection, addDoc, serverTimestamp, query, getDocs, getDoc } from 'firebase/firestore';
import { useTheme } from '../context/ThemeContext';

const PAYSTACK_SECRET = 'sk_test_f3acf7738a69ef2f04a191d3f90dbfdc0082af54';

const PROVIDER_MAP: Record<string, string> = {
  mtn: 'mtn',
  vodafone: 'vod',
  airteltigo: 'atl',
};

const NETWORKS = [
  { id: 'mtn', label: 'MTN Mobile Money', color: '#FFCC00', logo: require('../assets/images/mtn_logo.png') },
  { id: 'vodafone', label: 'Vodafone Cash', color: '#E60000', logo: require('../assets/images/vodafone_logo.png') },
  { id: 'airteltigo', label: 'AirtelTigo Money', color: '#FF6600', logo: require('../assets/images/airteltigo_logo.png') },
];

const QUICK_AMOUNTS = ['GH₵ 50', 'GH₵ 100', 'GH₵ 200', 'GH₵ 500'];

export default function AddMoneyScreen() {
  const router = useRouter();
  const { isDark, theme } = useTheme();
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentBalance, setCurrentBalance] = useState(0);

  const handleQuickAmount = (val: string) => {
    setAmount(val.replace('GH₵ ', ''));
  };

  React.useEffect(() => {
    const fetchBalance = async () => {
      if (!auth.currentUser) return;
      const snap = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (snap.exists()) {
        setCurrentBalance(snap.data().balance || 0);
      }
    };
    fetchBalance();
  }, []);

  const handleProceed = async () => {
    if (!selectedNetwork) {
      Alert.alert('Select Network', 'Please select your mobile money network.');
      return;
    }
    if (!phone || phone.length < 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit phone number.');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }

    const userEmail = auth.currentUser?.email;
    if (!userEmail) {
      Alert.alert('Error', 'Could not get your account email. Please re-login.');
      return;
    }

    setLoading(true);

    try {
      const amountInPesewas = Math.round(parseFloat(amount) * 100);

      const response = await fetch('https://api.paystack.co/charge', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userEmail,
          amount: amountInPesewas,
          currency: 'GHS',
          mobile_money: {
            phone,
            provider: PROVIDER_MAP[selectedNetwork],
          },
        }),
      });

      const data = await response.json();
      console.log('Paystack response:', JSON.stringify(data));

      if (data.status === true) {
        const chargeStatus = data.data?.status;
        const displayText = data.data?.display_text || data.data?.message || '';
        const reference = data.data?.reference;

        if (chargeStatus === 'pay_offline' || chargeStatus === 'send_otp' || chargeStatus === 'pending') {
          // Record the pending transaction in Firestore
          await addDoc(collection(db, 'users', auth.currentUser!.uid, 'transactions'), {
            type: 'credit',
            description: `MoMo Deposit (${networkName})`,
            amount: parseFloat(amount),
            reference: reference,
            status: 'pending',
            createdAt: serverTimestamp(),
          });
          
          // --- Auto-Allocation Logic ---
          try {
            const goalsRef = collection(db, 'users', auth.currentUser!.uid, 'goals');
            const q = query(goalsRef);
            const goalsSnap = await getDocs(q);
            
            for (const goalDoc of goalsSnap.docs) {
              const goalData = goalDoc.data();
              if (goalData.autoAllocation > 0) {
                const current = goalData.currentAmount || 0;
                const target = goalData.targetAmount || 0;
                const alloc = Math.min(goalData.autoAllocation, parseFloat(amount));
                
                await updateDoc(doc(db, 'users', auth.currentUser!.uid, 'goals', goalDoc.id), {
                  currentAmount: increment(alloc)
                });
                
                // Check for Goal Completion
                if (current < target && (current + alloc) >= target) {
                  await addDoc(collection(db, 'users', auth.currentUser!.uid, 'notifications'), {
                    type: 'success',
                    title: 'Goal Achieved! 🏆',
                    body: `Congratulations! You have reached your target for "${goalData.title}".`,
                    read: false,
                    createdAt: serverTimestamp(),
                  });
                }

                // Log allocation transaction
                await addDoc(collection(db, 'users', auth.currentUser!.uid, 'transactions'), {
                  type: 'debit',
                  description: `Goal Allocation: ${goalData.title}`,
                  amount: alloc,
                  status: 'success',
                  createdAt: serverTimestamp(),
                });
              }
            }
          } catch (allocError) {
            console.error("Auto-allocation failed:", allocError);
          }
          // ----------------------------

          // Optimistically update balance
          await updateDoc(doc(db, 'users', auth.currentUser!.uid), {
            balance: increment(parseFloat(amount)),
          });
          Alert.alert(
            '✅ Payment Prompt Sent!',
            `A payment request of GH₵ ${parseFloat(amount).toFixed(2)} has been sent to ${phone}.\n\n${displayText || 'Please check your phone and approve the payment.'}\n\nRef: ${reference}`,
            [{ text: 'OK', onPress: () => router.back() }]
          );
        } else if (chargeStatus === 'success') {
          Alert.alert(
            '🎉 Payment Successful!',
            `GH₵ ${parseFloat(amount).toFixed(2)} has been added successfully.`,
            [{ text: 'OK', onPress: () => router.back() }]
          );
        } else {
          Alert.alert('Payment Status', `Status: ${chargeStatus}\n${displayText}`);
        }
      } else {
        Alert.alert('Payment Failed', data.message || 'Something went wrong. Please try again.');
      }
    } catch (error: any) {
      console.error('Paystack error:', error);
      Alert.alert('Error', 'Could not connect to payment service. Check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  const networkName = NETWORKS.find(n => n.id === selectedNetwork)?.label;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color={theme.text} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: theme.text }]}>Add Money</Text>
              <View style={{ width: 34 }} />
            </View>

            {/* Balance Summary Card */}
            <View style={[styles.balanceCard, { backgroundColor: isDark ? '#1C1C1E' : '#000000' }]}>
              <Text style={styles.balanceLabel}>Current Balance</Text>
              <Text style={styles.balanceAmount}>GH₵ {currentBalance.toFixed(2)}</Text>
            </View>

            {/* Step 1: Select Network */}
            <Text style={[styles.sectionLabel, { color: theme.text }]}>1. Select Network</Text>
            <View style={styles.networkGrid}>
              {NETWORKS.map((network) => (
                <TouchableOpacity
                  key={network.id}
                  style={[
                    styles.networkCard,
                    { backgroundColor: theme.card, borderColor: theme.border },
                    selectedNetwork === network.id && [styles.networkCardActive, { backgroundColor: isDark ? '#D9F15D' : '#0F0F0F', borderColor: isDark ? '#D9F15D' : '#0F0F0F' }],
                  ]}
                  activeOpacity={0.7}
                  onPress={() => setSelectedNetwork(network.id)}
                >
                  {network.logo ? (
                    <Image source={network.logo} style={styles.networkLogo} resizeMode="contain" />
                  ) : (
                    <View style={[styles.networkDot, { backgroundColor: network.color }]} />
                  )}
                  <Text
                    style={[
                      styles.networkLabel,
                      { color: theme.text },
                      selectedNetwork === network.id && [styles.networkLabelActive, { color: isDark ? '#000' : '#FFF' }],
                    ]}
                    numberOfLines={2}
                  >
                    {network.label}
                  </Text>
                  {selectedNetwork === network.id && (
                    <Ionicons name="checkmark-circle" size={18} color={isDark ? '#000' : '#FFF'} style={styles.networkCheck} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Step 2: Phone Number */}
            <Text style={[styles.sectionLabel, { color: theme.text }]}>2. Mobile Money Number</Text>
            <View style={[styles.inputWrapper, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={[styles.prefixBox, { backgroundColor: theme.cardAlt, borderRightColor: theme.border }]}>
                <Text style={[styles.prefixText, { color: theme.text }]}>🇬🇭 +233</Text>
              </View>
              <TextInput
                style={[styles.phoneInput, { color: theme.inputText }]}
                placeholder="0XX XXX XXXX"
                placeholderTextColor={theme.placeholder}
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={setPhone}
              />
            </View>

            {/* Step 3: Amount */}
            <Text style={[styles.sectionLabel, { color: theme.text }]}>3. Enter Amount</Text>
            <View style={[styles.amountInputWrapper, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.currencyPrefix, { color: theme.text }]}>GH₵</Text>
              <TextInput
                style={[styles.amountInput, { color: theme.inputText }]}
                placeholder="0.00"
                placeholderTextColor={theme.placeholder}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
              />
            </View>

            {/* Quick Amount Buttons */}
            <View style={styles.quickAmountRow}>
              {QUICK_AMOUNTS.map((q) => (
                <TouchableOpacity
                  key={q}
                  style={[
                    styles.quickAmountBtn,
                    { backgroundColor: theme.card, borderColor: theme.border },
                    amount === q.replace('GH₵ ', '') && [styles.quickAmountBtnActive, { backgroundColor: isDark ? '#D9F15D' : '#0F0F0F', borderColor: isDark ? '#D9F15D' : '#0F0F0F' }]
                  ]}
                  onPress={() => handleQuickAmount(q)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.quickAmountText,
                    { color: theme.text },
                    amount === q.replace('GH₵ ', '') && [styles.quickAmountTextActive, { color: isDark ? '#000' : '#FFF' }]
                  ]}>
                    {q}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Summary — always visible */}
            <View style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: theme.divider }]}>
              <Text style={[styles.summaryTitle, { color: theme.text }]}>Transaction Summary</Text>
              <View style={[styles.summaryRow, { borderBottomColor: theme.divider }]}>
                <Text style={[styles.summaryKey, { color: theme.subtext }]}>Network</Text>
                <Text style={[styles.summaryVal, { color: theme.text }]}>{networkName || '—'}</Text>
              </View>
              <View style={[styles.summaryRow, { borderBottomColor: theme.divider }]}>
                <Text style={[styles.summaryKey, { color: theme.subtext }]}>Phone</Text>
                <Text style={[styles.summaryVal, { color: theme.text }]}>{phone.length >= 10 ? phone : '—'}</Text>
              </View>
              <View style={[styles.summaryRow, { borderBottomColor: theme.divider }]}>
                <Text style={[styles.summaryKey, { color: theme.subtext }]}>Amount</Text>
                <Text style={[styles.summaryVal, { color: theme.text }]}>
                  {amount && parseFloat(amount) > 0 ? `GH₵ ${parseFloat(amount).toFixed(2)}` : '—'}
                </Text>
              </View>
              <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
                <Text style={[styles.summaryKey, { color: theme.subtext }]}>Fee</Text>
                <Text style={[styles.summaryVal, { color: theme.text }]}>GH₵ 0.00</Text>
              </View>
            </View>

            <View style={{ height: 30 }} />

          </ScrollView>

          {/* Proceed Button pinned at bottom */}
          <View style={[styles.footer, { backgroundColor: theme.bg, borderTopColor: theme.divider }]}>
            <TouchableOpacity
              style={[styles.proceedBtn, { backgroundColor: isDark ? '#D9F15D' : '#0F0F0F' }, loading && { opacity: 0.7 }]}
              onPress={handleProceed}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={isDark ? '#000' : '#FFF'} />
              ) : (
                <Text style={[styles.proceedBtnText, { color: isDark ? '#000' : '#FFF' }]}>Proceed to Pay</Text>
              )}
            </TouchableOpacity>
          </View>

        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  backBtn: {
    padding: 5,
    marginLeft: -5,
  },
  headerTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
  },
  balanceCard: {
    borderRadius: 20,
    paddingVertical: 25,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 30,
  },
  balanceLabel: {
    fontFamily: 'Helvetica',
    fontSize: 13,
    color: '#AAAAAA',
    marginBottom: 8,
  },
  balanceAmount: {
    fontFamily: 'Inter_700Bold',
    fontSize: 36,
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  sectionLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    marginBottom: 12,
  },
  networkGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  networkCard: {
    borderRadius: 16,
    borderWidth: 1,
    width: '31%',
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    position: 'relative',
  },
  networkCardActive: {
    borderWidth: 1,
  },
  networkDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginBottom: 8,
  },
  networkLogo: {
    width: 44,
    height: 44,
    borderRadius: 8,
    marginBottom: 8,
  },
  networkLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
  },
  networkLabelActive: { },
  networkCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 25,
    overflow: 'hidden',
    minHeight: 72,
    alignItems: 'center',
  },
  prefixBox: {
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignSelf: 'stretch',
    alignItems: 'center',
    borderRightWidth: 1,
  },
  prefixText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 15,
    fontSize: 16,
    fontFamily: 'Poppins_400Regular',
  },
  amountInputWrapper: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 15,
    alignItems: 'center',
    paddingHorizontal: 15,
    minHeight: 72,
  },
  currencyPrefix: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    paddingVertical: 16,
    letterSpacing: -1,
  },
  quickAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  quickAmountBtn: {
    borderRadius: 30,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  quickAmountBtnActive: {
    borderWidth: 1,
  },
  quickAmountText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
  },
  quickAmountTextActive: { },
  summaryCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
  },
  summaryTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    marginBottom: 15,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  summaryKey: {
    fontFamily: 'Helvetica',
    fontSize: 14,
  },
  summaryVal: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    paddingTop: 15,
    borderTopWidth: 1,
  },
  proceedBtn: {
    borderRadius: 50,
    paddingVertical: 18,
    alignItems: 'center',
  },
  proceedBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
  },
});
