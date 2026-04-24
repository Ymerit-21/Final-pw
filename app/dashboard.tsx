import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  Platform, ActivityIndicator, Alert, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { 
  doc, onSnapshot, collection, query, orderBy, limit, Timestamp,
  Unsubscribe, where
} from 'firebase/firestore';
import { Stack, useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { generateH3 } from '../hooks/useGeospatial';
import { auth, db, registerListener, clearAllListeners, sessionState, resetSession } from '../config/firebase';
import { useTheme } from '../context/ThemeContext';

interface Transaction {
  id: string;
  type: 'credit' | 'debit' | 'income' | 'expense';
  description: string;
  amount: number;
  date: string;
  category?: string;
}

interface UserData {
  name: string;
  balance: number;
  walletBalance?: number;
  budgetGoal: number;
  budgetUsed: number;
  financialScore: number;
  avatarColor?: string;
  isExpert?: boolean;
  isVerified?: boolean;
  status?: 'online' | 'offline';
  role?: 'student' | 'admin' | 'work' | 'hire';
}

export default function DashboardScreen() {
  const router = useRouter();
  const { isDark, theme } = useTheme();
  const [userData, setUserData] = useState<UserData>({
    name: '',
    balance: 0,
    budgetGoal: 0,
    budgetUsed: 0,
    financialScore: 85,
    avatarColor: '#D9F15D',
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [featuredExperts, setFeaturedExperts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [priorityGoal, setPriorityGoal] = useState<any>(null);
  const SUPER_ADMIN_EMAIL = 'adminspw@test.com';
  const [isAdmin, setIsAdmin] = useState(auth.currentUser?.email === SUPER_ADMIN_EMAIL);
  const [adminStats, setAdminStats] = useState({ 
    totalUsers: 0, 
    totalExperts: 0, 
    pendingVerifications: 0,
    totalVolume: 0,
    newUsersToday: 0
  });

  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    // Real-time listener for user profile & balance
    const userUnsub = registerListener(onSnapshot(doc(db, 'users', uid), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setUserData({
          name: d.name || 'User',
          balance: d.balance || 0,
          budgetUsed: d.budgetUsed || 0,
          budgetGoal: d.budgetGoal || 0,
          financialScore: d.financialScore || 85,
          avatarColor: d.color || '#D9F15D',
          isExpert: d.isExpert || false,
          isVerified: d.isVerified || false,
          role: d.role || 'hire',
        });
        setIsAdmin(auth.currentUser?.email === SUPER_ADMIN_EMAIL || d.role === 'admin');
        setIsOnline(d.status === 'online');
      }
      setLoading(false);
    }, (err) => {
      setLoading(false);
      // Absolute suppression of permission errors or session end
      if (err.code === 'permission-denied' || sessionState.isEnding) return;
      console.error("User Snapshot Error:", err);
    }));

    // Real-time listener for last 5 transactions
    const txQuery = query(
      collection(db, 'users', uid, 'transactions'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const txUnsub = registerListener(onSnapshot(txQuery, (snap) => {
      const txList: Transaction[] = snap.docs.map(d => ({
        id: d.id,
        type: d.data().type,
        description: d.data().description,
        amount: d.data().amount,
        category: d.data().category || 'Transfer',
        date: d.data().createdAt?.toDate().toLocaleDateString() || '',
      }));
      setTransactions(txList);
    }, (err) => {
      if (err.code === 'permission-denied' || sessionState.isEnding) return;
      console.error("TX Snapshot Error:", err);
    }));

    // Real-time listener for Priority Goal
    const goalsRef = collection(db, 'users', uid, 'goals');
    const goalsUnsub = registerListener(onSnapshot(query(goalsRef), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const topGoal = list.find((g: any) => g.isPriority) || list[0];
      setPriorityGoal(topGoal);
    }, (err) => {
      if (err.code === 'permission-denied' || sessionState.isEnding) return;
      console.error("Goals Snapshot Error:", err);
    }));

    // Real-time listener for Unread Notifications (EXCLUDING messages)
    const notifQuery = query(
      collection(db, 'users', uid, 'notifications'),
      where('read', '==', false)
    );
    const notifUnsub = registerListener(onSnapshot(notifQuery, (snap) => {
      // Filter client-side to avoid "Composite Index" requirement in Firestore
      const filteredCount = snap.docs.filter(d => d.data().type !== 'message').length;
      setUnreadCount(filteredCount);
    }, (err) => {
      if (err.code === 'permission-denied' || sessionState.isEnding) return;
      console.error("Notif Snapshot Error:", err);
    }));

    // Real-time listener for Unread MESSAGES (summed from chats)
    const chatsQuery = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', uid)
    );
    const chatsUnsub = registerListener(onSnapshot(chatsQuery, (snap) => {
      let unreadConversations = 0;
      snap.docs.forEach(d => {
        const counts = d.data().unreadCount || {};
        if ((counts[uid] || 0) > 0) {
          unreadConversations += 1;
        }
      });
      setUnreadMessagesCount(unreadConversations);
    }, (err) => {
      if (err.code === 'permission-denied' || sessionState.isEnding) return;
      console.error("Chats Notif Error:", err);
    }));

    // Real-time listener for Featured Experts (Marketplace Slider)
    const expertsQuery = query(
      collection(db, 'users'),
      where('isExpert', '==', true),
      where('isVerified', '==', true),
      limit(5)
    );
    const expertsUnsub = registerListener(onSnapshot(expertsQuery, (snap) => {
      const list = snap.docs
        .filter(doc => doc.id !== auth.currentUser?.uid) // Self-exclude
        .map(doc => ({
          id: doc.id,
          name: doc.data().professionalName || doc.data().name || 'Expert',
          role: doc.data().trade || 'Service',
          rating: 5.0,
          reviews: 0,
          color: doc.data().color || '#D9F15D',
          icon: doc.data().icon || 'person-circle',
          isVerified: doc.data().isVerified || false,
          avatarUrl: doc.data().avatarUrl || null
        }));
      setFeaturedExperts(list.slice(0, 5));
    }, (err) => {
      if (err.code === 'permission-denied' || sessionState.isEnding) return;
      console.error("Experts Snapshot Error:", err);
    }));

    // Admin Global Metrics Listener
    let globalUnsub: () => void = () => {};
    if (auth.currentUser?.email === SUPER_ADMIN_EMAIL) {
      const globalQuery = query(collection(db, 'users'));
      globalUnsub = registerListener(onSnapshot(globalQuery, (snap) => {
        let volume = 0;
        let experts = 0;
        let pending = 0;
        let today = 0;
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);

        snap.docs.forEach(d => {
          const data = d.data();
          volume += (data.balance || 0);
          if (data.isExpert) {
            if (data.isVerified) experts++;
            else pending++;
          }
          if (data.createdAt && new Date(data.createdAt) > oneDayAgo) {
            today++;
          }
        });

        setAdminStats({
          totalUsers: snap.size,
          totalExperts: experts,
          pendingVerifications: pending,
          totalVolume: volume,
          newUsersToday: today
        });
      }, (err) => {
        if (err.code === 'permission-denied' || sessionState.isEnding) return;
        console.error("Global Snapshot Error:", err);
      }));
    }

    return () => {
      // Individual listeners are already handled by registerListener's return function
    };
  }, [auth.currentUser]);

  const masterLogout = async () => {
    if (Platform.OS === 'web') {
      const confirmLogout = window.confirm('Are you sure you want to sign out?');
      if (confirmLogout) {
        try {
          clearAllListeners();
          await signOut(auth);
        } catch (error) {
          resetSession();
          alert('Failed to sign out.');
        }
      }
    } else {
      Alert.alert("Logout", "Are you sure you want to sign out?", [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Log Out", 
          style: "destructive",
          onPress: async () => {
            try {
              clearAllListeners();
              await signOut(auth);
            } catch (error) {
              resetSession();
              Alert.alert("Error", "Failed to sign out.");
            }
          } 
        }
      ]);
    }
  };

  const budgetPercent = userData.budgetGoal > 0 
    ? Math.min(Math.round((userData.budgetUsed / userData.budgetGoal) * 100), 100)
    : 0;
  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.safe, { justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg }]}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      </>
    );
  }

  // --- Admin Dashboard View ---
  if (isAdmin) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <View>
                <Text style={[styles.greetingTitle, { color: theme.text }]}>Admin Shield</Text>
                <Text style={[styles.adminSubtitle, { color: theme.subtext }]}>Platform Overview</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <TouchableOpacity 
                  style={[styles.notificationIcon, { backgroundColor: theme.card }]}
                  onPress={() => router.push('/notifications')}
                >
                  <Feather name="bell" size={24} color={theme.text} />
                  {unreadCount > 0 && (
                    <View style={{
                      position: 'absolute', top: 8, right: 8, width: 10, height: 10, 
                      borderRadius: 5, backgroundColor: '#FF3B30', borderWidth: 1.5, borderColor: theme.card
                    }} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.notificationIcon, { backgroundColor: theme.card }]} onPress={masterLogout}>
                  <Feather name="log-out" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.adminStatsRow}>
               <View style={[styles.adminStatCard, { backgroundColor: theme.card }]}>
                  <Text style={[styles.adminStatValue, { color: theme.text }]}>{formatNumber(adminStats.totalUsers)}</Text>
                  <Text style={[styles.adminStatLabel, { color: theme.subtext }]}>Total Students</Text>
               </View>
               <View style={[styles.adminStatCard, { backgroundColor: theme.card }]}>
                  <Text style={[styles.adminStatValue, { color: theme.text }]}>{formatNumber(adminStats.totalExperts)}</Text>
                  <Text style={[styles.adminStatLabel, { color: theme.subtext }]}>Verified Experts</Text>
               </View>
            </View>

            <View style={styles.groupedContainer}>
              <Text style={[styles.iosSectionLabel, { color: theme.subtext }]}>PENDING VERIFICATIONS</Text>
              <TouchableOpacity 
                style={[styles.iosInsetCard, { backgroundColor: theme.card }]}
                onPress={() => router.push('/admin-verify')}
              >
                <View style={styles.verificationPrompt}>
                   <View style={[styles.verificationIconBg, { backgroundColor: theme.cardAlt }]}>
                      <Ionicons name="people-circle" size={30} color={theme.text} />
                   </View>
                   <View style={{ flex: 1 }}>
                      <Text style={[styles.verificationTitle, { color: theme.text }]}>Expert Applications</Text>
                      <Text style={[styles.verificationSubtitle, { color: theme.subtext }]}>{adminStats.pendingVerifications} experts waiting for review</Text>
                   </View>
                   <Ionicons name="chevron-forward" size={20} color={theme.subtext} />
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.groupedContainer}>
              <Text style={[styles.iosSectionLabel, { color: theme.subtext }]}>SYSTEM ACTIVITY</Text>
              <View style={[styles.iosInsetCard, { backgroundColor: theme.card }]}>
                 <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: theme.text, padding: 4 }}>Total platform volume: ₵{adminStats.totalVolume.toLocaleString()}</Text>
                 <View style={[styles.iosDivider, { backgroundColor: theme.divider }]} />
                 <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: theme.text, padding: 4 }}>New accounts today: +{adminStats.newUsersToday}</Text>
              </View>
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>

          {/* Admin Tab Bar (Modified) */}
          <View style={[styles.tabBar, { backgroundColor: theme.tabBar, borderTopColor: theme.border }]}>
            <TouchableOpacity style={styles.tabItem}>
              <View style={[styles.activeTabIconBg, { backgroundColor: isDark ? '#D9F15D' : '#000' }]}>
                <Ionicons name="shield" size={20} color={isDark ? '#000' : '#FFF'} />
              </View>
              <Text style={[styles.activeTabText, { color: theme.text }]}>Shield</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabItem} onPress={() => router.push('/admin/users')}>
              <Ionicons name="storefront-outline" size={22} color={theme.tabIcon} />
              <Text style={[styles.tabText, { color: theme.tabIcon }]}>Users</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabItem} onPress={() => router.push('/profile')}>
              <Feather name="user" size={22} color={theme.tabIcon} />
              <Text style={[styles.tabText, { color: theme.tabIcon }]}>Profile</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
        >
          
          <View style={styles.header}>
            <View>
              <Text style={[styles.greetingTitle, { color: theme.text }]}>Welcome back, {userData.name}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity 
                style={[styles.notificationIcon, { backgroundColor: theme.card }]}
                onPress={() => router.push('/notifications')}
              >
                <Feather name="bell" size={24} color={theme.text} />
                {unreadCount > 0 && (
                  <View style={{
                    position: 'absolute', top: 8, right: 8, width: 10, height: 10, 
                    borderRadius: 5, backgroundColor: '#FF3B30', borderWidth: 1.5, borderColor: theme.card
                  }} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.notificationIcon, { backgroundColor: theme.card }]}
                onPress={masterLogout}
              >
                <Feather name="log-out" size={20} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Apple Wallet Style Hero */}
          <View style={styles.walletSection}>
            <TouchableOpacity 
              activeOpacity={0.9}
              style={styles.appleCard}
              onPress={() => router.push('/wallet')}
            >
              <View style={styles.cardGlassTop}>
                <Ionicons name="sparkles" size={16} color="rgba(255,255,255,0.6)" />
                <Text style={styles.cardBrand}>ARCHITECT ELITE</Text>
              </View>
              <View style={styles.cardMainContent}>
                <Text style={styles.appleBalanceLabel}>Main Balance</Text>
                <Text style={styles.appleBalanceAmount}>
                  ₵{userData.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.cardHolder}>{userData.name.toUpperCase()}</Text>
                <View style={styles.cardChip} />
              </View>
            </TouchableOpacity>

            <View style={styles.walletQuickActions}>
              <TouchableOpacity style={[styles.appleActionBtn, { backgroundColor: isDark ? '#D9F15D' : '#D9F15D' }]} onPress={() => router.push('/add-money')}>
                <Ionicons name="add" size={20} color="#000" />
                <Text style={styles.appleActionText}>Add</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.appleActionBtn, { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }]} onPress={() => router.push('/withdraw')}>
                <Ionicons name="arrow-up" size={18} color={isDark ? '#FFF' : '#000'} />
                <Text style={[styles.appleActionText, { color: isDark ? '#FFF' : '#000' }]}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* iOS Quick Actions Grid */}
          <View style={styles.groupedContainer}>
            <View style={styles.gridRow}>
              <TouchableOpacity style={[styles.gridItem, { backgroundColor: theme.card }]} onPress={() => router.push('/add-expense')}>
                <View style={[styles.gridIconBox, { backgroundColor: isDark ? '#1C1C1E' : '#E8F5E9' }]}>
                  <Ionicons name="receipt" size={22} color={isDark ? '#34C759' : '#4CAF50'} />
                </View>
                <Text style={[styles.gridText, { color: theme.text }]}>Log Expense</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.gridItem, { backgroundColor: theme.card }]} onPress={() => router.push('/marketplace')}>
                <View style={[styles.gridIconBox, { backgroundColor: isDark ? '#1C1C1E' : '#FFF3E0' }]}>
                  <Ionicons name="people" size={22} color={isDark ? '#FF9F0A' : '#FF9800'} />
                </View>
                <Text style={[styles.gridText, { color: theme.text }]}>Experts</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.gridItem, { backgroundColor: theme.card }]} onPress={() => router.push('/jobs')}>
                <View style={[styles.gridIconBox, { backgroundColor: isDark ? '#1C1C1E' : '#E3F2FD' }]}>
                  <Ionicons name="briefcase" size={22} color={isDark ? '#0A84FF' : '#2196F3'} />
                </View>
                <Text style={[styles.gridText, { color: theme.text }]}>My Jobs</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.groupedContainer}>
            <Text style={[styles.iosSectionLabel, { color: theme.subtext }]}>GOALS & BUDGET</Text>
            <TouchableOpacity 
              onPress={() => router.push('/wallet')} 
              style={[styles.iosInsetCard, { backgroundColor: theme.card }]}
            >
              <View style={styles.iosCardHeader}>
                 <Ionicons name="flag" size={18} color={theme.text} />
                 <Text style={[styles.iosCardTitle, { color: theme.text }]}>Next Milestone</Text>
              </View>
              
              {priorityGoal ? (
                <View style={{ marginTop: 15 }}>
                  <View style={styles.iosProgressHeader}>
                      <Text style={[styles.iosProgressName, { color: theme.text }]}>{priorityGoal.title}</Text>
                      <Text style={[styles.iosProgressAmount, { color: theme.text }]}>
                        ₵{priorityGoal.currentAmount.toLocaleString()}
                      </Text>
                  </View>
                  <View style={[styles.appleProgressBg, { backgroundColor: theme.cardAlt }]}>
                      <View style={[styles.appleProgressFill, { width: `${Math.min((priorityGoal.currentAmount / priorityGoal.targetAmount) * 100, 100)}%` }]} />
                  </View>
                </View>
              ) : (
                <View style={styles.iosEmptyGoal}>
                  <Text style={[styles.iosEmptyText, { color: theme.subtext }]}>No active milestones.</Text>
                </View>
              )}

              <View style={[styles.iosDivider, { backgroundColor: theme.divider }]} />

              <View style={{ marginTop: 15 }}>
                <View style={styles.iosProgressHeader}>
                  <Text style={[styles.iosProgressName, { color: theme.text }]}>Monthly Budget</Text>
                  <Text style={[styles.iosProgressAmount, { color: theme.text }]}>{budgetPercent}%</Text>
                </View>
                <View style={[styles.appleProgressBg, { backgroundColor: theme.cardAlt }]}>
                  <View style={[styles.appleProgressFill, { width: `${budgetPercent}%`, backgroundColor: budgetPercent > 90 ? '#FF3B30' : '#D9F15D' }]} />
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* Marketplace Slider */}
          <View style={[styles.sectionHeaderSpacing, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Marketplace</Text>
            <TouchableOpacity onPress={() => router.push('/marketplace')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView 
            horizontal showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.marketplaceScroll}
            snapToInterval={180} decelerationRate="fast"
          >
            {featuredExperts.map((expert) => (
              <TouchableOpacity key={expert.id} style={[styles.expertCard, { backgroundColor: theme.card }]} onPress={() => router.push(`/expert/${expert.id}` as any)}>
                <View style={[styles.expertImagePlaceholder, { overflow: 'hidden' }]}>
                  {expert.avatarUrl ? (
                    <Image source={{ uri: expert.avatarUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: expert.color, justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name={expert.icon as any} size={30} color="#000" style={{ opacity: 0.5 }} />
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                   <Text style={[styles.expertName, { color: theme.text }]}>{expert.name.split(' ')[0]} {expert.name.split(' ')[2] || ''}</Text>
                   {expert.isVerified && (
                     <View style={styles.verifiedBadge}>
                       <Ionicons name="checkmark-sharp" size={8} color="#000" />
                     </View>
                   )}
                </View>
                <Text style={[styles.expertRole, { color: theme.subtext }]}>{expert.role}</Text>
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={12} color="#FFD700" />
                  <Text style={[styles.ratingScore, { color: theme.text }]}>{expert.rating}</Text>
                  <Text style={[styles.ratingCount, { color: theme.subtext }]}>({expert.reviews})</Text>
                </View>
              </TouchableOpacity>
            ))}
            
            {featuredExperts.length === 0 && (
              <View style={[styles.expertCard, { backgroundColor: theme.card, justifyContent: 'center', alignItems: 'center', paddingVertical: 20 }]}>
                <Ionicons name="people-outline" size={24} color={theme.subtext} />
                <Text style={[styles.expertRole, { color: theme.subtext, marginTop: 10 }]}>No experts yet.</Text>
              </View>
            )}
          </ScrollView>

          {/* Quick Stats Row */}
          <View style={[styles.quickStatsRow, { backgroundColor: theme.card }]}>
            <View style={styles.quickStatCard}>
              <Text style={[styles.quickStatValue, { color: theme.text }]}>₵{(userData.walletBalance ?? userData.balance ?? 0).toLocaleString()}</Text>
              <Text style={[styles.quickStatLabel, { color: theme.subtext }]}>Financial Hub</Text>
            </View>
            <View style={[styles.quickStatDivider, { backgroundColor: theme.divider }]} />
            <View style={styles.quickStatCard}>
              <Text style={[styles.quickStatValue, { color: theme.text }]}>{priorityGoal ? '1' : '0'}</Text>
              <Text style={[styles.quickStatLabel, { color: theme.subtext }]}>Active Goals</Text>
            </View>
            <View style={[styles.quickStatDivider, { backgroundColor: theme.divider }]} />
            <View style={styles.quickStatCard}>
              {userData.isVerified ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={[styles.quickStatValue, { color: '#34C759' }]}>Active</Text>
                  <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                </View>
              ) : userData.isExpert ? (
                <Text style={[styles.quickStatValue, { color: '#FF9500', fontSize: 13 }]}>Pending</Text>
              ) : (
                <Text style={[styles.quickStatValue, { fontSize: 13, color: theme.subtext }]}>—</Text>
              )}
              <Text style={[styles.quickStatLabel, { color: theme.subtext }]}>Expert Status</Text>
            </View>
          </View>

          {/* Recent Activity */}
          <View style={[styles.sectionHeaderSpacing, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Activity</Text>
            <TouchableOpacity onPress={() => router.push('/wallet')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.activityList}>
            {transactions.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: theme.card }]}>
                <Feather name="inbox" size={32} color={theme.subtext} />
                <Text style={[styles.emptyText, { color: theme.subtext }]}>No transactions yet</Text>
              </View>
            ) : (
              <View style={[styles.ledger, { backgroundColor: theme.card }]}>
                {transactions.map((tx) => (
                    <View key={tx.id} style={[styles.txItem, { borderBottomColor: theme.divider }]}>
                        <View style={styles.txLeft}>
                            <View style={[styles.txIconBg, { backgroundColor: (tx.type === 'income' || tx.type === 'credit') ? theme.incomeBg : theme.expenseBg }]}>
                                <Ionicons 
                                    name={(tx.type === 'income' || tx.type === 'credit') ? 'arrow-down' : 'arrow-up'} 
                                    size={18} 
                                    color={(tx.type === 'income' || tx.type === 'credit') ? '#32D74B' : '#FF3B30'} 
                                />
                            </View>
                            <View style={{ flex: 1, flexShrink: 1 }}>
                                <Text style={[styles.txDesc, { color: theme.text }]} numberOfLines={1} ellipsizeMode="tail">{tx.description || 'Unknown Transaction'}</Text>
                                <Text style={[styles.txCategory, { color: theme.subtext }]} numberOfLines={1} ellipsizeMode="tail">{tx.category || 'Transfer'} • {tx.date}</Text>
                            </View>
                        </View>
                        <View style={styles.txRight}>
                            <Text style={[styles.txAmount, { color: (tx.type === 'income' || tx.type === 'credit') ? '#32D74B' : theme.text }]}>
                              {(tx.type === 'income' || tx.type === 'credit') ? '+' : '-'}₵{(tx.amount || 0).toLocaleString()}
                            </Text>
                        </View>
                    </View>
                ))}
              </View>
            )}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Bottom Tab Bar */}
        <View style={[styles.tabBar, { backgroundColor: theme.tabBar, borderTopColor: theme.border }]}>
          <TouchableOpacity style={styles.tabItem}>
            <View style={[styles.activeTabIconBg, { backgroundColor: isDark ? '#D9F15D' : '#000' }]}>
              <Ionicons name="home" size={20} color={isDark ? '#000' : '#FFF'} />
            </View>
            <Text style={[styles.activeTabText, { color: theme.text }]}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabItem} onPress={() => router.push('/messages')}>
            <Ionicons name="chatbubble-ellipses-outline" size={22} color={theme.tabIcon} />
            <Text style={[styles.tabText, { color: theme.tabIcon }]}>Messages</Text>
            {unreadMessagesCount > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{unreadMessagesCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabItem} onPress={() => router.push('/marketplace')}>
            <Ionicons name="storefront-outline" size={22} color={theme.tabIcon} />
            <Text style={[styles.tabText, { color: theme.tabIcon }]}>Marketplace</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabItem} onPress={() => router.push('/wallet')}>
            <Ionicons name="wallet-outline" size={22} color={theme.tabIcon} />
            <Text style={[styles.tabText, { color: theme.tabIcon }]}>Financial Hub</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabItem} onPress={() => router.push('/profile')}>
            <Feather name="user" size={22} color={theme.tabIcon} />
            <Text style={[styles.tabText, { color: theme.tabIcon }]}>Profile</Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </>
  );
}

