import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { useTheme } from '../context/ThemeContext';

interface MyNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  dateStr: string;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { isDark, theme } = useTheme();
  const [notifications, setNotifications] = useState<MyNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const q = query(
      collection(db, 'users', uid, 'notifications')
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => {
        const data = d.data();
        let dateStr = 'Just now';
        if (data.createdAt) {
          dateStr = data.createdAt.toDate().toLocaleDateString() + ' ' + 
                    data.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return {
          id: d.id,
          title: data.title || 'Notification',
          message: data.message || '',
          type: data.type || 'info',
          read: data.read || false,
          dateStr,
          createdAtSeconds: data.createdAt?.seconds || 0
        };
      });
      
      // Client-side sort to avoid index requirement
      list.sort((a, b) => b.createdAtSeconds - a.createdAtSeconds);
      
      setNotifications(list);
      setLoading(false);
    }, (err) => {
      if (err.code === 'permission-denied') return;
      console.error("Notifications Snapshot Error:", err);
      setNotifications([]);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleRead = async (id: string, isRead: boolean) => {
    if (isRead) return;
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      await updateDoc(doc(db, 'users', uid, 'notifications', id), {
        read: true
      });
    } catch (e) {
      console.error(e);
    }
  };

  const renderItem = ({ item }: { item: MyNotification }) => (
    <TouchableOpacity 
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border },
        !item.read && { backgroundColor: isDark ? '#0A1929' : '#F0F7FF', borderColor: isDark ? '#1A3A5C' : '#D4E8FF' }
      ]}
      onPress={() => handleRead(item.id, item.read)}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        <Ionicons 
          name={item.type === 'success' ? 'checkmark-circle' : 'notifications'} 
          size={24} 
          color={item.type === 'success' ? '#32D74B' : (isDark ? '#D9F15D' : '#007AFF')} 
        />
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: theme.text }]}>{item.title}</Text>
        <Text style={[styles.message, { color: theme.subtext }]}>{item.message}</Text>
        <Text style={[styles.date, { color: theme.subtext }]}>{item.dateStr}</Text>
      </View>
      {!item.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Notifications</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 50 }} size="large" color={theme.text} />
        ) : (
          <FlatList
            data={notifications}
            renderItem={renderItem}
            keyExtractor={(i) => i.id}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Ionicons name="notifications-off-outline" size={50} color={theme.subtext} />
                <Text style={[styles.emptyText, { color: theme.subtext }]}>No notifications yet.</Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
    paddingHorizontal: 20, height: 60,
    borderBottomWidth: 1
  },
  backBtn: { padding: 5 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  listContainer: { padding: 20 },
  card: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    alignItems: 'flex-start'
  },
  iconContainer: {
    width: 40, alignItems: 'center', justifyContent: 'center', marginRight: 10
  },
  textContainer: { flex: 1 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 15, marginBottom: 4 },
  message: { fontFamily: 'Poppins_400Regular', fontSize: 13, lineHeight: 18, marginBottom: 8 },
  date: { fontFamily: 'Poppins_400Regular', fontSize: 11 },
  unreadDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF3B30', marginTop: 5
  },
  emptyBox: { alignItems: 'center', marginTop: 100 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 15, marginTop: 10 }
});
