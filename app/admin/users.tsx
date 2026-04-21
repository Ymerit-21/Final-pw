import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, TextInput, FlatList, SafeAreaView, Modal,
  Animated, Alert, ActivityIndicator
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { auth, db, registerListener, sessionState } from '../../config/firebase';
import {
  collection, query, onSnapshot, orderBy, doc, updateDoc, serverTimestamp, addDoc, Timestamp
} from 'firebase/firestore';

interface UserItem {
  id: string;
  name: string;
  email: string;
  balance: number;
  role: 'student' | 'admin';
  isExpert: boolean;
  createdAt: string;
  color?: string;
  isBanned?: boolean;
  banReason?: string;
  bannedAt?: any;
  bannedBy?: string;
  // Timed suspension fields (experts only)
  isSuspended?: boolean;
  suspensionReason?: string;
  suspensionEndsAt?: any;  // Firestore Timestamp
  suspendedBy?: string;
}

// Duration options for timed expert suspensions
const DURATIONS = [
  { label: '2h',  ms: 2 * 60 * 60 * 1000 },
  { label: '6h',  ms: 6 * 60 * 60 * 1000 },
  { label: '12h', ms: 12 * 60 * 60 * 1000 },
  { label: '1d',  ms: 24 * 60 * 60 * 1000 },
  { label: '3d',  ms: 3 * 24 * 60 * 60 * 1000 },
  { label: '7d',  ms: 7 * 24 * 60 * 60 * 1000 },
  { label: '30d', ms: 30 * 24 * 60 * 60 * 1000 },
];

const CATEGORIES = ['All', 'Students', 'Experts', 'Admins', 'Banned'];

function formatSuspensionEnd(ts: any): string {
  if (!ts) return '';
  const date: Date = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  if (diffMs <= 0) return 'Expired';
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  const diffD = Math.floor(diffH / 24);
  if (diffD >= 1) return `${diffD}d ${diffH % 24}h remaining`;
  const diffM = Math.floor(diffMs / (1000 * 60));
  if (diffH >= 1) return `${diffH}h ${diffM % 60}m remaining`;
  return `${diffM}m remaining`;
}

