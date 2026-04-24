import * as React from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Platform, Alert } from 'react-native';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import Constants from 'expo-constants';

// We will load these lazily to prevent Expo Go from crashing on boot
let GoogleSignin: any = null;
let statusCodes: any = null;

/**
 * Professional Native Google Authentication Hook
 * Uses @react-native-google-signin/google-signin for production-grade reliability
 */
export function useGoogleAuth() {
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Check if we are running in Expo Go
  const isExpoGo = Constants.appOwnership === 'expo';

  useEffect(() => {
    // 1. Initial Configure - Only run if NOT in Expo Go
    if (!isExpoGo) {
      try {
        // Lazy load the native module
        const GoogleModule = require('@react-native-google-signin/google-signin');
        GoogleSignin = GoogleModule.GoogleSignin;
        statusCodes = GoogleModule.statusCodes;

        GoogleSignin.configure({
          webClientId: '703560838714-4d5bn58dvafkvj5skva9i3brfgrrf2qv.apps.googleusercontent.com',
          offlineAccess: true,
        });
      } catch (e) {
        console.warn('GoogleSignin initialization failed:', e);
      }
    } else {
      console.warn('Google Sign-In is disabled in Expo Go. Use a Development Build to test this feature.');
    }
  }, [isExpoGo]);

  const authenticateWithFirebase = async (idToken: string) => {
    try {
      // 2. Create a Firebase credential using the native Google ID token
      const credential = GoogleAuthProvider.credential(idToken);

      // 3. Sign in to Firebase Auth
      const userCredential = await signInWithCredential(auth, credential);
      const user = userCredential.user;

      const profileInfo = {
        uid: user.uid,
        name: user.displayName,
        email: user.email,
        picture: user.photoURL,
      };

      // 4. Check Firestore (Users Database)
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        await setDoc(userDocRef, {
          email: profileInfo.email,
          name: profileInfo.name,
          profilePicture: profileInfo.picture,
          createdAt: new Date().toISOString(),
          onboardingCompleted: false
        });
        console.log('Created new user profile in Firestore');
        router.replace('/onboarding');
      } else {
        const data = userDocSnap.data();
        if (data.onboardingCompleted) {
          router.replace('/dashboard');
        } else {
          router.replace('/onboarding');
        }
      }

      setUserInfo(profileInfo);
    } catch (error) {
      console.error('Error securely logging into Firebase:', error);
      throw error;
    }
  };

  const signIn = async () => {
    if (isExpoGo) {
      Alert.alert(
        'Feature Unavailable',
        'Google Sign-In requires a custom Development Build. It is not supported in the standard Expo Go app. You can use Email/Password sign-in to continue testing.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!GoogleSignin) {
      console.error('GoogleSignin is not initialized');
      return;
    }

    setLoading(true);
    try {
      // Check if user has Google Play Services (Android only)
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices();
      }
      
      // Native Sign In
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;

      if (!idToken) {
        throw new Error('No ID Token received from Google');
      }

      await authenticateWithFirebase(idToken);
    } catch (error: any) {
      if (statusCodes && error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('User cancelled the login flow');
      } else if (statusCodes && error.code === statusCodes.IN_PROGRESS) {
        console.log('Sign in is already in progress');
      } else if (statusCodes && error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        console.log('Play services not available or outdated');
      } else {
        console.error('Google Sign-In Error:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  return { signIn, userInfo, loading, isReady: !isExpoGo };
}
