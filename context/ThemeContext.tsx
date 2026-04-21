import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { Palette, AppTheme } from '../constants/theme';
import * as SystemUI from 'expo-system-ui';
import { Platform } from 'react-native';

interface ThemeContextValue {
  isDark: boolean;
  theme: AppTheme;
  toggleDark: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  isDark: false,
  theme: Palette.light,
  toggleDark: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  // null = not yet loaded from Firestore; use system default in the meantime
  const [userDarkMode, setUserDarkMode] = useState<boolean | null>(null);

  // Once a user is signed in, mirror their Firestore preference in real time
  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setUserDarkMode(null);
      return;
    }

    const unsub = onSnapshot(doc(db, 'users', currentUser.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (typeof data.darkMode === 'boolean') {
          setUserDarkMode(data.darkMode);
        } else {
          // Never set before — fall back to OS
          setUserDarkMode(null);
        }
      }
    }, () => {});

    return () => unsub();
  }, [auth.currentUser?.uid]);

  // Resolved boolean: user pref > OS default
  const isDark = userDarkMode !== null ? userDarkMode : systemScheme === 'dark';
    const theme: AppTheme = isDark ? Palette.dark : Palette.light;

  // Sync System UI (Status Bar / Navigation Bar background)
  useEffect(() => {
    if (Platform.OS !== 'web') {
      SystemUI.setBackgroundColorAsync(theme.bg);
    }
  }, [theme.bg]);

  const toggleDark = useCallback(async () => {
    const next = !isDark;
    setUserDarkMode(next); // optimistic update
    try {
      const uid = auth.currentUser?.uid;
      if (uid) {
        await updateDoc(doc(db, 'users', uid), { darkMode: next });
      }
    } catch {
      // revert on failure
      setUserDarkMode(isDark);
    }
  }, [isDark]);

  return (
    <ThemeContext.Provider value={{ isDark, theme, toggleDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
