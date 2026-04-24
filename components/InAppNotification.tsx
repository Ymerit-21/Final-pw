import React, { useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, Animated, Dimensions, 
  TouchableOpacity, Platform, Image 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

interface Props {
  notification: {
    id: string;
    title: string;
    body: string;
    type: 'message' | 'job' | 'success' | 'goal';
    chatId?: string;
    jobId?: string;
    senderAvatar?: string;
  };
  onClose: () => void;
}

export default function InAppNotification({ notification, onClose }: Props) {
  const router = useRouter();
  const translateY = useRef(new Animated.Value(-150)).current;

  useEffect(() => {
    // 1. Entrance Animation
    Animated.spring(translateY, {
      toValue: 60, // Distance from top
      useNativeDriver: true,
      friction: 8,
      tension: 40,
    }).start();

    // 2. Auto-dismiss after 4 seconds
    const timer = setTimeout(() => {
      dismiss();
    }, 4500);

    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    Animated.timing(translateY, {
      toValue: -150,
      duration: 300,
      useNativeDriver: true,
    }).start(() => onClose());
  };

  const handlePress = () => {
    if (notification.type === 'message' && notification.chatId) {
      router.push(`/chat/${notification.chatId}` as any);
    } else if (notification.type === 'job') {
      router.push('/jobs');
    }
    dismiss();
  };

  const getIcon = () => {
    switch (notification.type) {
      case 'message': return 'chatbubble';
      case 'job': return 'briefcase';
      case 'success': return 'checkmark-circle';
      case 'goal': return 'trophy';
      default: return 'notifications';
    }
  };

  const { isDark, theme } = useTheme();

  return (
    <Animated.View 
      style={[
        styles.container, 
        { transform: [{ translateY }] }
      ]}
    >
      <TouchableOpacity 
        style={[styles.card, { backgroundColor: isDark ? 'rgba(28, 28, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)', borderColor: theme.border }]} 
        activeOpacity={0.9}
        onPress={handlePress}
      >
        <View style={styles.iconBox}>
          {notification.senderAvatar ? (
            <Image 
              source={{ uri: notification.senderAvatar }} 
              style={{ width: '100%', height: '100%', borderRadius: 12 }} 
            />
          ) : (
            <Ionicons name={getIcon() as any} size={20} color="#000" />
          )}
        </View>
        <View style={styles.content}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{notification.title}</Text>
          <Text style={[styles.body, { color: theme.subtext }]} numberOfLines={2}>{notification.body}</Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={dismiss}>
          <Ionicons name="close" size={18} color={theme.subtext} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    borderRadius: 20,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#D9F15D',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    marginBottom: 2,
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 16,
  },
  closeBtn: {
    padding: 5,
    marginLeft: 10,
  }
});
