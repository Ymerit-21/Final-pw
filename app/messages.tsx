import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  Image, ActivityIndicator, Platform 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { auth, db, registerListener, sessionState } from '../config/firebase';
import { 
  collection, query, where, orderBy, onSnapshot, doc, getDoc, 
  Timestamp, Unsubscribe 
} from 'firebase/firestore';
import { Stack, useRouter } from 'expo-router';
import { useTheme } from '../context/ThemeContext';

interface Chat {
  id: string;
  participants: string[];
  lastMessage: string;
  lastUpdatedAt: any;
  participantInfo: {
    [key: string]: {
      name: string;
      role: string;
    };
  };
  unreadCount?: {
    [key: string]: number;
  };
}

export default function MessagesScreen() {
  const router = useRouter();
  const { isDark, theme } = useTheme();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'experts' | 'support'>('all');
  const [loading, setLoading] = useState(true);

  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) return;

    // Listen for chats where the current user is a participant
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', currentUser.uid)
    );

    const unsub = registerListener(onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Chat[];
      
      // Client-side sort to avoid index requirement
      const sortedList = list.sort((a, b) => {
        const timeA = a.lastUpdatedAt?.seconds || 0;
        const timeB = b.lastUpdatedAt?.seconds || 0;
        return timeB - timeA;
      });

      setChats(sortedList);
      setLoading(false);
    }, (error) => {
      if (error.code === 'permission-denied' || sessionState.isEnding) return;
      console.error("Chats listener error:", error);
      setLoading(false);
    }));

    return () => unsub();
  }, [currentUser]);

  const filteredChats = chats.filter(chat => {
    if (activeTab === 'all') return true;
    
    const otherUserId = chat.participants.find(p => p !== currentUser?.uid);
    const otherUser = chat.participantInfo?.[otherUserId || ''];
    
    if (activeTab === 'experts') {
      // Any user that isn't Support is considered an Expert/Peer in this context
      return otherUser?.role !== 'Support' && otherUser?.role !== 'Admin';
    }
    
    if (activeTab === 'support') {
      return otherUser?.role === 'Support' || otherUser?.role === 'Admin';
    }
    
    return true;
  });

  const handleSupportChat = async () => {
    // Navigate to a dedicated support route or start a support chat
    // For now, we'll push to help-center or a specific support chat ID
    router.push('/help-center');
  };

  const renderChatItem = ({ item }: { item: Chat }) => {
    const unreadCount = item.unreadCount?.[currentUser?.uid || ''] || 0;
    const isUnread = unreadCount > 0;
    const otherUserId = item.participants.find(p => p !== currentUser?.uid);
    const otherUser = item.participantInfo?.[otherUserId || ''] || { name: 'Expert', role: 'Specialist' };

    return (
      <TouchableOpacity 
        style={[styles.chatCard, { borderBottomColor: theme.border }, isUnread && { backgroundColor: isDark ? '#0A1929' : '#F9FCFF' }]} 
        onPress={() => router.push(`/chat/${item.id}`)}
      >
        <View style={styles.avatarContainer}>
          <View style={[styles.avatarPlaceholder, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="person" size={24} color={theme.subtext} />
          </View>
          <View style={styles.onlineBadge} />
        </View>
        
        <View style={styles.chatInfo}>
          <View style={styles.chatHeaderRow}>
            <Text style={[styles.participantName, { color: theme.text }, isUnread && styles.unreadText]}>{otherUser.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {isUnread && <View style={styles.unreadDot} />}
              <Text style={[styles.chatTime, { color: theme.subtext }]}>
                {formatTime(item.lastUpdatedAt)}
              </Text>
            </View>
          </View>
          <Text style={[styles.lastMessage, { color: theme.subtext }, isUnread && { color: theme.text, fontFamily: 'Inter_600SemiBold' }]} numberOfLines={1}>
            {item.lastMessage || "Start a conversation..."}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.border} />
      </TouchableOpacity>
    );
  };

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
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Messages</Text>
        <TouchableOpacity style={styles.searchBtn}>
          <Feather name="search" size={22} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'all' ? { backgroundColor: isDark ? '#D9F15D' : '#000' } : { backgroundColor: theme.cardAlt }]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.filterTabText, activeTab === 'all' ? { color: isDark ? '#000' : '#FFF', fontFamily: 'Inter_700Bold' } : { color: theme.subtext }]}>All Chats</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'experts' ? { backgroundColor: isDark ? '#D9F15D' : '#000' } : { backgroundColor: theme.cardAlt }]}
          onPress={() => setActiveTab('experts')}
        >
          <Text style={[styles.filterTabText, activeTab === 'experts' ? { color: isDark ? '#000' : '#FFF', fontFamily: 'Inter_700Bold' } : { color: theme.subtext }]}>Experts</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'support' ? { backgroundColor: isDark ? '#D9F15D' : '#000' } : { backgroundColor: theme.cardAlt }]}
          onPress={() => setActiveTab('support')}
        >
          <Text style={[styles.filterTabText, activeTab === 'support' ? { color: isDark ? '#000' : '#FFF', fontFamily: 'Inter_700Bold' } : { color: theme.subtext }]}>Support</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredChats}
        renderItem={renderChatItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          activeTab === 'support' ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: theme.card }]}>
                <Ionicons name="headset-outline" size={40} color={theme.subtext} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Need Help?</Text>
              <Text style={[styles.emptySubtitle, { color: theme.subtext }]}>Our team of experts is available 24/7 to help you with any issues.</Text>
              <TouchableOpacity 
                style={[styles.exploreBtn, { backgroundColor: isDark ? '#D9F15D' : '#000' }]} 
                onPress={handleSupportChat}
              >
                <Text style={[styles.exploreBtnText, { color: isDark ? '#000' : '#FFF' }]}>Contact Support</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: theme.card }]}>
                <Ionicons name="chatbubbles-outline" size={40} color={theme.subtext} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No messages yet</Text>
              <Text style={[styles.emptySubtitle, { color: theme.subtext }]}>Find an expert on the map to start chatting!</Text>
              <TouchableOpacity 
                style={[styles.exploreBtn, { backgroundColor: isDark ? '#D9F15D' : '#000' }]} 
                onPress={() => router.push('/map-explorer')}
              >
                <Text style={[styles.exploreBtnText, { color: isDark ? '#000' : '#FFF' }]}>Explore Experts</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />

      {/* Bottom Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: theme.tabBar, borderTopColor: theme.border }]}>
        <TouchableOpacity style={styles.tabItem} onPress={() => router.push('/dashboard')}>
          <Ionicons name="home-outline" size={22} color={theme.tabIcon} />
          <Text style={[styles.tabText, { color: theme.tabIcon }]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <View style={[styles.activeTabIconBg, { backgroundColor: isDark ? '#D9F15D' : '#000' }]}>
            <Ionicons name="chatbubble-ellipses" size={20} color={isDark ? '#000' : '#FFF'} />
          </View>
          <Text style={[styles.activeTabText, { color: theme.text }]}>Messages</Text>
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
  );
}

function formatTime(timestamp: any) {
  if (!timestamp) return '';
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 20, 
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 22 },
  backBtn: { width: 40 },
  searchBtn: { width: 40, alignItems: 'flex-end' },
  tabsRow: { 
    flexDirection: 'row', 
    paddingHorizontal: 20, 
    gap: 15, 
    marginBottom: 20,
    marginTop: 10
  },
  tab: { 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 20, 
  },
  activeTab: { backgroundColor: '#000' },
  filterTabText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#666' },
  activeFilterTabText: { color: '#FFF', fontFamily: 'Inter_700Bold' },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  chatCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 15, 
    borderBottomWidth: 0.5, 
  },
  avatarContainer: { position: 'relative', marginRight: 15 },
  avatarPlaceholder: { 
    width: 60, 
    height: 60, 
    borderRadius: 30, 
    backgroundColor: '#F9F9F9', 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0F0F0'
  },
  onlineBadge: { 
    position: 'absolute', 
    bottom: 2, 
    right: 2, 
    width: 14, 
    height: 14, 
    borderRadius: 7, 
    backgroundColor: '#32D74B', 
    borderWidth: 2, 
  },
  chatInfo: { flex: 1 },
  chatHeaderRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 4 
  },
  participantName: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  chatTime: { fontFamily: 'Poppins_400Regular', fontSize: 11 },
  lastMessage: { fontFamily: 'Inter_400Regular', fontSize: 14 },
  emptyContainer: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingTop: 100 
  },
  emptyIconCircle: { 
    width: 100, 
    height: 100, 
    borderRadius: 50, 
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: 20
  },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, marginBottom: 10 },
  emptySubtitle: { 
    fontFamily: 'Inter_400Regular', 
    fontSize: 14, 
    textAlign: 'center', 
    paddingHorizontal: 40,
    lineHeight: 20
  },
  exploreBtn: { 
    paddingHorizontal: 30, 
    paddingVertical: 15, 
    borderRadius: 30, 
    marginTop: 30 
  },
  exploreBtnText: { fontFamily: 'Inter_700Bold', fontSize: 15 },
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
  activeTabIconBg: { 
    width: 45, 
    height: 35, 
    borderRadius: 10, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 5 
  },
  activeTabText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  tabText: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 5 },
  unreadChatCard: { backgroundColor: '#F9FCFF' },
  unreadText: { fontFamily: 'Inter_700Bold' },
  unreadLastMsgText: { color: '#000', fontFamily: 'Inter_600SemiBold' },
  unreadDot: { 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    backgroundColor: '#007AFF', 
    marginRight: 8 
  },
});
