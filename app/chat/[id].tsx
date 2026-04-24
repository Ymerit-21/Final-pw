import { Feather, Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { StatusBar } from 'expo-status-bar';
import {
  addDoc,
  collection, doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView, Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db, storage, registerListener, sessionState } from '../../config/firebase';

interface Message {
  id: string;
  senderId: string;
  text?: string;
  imageUri?: string;
  createdAt: any;
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { isDark, theme } = useTheme();
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [chatInfo, setChatInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const participantsRef = useRef<string[]>([]);

  const currentUser = auth.currentUser;

  const handleSimulatedCall = (type: 'Phone' | 'Video') => {
    Alert.alert(`Secure ${type} Call`, `Initiating end-to-end encrypted call with ${chatInfo?.otherUser?.name || 'User'}...`);
  };

  const handlePickImage = async () => {
    // Create file input for image selection from library
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Read file and get data URL
      const reader = new FileReader();
      reader.onload = async (event: any) => {
        const dataUrl = event.target.result;
        // Convert data URL to blob for upload
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        await sendImageMessage(blob);
      };
      reader.readAsDataURL(file);
    };

    input.click();
  };

  const handleTakePhoto = async () => {
    // Create file input with camera capture (works on mobile phones)
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = true; // Request camera capture on mobile
    
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event: any) => {
        const dataUrl = event.target.result;
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        await sendImageMessage(blob);
      };
      reader.readAsDataURL(file);
    };

    input.click();
  };

  const sendImageMessage = async (blob: Blob) => {
    if (!id || !currentUser) return;
    setUploading(true);
    try {
      // Upload blob to Firebase Storage
      const filename = `chat_images/${id}/${currentUser.uid}_${Date.now()}.jpg`;
      const storageRef = ref(storage, filename);
      const uploadTask = uploadBytesResumable(storageRef, blob);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on('state_changed', null,
          (err) => { console.error('Storage upload error:', err); reject(err); },
          () => resolve()
        );
      });

      // 3. Get download URL
      const downloadURL = await getDownloadURL(storageRef);

      // 4. Save message to Firestore
      const messagesRef = collection(db, 'chats', id as string, 'messages');
      await addDoc(messagesRef, {
        senderId: currentUser.uid,
        imageUri: downloadURL,
        createdAt: serverTimestamp(),
      });

      // Use cached participants ref to avoid chatInfo race condition
      const otherUserId = participantsRef.current.find((p: string) => p !== currentUser.uid);
      await updateDoc(doc(db, 'chats', id as string), {
        lastMessage: '📷 Photo',
        lastUpdatedAt: serverTimestamp(),
        ...(otherUserId ? { [`unreadCount.${otherUserId}`]: increment(1) } : {})
      });
    } catch (error: any) {
      console.error('Error sending image:', error);
      const msg = error?.code === 'storage/unauthorized'
        ? 'Storage permission denied. Please contact support.'
        : 'Could not send image. Check your connection and try again.';
      Alert.alert('Upload Failed', msg);
    } finally {
      setUploading(false);
    }
  };

  const handleMicPress = () => {
    Alert.alert(
      "Voice Note", 
      "Recording...", 
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Send", 
          onPress: () => sendSimulatedMedia("[Voice Note 🎤 0:05]") 
        }
      ]
    );
  };

  const sendSimulatedMedia = async (mediaText: string) => {
    if (!id || !currentUser || !chatInfo) return;
    try {
      const messagesRef = collection(db, 'chats', id as string, 'messages');
      await addDoc(messagesRef, {
        senderId: currentUser.uid,
        text: mediaText,
        createdAt: serverTimestamp(),
      });

      const otherUserId = chatInfo?.participants?.find((p: string) => p !== currentUser.uid);
      await updateDoc(doc(db, 'chats', id as string), {
        lastMessage: mediaText,
        lastUpdatedAt: serverTimestamp(),
        ...(otherUserId ? { [`unreadCount.${otherUserId}`]: increment(1) } : {})
      });
    } catch (error) {
      console.error("Error sending media mock:", error);
    }
  };

  useEffect(() => {
    if (!id || !currentUser) return;

    // 1. Reset unread count for current user
    const resetUnread = async () => {
      await updateDoc(doc(db, 'chats', id as string), {
        [`unreadCount.${currentUser.uid}`]: 0
      });
    };
    resetUnread();

    // 2. Get chat metadata for header
    const fetchChatInfo = async () => {
      const chatDoc = await getDoc(doc(db, 'chats', id as string));
      if (chatDoc.exists()) {
        const data = chatDoc.data();
        const otherUserId = data.participants.find((p: string) => p !== currentUser.uid);
        
        let realOtherUser = data.participantInfo?.[otherUserId];
        if (otherUserId) {
          const userDoc = await getDoc(doc(db, 'users', otherUserId));
          if (userDoc.exists()) {
             realOtherUser = { ...realOtherUser, ...userDoc.data() };
          }
        }

        // Cache participants immediately for image send (avoids race with chatInfo state)
        participantsRef.current = data.participants || [];
        setChatInfo({
          ...data,
          otherUser: realOtherUser || { name: 'Expert', role: 'Specialist' }
        });
      }
    };
    fetchChatInfo();

    // Listen for messages in this chat
    const messagesRef = collection(db, 'chats', id as string, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsub = registerListener(onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(list);
      setLoading(false);

      // Auto-scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 200);
    }, (err) => {
      if (err.code === 'permission-denied' || sessionState.isEnding) return;
      console.error("Chat Messages Error:", err);
    }));

    return () => unsub();
  }, [id, currentUser]);

  const sendMessage = async () => {
    if (!inputText.trim() || !id || !currentUser || !chatInfo) return;

    const text = inputText.trim();
    setInputText('');

    try {
      const messagesRef = collection(db, 'chats', id as string, 'messages');
      await addDoc(messagesRef, {
        senderId: currentUser.uid,
        text,
        createdAt: serverTimestamp(),
      });

      const otherUserId = chatInfo.participants?.find((p: string) => p !== currentUser.uid);
      await updateDoc(doc(db, 'chats', id as string), {
        lastMessage: text,
        lastUpdatedAt: serverTimestamp(),
        ...(otherUserId ? { [`unreadCount.${otherUserId}`]: increment(1) } : {})
      });

      // Notify the recipient safely
      if (otherUserId) {
        const senderName = chatInfo.participantInfo?.[currentUser.uid]?.name || 'Someone';
        const senderAvatar = chatInfo.participantInfo?.[currentUser.uid]?.avatarUrl || null;
        await addDoc(collection(db, 'users', otherUserId, 'notifications'), {
          type: 'message',
          title: `New message from ${senderName}`,
          body: text.length > 50 ? text.substring(0, 47) + '...' : text,
          chatId: id,
          senderAvatar: senderAvatar,
          read: false,
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const renderMessage = ({ item, index }: { item: Message, index: number }) => {
    const isMine = item.senderId === currentUser?.uid;

    let showDateHeader = false;
    if (index === 0) {
      showDateHeader = true;
    } else {
      const prevMessage = messages[index - 1];
      const prevDate = prevMessage.createdAt?.toDate ? prevMessage.createdAt.toDate() : new Date();
      const currDate = item.createdAt?.toDate ? item.createdAt.toDate() : new Date();
      if (prevDate.toDateString() !== currDate.toDateString()) {
        showDateHeader = true;
      }
    }

    return (
      <View>
        {showDateHeader && (
          <View style={[styles.dateHeaderContainer, { backgroundColor: isDark ? theme.card : '#FFF' }]}>
            <Text style={[styles.dateHeaderText, { color: isDark ? theme.subtext : '#666' }]}>{formatDateHeader(item.createdAt)}</Text>
          </View>
        )}
        <View style={[
          styles.messageWrapper,
          isMine ? styles.myMessageWrapper : styles.theirMessageWrapper
        ]}>
          <View style={[
            styles.messageBubble,
            isMine ? [styles.myBubble, { backgroundColor: isDark ? '#D9F15D' : '#000' }] : [styles.theirBubble, { backgroundColor: theme.card }],
            item.imageUri && { padding: 4, backgroundColor: 'transparent', shadowOpacity: 0 }
          ]}>
            {item.imageUri ? (
              <Image 
                source={{ uri: item.imageUri }} 
                style={styles.chatImage}
                resizeMode="cover"
              />
            ) : (
              <Text style={[styles.messageText, { color: isMine ? (isDark ? '#000' : '#FFF') : theme.text }]}>{item.text}</Text>
            )}
            <View style={styles.messageMeta}>
              <Text style={[styles.messageTime, { color: isMine ? (isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.7)') : theme.subtext }]}>
                {formatTime(item.createdAt)}
              </Text>
              {isMine && <Ionicons name="checkmark-done" size={14} color={isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.7)'} style={{marginLeft: 4, marginTop: -2}} />}
            </View>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom Chat Header */}
      <View style={[styles.header, { backgroundColor: theme.bg, borderBottomColor: theme.border, borderBottomWidth: 1 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </TouchableOpacity>

        <View style={styles.headerUser}>
          <View style={[styles.headerAvatar, { backgroundColor: theme.cardAlt }]}>
            {chatInfo?.otherUser?.avatarUrl ? (
              <Image source={{ uri: chatInfo.otherUser.avatarUrl }} style={{ width: '100%', height: '100%', borderRadius: 20 }} />
            ) : (
              <Ionicons name="person" size={20} color={theme.text} />
            )}
            {chatInfo?.otherUser?.isOnline !== false && (
              <View style={styles.headerOnline} />
            )}
          </View>
          <View>
            <Text style={[styles.headerName, { color: theme.text }]}>{chatInfo?.otherUser?.name || 'Loading...'}</Text>
            <Text style={styles.headerStatus}>
              {chatInfo?.otherUser?.isOnline !== false ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={{ marginRight: 20 }} onPress={() => handleSimulatedCall('Video')}>
            <Feather name="video" size={22} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleSimulatedCall('Phone')}>
            <Feather name="phone" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: isDark ? theme.bg : '#efeae2' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={[styles.encryptionBubble, { backgroundColor: isDark ? '#1C1C1E' : '#FFEFCD' }]}>
            <Ionicons name="lock-closed" size={12} color={isDark ? '#D9F15D' : '#856404'} />
            <Text style={[styles.encryptionText, { color: isDark ? theme.subtext : '#856404' }]}>
              Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them. Learn more.
            </Text>
          </View>
        }
      />

      <View style={[styles.inputOuterContainer, { backgroundColor: isDark ? theme.bg : '#efeae2' }]}>
           <TouchableOpacity style={styles.attachBtnOuter} onPress={handlePickImage}>
             <Feather name="plus" size={28} color={theme.text} />
           </TouchableOpacity>
           
           <View style={[styles.inputPill, { backgroundColor: theme.card, borderColor: theme.border }]}>
             <TouchableOpacity style={styles.iconInside} onPress={() => inputRef.current?.focus()}>
               <Feather name="smile" size={24} color={theme.subtext} />
             </TouchableOpacity>
             
             <TextInput
               ref={inputRef}
               style={[styles.input, { color: theme.inputText }]}
               placeholder="Message"
               placeholderTextColor={theme.placeholder}
               value={inputText}
               onChangeText={setInputText}
               multiline
             />
             
             {!inputText.trim() && (
               <>
                 <TouchableOpacity style={styles.iconInside} onPress={handlePickImage}>
                    <Feather name="paperclip" size={20} color={theme.subtext} />
                 </TouchableOpacity>
                 <TouchableOpacity style={[styles.iconInside, {marginRight: 10}]} onPress={handleTakePhoto}>
                    <Feather name="camera" size={20} color={theme.subtext} />
                 </TouchableOpacity>
               </>
             )}
           </View>

           {uploading ? (
             <View style={[styles.sendCircle, { backgroundColor: isDark ? '#D9F15D' : '#000' }]}>
               <ActivityIndicator color={isDark ? '#000' : '#FFF'} size="small" />
             </View>
           ) : inputText.trim() ? (
             <TouchableOpacity style={[styles.sendCircle, { backgroundColor: isDark ? '#D9F15D' : '#000' }]} onPress={sendMessage}>
               <Ionicons name="send" size={16} color={isDark ? '#000' : '#FFF'} style={{marginLeft: 3}} />
             </TouchableOpacity>
           ) : (
             <TouchableOpacity style={[styles.sendCircle, { backgroundColor: isDark ? '#D9F15D' : '#000' }]} onPress={handleMicPress}>
               <Feather name="mic" size={20} color={isDark ? '#000' : '#FFF'} />
             </TouchableOpacity>
           )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function formatTime(timestamp: any) {
  if (!timestamp) return '';
  const date = timestamp?.toDate ? timestamp.toDate() : new Date();
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateHeader(timestamp: any) {
  if (!timestamp) return '';
  const date = timestamp?.toDate ? timestamp.toDate() : new Date();
  const now = new Date();
  
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  
  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';
  
  return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: '#FFF',
  },
  backBtn: { padding: 5 },
  headerUser: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 5 },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    position: 'relative'
  },
  headerOnline: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CD964',
    borderWidth: 2,
    borderColor: '#FFF'
  },
  headerName: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  headerStatus: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#D9F15D' },
  headerActions: { flexDirection: 'row', alignItems: 'center', paddingRight: 10 },
  
  messagesList: { padding: 15, paddingBottom: 30 },
  encryptionBubble: {
    backgroundColor: '#FFEFCD',
    alignSelf: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    maxWidth: '95%',
    shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 1
  },
  encryptionText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#856404',
    marginLeft: 6,
    lineHeight: 16,
    flex: 1
  },

  dateHeaderContainer: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1
  },
  dateHeaderText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#666'
  },

  messageWrapper: { flexDirection: 'row', marginBottom: 12, maxWidth: '85%' },
  myMessageWrapper: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  theirMessageWrapper: { alignSelf: 'flex-start' },
  
  messageBubble: { 
    paddingHorizontal: 12, 
    paddingTop: 8,
    paddingBottom: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2
  },
  myBubble: { borderTopRightRadius: 2 },
  theirBubble: { borderTopLeftRadius: 2 },
  
  messageText: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22 },
  
  messageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 2,
    marginLeft: 15
  },
  messageTime: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: '#888',
  },
  chatImage: {
    width: 220,
    height: 180,
    borderRadius: 12,
  },

  inputOuterContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  attachBtnOuter: { justifyContent: 'center', alignItems: 'center', paddingBottom: 10, paddingRight: 10 },
  
  inputPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#FFF',
    borderRadius: 24,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxHeight: 120,
    borderWidth: 1,
  },
  iconInside: { paddingHorizontal: 6, paddingBottom: 2 },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    paddingTop: 4,
    paddingBottom: 4,
    minHeight: 28,
  },
  sendCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    marginBottom: 2
  }
});