// Parse onboarding budgetGoal strings like "GH₵ 1k - GH₵ 5k" into a number
function parseBudget(goal: string): number {
  if (!goal) return 1000;
  if (goal.includes('10k+')) return 10000;
  const nums = goal.match(/\d+/g);
  if (nums && nums.length >= 2) return parseInt(nums[1]) * 1000;
  if (nums && nums.length === 1) return parseInt(nums[0]) * 1000;
  return 1000;
}

function formatDate(ts: any): string {
  if (!ts) return '';
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString('en-GH', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'm';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toString();
}

const styles = StyleSheet.create({
  ledger: { borderRadius: 16, padding: 16 },
  txItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1 },
  txLeft: { flexDirection: 'row', alignItems: 'center', gap: 15, flex: 1 },
  txIconBg: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  txDesc: { fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 2 },
  txCategory: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  txRight: { alignItems: 'flex-end', marginLeft: 10, minWidth: 60 },
  txAmount: { fontFamily: 'Inter_700Bold', fontSize: 15 },

  safe: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 40 : 10 },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 25,
    paddingHorizontal: 4
  },
  greetingTitle: { 
    fontFamily: 'Inter_700Bold', 
    fontSize: 28, 
    color: '#000000',
    letterSpacing: -0.5
  },
  notificationIcon: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5
  },
  walletSection: { marginBottom: 30 },
  appleCard: { 
    backgroundColor: '#1C1C1E', 
    width: '100%', 
    height: 200, 
    borderRadius: 20, 
    padding: 24, 
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden'
  },
  cardGlassTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardBrand: { fontFamily: 'Inter_700Bold', fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: 2 },
  cardMainContent: { marginTop: 20 },
  appleBalanceLabel: { fontFamily: 'Inter_400Regular', fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 4 },
  appleBalanceAmount: { fontFamily: 'Inter_700Bold', fontSize: 34, color: '#FFF', letterSpacing: -1 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  cardHolder: { fontFamily: 'Inter_700Bold', fontSize: 12, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 },
  cardChip: { width: 34, height: 24, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)' },
  
  mapPreviewIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D9F15D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  walletQuickActions: { flexDirection: 'row', marginTop: 16, gap: 12 },
  appleActionBtn: { 
    flex: 1, 
    flexDirection: 'row', 
    backgroundColor: '#D9F15D', 
    height: 48, 
    borderRadius: 12, 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 6 
  },
  appleActionText: { fontFamily: 'Inter_700Bold', fontSize: 15 },

  groupedContainer: { marginBottom: 30 },
  iosSectionLabel: { 
    fontFamily: 'Inter_700Bold', 
    fontSize: 13, 
    color: '#8E8E93', 
    marginLeft: 16, 
    marginBottom: 8 
  },
  iosInsetCard: { 
    borderRadius: 16, 
    padding: 16, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2
  },
  iosCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iosCardTitle: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  
  iosProgressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  iosProgressName: { fontFamily: 'Inter_400Regular', fontSize: 14 },
  iosProgressAmount: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  appleProgressBg: { backgroundColor: '#F2F2F7', height: 10, borderRadius: 5, width: '100%', overflow: 'hidden' },
  appleProgressFill: { backgroundColor: '#D9F15D', height: '100%', borderRadius: 5 },
  
  iosDivider: { height: 1, marginVertical: 15, width: '100%' },
  iosEmptyGoal: { paddingVertical: 10 },
  iosEmptyText: { fontFamily: 'Inter_400Regular', fontSize: 14 },

  gridRow: { flexDirection: 'row', gap: 12 },
  gridItem: { 
    flex: 1, 
    borderRadius: 16, 
    padding: 16, 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2
  },
  gridIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  gridText: { fontFamily: 'Inter_700Bold', fontSize: 11, textAlign: 'center' },

  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  sectionHeaderSpacing: { marginBottom: 15 },
  marketplaceScroll: { marginBottom: 30 },
  expertCard: { 
    borderRadius: 16, 
    padding: 12, 
    width: 150, 
    marginRight: 12, 
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3
  },
  expertImagePlaceholder: { height: 50, width: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  expertName: { fontFamily: 'Inter_700Bold', fontSize: 13, marginBottom: 2 },
  expertRole: { fontFamily: 'Inter_400Regular', fontSize: 10, color: '#8E8E93', marginBottom: 8 },
  ratingRow: { flexDirection: 'row', alignItems: 'center' },
  ratingScore: { fontFamily: 'Inter_700Bold', fontSize: 11, marginLeft: 3, marginRight: 5 },
  ratingCount: { fontFamily: 'Inter_400Regular', fontSize: 9, color: '#8E8E93' },
  verifiedBadge: { backgroundColor: '#D9F15D', width: 12, height: 12, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  
  quickStatsRow: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 20,
    marginBottom: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  quickStatCard: { flex: 1, alignItems: 'center' },
  quickStatValue: { fontFamily: 'Inter_700Bold', fontSize: 18, marginBottom: 4 },
  quickStatLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#8E8E93' },
  quickStatDivider: { width: 1, height: 36, backgroundColor: '#F0F0F0' },
  
  viewAllText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#D9F15D' },
  activityList: { marginBottom: 30 },
  emptyState: { alignItems: 'center', paddingVertical: 30, borderRadius: 20 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 14, marginTop: 10 },
  activityCard: { 
    borderRadius: 16, 
    padding: 14, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5
  },
  activityLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  activityIconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  activityName: { fontFamily: 'Inter_700Bold', fontSize: 14, marginBottom: 2 },
  activityDate: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  activityAmount: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  
  tabBar: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    height: 90, 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    alignItems: 'center', 
    paddingBottom: Platform.OS === 'ios' ? 20 : 0, 
    borderTopWidth: 1, 
  },
  tabItem: { alignItems: 'center', justifyContent: 'center', minWidth: 60 },
  activeTabIconBg: { width: 42, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  activeTabText: { fontFamily: 'Inter_700Bold', fontSize: 10 },
  tabText: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 5 },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: 12,
    backgroundColor: '#FF3B30',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  tabBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
  },
  adminSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 16, color: '#8E8E93', marginTop: 4 },
  adminStatsRow: { flexDirection: 'row', gap: 12, marginBottom: 25, paddingHorizontal: 4 },
  adminStatCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  adminStatValue: { fontFamily: 'Inter_700Bold', fontSize: 24, marginBottom: 4 },
  adminStatLabel: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  verificationPrompt: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  verificationIconBg: { width: 50, height: 50, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  verificationTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 2 },
  verificationSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  
  // Pending Expert Styles
  pendingContainer: { flex: 1, backgroundColor: '#FFF' },
  pendingContent: { flex: 1, padding: 30, alignItems: 'center', justifyContent: 'center' },
  pendingIconBg: { width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center', marginBottom: 30 },
  pendingTitle: { fontFamily: 'Inter_700Bold', fontSize: 28, textAlign: 'center', marginBottom: 15 },
  pendingTradeBadge: { backgroundColor: '#D9F15D', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, marginBottom: 20 },
  pendingTradeText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#000' },
  pendingDescription: { fontFamily: 'Inter_400Regular', fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 40 },
  pendingSteps: { width: '100%', marginBottom: 40 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 15 },
  stepText: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  primaryButton: { 
    backgroundColor: '#0F0F0F', 
    borderRadius: 50, 
    paddingVertical: 18, 
    alignItems: 'center', 
    justifyContent: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10
  },
  primaryButtonText: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 16 },
});
