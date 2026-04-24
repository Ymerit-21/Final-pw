import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, Alert, Switch, SafeAreaView, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { auth, db, registerListener, clearAllListeners, sessionState, resetSession } from '../config/firebase';
import { doc, onSnapshot, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { signOut, sendPasswordResetEmail, updateProfile } from 'firebase/auth';
import { useTheme } from '../context/ThemeContext';

const AVATAR_COLORS = ['#D9F15D', '#FF6B6B', '#4ECDC4', '#A78BFA', '#FFA94D', '#74C0FC', '#63E6BE', '#F783AC'];

export default function ProfileScreen() {
  const router = useRouter();
  const { isDark, theme, toggleDark } = useTheme();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [jobStats, setJobStats] = useState({ completed: 0, reviews: 0 });

  // Edit name modal
  const [showEditName, setShowEditName] = useState(false);
  const [newName, setNewName] = useState('');
  const [savingName, setSavingName] = useState(false);

  const SUPER_ADMIN_EMAIL = 'adminspw@test.com';
  const isAdmin = auth.currentUser?.email === SUPER_ADMIN_EMAIL || userData?.role === 'admin';

  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    const unsub = registerListener(onSnapshot(doc(db, 'users', uid), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setUserData(d);
        setNotificationsEnabled(d.notificationsEnabled !== false); // default true
      }
      setLoading(false);
    }, (error) => {
      setLoading(false);
      if (error.code === 'permission-denied' || sessionState.isEnding) return;
      console.error('Profile Snapshot Error:', error);
    }));

    // Load job stats
    const fetchStats = async () => {
      try {
        const q = query(collection(db, 'jobs'), where('studentId', '==', uid));
        const snap = await getDocs(q);
        const completed = snap.docs.filter(d => d.data().status === 'completed').length;
        const reviewed = snap.docs.filter(d => d.data().isReviewed).length;
        setJobStats({ completed, reviews: reviewed });
      } catch (e) { /* silent */ }
    };
    fetchStats();

    return () => unsub();
  }, [auth.currentUser]);

  // ─── Handlers ───────────────────────────────────────────────────
  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      const confirmLogout = window.confirm('Are you sure you want to log out?');
      if (confirmLogout) {
        try {
          clearAllListeners();
          await signOut(auth);
        } catch {
          resetSession();
          alert('Failed to sign out.');
        }
      }
    } else {
      Alert.alert('Sign Out', 'Are you sure you want to log out?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out', style: 'destructive',
          onPress: async () => {
            try {
              clearAllListeners();
              await signOut(auth);
            } catch {
              resetSession();
              Alert.alert('Error', 'Failed to sign out.'); 
            }
          }
        }
      ]);
    }
  };

  const handleSaveName = async () => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed.length < 2) {
      Alert.alert('Invalid Name', 'Please enter at least 2 characters.');
      return;
    }
    setSavingName(true);
    try {
      const uid = auth.currentUser!.uid;
      await updateDoc(doc(db, 'users', uid), { name: trimmed });
      if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: trimmed });
      setShowEditName(false);
    } catch {
      Alert.alert('Error', 'Could not update name. Try again.');
    } finally {
      setSavingName(false);
    }
  };

  const handlePasswordReset = () => {
    const email = auth.currentUser?.email;
    if (!email) return;
    Alert.alert(
      'Reset Password',
      `We'll send a password reset link to:\n${email}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Link',
          onPress: async () => {
            try {
              await sendPasswordResetEmail(auth, email);
              Alert.alert('Email Sent! ✉️', 'Check your inbox for the reset link.');
            } catch {
              Alert.alert('Error', 'Could not send reset email.');
            }
          }
        }
      ]
    );
  };

  const toggleNotifications = async (val: boolean) => {
    setNotificationsEnabled(val);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser!.uid), {
        notificationsEnabled: val
      });
    } catch { /* revert on failure */ setNotificationsEnabled(!val); }
  };

  const handlePickColor = async (color: string) => {
    try {
      await updateDoc(doc(db, 'users', auth.currentUser!.uid), { color });
    } catch { Alert.alert('Error', 'Could not update avatar color.'); }
  };

  const getTier = (score: number) => {
    if (score >= 90) return { name: 'Master Architect', color: '#FFD700', label: 'ELITE' };
    if (score >= 75) return { name: 'Strategic Scholar', color: '#C0C0C0', label: 'PRO' };
    return { name: 'Student Saver', color: '#CD7F32', label: 'BASIC' };
  };

  const userTier = getTier(userData?.financialScore || 0);
  const avatarColor = userData?.color || '#D9F15D';
  const initials = userData?.name?.[0]?.toUpperCase() || '?';

  // ─── Sub-components ─────────────────────────────────────────────
  const Header = () => (
    <View style={styles.header}>
      <Text style={[styles.headerTitle, { color: theme.text }]}>Profile</Text>
    </View>
  );

  const TabBar = () => (
    <View style={[styles.tabBar, { backgroundColor: theme.tabBar, borderTopColor: theme.border }]}>
      {isAdmin ? (
        <>
          <TouchableOpacity style={styles.tabItem} onPress={() => router.push('/dashboard')}>
            <Ionicons name="shield-outline" size={22} color={theme.tabIcon} />
            <Text style={[styles.tabText, { color: theme.tabIcon }]}>Shield</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabItem} onPress={() => router.push('/admin/users')}>
            <Ionicons name="people-outline" size={22} color={theme.tabIcon} />
            <Text style={[styles.tabText, { color: theme.tabIcon }]}>Users</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabItem}>
            <View style={[styles.activeTabIconBg, { backgroundColor: isDark ? '#D9F15D' : '#000' }]}>
              <Ionicons name="person" size={20} color={isDark ? '#000' : '#FFF'} />
            </View>
            <Text style={[styles.activeTabText, { color: theme.text }]}>Profile</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
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
          <TouchableOpacity style={styles.tabItem} onPress={() => router.push('/wallet')}>
            <Ionicons name="wallet-outline" size={22} color={theme.tabIcon} />
            <Text style={[styles.tabText, { color: theme.tabIcon }]}>Financial Hub</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabItem}>
            <View style={[styles.activeTabIconBg, { backgroundColor: isDark ? '#D9F15D' : '#000' }]}>
              <Ionicons name="person" size={20} color={isDark ? '#000' : '#FFF'} />
            </View>
            <Text style={[styles.activeTabText, { color: theme.text }]}>Profile</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
          <View style={[styles.header, { backgroundColor: theme.bg }]}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Profile</Text>
          </View>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <ActivityIndicator size="large" color={theme.text} />
            <TouchableOpacity 
              style={{ marginTop: 40, padding: 10 }}
              onPress={handleLogout}
            >
              <Text style={{ color: theme.subtext, fontFamily: 'Inter_400Regular' }}>Sign Out</Text>
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
        <Header />
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* ── Avatar + Name ── */}
          <View style={styles.heroSection}>
            <TouchableOpacity onPress={() => {
              Alert.alert('Change Avatar Color', 'Pick a color for your avatar:',
                AVATAR_COLORS.map(c => ({
                  text: '  ',
                  onPress: () => handlePickColor(c)
                }))
              );
            }}>
              <View style={[styles.avatarCircle, { backgroundColor: avatarColor }]}>
                <Text style={styles.avatarText}>{initials}</Text>
                <View style={styles.editBadge}>
                  <Feather name="edit-2" size={10} color="#000" />
                </View>
              </View>
            </TouchableOpacity>

            {/* Colour swatches */}
            <View style={styles.swatchRow}>
              {AVATAR_COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  onPress={() => handlePickColor(c)}
                  style={[
                    styles.swatch,
                    { backgroundColor: c },
                    avatarColor === c && styles.swatchActive
                  ]}
                />
              ))}
            </View>

            <TouchableOpacity onPress={() => { setNewName(userData?.name || ''); setShowEditName(true); }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.userName, { color: theme.text }]}>{userData?.name || 'Your Name'}</Text>
                <Feather name="edit-2" size={14} color={theme.subtext} />
              </View>
            </TouchableOpacity>
            <Text style={[styles.userEmail, { color: theme.subtext }]}>{auth.currentUser?.email}</Text>

            <View style={[styles.tierPill, { backgroundColor: userTier.color + '20' }]}>
              <View style={[styles.tierDot, { backgroundColor: userTier.color }]} />
              <Text style={[styles.tierText, { color: userTier.color }]}>{userTier.label} MEMBER</Text>
            </View>
          </View>

          {/* ── Stats Row ── */}
          {!isAdmin && (
            <View style={[styles.statsRow, { backgroundColor: theme.card }]}>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: theme.text }]}>{jobStats.completed}</Text>
                <Text style={[styles.statLabel, { color: theme.subtext }]}>Jobs Done</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: theme.divider }]} />
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: theme.text }]}>{jobStats.reviews}</Text>
                <Text style={[styles.statLabel, { color: theme.subtext }]}>Reviews Left</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: theme.divider }]} />
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: userTier.color }]}>{userTier.label}</Text>
                <Text style={[styles.statLabel, { color: theme.subtext }]}>Tier</Text>
              </View>
            </View>
          )}

          {/* ── Account Settings ── */}
          <Text style={[styles.sectionLabel, { color: theme.subtext }]}>ACCOUNT SETTINGS</Text>
          <View style={[styles.insetGroup, { backgroundColor: theme.card }]}>
            <SettingRow
              icon="person" color="#007AFF" label="Personal Information"
              subtitle={userData?.name}
              onPress={() => { setNewName(userData?.name || ''); setShowEditName(true); }}
              theme={theme}
            />
            <SettingRow
              icon="notifications" color="#FF3B30" label="Notifications"
              subtitle={notificationsEnabled ? 'Enabled' : 'Disabled'}
              theme={theme}
            >
              <Switch
                value={notificationsEnabled}
                onValueChange={toggleNotifications}
                trackColor={{ false: '#767577', true: '#32D74B' }}
                ios_backgroundColor="#3e3e3e"
              />
            </SettingRow>
            <SettingRow
              icon="moon" color="#5856D6" label="Dark Mode"
              subtitle={isDark ? 'On' : 'Off'}
              theme={theme}
            >
              <Switch
                value={isDark}
                onValueChange={toggleDark}
                trackColor={{ false: '#767577', true: '#5856D6' }}
                ios_backgroundColor="#3e3e3e"
              />
            </SettingRow>
            <SettingRow
              icon="shield-checkmark" color="#32D74B" label="Security & Password"
              subtitle="Send reset link"
              onPress={handlePasswordReset}
              isLast
              theme={theme}
            />
          </View>

          {/* ── Strategy & Earnings ── */}
          {!isAdmin && (
            <>
              <Text style={[styles.sectionLabel, { color: theme.subtext }]}>STRATEGY & EARNINGS</Text>
              <View style={[styles.insetGroup, { backgroundColor: theme.card }]}>
                <SettingRow
                  icon="flag" color="#FF9500" label="Financial Goals"
                  subtitle="Set & track milestones"
                  onPress={() => router.push('/set-goals')}
                  theme={theme}
                />
                <SettingRow
                  icon="briefcase" color="#5856D6" label="My Jobs"
                  subtitle="Track your job orders"
                  onPress={() => router.push('/jobs')}
                  theme={theme}
                />
                {userData?.isExpert ? (
                  <SettingRow
                    icon="create" color="#000" label="Expert Profile"
                    subtitle="Edit your service listing"
                    onPress={() => router.push('/edit-expert-profile' as any)}
                    isLast
                    theme={theme}
                  />
                ) : (
                  <SettingRow
                    icon="star" color="#000" label="Become an Expert"
                    subtitle="Monetise your skills"
                    onPress={() => router.push('/expert-registration')}
                    isLast
                    theme={theme}
                  />
                )}
              </View>
            </>
          )}

          {/* ── Support ── */}
          <Text style={[styles.sectionLabel, { color: theme.subtext }]}>SUPPORT</Text>
          <View style={[styles.insetGroup, { backgroundColor: theme.card }]}>
            <SettingRow
              icon="help-circle" color="#8E8E93" label="Help Center"
              subtitle="FAQs & guides"
              onPress={() => router.push('/help-center' as any)}
              theme={theme}
            />
            <SettingRow
              icon="document-text" color="#8E8E93" label="Terms of Service"
              subtitle="Legal information"
              onPress={() => router.push('/terms-of-service' as any)}
              isLast
              theme={theme}
            />
          </View>

          {/* ── Admin ── */}
          {isAdmin && (
            <>
              <Text style={[styles.sectionLabel, { color: theme.subtext }]}>ADMINISTRATION</Text>
              <View style={[styles.insetGroup, { backgroundColor: theme.card }]}>
                <SettingRow icon="shield-checkmark" color="#5856D6" label="Admin Shield"
                  onPress={() => router.push('/dashboard')} theme={theme} />
                <SettingRow icon="people" color="#FF9500" label="Verify Experts"
                  onPress={() => router.push('/admin-verify')} theme={theme} />
                <SettingRow icon="person-remove" color="#FF3B30" label="Manage Users"
                  onPress={() => router.push('/admin/users')} isLast theme={theme} />
              </View>
            </>
          )}

          {/* ── Log Out ── */}
          <View style={{ paddingHorizontal: 16, marginTop: 10, marginBottom: 60 }}>
            <TouchableOpacity 
              style={[styles.premiumLogoutBtn, { backgroundColor: isDark ? 'rgba(255,59,48,0.1)' : '#FFF' }]} 
              onPress={handleLogout}
            >
              <Ionicons name="log-out" size={22} color="#FF3B30" />
              <Text style={styles.premiumLogoutText}>Sign Out from Architect</Text>
            </TouchableOpacity>
            <Text style={[styles.versionText, { color: theme.subtext }]}>Version 1.0.4 (Build 2024)</Text>
          </View>

        </ScrollView>
        <TabBar />
      </SafeAreaView>

      {/* ── Edit Name Modal ── */}
      <Modal visible={showEditName} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalSheet, { backgroundColor: theme.card }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>Update Your Name</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.inputBg, color: theme.text }]}
              value={newName}
              onChangeText={setNewName}
              placeholder="Full name"
              placeholderTextColor={theme.placeholder}
              autoFocus
              maxLength={40}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: theme.cardAlt }]} onPress={() => setShowEditName(false)}>
                <Text style={[styles.cancelBtnText, { color: theme.subtext }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, savingName && { opacity: 0.6 }]}
                onPress={handleSaveName}
                disabled={savingName}
              >
                {savingName
                  ? <ActivityIndicator color="#000" size="small" />
                  : <Text style={styles.saveBtnText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function SettingRow({ icon, color, label, subtitle, isLast, children, onPress, theme }: any) {
  return (
    <TouchableOpacity
      style={[styles.row, isLast && { borderBottomWidth: 0 }, { borderBottomColor: theme?.border ?? '#E5E5EA' }]}
      onPress={onPress}
      disabled={!onPress && !children}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <View style={[styles.iconBox, { backgroundColor: color }]}>
        <Ionicons name={icon} size={18} color="#FFF" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: theme?.text ?? '#000' }]}>{label}</Text>
        {subtitle ? <Text style={[styles.rowSub, { color: theme?.subtext ?? '#8E8E93' }]}>{subtitle}</Text> : null}
      </View>
      {children || (onPress && <Ionicons name="chevron-forward" size={16} color={theme?.subtext ?? '#C4C4C6'} />)}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: { paddingBottom: 120, paddingTop: 10 },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 25, 
    paddingVertical: 15,
    marginBottom: 10
  },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 28, letterSpacing: -0.5 },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2
  },

  // Hero
  heroSection: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 20 },
  avatarCircle: {
    width: 90, height: 90, borderRadius: 45,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 10, marginBottom: 10, position: 'relative',
  },
  avatarText: { fontFamily: 'Inter_700Bold', fontSize: 32 },
  editBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#F2F2F7',
  },
  swatchRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  swatch: { width: 22, height: 22, borderRadius: 11 },
  swatchActive: { borderWidth: 3, borderColor: '#000' },

  userName: { fontFamily: 'Inter_700Bold', fontSize: 24, marginBottom: 4 },
  userEmail: { fontFamily: 'Inter_400Regular', fontSize: 14, marginBottom: 12 },
  tierPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6,
  },
  tierDot: { width: 8, height: 8, borderRadius: 4 },
  tierText: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1 },

  // Stats
  statsRow: {
    flexDirection: 'row', backgroundColor: '#FFF',
    marginHorizontal: 16, marginBottom: 8, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#F2F2F7', marginHorizontal: 10 },

  // Groups
  sectionLabel: {
    fontFamily: 'Inter_700Bold', fontSize: 13, color: '#8E8E93',
    marginLeft: 16, marginTop: 22, marginBottom: 8, letterSpacing: 0.5,
  },
  insetGroup: {
    backgroundColor: '#FFF', marginHorizontal: 16, borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', padding: 13, paddingLeft: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E5EA',
  },
  iconBox: {
    width: 30, height: 30, borderRadius: 7,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  rowLabel: { fontFamily: 'Inter_400Regular', fontSize: 16 },
  rowSub: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 1 },

  premiumLogoutBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 18, 
    borderRadius: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.2)'
  },
  premiumLogoutText: { 
    fontFamily: 'Inter_700Bold', 
    fontSize: 16, 
    color: '#FF3B30' 
  },
  versionText: {
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 20,
    opacity: 0.6
  },

  // Tab bar
  tabBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 90,
    flexDirection: 'row',
    justifyContent: 'space-around', alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
    borderTopWidth: 1,
  },
  tabItem: { alignItems: 'center', justifyContent: 'center', minWidth: 60 },
  activeTabIconBg: {
    backgroundColor: '#000', width: 42, height: 32, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  activeTabText: { fontFamily: 'Inter_700Bold', fontSize: 10 },
  tabText: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 4 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: '#E0E0E0',
    borderRadius: 2, alignSelf: 'center', marginBottom: 20,
  },
  modalTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, marginBottom: 16 },
  modalInput: {
    borderRadius: 12, padding: 16,
    fontSize: 16, fontFamily: 'Inter_400Regular', marginBottom: 20,
  },
  modalBtns: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1, backgroundColor: '#F2F2F7', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
  },
  cancelBtnText: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#8E8E93' },
  saveBtn: {
    flex: 1, backgroundColor: '#D9F15D', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
  },
  saveBtnText: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#000' },
});
