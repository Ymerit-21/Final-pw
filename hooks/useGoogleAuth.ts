import * as React from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

// Ensures that auth session can be completed properly on web environments
WebBrowser.maybeCompleteAuthSession();

export function useGoogleAuth() {
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Configuration for Google Auth
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: '157569495495-dqslqhcrnhmeipfiusdtsjelanudrk4u.apps.googleusercontent.com',
    androidClientId: 'YOUR_ANDROID_CLIENT_ID_HERE.apps.googleusercontent.com',
    iosClientId: '157569495495-fou5e3inrqemsnhduhen9c77frbn2moj.apps.googleusercontent.com',
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      if (authentication?.accessToken || authentication?.idToken) {
        authenticateWithFirebase(
          authentication?.idToken ?? undefined, 
          authentication?.accessToken
        );
      }
    }
  }, [response]);

  const authenticateWithFirebase = async (idToken: string | undefined, accessToken: string | undefined) => {
    setLoading(true);
    try {
      // 1. Create a Firebase credential using the Google access token
      const credential = GoogleAuthProvider.credential(idToken, accessToken);

      // 2. Sign in to Firebase Auth
      const userCredential = await signInWithCredential(auth, credential);
      const user = userCredential.user;

      const profileInfo = {
        uid: user.uid,
        name: user.displayName,
        email: user.email,
        picture: user.photoURL,
      };

      // 3. Check Firestore (Users Database)
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        await setDoc(userDocRef, {
          email: profileInfo.email,
          name: profileInfo.name,
          profilePicture: profileInfo.picture,
          createdAt: new Date().toISOString(),
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
    } finally {
      setLoading(false);
    }
  };

  const signIn = async () => {
    if (request) {
      await promptAsync();
    }
  };

  return { signIn, userInfo, loading, isReady: !!request };
}