export default function AdminUsersScreen() {
  const router = useRouter();
  const { auth } = require('../../config/firebase');
  const SUPER_ADMIN_EMAIL = 'adminspw@test.com';
  const [isAdmin] = useState(auth?.currentUser?.email === SUPER_ADMIN_EMAIL);

  const [users, setUsers] = useState<UserItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);

  // Action Sheet state
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  // Permanent ban
  const [banReason, setBanReason] = useState('');
  const [showBanInput, setShowBanInput] = useState(false);

  // Timed suspension (experts)
  const [showSuspendInput, setShowSuspendInput] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [selectedDuration, setSelectedDuration] = useState<typeof DURATIONS[0] | null>(null);

  const [actionLoading, setActionLoading] = useState(false);
  const sheetAnim = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsub = registerListener(onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as UserItem[];
      setUsers(list);
      setLoading(false);
    }, (err) => {
      if (err.code === 'permission-denied' || sessionState.isEnding) return;
      console.error('Admin Users Snapshot Error:', err);
    }));
    return () => unsub();
  }, [auth.currentUser]);

  const filteredUsers = users.filter(u => {
    const lowerQuery = searchQuery.toLowerCase();
    const nameMatch = u.name?.toLowerCase().includes(lowerQuery);
    const emailMatch = u.email?.toLowerCase().includes(lowerQuery);

    let roleMatch = true;
    if (activeCategory === 'Students') roleMatch = !u.isExpert && u.role !== 'admin';
    if (activeCategory === 'Experts') roleMatch = u.isExpert;
    if (activeCategory === 'Admins') roleMatch = u.role === 'admin';
    if (activeCategory === 'Banned') roleMatch = !!u.isBanned || !!u.isSuspended;

    return (nameMatch || emailMatch) && roleMatch;
  });

  // ── Sheet helpers ───────────────────────────────────────────────────────────
  const openSheet = (user: UserItem) => {
    setSelectedUser(user);
    setShowBanInput(false);
    setShowSuspendInput(false);
    setBanReason('');
    setSuspendReason('');
    setSelectedDuration(null);
    setSheetVisible(true);
    Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
  };

  const closeSheet = () => {
    Animated.timing(sheetAnim, { toValue: 600, useNativeDriver: true, duration: 250 }).start(() => {
      setSheetVisible(false);
      setSelectedUser(null);
    });
  };

  // ── Permanent Ban ───────────────────────────────────────────────────────────
  const handleBan = async () => {
    if (!selectedUser) return;
    if (!banReason.trim()) {
      Alert.alert('Reason Required', 'Please provide a reason for the ban.');
      return;
    }
    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'users', selectedUser.id), {
        isBanned: true,
        banReason: banReason.trim(),
        bannedAt: serverTimestamp(),
        bannedBy: auth.currentUser?.email || 'admin',
      });
      await addDoc(collection(db, 'users', selectedUser.id, 'notifications'), {
        title: '⛔ Account Suspended',
        message: `Your account has been permanently suspended. Reason: ${banReason.trim()}`,
        type: 'ban',
        createdAt: serverTimestamp(),
        read: false,
      });
      Alert.alert('User Banned', `${selectedUser.name || selectedUser.email} has been permanently suspended.`);
      closeSheet();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not ban this user.');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Unban ───────────────────────────────────────────────────────────────────
  const handleUnban = async () => {
    if (!selectedUser) return;
    Alert.alert('Lift Suspension', `Restore ${selectedUser.name || selectedUser.email}'s access?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore',
        onPress: async () => {
          setActionLoading(true);
          try {
            await updateDoc(doc(db, 'users', selectedUser.id), {
              isBanned: false, banReason: null, bannedAt: null, bannedBy: null,
            });
            await addDoc(collection(db, 'users', selectedUser.id, 'notifications'), {
              title: '✅ Account Restored',
              message: 'Your account suspension has been lifted. Welcome back!',
              type: 'success', createdAt: serverTimestamp(), read: false,
            });
            Alert.alert('Restored', `${selectedUser.name || selectedUser.email} can log in again.`);
            closeSheet();
          } catch (e) {
            Alert.alert('Error', 'Could not restore this user.');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  // ── Timed Suspension (experts) ──────────────────────────────────────────────
  const handleSuspend = async () => {
    if (!selectedUser || !selectedUser.isExpert) return;
    if (!suspendReason.trim()) {
      Alert.alert('Reason Required', 'Please provide a reason for this suspension.');
      return;
    }
    if (!selectedDuration) {
      Alert.alert('Duration Required', 'Please select how long the suspension should last.');
      return;
    }
    setActionLoading(true);
    try {
      const endsAt = new Date(Date.now() + selectedDuration.ms);
      await updateDoc(doc(db, 'users', selectedUser.id), {
        isSuspended: true,
        suspensionReason: suspendReason.trim(),
        suspensionEndsAt: Timestamp.fromDate(endsAt),
        suspendedBy: auth.currentUser?.email || 'admin',
        // Also hide their expert listing during suspension
        isVerified: false,
      });
      await addDoc(collection(db, 'users', selectedUser.id, 'notifications'), {
        title: '⏳ Expert Listing Suspended',
        message: `Your expert profile has been temporarily suspended for ${selectedDuration.label}. Reason: ${suspendReason.trim()}. It will be automatically restored on ${endsAt.toLocaleDateString()} at ${endsAt.toLocaleTimeString()}.`,
        type: 'warning',
        createdAt: serverTimestamp(),
        read: false,
      });
      Alert.alert('Suspended', `${selectedUser.name}'s expert listing is suspended for ${selectedDuration.label}.`);
      closeSheet();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not suspend this expert.');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Lift timed suspension ───────────────────────────────────────────────────
  const handleLiftSuspension = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'users', selectedUser.id), {
        isSuspended: false,
        suspensionReason: null,
        suspensionEndsAt: null,
        suspendedBy: null,
        isVerified: true,
      });
      await addDoc(collection(db, 'users', selectedUser.id, 'notifications'), {
        title: '✅ Expert Listing Restored',
        message: 'Your expert listing suspension has been lifted early. You are visible in the marketplace again.',
        type: 'success', createdAt: serverTimestamp(), read: false,
      });
      Alert.alert('Lifted', 'Expert suspension removed. Their listing is now visible again.');
      closeSheet();
    } catch (e) {
      Alert.alert('Error', 'Could not lift the suspension.');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const isActivelyRestricted = (u: UserItem) => u.isBanned || u.isSuspended;

  const renderUserItem = ({ item }: { item: UserItem }) => {
    const isSuspendedActive = item.isSuspended && item.suspensionEndsAt
      ? item.suspensionEndsAt.toDate ? item.suspensionEndsAt.toDate() > new Date() : false
      : false;

    return (
      <TouchableOpacity
        style={[
          styles.userCard,
          item.isBanned && styles.userCardBanned,
          isSuspendedActive && !item.isBanned && styles.userCardSuspended,
        ]}
        activeOpacity={0.7}
        onPress={() => openSheet(item)}
      >
        <View style={[
          styles.avatarBox,
          item.isBanned ? { backgroundColor: '#FFE5E5' } : isSuspendedActive ? { backgroundColor: '#FFF4E5' } : { backgroundColor: '#F2F2F7' }
        ]}>
          <Text style={[
            styles.avatarText,
            item.isBanned && { color: '#FF3B30' },
            isSuspendedActive && !item.isBanned && { color: '#FF9500' },
          ]}>
            {item.name?.[0] || item.email?.[0]?.toUpperCase() || '?'}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.userName}>{item.name || 'Anonymous'}</Text>
            {item.role === 'admin' && (
              <View style={[styles.roleBadge, { backgroundColor: '#5856D6' }]}>
                <Text style={styles.roleText}>Admin</Text>
              </View>
            )}
            {item.isExpert && (
              <View style={[styles.roleBadge, { backgroundColor: '#D9F15D' }]}>
                <Text style={[styles.roleText, { color: '#000' }]}>Expert</Text>
              </View>
            )}
            {item.isBanned && (
              <View style={[styles.roleBadge, { backgroundColor: '#FF3B30' }]}>
                <Text style={styles.roleText}>Banned</Text>
              </View>
            )}
            {isSuspendedActive && !item.isBanned && (
              <View style={[styles.roleBadge, { backgroundColor: '#FF9500' }]}>
                <Text style={styles.roleText}>Suspended</Text>
              </View>
            )}
          </View>
          <Text style={styles.userEmail}>{item.email}</Text>
          {item.isBanned
            ? <Text style={styles.restrictionText} numberOfLines={1}>⛔ {item.banReason}</Text>
            : isSuspendedActive
            ? <Text style={[styles.restrictionText, { color: '#FF9500' }]}numberOfLines={1}>
                ⏳ {formatSuspensionEnd(item.suspensionEndsAt)}
              </Text>
            : <Text style={styles.joinedText}>
                Joined {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}
              </Text>
          }
        </View>
        <View style={styles.balanceInfo}>
          <Text style={styles.balanceLabel}>Balance</Text>
          <Text style={styles.balanceValue}>₵{(item.balance || 0).toLocaleString()}</Text>
          <Feather name="chevron-right" size={16} color="#C6C6C8" style={{ marginTop: 6 }} />
        </View>
      </TouchableOpacity>
    );
  };

  const bannedCount = users.filter(u => u.isBanned || u.isSuspended).length;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>User Management</Text>
          <View style={styles.headerMeta}>
            <Text style={styles.headerCount}>{users.length} Total</Text>
            {bannedCount > 0 && (
              <View style={styles.bannedBadge}>
                <Text style={styles.bannedBadgeText}>{bannedCount} Restricted</Text>
              </View>
            )}
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Feather name="search" size={18} color="#8E8E93" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or email..."
              placeholderTextColor="#8E8E93"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#8E8E93" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Category Tabs */}
        <View style={styles.categoryContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.catBtn,
                  activeCategory === cat && styles.catBtnActive,
                  cat === 'Banned' && styles.catBtnDanger,
                  cat === 'Banned' && activeCategory === cat && styles.catBtnDangerActive,
                ]}
                onPress={() => setActiveCategory(cat)}
              >
                <Text style={[styles.catText, activeCategory === cat && styles.catTextActive]}>
                  {cat === 'Banned' ? '⛔ Restricted' : cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color="#000" /></View>
        ) : (
          <FlatList
            data={filteredUsers}
            renderItem={renderUserItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            initialNumToRender={10}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="search" size={50} color="#E5E5EA" />
                <Text style={styles.emptyText}>No users found.</Text>
              </View>
            }
          />
        )}

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          <TouchableOpacity style={styles.tabItem} onPress={() => router.push('/dashboard')}>
            <Ionicons name="shield-outline" size={22} color="#A0A0A0" />
            <Text style={styles.tabText}>Shield</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabItem}>
            <View style={styles.activeTabIconBg}>
              <Ionicons name="people" size={20} color="#FFF" />
            </View>
            <Text style={styles.activeTabText}>Users</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabItem} onPress={() => router.push('/profile')}>
            <Feather name="user" size={22} color="#A0A0A0" />
            <Text style={styles.tabText}>Profile</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ── User Action Bottom Sheet ─────────────────────────────────────────── */}
      <Modal visible={sheetVisible} transparent animationType="none" onRequestClose={closeSheet}>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={closeSheet} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetAnim }] }]}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {selectedUser && (
              <>
                {/* Handle */}
                <View style={styles.sheetHandle} />

                {/* User Row */}
                <View style={styles.sheetUserRow}>
                  <View style={[styles.sheetAvatar, {
                    backgroundColor: selectedUser.isBanned ? '#FFE5E5' : selectedUser.isSuspended ? '#FFF4E5' : '#F2F2F7'
                  }]}>
                    <Text style={[styles.sheetAvatarText,
                      selectedUser.isBanned && { color: '#FF3B30' },
                      selectedUser.isSuspended && !selectedUser.isBanned && { color: '#FF9500' }
                    ]}>
                      {selectedUser.name?.[0]?.toUpperCase() || '?'}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={styles.sheetUserName}>{selectedUser.name || 'Anonymous'}</Text>
                    <Text style={styles.sheetUserEmail}>{selectedUser.email}</Text>
                    {selectedUser.isBanned
                      ? <Text style={styles.sheetRestrictionLabel}>⛔ Permanently banned — {selectedUser.banReason}</Text>
                      : selectedUser.isSuspended
                      ? <Text style={[styles.sheetRestrictionLabel, { color: '#FF9500' }]}>
                          ⏳ Suspended — {formatSuspensionEnd(selectedUser.suspensionEndsAt)}
                        </Text>
                      : null
                    }
                  </View>
                  <View style={[styles.sheetStatusTag, {
                    backgroundColor: selectedUser.isBanned ? '#FFE5E5' : selectedUser.isSuspended ? '#FFF4E5' : '#E5F8E5'
                  }]}>
                    <Text style={[styles.sheetStatusText, {
                      color: selectedUser.isBanned ? '#FF3B30' : selectedUser.isSuspended ? '#FF9500' : '#34C759'
                    }]}>
                      {selectedUser.isBanned ? 'Banned' : selectedUser.isSuspended ? 'Suspended' : 'Active'}
                    </Text>
                  </View>
                </View>

                <View style={styles.sheetDivider} />

                {/* Stats */}
                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>₵{(selectedUser.balance || 0).toLocaleString()}</Text>
                    <Text style={styles.statLabel}>Balance</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>{selectedUser.isExpert ? 'Yes' : 'No'}</Text>
                    <Text style={styles.statLabel}>Expert</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>{selectedUser.role === 'admin' ? 'Admin' : 'User'}</Text>
                    <Text style={styles.statLabel}>Role</Text>
                  </View>
                </View>

                <View style={styles.sheetDivider} />

                {/* ── Restore buttons if restricted ─────────────── */}
                {selectedUser.isBanned && (
                  <TouchableOpacity style={styles.actionBtn} onPress={handleUnban} disabled={actionLoading}>
                    {actionLoading ? <ActivityIndicator color="#34C759" /> : <>
                      <View style={[styles.actionIconBg, { backgroundColor: '#E5F8E5' }]}>
                        <MaterialIcons name="lock-open" size={20} color="#34C759" />
                      </View>
                      <View style={{ flex: 1, marginLeft: 14 }}>
                        <Text style={styles.actionTitle}>Lift Permanent Ban</Text>
                        <Text style={styles.actionSub}>Restore full access to the app</Text>
                      </View>
                      <Feather name="chevron-right" size={18} color="#C6C6C8" />
                    </>}
                  </TouchableOpacity>
                )}

                {selectedUser.isSuspended && !selectedUser.isBanned && (
                  <TouchableOpacity style={styles.actionBtn} onPress={handleLiftSuspension} disabled={actionLoading}>
                    {actionLoading ? <ActivityIndicator color="#34C759" /> : <>
                      <View style={[styles.actionIconBg, { backgroundColor: '#E5F8E5' }]}>
                        <MaterialIcons name="restore" size={20} color="#34C759" />
                      </View>
                      <View style={{ flex: 1, marginLeft: 14 }}>
                        <Text style={styles.actionTitle}>Lift Expert Suspension Early</Text>
                        <Text style={styles.actionSub}>Re-enable their marketplace listing now</Text>
                      </View>
                      <Feather name="chevron-right" size={18} color="#C6C6C8" />
                    </>}
                  </TouchableOpacity>
                )}

                {/* ── Timed Suspension (experts only, not banned) ─── */}
                {selectedUser.isExpert && !selectedUser.isBanned && !selectedUser.isSuspended && (
                  <>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => { setShowSuspendInput(v => !v); setShowBanInput(false); }}
                    >
                      <View style={[styles.actionIconBg, { backgroundColor: '#FFF4E5' }]}>
                        <MaterialIcons name="timer-off" size={20} color="#FF9500" />
                      </View>
                      <View style={{ flex: 1, marginLeft: 14 }}>
                        <Text style={[styles.actionTitle, { color: '#FF9500' }]}>Suspend Expert Listing</Text>
                        <Text style={styles.actionSub}>Temporarily hide from marketplace (hours / days)</Text>
                      </View>
                      <Feather name={showSuspendInput ? 'chevron-up' : 'chevron-down'} size={18} color="#FF9500" />
                    </TouchableOpacity>

                    {showSuspendInput && (
                      <View style={styles.suspendSection}>
                        {/* Duration chips */}
                        <Text style={styles.sectionLabel}>SUSPENSION DURATION</Text>
                        <View style={styles.durationRow}>
                          {DURATIONS.map(d => (
                            <TouchableOpacity
                              key={d.label}
                              style={[styles.durationChip, selectedDuration?.label === d.label && styles.durationChipActive]}
                              onPress={() => setSelectedDuration(d)}
                            >
                              <Text style={[styles.durationChipText, selectedDuration?.label === d.label && styles.durationChipTextActive]}>
                                {d.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        {selectedDuration && (
                          <Text style={styles.durationHint}>
                            Suspension ends: {new Date(Date.now() + selectedDuration.ms).toLocaleString()}
                          </Text>
                        )}

                        <Text style={[styles.sectionLabel, { marginTop: 14 }]}>REASON</Text>
                        <TextInput
                          style={styles.banInput}
                          placeholder="State reason for suspension..."
                          placeholderTextColor="#C6C6C8"
                          value={suspendReason}
                          onChangeText={setSuspendReason}
                          multiline
                          maxLength={200}
                        />
                        <TouchableOpacity
                          style={[styles.confirmSuspendBtn, (!suspendReason.trim() || !selectedDuration) && { opacity: 0.4 }]}
                          onPress={handleSuspend}
                          disabled={actionLoading || !suspendReason.trim() || !selectedDuration}
                        >
                          {actionLoading
                            ? <ActivityIndicator color="#FFF" />
                            : <Text style={styles.confirmBtnText}>⏳ Confirm Suspension</Text>
                          }
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                )}

                {/* ── Permanent Ban (non-admin, not already banned) ─ */}
                {selectedUser.role !== 'admin' && !selectedUser.isBanned && (
                  <>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => { setShowBanInput(v => !v); setShowSuspendInput(false); }}
                    >
                      <View style={[styles.actionIconBg, { backgroundColor: '#FFE5E5' }]}>
                        <MaterialIcons name="block" size={20} color="#FF3B30" />
                      </View>
                      <View style={{ flex: 1, marginLeft: 14 }}>
                        <Text style={[styles.actionTitle, { color: '#FF3B30' }]}>Permanently Ban User</Text>
                        <Text style={styles.actionSub}>Block all app access indefinitely</Text>
                      </View>
                      <Feather name={showBanInput ? 'chevron-up' : 'chevron-down'} size={18} color="#FF3B30" />
                    </TouchableOpacity>

                    {showBanInput && (
                      <View style={styles.banSection}>
                        <TextInput
                          style={styles.banInput}
                          placeholder="State reason for permanent ban..."
                          placeholderTextColor="#C6C6C8"
                          value={banReason}
                          onChangeText={setBanReason}
                          multiline
                          maxLength={200}
                        />
                        <TouchableOpacity
                          style={[styles.confirmBanBtn, !banReason.trim() && { opacity: 0.4 }]}
                          onPress={handleBan}
                          disabled={actionLoading || !banReason.trim()}
                        >
                          {actionLoading
                            ? <ActivityIndicator color="#FFF" />
                            : <Text style={styles.confirmBtnText}>⛔ Confirm Permanent Ban</Text>
                          }
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                )}

                {selectedUser.role === 'admin' && (
                  <View style={styles.adminProtectedRow}>
                    <Ionicons name="shield-checkmark" size={18} color="#5856D6" />
                    <Text style={styles.adminProtectedText}>Admin accounts cannot be restricted.</Text>
                  </View>
                )}

                {/* Cancel */}
                <TouchableOpacity style={styles.cancelBtn} onPress={closeSheet}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F2F2F7' },

  header: { padding: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 24, color: '#000' },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  headerCount: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#8E8E93' },
  bannedBadge: { backgroundColor: '#FFE5E5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  bannedBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 11, color: '#FF3B30' },

  searchContainer: { padding: 16, backgroundColor: '#FFF' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2F2F7', borderRadius: 12, paddingHorizontal: 15, height: 44 },
  searchInput: { flex: 1, marginLeft: 10, fontFamily: 'Inter_400Regular', color: '#000', fontSize: 16 },

  categoryContainer: { backgroundColor: '#FFF', paddingBottom: 12 },
  catBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F2F2F7', marginRight: 8 },
  catBtnActive: { backgroundColor: '#000' },
  catBtnDanger: { backgroundColor: '#FFE5E5' },
  catBtnDangerActive: { backgroundColor: '#FF3B30' },
  catText: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#8E8E93' },
  catTextActive: { color: '#FFF' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16, paddingBottom: 120 },

  userCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  userCardBanned: { borderWidth: 1, borderColor: '#FFD5D5', backgroundColor: '#FFF9F9' },
  userCardSuspended: { borderWidth: 1, borderColor: '#FFE0B2', backgroundColor: '#FFFBF5' },
  avatarBox: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#000' },
  userInfo: { flex: 1, marginLeft: 15 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' },
  userName: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#000' },
  userEmail: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#8E8E93' },
  joinedText: { fontFamily: 'Inter_400Regular', fontSize: 10, color: '#C6C6C8', marginTop: 4 },
  restrictionText: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#FF3B30', marginTop: 4 },

  roleBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  roleText: { fontFamily: 'Inter_700Bold', fontSize: 8, color: '#FFF' },

  balanceInfo: { alignItems: 'flex-end' },
  balanceLabel: { fontFamily: 'Inter_400Regular', fontSize: 10, color: '#8E8E93', marginBottom: 2 },
  balanceValue: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#000' },

  emptyState: { alignItems: 'center', marginTop: 100 },
  emptyText: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#8E8E93', marginTop: 15 },

  tabBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 90, backgroundColor: 'rgba(255,255,255,0.9)', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingBottom: Platform.OS === 'ios' ? 20 : 0, borderTopWidth: 1, borderTopColor: '#E5E5EA' },
  tabItem: { alignItems: 'center', justifyContent: 'center', minWidth: 60 },
  activeTabIconBg: { backgroundColor: '#000', width: 42, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  activeTabText: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#000' },
  tabText: { fontFamily: 'Inter_400Regular', fontSize: 10, color: '#8E8E93', marginTop: 4 },

  // Sheet
  sheetOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 28, maxHeight: '90%', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 20 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E5EA', alignSelf: 'center', marginTop: 12, marginBottom: 20 },

  sheetUserRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  sheetAvatar: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  sheetAvatarText: { fontFamily: 'Inter_700Bold', fontSize: 22, color: '#000' },
  sheetUserName: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#000' },
  sheetUserEmail: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#8E8E93', marginTop: 2 },
  sheetRestrictionLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#FF3B30', marginTop: 4 },
  sheetStatusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  sheetStatusText: { fontFamily: 'Inter_700Bold', fontSize: 12 },

  sheetDivider: { height: 1, backgroundColor: '#F2F2F7', marginBottom: 20 },

  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#000' },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#8E8E93', marginTop: 2 },
  statDivider: { width: 1, height: 36, backgroundColor: '#F2F2F7' },

  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderRadius: 16, marginBottom: 8 },
  actionIconBg: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  actionTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#000' },
  actionSub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#8E8E93', marginTop: 2 },

  // Suspend section
  suspendSection: { backgroundColor: '#FFFBF0', borderRadius: 16, padding: 16, marginBottom: 12 },
  sectionLabel: { fontFamily: 'Inter_700Bold', fontSize: 11, color: '#8E8E93', letterSpacing: 0.5, marginBottom: 10 },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  durationChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F2F2F7', borderWidth: 1, borderColor: '#E5E5EA' },
  durationChipActive: { backgroundColor: '#FF9500', borderColor: '#FF9500' },
  durationChipText: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#8E8E93' },
  durationChipTextActive: { color: '#FFF' },
  durationHint: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#FF9500', marginBottom: 4 },
  confirmSuspendBtn: { backgroundColor: '#FF9500', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 12 },

  // Ban section
  banSection: { backgroundColor: '#FFF5F5', borderRadius: 16, padding: 16, marginBottom: 12 },
  banInput: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#000', minHeight: 70, textAlignVertical: 'top', backgroundColor: '#F9F9F9', borderRadius: 10, padding: 12, marginTop: 4 },
  confirmBanBtn: { backgroundColor: '#FF3B30', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  confirmBtnText: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#FFF' },

  adminProtectedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F0EFFE', borderRadius: 12, padding: 14, marginBottom: 12 },
  adminProtectedText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#5856D6' },

  cancelBtn: { backgroundColor: '#F2F2F7', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4, marginBottom: 8 },
  cancelText: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#000' },
});
