import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  Platform, TextInput, SafeAreaView, KeyboardAvoidingView, Image
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { Shimmer, ExpertSkeleton } from '../components/Shimmer';
import { useTheme } from '../context/ThemeContext';

const CATEGORIES = ['All', 'Plumber', 'Electrician', 'Graphic Des.', 'Tutor'];

export default function MarketplaceScreen() {
  const router = useRouter();
  const { isDark, theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [experts, setExperts] = useState<any[]>([]);
  const [isCurrentUserExpert, setIsCurrentUserExpert] = useState(false);

  // Check if the current user is already an expert
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getDoc(doc(db, 'users', uid)).then(snap => {
      if (snap.exists()) {
        setIsCurrentUserExpert(snap.data().isExpert === true);
      }
    });
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'users'),
      where('isExpert', '==', true)
    );

    const unsub = onSnapshot(q, (snap) => {
      // Filter out current user on the client side since Firestore 
      // is already using equality filters on other fields
      const list = snap.docs
        .filter(doc => doc.id !== auth.currentUser?.uid && doc.data().isVerified === true)
        .map(doc => ({
          id: doc.id,
          name: doc.data().professionalName || doc.data().name || 'Expert',
          role: doc.data().trade || 'Service Provider',
          rating: doc.data().rating || 5.0,
          reviews: doc.data().reviews || 0,
          color: doc.data().color || '#D9F15D',
          icon: 'person-circle',
          isVerified: true,
          avatarUrl: doc.data().avatarUrl || null,
          basePrice: doc.data().basePrice || 0
        }));
      setExperts(list);
      setLoading(false);
    }, (err) => {
      // In tests/dev, sometimes indexes or permissions drop. Just stop loading.
      if (err.code === 'permission-denied') return;
      console.error("Marketplace Snapshot Error:", err);
      // Fallback empty state so UI doesn't crash hanging on loading
      setExperts([]);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const filteredExperts = experts.filter(expert => {
    const matchesCategory = activeCategory === 'All' || expert.role.toLowerCase().includes(activeCategory.toLowerCase().replace('.', ''));
    const matchesSearch = expert.name.toLowerCase().includes(searchQuery.toLowerCase()) || expert.role.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          
          <View style={styles.header}>
            <View style={{ width: 34 }} />
            <Text style={[styles.headerTitle, { color: theme.text }]}>Marketplace</Text>
            <TouchableOpacity 
              style={[styles.notificationIcon, { backgroundColor: theme.card }]}
              onPress={() => router.push('/map-explorer')}
            >
              <Ionicons name="map-outline" size={22} color={theme.text} />
            </TouchableOpacity>
          </View>

          <View style={[styles.searchContainer, { backgroundColor: theme.cardAlt }]}>
            <Ionicons name="search-outline" size={20} color={theme.subtext} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: theme.inputText }]}
              placeholder="Search experts..."
              placeholderTextColor={theme.placeholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>



          <View style={styles.categoriesWrapper}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesScroll}
            >
              {CATEGORIES.map(category => (
                <TouchableOpacity 
                  key={category} 
                  style={[
                    styles.categoryPill,
                    { backgroundColor: theme.cardAlt },
                    activeCategory === category && [styles.categoryPillActive, { backgroundColor: isDark ? '#D9F15D' : '#000' }]
                  ]}
                  onPress={() => setActiveCategory(category)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.categoryText,
                    { color: theme.text },
                    activeCategory === category && [styles.categoryTextActive, { color: isDark ? '#000' : '#FFF' }]
                  ]}>
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <ScrollView contentContainerStyle={styles.expertsList} showsVerticalScrollIndicator={false}>
            
            {isCurrentUserExpert ? (
              /* Already an expert — show manage card */
              <TouchableOpacity 
                style={[styles.offerCard, { backgroundColor: isDark ? '#1C1C1E' : '#1A1A1A' }]} 
                activeOpacity={0.8}
                onPress={() => router.push('/edit-expert-profile' as any)}
              >
                <View style={styles.offerContent}>
                  <View style={[styles.offerIconBg, { backgroundColor: '#D9F15D' }]}>
                    <Ionicons name="checkmark-circle" size={24} color="#000" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.offerTitle, { color: '#FFF' }]}>You're a Verified Expert ✓</Text>
                    <Text style={styles.offerSubtitle}>Your profile is live. Tap to manage your services.</Text>
                  </View>
                  <Feather name="chevron-right" size={24} color="#D9F15D" />
                </View>
              </TouchableOpacity>
            ) : (
              /* Not yet an expert — show offer services */
              <TouchableOpacity 
                style={[styles.offerCard, { backgroundColor: isDark ? '#1C1C1E' : '#000' }]} 
                activeOpacity={0.8}
                onPress={() => router.push('/expert-registration')}
              >
                <View style={styles.offerContent}>
                  <View style={[styles.offerIconBg, { backgroundColor: '#D9F15D' }]}>
                    <Ionicons name="construct-outline" size={24} color="#000" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.offerTitle, { color: '#FFF' }]}>Offer Services</Text>
                    <Text style={styles.offerSubtitle}>List your professional skills. Typical students earn <Text style={{fontFamily: 'Inter_700Bold', color: '#D9F15D'}}>₵50 - ₵150</Text> per job.</Text>
                  </View>
                  <Feather name="plus-circle" size={24} color="#D9F15D" />
                </View>
              </TouchableOpacity>
            )}

            {loading ? (
               <View style={{ marginTop: 10 }}>
                 <ExpertSkeleton />
                 <ExpertSkeleton />
                 <ExpertSkeleton />
                 <ExpertSkeleton />
               </View>
            ) : (
              <>
                {filteredExperts.map(expert => (
                  <TouchableOpacity 
                    key={expert.id} 
                    style={[styles.expertCard, { backgroundColor: theme.card }]} 
                    activeOpacity={0.7}
                    onPress={() => router.push(`/expert/${expert.id}` as any)}
                  >
                    <View style={styles.expertImagePlaceholder}>
                      {expert.avatarUrl ? (
                        <Image source={{ uri: expert.avatarUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      ) : (
                        <View style={[styles.expertSplash, { backgroundColor: expert.color }]}>
                          <Ionicons name={expert.icon as any} size={30} color="#000" style={{ opacity: 0.6 }} />
                        </View>
                      )}
                    </View>
                    <View style={styles.expertInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.expertName, { color: theme.text }]}>{expert.name}</Text>
                        {expert.isVerified && (
                          <View style={styles.verifiedBadge}>
                            <Ionicons name="checkmark-sharp" size={8} color="#000" />
                          </View>
                        )}
                      </View>
                      <Text style={[styles.expertRole, { color: theme.subtext }]}>{expert.role}</Text>
                      <View style={styles.ratingRow}>
                        <Ionicons name="star" size={14} color="#FFD700" />
                        <Text style={[styles.ratingScore, { color: theme.text }]}>{Number(expert.rating).toFixed(1)}</Text>
                        {expert.reviews > 0 && (
                          <Text style={[styles.ratingCount, { color: theme.subtext }]}>({expert.reviews} Reviews)</Text>
                        )}
                        <Text style={[styles.ratingCount, { color: theme.subtext }]}> • </Text>
                        <Text style={[styles.priceTag, { color: theme.text }]}>₵{expert.basePrice || '---'}</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.subtext} />
                  </TouchableOpacity>
                ))}
                
                {filteredExperts.length === 0 && (
                  <View style={styles.emptyState}>
                     <Ionicons name="search" size={40} color={theme.subtext} />
                     <Text style={[styles.emptyText, { color: theme.subtext }]}>No experts found.</Text>
                  </View>
                )}
              </>
            )}
            <View style={{ height: 100 }}/>
          </ScrollView>

        </KeyboardAvoidingView>

        {/* Floating Map Action */}
        <TouchableOpacity 
          style={[styles.mapFab, { backgroundColor: isDark ? '#D9F15D' : '#000' }]} 
          onPress={() => router.push('/map-explorer')}
          activeOpacity={0.9}
        >
          <View style={styles.mapFabContent}>
            <Ionicons name="map-outline" size={24} color={isDark ? '#000' : '#FFF'} />
            <Text style={[styles.mapFabText, { color: isDark ? '#000' : '#FFF' }]}>Map View</Text>
          </View>
        </TouchableOpacity>

        {/* Bottom Tab Bar */}
        <View style={[styles.tabBar, { backgroundColor: theme.tabBar, borderTopColor: theme.border }]}>
          <TouchableOpacity style={styles.tabItem} onPress={() => router.push('/dashboard')}>
            <Ionicons name="home-outline" size={22} color={theme.tabIcon} />
            <Text style={[styles.tabText, { color: theme.tabIcon }]}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabItem} onPress={() => router.push('/messages')}>
            <Ionicons name="chatbubble-ellipses-outline" size={22} color={theme.tabIcon} />
            <Text style={[styles.tabText, { color: theme.tabIcon }]}>Messages</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabItem}>
            <View style={[styles.activeTabIconBg, { backgroundColor: isDark ? '#D9F15D' : '#000' }]}>
              <Ionicons name="storefront" size={20} color={isDark ? '#000' : '#FFF'} />
            </View>
            <Text style={[styles.activeTabText, { color: theme.text }]}>Marketplace</Text>
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

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    marginBottom: 15,
  },
  headerTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3E3E8',
    borderRadius: 12,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 20,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
  },
  categoriesWrapper: { marginBottom: 20 },
  categoriesScroll: { paddingHorizontal: 16 },
  categoryPill: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  categoryPillActive: { backgroundColor: '#000' },
  categoryText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  categoryTextActive: { },

  expertsList: { paddingHorizontal: 16, paddingBottom: 20 },
  sectionTitle: { 
    fontFamily: 'Inter_700Bold', 
    fontSize: 13, 
    color: '#8E8E93', 
    marginBottom: 10,
    marginLeft: 10,
    textTransform: 'uppercase'
  },
  
  offerCard: {
    backgroundColor: '#000',
    borderRadius: 16,
    padding: 20,
    marginBottom: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  offerContent: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  offerIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#D9F15D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  offerTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#FFF', marginBottom: 2 },
  offerSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 18 },

  expertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5
  },
  expertImagePlaceholder: { width: 50, height: 50, borderRadius: 12, overflow: 'hidden', marginRight: 12 },
  expertSplash: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  expertInfo: { flex: 1 },
  expertName: { fontFamily: 'Inter_700Bold', fontSize: 15, marginBottom: 2 },
  expertRole: { fontFamily: 'Inter_400Regular', fontSize: 12, marginBottom: 6 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingScore: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  ratingCount: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  priceTag: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  verifiedBadge: { backgroundColor: '#D9F15D', width: 14, height: 14, borderRadius: 7, justifyContent: 'center', alignItems: 'center' },

  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 15, color: '#8E8E93', marginTop: 10 },
  
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
  tabText: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 4 },

  mapFab: {
    position: 'absolute',
    bottom: 110,
    alignSelf: 'center',
    backgroundColor: '#000',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  mapFabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mapFabText: {
    color: '#FFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },
});
