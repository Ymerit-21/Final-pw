import { initializeApp, getApps, getApp } from "firebase/app";
// @ts-ignore - getReactNativePersistence exists at runtime but is missing from the TS definitions
import { getAuth, initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore, Unsubscribe } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBn8BfhPEKSTroJiJL-zK-9hLfyfTcVzMI",
  authDomain: "arts-920d8.firebaseapp.com",
  projectId: "arts-920d8",
  storageBucket: "arts-920d8.firebasestorage.app",
  messagingSenderId: "703560838714",
  appId: "1:703560838714:web:dcfe6361c4b192b3b8cf03",
  measurementId: "G-V003YCY5QY"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth based on platform
const auth = Platform.OS === 'web' 
  ? getAuth(app) 
  : initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });

const db = getFirestore(app);
const storage = getStorage(app);

const activeListeners = new Set<Unsubscribe>();

export const sessionState = {
  isEnding: false
};

// Global Registry for Synchronous Cord-Cutting
export const registerListener = (unsub: Unsubscribe) => {
  activeListeners.add(unsub);
  return () => {
    activeListeners.delete(unsub);
    unsub();
  };
};

export const clearAllListeners = () => {
  sessionState.isEnding = true;
  activeListeners.forEach(unsub => {
    try { unsub(); } catch (e) { /* Already dead */ }
  });
  activeListeners.clear();
};

export const resetSession = () => {
  sessionState.isEnding = false;
};

export { app, auth, db, storage };
