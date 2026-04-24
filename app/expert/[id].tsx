import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  Image, ActivityIndicator, Alert, Dimensions, Platform
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { doc, getDoc, collection, addDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import MapView, { Marker, PROVIDER_GOOGLE } from '../../components/MapComponents';
import { db, auth } from '../../config/firebase';

const { width } = Dimensions.get('window');

const silverMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }] },
  { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#f5f5f5" }] },
  { "featureType": "administrative.land_parcel", "elementType": "labels.text.fill", "stylers": [{ "color": "#bdbdbd" }] },
  { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#e5e5e5" }] },
  { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
  { "featureType": "road.arterial", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#dadada" }] },
  { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
  { "featureType": "road.local", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
  { "featureType": "transit.line", "elementType": "geometry", "stylers": [{ "color": "#e5e5e5" }] },
  { "featureType": "transit.station", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#c9c9c9" }] },
  { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] }
];

interface ExpertProfile {
  id: string;
  name: string;
  trade: string;
  expertBio: string;
  skills: string[];
  avatarUrl: string;
  rating: number;
  reviews: number;
  isVerified: boolean;
  color: string;
  coords?: {
    latitude: number;
    longitude: number;
  };
  basePrice?: number;
}

export default function ExpertDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { isDark, theme } = useTheme();
  const [profile, setProfile] = useState<ExpertProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchExpert() {
      try {
        if (!id) return;
        const docRef = doc(db, 'users', id as string);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProfile({
            id: docSnap.id,
            name: data.professionalName || data.name || 'Unknown Expert',
            trade: data.trade || 'Service Provider',
            expertBio: data.expertBio || 'This expert has not provided a biography yet.',
            skills: data.skills || [],
            avatarUrl: data.avatarUrl || '',
            rating: data.rating || 5.0,
            reviews: data.reviews || 0,
            isVerified: data.isVerified || false,
            color: data.color || '#D9F15D',
            coords: data.currentCoords || data.coords || { latitude: 5.6037, longitude: -0.1870 }, // Default to Accra
            basePrice: data.basePrice || 0
          });
        }
      } catch (err) {
        console.error("Error fetching expert:", err);
        Alert.alert("Error", "Could not load expert profile.");
      } finally {
        setLoading(false);
      }
    }
    fetchExpert();
  }, [id]);

  const handleBooking = async () => {
    if (!auth.currentUser || !profile) {
      if (Platform.OS === 'web') {
        window.alert("Auth Required: Please sign in to book an expert.");
      } else {
        Alert.alert("Auth Required", "Please sign in to book an expert.");
      }
      return;
    }

    const executeBooking = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        setLoading(true);
        const currentUserId = user.uid;
        
        // 1. Create the Job record
        const jobRef = await addDoc(collection(db, 'jobs'), {
          studentId: currentUserId,
          expertId: profile.id,
          status: 'pending',
          trade: profile.trade,
          price: profile.basePrice || 150, // Use expert's base price
          createdAt: serverTimestamp(),
          studentName: user.displayName || 'Student',
          expertName: profile.name,
        });

        // 2. Notify the Expert
        await addDoc(collection(db, 'users', profile.id, 'notifications'), {
          type: 'job',
          title: 'New Job Request! 🛠️',
          body: `${user.displayName || 'A student'} wants to hire you for ${profile.trade}.`,
          jobId: jobRef.id,
          read: false,
          createdAt: serverTimestamp(),
        });

        if (Platform.OS === 'web') {
          window.alert(`Request Sent! ${profile.name} has been notified. You can track this in your Jobs tab soon.`);
          router.push('/dashboard');
        } else {
          Alert.alert(
            "Request Sent!", 
            `${profile.name} has been notified. You can track this in your Jobs tab soon.`,
            [{ text: "OK", onPress: () => router.push('/dashboard') }]
          );
        }
      } catch (err) {
        console.error("Booking Error:", err);
        if (Platform.OS === 'web') {
          window.alert("Error: Failed to send booking request.");
        } else {
          Alert.alert("Error", "Failed to send booking request.");
        }
      } finally {
        setLoading(false);
      }
    };

    if (Platform.OS === 'web') {
      const confirm = window.confirm(`Send a job request to ${profile.name.split(' ')[0]} for ₵${profile.basePrice || 150}?`);
      if (confirm) {
        executeBooking();
      }
    } else {
      Alert.alert(
        "Confirm Request",
        `Send a job request to ${profile.name.split(' ')[0]} for ₵${profile.basePrice || 150}?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Send Request", onPress: executeBooking }
        ]
      );
    }
  };

  const handleMessage = async () => {
    try {
      const currentUserId = auth.currentUser?.uid;
      if (!currentUserId || !profile) return;

      setLoading(true);

      // Fetch current user's name from Firestore first (more reliable than displayName)
      const userDoc = await getDoc(doc(db, 'users', currentUserId));
      const currentUserName = userDoc.exists() ? userDoc.data().name : 'User';

      // 1. Check if a chat already exists between these two participants
      const chatsRef = collection(db, 'chats');
      const q = query(
        chatsRef, 
        where('participants', 'array-contains', currentUserId)
      );
      
      const querySnapshot = await getDocs(q);
      let chatId = null;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.participants.includes(profile.id)) {
          chatId = doc.id;
        }
      });

      // 2. If no chat exists, create one
      if (!chatId) {
        const newChatRef = await addDoc(collection(db, 'chats'), {
          participants: [currentUserId, profile.id],
          lastMessage: '',
          lastUpdatedAt: serverTimestamp(),
          participantInfo: {
            [currentUserId]: {
              name: currentUserName,
              role: 'Student',
              avatarUrl: userDoc.exists() ? (userDoc.data().avatarUrl || '') : ''
            },
            [profile.id]: {
              name: profile.name,
              role: profile.trade,
              avatarUrl: profile.avatarUrl || ''
            }
          }
        });
        chatId = newChatRef.id;
      }

      // 3. Navigate to the chat
      router.push(`/chat/${chatId}` as any);
    } catch (err) {
      console.error("Error starting chat:", err);
      Alert.alert("Error", "Could not start a conversation with this expert.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text>Expert not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: '#007AFF' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>

        <View style={[styles.fixedHeader, { backgroundColor: isDark ? '#000' : theme.bg }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color={isDark ? '#FFF' : theme.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn}>
            <Feather name="share" size={20} color={isDark ? '#FFF' : theme.text} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.coverPhoto} />

          <View style={styles.profileSection}>
             <View style={[styles.avatarContainer, { borderColor: theme.bg, borderWidth: 4 }]}>
               {profile.avatarUrl ? (
                 <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} resizeMode="cover" />
               ) : (
                 <View style={[styles.avatarImage, { backgroundColor: profile.color, justifyContent: 'center', alignItems: 'center' }]}>
                   <Ionicons name="person" size={50} color="#000" style={{ opacity: 0.5 }} />
                 </View>
               )}
             </View>

             <View style={styles.nameRow}>
                <Text style={[styles.expertName, { color: theme.text }]}>{profile.name}</Text>
                {profile.isVerified && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-sharp" size={10} color="#000" />
                  </View>
                )}
             </View>
             <Text style={[styles.expertTrade, { color: theme.subtext }]}>{profile.trade}</Text>

             <View style={styles.ratingRow}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={[styles.ratingText, { color: theme.text }]}>{Number(profile.rating).toFixed(1)}</Text>
                {profile.reviews > 0 && <Text style={[styles.reviewsText, { color: theme.subtext }]}>({profile.reviews} reviews)</Text>}
             </View>

             <View style={[styles.statsRow, { backgroundColor: theme.cardAlt }]}>
                <View style={styles.statBox}>
                   <Text style={[styles.statNumber, { color: theme.text }]}>100%</Text>
                   <Text style={[styles.statLabel, { color: theme.subtext }]}>Response</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
                <View style={styles.statBox}>
                   <Text style={[styles.statNumber, { color: theme.text }]}>Fast</Text>
                   <Text style={[styles.statLabel, { color: theme.subtext }]}>Delivery</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
                <View style={styles.statBox}>
                   <Text style={[styles.statNumber, { color: theme.text }]}>12+</Text>
                   <Text style={[styles.statLabel, { color: theme.subtext }]}>Jobs Done</Text>
                </View>
             </View>
          </View>

          <View style={[styles.detailsSection, { backgroundColor: theme.bg }]}>
             <Text style={[styles.sectionTitle, { color: theme.text }]}>About Me</Text>
             <Text style={[styles.bioText, { color: theme.subtext }]}>{profile.expertBio}</Text>
             
             <View style={[styles.divider, { backgroundColor: theme.border }]} />

             <Text style={[styles.sectionTitle, { color: theme.text }]}>Service Location</Text>
             <View style={styles.mapContainer}>
               {profile.coords ? (
                 <MapView
                   provider={PROVIDER_GOOGLE}
                   style={styles.miniMap}
                   customMapStyle={silverMapStyle}
                   initialRegion={{
                     ...profile.coords,
                     latitudeDelta: 0.01,
                     longitudeDelta: 0.01,
                   }}
                   scrollEnabled={false}
                   zoomEnabled={false}
                   onPress={() => router.push('/map-explorer')}
                 >
                   <Marker coordinate={profile.coords}>
                     <View style={[styles.markerBubble, { backgroundColor: isDark ? '#D9F15D' : '#000' }]}>
                       <Ionicons name="location" size={16} color={isDark ? '#000' : '#FFF'} />
                     </View>
                   </Marker>
                 </MapView>
               ) : (
                 <View style={[styles.miniMap, { backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' }]}>
                   <ActivityIndicator color="#000" />
                 </View>
               )}
               <TouchableOpacity 
                 style={[styles.mapExpandBtn, { backgroundColor: isDark ? '#1C1C1E' : 'rgba(255,255,255,0.9)' }]}
                 onPress={() => router.push('/map-explorer')}
               >
                 <Ionicons name="expand" size={18} color={theme.text} />
                 <Text style={[styles.mapExpandText, { color: theme.text }]}>Open Explorer</Text>
               </TouchableOpacity>
             </View>

             <View style={[styles.divider, { backgroundColor: theme.border }]} />

             <Text style={[styles.sectionTitle, { color: theme.text }]}>Top Skills</Text>
             <View style={styles.skillsWrapper}>
                {profile.skills.length > 0 ? (
                  profile.skills.map((skill, index) => (
                    <View key={index} style={[styles.skillTag, { backgroundColor: theme.cardAlt }]}>
                      <Text style={[styles.skillText, { color: theme.text }]}>{skill}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={[styles.bioText, { color: theme.subtext }]}>No skills listed.</Text>
                )}
             </View>
          </View>
        </ScrollView>

        {/* Sticky Bottom Bar */}
        <View style={[styles.bottomBar, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
           <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={[styles.priceLabel, { color: theme.subtext }]}>Starting at</Text>
              <Text style={[styles.priceValue, { color: theme.text }]}>₵{profile.basePrice || '---'}</Text>
           </View>
           
           <View style={styles.actionButtons}>
              <TouchableOpacity style={[styles.messageBtn, { backgroundColor: theme.bg }]} onPress={handleMessage}>
                 <Ionicons name="chatbubble-outline" size={24} color={theme.text} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.bookBtn, { backgroundColor: isDark ? '#D9F15D' : '#000' }]} onPress={handleBooking}>
                 <Text style={[styles.bookBtnText, { color: isDark ? '#000' : '#FFF' }]}>Book Now</Text>
              </TouchableOpacity>
           </View>
        </View>

      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: { paddingBottom: 120 },

  fixedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center'
  },

  coverPhoto: {
    width: '100%',
    height: 130,
    backgroundColor: '#000',
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.8)', justifyContent: 'center', alignItems: 'center' },
  profileSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: -55,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 20,
    paddingBottom: 20,
  },
  avatarContainer: {
    width: 110, height: 110, borderRadius: 55, backgroundColor: '#FFF',
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden', elevation: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10
  },
  avatarImage: { width: '100%', height: '100%', borderRadius: 55 },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 5 },
  expertName: { fontFamily: 'Inter_700Bold', fontSize: 24, letterSpacing: -0.5 },
  verifiedBadge: { backgroundColor: '#D9F15D', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  expertTrade: { fontFamily: 'Inter_400Regular', fontSize: 15, marginTop: 4 },
  
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 },
  ratingText: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  reviewsText: { fontFamily: 'Inter_400Regular', fontSize: 14 },
  
  statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9F9F9', borderRadius: 16, paddingVertical: 15, paddingHorizontal: 20, marginTop: 25, width: '100%', justifyContent: 'space-between' },
  statBox: { alignItems: 'center', flex: 1 },
  statNumber: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 },
  statDivider: { width: 1, height: 30 },

  detailsSection: { padding: 25 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, marginBottom: 12 },
  bioText: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 24 },
  divider: { height: 1, marginVertical: 25 },
  
  skillsWrapper: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  skillTag: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  skillText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  
  mapContainer: { 
    width: '100%', 
    height: 180, 
    borderRadius: 20, 
    overflow: 'hidden', 
    backgroundColor: '#F5F5F5',
    position: 'relative'
  },
  miniMap: { width: '100%', height: '100%' },
  markerBubble: { 
    backgroundColor: '#000', 
    padding: 6, 
    borderRadius: 20, 
    borderWidth: 2, 
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5
  },
  mapExpandBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3
  },
  mapExpandText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFF',
    borderTopWidth: 1, borderTopColor: '#E5E5EA',
    paddingHorizontal: 20, paddingVertical: 15, paddingBottom: 35,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 10
  },
  priceLabel: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  priceValue: { fontFamily: 'Inter_700Bold', fontSize: 22, marginTop: 2 },
  actionButtons: { flexDirection: 'row', gap: 15 },
  messageBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },
  bookBtn: { backgroundColor: '#000', paddingHorizontal: 30, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  bookBtnText: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#FFF' }
});
