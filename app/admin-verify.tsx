import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  SafeAreaView, ActivityIndicator, Alert, Platform, Image, Modal
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { auth, db, registerListener, sessionState } from '../config/firebase';
import { 
  collection, query, where, onSnapshot, doc, updateDoc, addDoc, serverTimestamp 
} from 'firebase/firestore';
import { useTheme } from '../context/ThemeContext';

interface PendingExpert {
  id: string;
  name: string;
  role: string;
  trade?: string;
  email: string;
  isVerified: boolean;
  color?: string;
  ghanaCardNumber?: string;
  ghanaCardImage?: string;
  ghanaCardBack?: string;
  selfiePic?: string;
  expertBio?: string;
  skills?: string[];
}

export default function AdminVerifyScreen() {
  const router = useRouter();
  const { isDark, theme } = useTheme();
  const [pendingExperts, setPendingExperts] = useState<PendingExpert[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  useEffect(() => {
    // Fetch directly from the new dedicated Application Backend queue
    const q = query(
      collection(db, 'expertApplications'),
      where('status', '==', 'pending')
    );

    const unsub = registerListener(onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as PendingExpert[];
      
      setPendingExperts(list);
      setLoading(false);
    }, (err) => {
      setLoading(false);
      if (sessionState.isEnding) return;
      console.error("Admin Verify Error:", err);
      Alert.alert("Database Error", "Could not load applications. " + err.message);
    }));

    return () => unsub();
  }, [auth.currentUser]);

  const handleVerify = async (expert: PendingExpert) => {
    Alert.alert(
      "Verify Expert",
      `Are you sure you want to verify ${expert.name || 'this user'}?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Confirm", 
          onPress: async () => {
            try {
              // 1. Mark Application as Approved in the dedicated backend
              await updateDoc(doc(db, 'expertApplications', expert.id), {
                status: 'approved'
              });

              // 2. Promote the standard User Account in the main collection
              await updateDoc(doc(db, 'users', expert.id), {
                isExpert: true,
                isVerified: true,
                professionalName: expert.name, // Legal name for marketplace display only
                avatarUrl: expert.selfiePic || '', // Use the selfie as their profile pic
                trade: expert.trade,
                skills: expert.skills,
                expertBio: expert.expertBio,
                ghanaCardNumber: expert.ghanaCardNumber
                // NOTE: 'name' is intentionally NOT overwritten — it stays as the original account name
              });

              // 3. Send Notification
              await addDoc(collection(db, 'users', expert.id, 'notifications'), {
                title: "You're Verified!",
                message: "Congratulations! Your expert profile has been approved and is now visible in the marketplace.",
                type: 'success',
                createdAt: serverTimestamp(),
                read: false
              });

              Alert.alert("Success", `${expert.name || 'User'} is now a verified expert.`);
            } catch (error) {
              console.error(error);
              Alert.alert("Error", "Could not verify expert.");
            }
          } 
        }
      ]
    );
  };

  const renderExpertItem = ({ item }: { item: PendingExpert }) => {
    const isExpanded = expandedId === item.id;
    const safeName = item.name || 'Unknown Expert';

    return (
      <View style={[styles.expertCard, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: isDark ? 1 : 0 }]}>
        <TouchableOpacity 
          style={styles.cardHeader} 
          onPress={() => setExpandedId(isExpanded ? null : item.id)}
          activeOpacity={0.7}
        >
          <View style={[styles.avatarBox, { backgroundColor: item.color || '#D9F15D' }]}>
            <Text style={[styles.avatarText, { color: '#000' }]}>{safeName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.expertInfo}>
            <Text style={[styles.expertName, { color: theme.text }]}>{safeName}</Text>
            <Text style={[styles.expertRole, { color: theme.subtext }]}>{item.trade || item.role}</Text>
          </View>
          <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={theme.subtext} />
        </TouchableOpacity>

        {isExpanded && (
          <View style={[styles.detailsSection, { backgroundColor: theme.cardAlt }]}>
            <View style={[styles.iosDivider, { backgroundColor: theme.divider }]} />
            
            <Text style={[styles.detailLabel, { color: theme.subtext }]}>PROOF OF IDENTITY</Text>
            <Text style={[styles.detailValue, { color: theme.text }]}>ID Number: {item.ghanaCardNumber || 'Not provided'}</Text>
            
            <View style={styles.imageRow}>
               <View style={styles.imageColumn}>
                  <Text style={[styles.imageLabel, { color: theme.subtext }]}>Front ID</Text>
                  {item.ghanaCardImage ? (
                    <TouchableOpacity onPress={() => setFullscreenImage(item.ghanaCardImage!)} activeOpacity={0.8}>
                      <Image source={{ uri: item.ghanaCardImage }} style={[styles.idPreview, { backgroundColor: theme.divider }]} resizeMode="cover" />
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.idPlaceholder, { backgroundColor: theme.divider }]}><Ionicons name="card-outline" size={30} color={theme.subtext} /></View>
                  )}
               </View>
               <View style={styles.imageColumn}>
                  <Text style={[styles.imageLabel, { color: theme.subtext }]}>Back ID</Text>
                  {item.ghanaCardBack ? (
                    <TouchableOpacity onPress={() => setFullscreenImage(item.ghanaCardBack!)} activeOpacity={0.8}>
                      <Image source={{ uri: item.ghanaCardBack }} style={[styles.idPreview, { backgroundColor: theme.divider }]} resizeMode="cover" />
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.idPlaceholder, { backgroundColor: theme.divider }]}><Ionicons name="card-outline" size={30} color={theme.subtext} /></View>
                  )}
               </View>
               <View style={styles.imageColumn}>
                  <Text style={[styles.imageLabel, { color: theme.subtext }]}>Selfie</Text>
                  {item.selfiePic ? (
                    <TouchableOpacity onPress={() => setFullscreenImage(item.selfiePic!)} activeOpacity={0.8}>
                      <Image source={{ uri: item.selfiePic }} style={[styles.idPreview, { backgroundColor: theme.divider }]} resizeMode="cover" />
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.idPlaceholder, { backgroundColor: theme.divider }]}><Ionicons name="camera-outline" size={30} color={theme.subtext} /></View>
                  )}
               </View>
            </View>

            <Text style={[styles.detailLabel, { color: theme.subtext }]}>PROFESSIONAL BIO</Text>
            <Text style={[styles.bioText, { color: theme.subtext }]}>{item.expertBio || 'No bio provided.'}</Text>
            
            <Text style={[styles.detailLabel, { color: theme.subtext }]}>SKILLS</Text>
            <View style={styles.skillsRow}>
              {item.skills?.map((skill, index) => (
                <View key={index} style={[styles.skillTag, { backgroundColor: theme.divider }]}>
                  <Text style={[styles.skillTagText, { color: theme.text }]}>{skill}</Text>
                </View>
              )) || <Text style={[styles.bioText, { color: theme.subtext }]}>None listed</Text>}
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity 
                style={[styles.btn, styles.verifyBtn]} 
                onPress={() => handleVerify(item)}
              >
                <Ionicons name="checkmark-circle" size={18} color="#000" />
                <Text style={styles.btnText}>Approve Expert</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.rejectBtn, { backgroundColor: 'transparent', borderColor: theme.divider }]}>
                <Text style={[styles.btnText, {color: '#FF3B30'}]}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.divider }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Verification Queue</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.text} />
          </View>
        ) : (
          <FlatList
            data={pendingExperts}
            renderItem={renderExpertItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="shield-checkmark" size={60} color={theme.divider} />
                <Text style={[styles.emptyText, { color: theme.text }]}>All Clear!</Text>
                <Text style={[styles.emptySubtext, { color: theme.subtext }]}>You've reviewed every application.</Text>
              </View>
            }
          />
        )}
      </SafeAreaView>

      {/* Full Screen Image Modal */}
      <Modal visible={!!fullscreenImage} transparent={true} animationType="fade">
        <View style={styles.modalBackground}>
          <TouchableOpacity 
            style={styles.closeModalBtn} 
            onPress={() => setFullscreenImage(null)}
          >
            <Ionicons name="close-circle" size={40} color="#FFF" />
            <Text style={{ color: '#FFF', marginTop: 4, fontFamily: 'Inter_700Bold' }}>Close</Text>
          </TouchableOpacity>
          {fullscreenImage && (
            <Image 
              source={{ uri: fullscreenImage }} 
              style={styles.modalImage} 
              resizeMode="contain" 
            />
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F2F2F7' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA'
  },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  listContent: { padding: 16 },
  expertCard: {
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    overflow: 'hidden'
  },
  cardHeader: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBox: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  expertInfo: { flex: 1, marginLeft: 15 },
  expertName: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  expertRole: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  
  detailsSection: {
    padding: 16,
    paddingTop: 0,
    backgroundColor: '#FAFAFA'
  },
  iosDivider: { height: 1, marginVertical: 15 },
  detailLabel: { fontFamily: 'Inter_700Bold', fontSize: 11, marginBottom: 8, letterSpacing: 0.5 },
  detailValue: { fontFamily: 'Inter_400Regular', fontSize: 14, marginBottom: 15 },
  imageRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  imageColumn: { flex: 1 },
  imageLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, marginBottom: 6, textAlign: 'center' },
  idPreview: { width: '100%', height: 100, borderRadius: 12 },
  idPlaceholder: { width: '100%', height: 100, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  bioText: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, marginBottom: 20 },
  skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 25 },
  skillTag: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 },
  skillTagText: { fontFamily: 'Inter_700Bold', fontSize: 11 },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  btn: { 
    flex: 1,
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12
  },
  verifyBtn: { backgroundColor: '#D9F15D' },
  rejectBtn: { borderWidth: 1 },
  btnText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { fontFamily: 'Inter_700Bold', fontSize: 18, marginTop: 20 },
  emptySubtext: { fontFamily: 'Inter_400Regular', fontSize: 14, marginTop: 8 },
  modalBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  closeModalBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, alignItems: 'center' },
  modalImage: { width: '90%', height: '80%' }
});

