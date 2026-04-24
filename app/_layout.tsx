import { Stack, useRouter, useSegments } from 'expo-router';
import '../web.css';

import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Platform } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { auth, db } from '../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, orderBy, limit, onSnapshot, doc, onSnapshot as onSnap } from 'firebase/firestore';
import InAppNotification from '../components/InAppNotification';
import { useFonts } from 'expo-font';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { Palette } from '../constants/theme';
import {
  KodeMono_400Regular,
  KodeMono_700Bold,
} from '@expo-google-fonts/kode-mono';
import {
  Poppins_400Regular,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import {
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    KodeMono_400Regular,
    KodeMono_700Bold,
    Poppins_400Regular,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    ...Ionicons.font,
    ...Feather.font,
  });

  const segments = useSegments();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }

  }, [fontsLoaded]);

  // Handle Authentication State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsReady(true);
    });
    return unsubscribe;
  }, []);

  // Handle Redirection Logic
  useEffect(() => {
    if (!isReady || !fontsLoaded) return;

    const isRoot = (segments as string[]).length === 0;
    const inAuthGroup = segments[0] === 'sign-in' || 
                       segments[0] === 'create-account' || 
                       segments[0] === 'forgot-password';

    if (!user && !inAuthGroup && !isRoot) {
      // Not logged in and not in auth screens and not root -> Redirect to Sign In
      router.replace('/sign-in');
    } else if (user && inAuthGroup) {
      // Logged in but in auth screens -> Redirect to Dashboard
      router.replace('/dashboard');
    }
  }, [user, segments, isReady, fontsLoaded]);

  // ── Mid-session Restriction Enforcement ────────────────────────────────────
  // Listens to the current user's Firestore doc.
  // • If isBanned flips to true → sign out immediately.
  // • If isSuspended with a future suspensionEndsAt → schedule auto-lift when timer expires.
  useEffect(() => {
    if (!user) return;

    let autoLiftTimer: ReturnType<typeof setTimeout> | null = null;

    const userDocRef = doc(db, 'users', user.uid);
    const unsub = onSnap(userDocRef, async (snap) => {
      const data = snap.data();

      // Clear any previously scheduled auto-lift
      if (autoLiftTimer) { clearTimeout(autoLiftTimer); autoLiftTimer = null; }

      // Permanent ban → force sign-out
      if (data?.isBanned) {
        try { await auth.signOut(); } catch (_) {}
        return;
      }

      // Timed suspension → schedule auto-lift when it expires
      if (data?.isSuspended && data?.suspensionEndsAt) {
        const endsAt: Date = data.suspensionEndsAt.toDate ? data.suspensionEndsAt.toDate() : new Date(data.suspensionEndsAt);
        const msLeft = endsAt.getTime() - Date.now();

        if (msLeft <= 0) {
          // Already expired — lift it now
          try {
            const { doc: fDoc, updateDoc: fUpdate } = await import('firebase/firestore');
            await fUpdate(fDoc(db, 'users', user.uid), {
              isSuspended: false,
              suspensionReason: null,
              suspensionEndsAt: null,
              suspendedBy: null,
              isVerified: true,
            });
          } catch (_) {}
        } else {
          // Schedule lift at expiry
          autoLiftTimer = setTimeout(async () => {
            try {
              const { doc: fDoc, updateDoc: fUpdate } = await import('firebase/firestore');
              await fUpdate(fDoc(db, 'users', user.uid), {
                isSuspended: false,
                suspensionReason: null,
                suspensionEndsAt: null,
                suspendedBy: null,
                isVerified: true,
              });
            } catch (_) {}
          }, msLeft);
        }
      }
    });

    return () => {
      unsub();
      if (autoLiftTimer) clearTimeout(autoLiftTimer);
    };
  }, [user]);

  const [activeNotification, setActiveNotification] = useState<any>(null);
  const lastNotifId = useRef<string | null>(null);
  const sessionStartTime = useRef<Date>(new Date());

  // Global Notification Listener
  useEffect(() => {
    if (!user) {
      setActiveNotification(null);
      return;
    }

    // NOTE: We only use orderBy here (no where) to avoid requiring a composite
    // Firestore index. The unread filter is applied client-side below.
    const notifQuery = query(
      collection(db, 'users', user.uid, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsub = onSnapshot(notifQuery, (snap) => {
      // Client-side filter: pick the first unread notification
      const unreadDoc = snap.docs.find(d => d.data().read === false);
      if (unreadDoc) {
        const data = unreadDoc.data();
        const notif = { id: unreadDoc.id, ...data } as any;

        // Only show if it's fresh (created after session start)
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
        const isFresh = !data.createdAt || createdAt > sessionStartTime.current;

        // Don't show if the user is already in that chat
        const isInThisChat = segments[0] === 'chat' && segments[1] === data.chatId;

        if (notif.id !== lastNotifId.current && isFresh && !isInThisChat) {
          lastNotifId.current = notif.id;
          setTimeout(() => {
            setActiveNotification(notif);
          }, 300);
        }
      }
    });

    return unsub;
  }, [user]);

  if (!fontsLoaded || !isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#D9F15D" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <AppShell
        activeNotification={activeNotification}
        onCloseNotification={() => setActiveNotification(null)}
      />
    </ThemeProvider>
  );
}

function AppShell({ activeNotification, onCloseNotification }: { activeNotification: any; onCloseNotification: () => void }) {
  const { isDark } = useTheme();
  return (
    <>
      <View style={{ flex: 1, backgroundColor: isDark ? Palette.dark.bg : Palette.light.bg }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: isDark ? Palette.dark.bg : Palette.light.bg }
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="sign-in" options={{ animation: 'none' }} />
          <Stack.Screen name="create-account" />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="dashboard" />
          <Stack.Screen name="marketplace" />
          <Stack.Screen name="messages" />
          <Stack.Screen name="withdraw" />
          <Stack.Screen name="add-money" />
          <Stack.Screen name="add-expense" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="chat/[id]" />
          <Stack.Screen name="wallet" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="set-goals" />
          <Stack.Screen name="expert/[id]" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="edit-expert-profile" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="jobs" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="review/[jobId]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="notifications" options={{ animation: 'none' }} />
          <Stack.Screen name="help-center" />
          <Stack.Screen name="terms-of-service" />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
      </View>
      {activeNotification && (
        <InAppNotification
          notification={activeNotification}
          onClose={onCloseNotification}
        />
      )}
      <StatusBar style={isDark ? 'light' : 'dark'} translucent />
    </>
  );
}
