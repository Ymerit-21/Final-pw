import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  SafeAreaView, ActivityIndicator, Alert, Platform, Image
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { 
  collection, query, where, onSnapshot, orderBy, 
  updateDoc, doc, serverTimestamp, addDoc, getDoc
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { useTheme } from '../context/ThemeContext';

interface Job {
  id: string;
  studentId: string;
  expertId: string;
  studentName: string;
  expertName: string;
  trade: string;
  status: 'pending' | 'accepted' | 'completed' | 'cancelled';
  price: number;
  createdAt: any;
  isReviewed?: boolean;
  isPaid?: boolean;
}

export default function JobsScreen() {
  const router = useRouter();
  const { isDark, theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'student' | 'expert'>('student');
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isExpert, setIsExpert] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    // Check if user is an expert to show the toggle
    getDoc(doc(db, 'users', uid)).then(snap => {
      if (snap.exists() && snap.data().isExpert) {
        setIsExpert(true);
      }
    });

    const q = query(
      collection(db, 'jobs'),
      where(activeTab === 'student' ? 'studentId' : 'expertId', '==', uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Job));
      
      // Client-side sort to avoid index requirement over different fields
      list.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });

      setJobs(list);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsub();
  }, [activeTab]);

  const updateJobStatus = async (jobId: string, newStatus: string, expertId: string, studentId: string) => {
    try {
      await updateDoc(doc(db, 'jobs', jobId), { status: newStatus });
      
      // Notify the other party
      const recipientId = activeTab === 'student' ? expertId : studentId;
      await addDoc(collection(db, 'users', recipientId, 'notifications'), {
        type: 'job',
        title: `Job Update: ${newStatus.toUpperCase()}`,
        body: `The job for ${jobs.find(j => j.id === jobId)?.trade} has been marked as ${newStatus}.`,
        jobId,
        read: false,
        createdAt: serverTimestamp(),
      });

      Alert.alert("Success", `Job marked as ${newStatus}.`);
    } catch (err) {
      Alert.alert("Error", "Failed to update job status.");
    }
  };

  const handlePayment = async (job: Job) => {
    Alert.alert(
      "Confirm Payment",
      `Pay ₵${job.price} to ${job.expertName} for this service?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Pay Now", 
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'jobs', job.id), { isPaid: true });
              
              // Add debit transaction to Student's wallet
              await addDoc(collection(db, 'users', job.studentId, 'transactions'), {
                type: 'debit',
                description: `${job.trade} (Completed by ${job.expertName})`,
                amount: job.price,
                category: 'service',
                createdAt: serverTimestamp(),
              });

              // Add credit transaction to Expert's wallet
              await addDoc(collection(db, 'users', job.expertId, 'transactions'), {
                type: 'credit',
                description: `Received for ${job.trade} from ${job.studentName}`,
                amount: job.price,
                category: 'income',
                createdAt: serverTimestamp(),
              });

              Alert.alert("Payment Successful", "Your ledger has been updated automatically.");
            } catch (err) {
              console.error(err);
              Alert.alert("Error", "Failed to process payment.");
            }
          }
        }
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#FF9500';
      case 'accepted': return '#007AFF';
      case 'completed': return '#34C759';
      case 'cancelled': return '#FF3B30';
      default: return '#8E8E93';
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Jobs', headerShown: false }} />
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: theme.cardAlt }]}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Job Tracker</Text>
          <View style={{ width: 40 }} />
        </View>

        {isExpert && (
          <View style={[styles.tabWrapper, { backgroundColor: theme.cardAlt }]}>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'student' && [styles.activeTab, { backgroundColor: theme.card }]]}
              onPress={() => setActiveTab('student')}
            >
              <Text style={[styles.tabText, { color: theme.subtext }, activeTab === 'student' && [styles.activeTabText, { color: theme.text }]]}>Hiring</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'expert' && [styles.activeTab, { backgroundColor: theme.card }]]}
              onPress={() => setActiveTab('expert')}
            >
              <Text style={[styles.tabText, { color: theme.subtext }, activeTab === 'expert' && [styles.activeTabText, { color: theme.text }]]}>Work Orders</Text>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView contentContainerStyle={styles.listContent}>
          {loading ? (
            <ActivityIndicator color={theme.text} style={{ marginTop: 50 }} />
          ) : jobs.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="briefcase-outline" size={60} color={theme.divider} />
              <Text style={[styles.emptyText, { color: theme.subtext }]}>No {activeTab === 'student' ? 'hired experts' : 'jobs'} yet.</Text>
            </View>
          ) : (
            jobs.map((job) => (
              <View key={job.id} style={[styles.jobCard, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: isDark ? 1 : 0 }]}>
                <View style={styles.jobHeader}>
                  <View>
                    <Text style={[styles.tradeText, { color: theme.text }]}>{job.trade}</Text>
                    <Text style={[styles.nameText, { color: theme.subtext }]}>
                      {activeTab === 'student' ? `Expert: ${job.expertName}` : `Client: ${job.studentName}`}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(job.status) + '15' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(job.status) }]}>{job.status.toUpperCase()}</Text>
                  </View>
                </View>

                <View style={[styles.jobFooter, { borderTopColor: theme.divider }]}>
                  <Text style={[styles.priceText, { color: theme.text }]}>₵{job.price}</Text>
                  
                  <View style={styles.actionRow}>
                    {activeTab === 'expert' && job.status === 'pending' && (
                      <>
                        <TouchableOpacity 
                          style={[styles.actionBtn, styles.acceptBtn]}
                          onPress={() => updateJobStatus(job.id, 'accepted', job.expertId, job.studentId)}
                        >
                          <Text style={styles.btnText}>Accept</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.actionBtn, styles.cancelBtn]}
                          onPress={() => updateJobStatus(job.id, 'cancelled', job.expertId, job.studentId)}
                        >
                          <Text style={styles.btnText}>Decline</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    
                    {activeTab === 'expert' && job.status === 'accepted' && (
                      <TouchableOpacity 
                        style={[styles.actionBtn, styles.completeBtn, { backgroundColor: isDark ? '#D9F15D' : '#000' }]}
                        onPress={() => updateJobStatus(job.id, 'completed', job.expertId, job.studentId)}
                      >
                        <Text style={[styles.btnText, { color: isDark ? '#000' : '#FFF' }]}>Mark Completed</Text>
                      </TouchableOpacity>
                    )}

                    {activeTab === 'student' && job.status === 'completed' && !job.isPaid && (
                      <TouchableOpacity 
                        style={[styles.actionBtn, styles.payBtn]}
                        onPress={() => handlePayment(job)}
                      >
                        <Ionicons name="card" size={16} color="#FFF" style={{marginRight: 5}} />
                        <Text style={styles.btnText}>Pay</Text>
                      </TouchableOpacity>
                    )}

                    {activeTab === 'student' && job.status === 'completed' && job.isPaid && !job.isReviewed && (
                      <TouchableOpacity 
                        style={[styles.actionBtn, styles.reviewBtn]}
                        onPress={() => router.push(`/review/${job.id}` as any)}
                      >
                        <Ionicons name="star" size={16} color="#FFF" style={{marginRight: 5}} />
                        <Text style={styles.btnText}>Review</Text>
                      </TouchableOpacity>
                    )}

                    {activeTab === 'student' && job.isReviewed && (
                      <View style={[styles.actionBtn, {backgroundColor: theme.cardAlt}]}>
                        <Text style={[styles.btnText, {color: theme.subtext}]}>Reviewed</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}


const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
    paddingHorizontal: 20, paddingTop: 10, marginBottom: 15 
  },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 24 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  
  tabWrapper: { 
    flexDirection: 'row', borderRadius: 10, 
    marginHorizontal: 20, padding: 2, marginBottom: 20 
  },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  activeTab: { elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3 },
  tabText: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  activeTabText: { fontFamily: 'Inter_700Bold' },

  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  jobCard: { 
    borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 
  },
  jobHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  tradeText: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  nameText: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontFamily: 'Inter_700Bold', fontSize: 10 },

  jobFooter: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, paddingTop: 12 
  },
  priceText: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  acceptBtn: { backgroundColor: '#34C759' },
  cancelBtn: { backgroundColor: '#FF3B30' },
  completeBtn: { backgroundColor: '#000' },
  payBtn: { backgroundColor: '#32D74B', flexDirection: 'row', alignItems: 'center' },
  reviewBtn: { backgroundColor: '#007AFF', flexDirection: 'row', alignItems: 'center' },
  btnText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#FFF' },
  
  emptyState: { alignItems: 'center', marginTop: 100 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 16, marginTop: 20 },
});
