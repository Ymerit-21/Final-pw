import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  useWindowDimensions,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { StatusBar } from 'expo-status-bar';
import { auth } from '../config/firebase';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withSpring,
  withSequence,
  FadeIn,
  FadeInUp, 
  FadeInDown,
} from 'react-native-reanimated';

// You can replace this with the actual generated image path or a require statement
// For now, we use a placeholder or local asset if available.
// The icon helps give that "Facebook" logo feel at startup.
const LOGO_URI = 'https://i.ibb.co/VpXk0fD/architect-logo.png'; 

export default function RootIndex() {
  const router = useRouter();
  const { isDark, theme } = useTheme();
  const { width, height } = useWindowDimensions();

  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [showButtons, setShowButtons] = useState(false);

  // Animations
  const blob1Pos = useSharedValue(0);
  const blob2Pos = useSharedValue(0);
  const logoScale = useSharedValue(0.8);
  const logoOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);

  useEffect(() => {
    // 1. Initial Logo Entry
    logoOpacity.value = withTiming(1, { duration: 800 });
    logoScale.value = withSpring(1.1);

    // 2. Background Blobs Animation
    blob1Pos.value = withRepeat(withTiming(1, { duration: 6000 }), -1, true);
    blob2Pos.value = withRepeat(withTiming(1, { duration: 8000 }), -1, true);

    // 3. Auth Check & Decision
    const unsubscribe = auth.onAuthStateChanged((user) => {
      // Simulate branding delay (Facebook style)
      setTimeout(() => {
        setIsAuthChecking(false);
        if (user) {
          // Graceful transition to dashboard
          logoScale.value = withTiming(10, { duration: 800 });
          logoOpacity.value = withTiming(0, { duration: 600 });
          setTimeout(() => {
            router.replace('/dashboard');
          }, 400);
        } else {
          // Reveal Landing UI components
          setShowButtons(true);
          contentOpacity.value = withTiming(1, { duration: 800 });
          logoScale.value = withSpring(1);
        }
      }, 1800);
    });

    return unsubscribe;
  }, []);

  // Animated Styles
  const blob1Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: withSpring(blob1Pos.value * 100 - 50) },
      { translateY: withSpring(Math.sin(blob1Pos.value * Math.PI) * 50) },
    ],
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
      <StatusBar style={isDark ? "light" : "dark"} />
      
      {/* Dynamic Background */}
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[styles.blob, blob1Style, { top: '5%', left: '10%' }]}>
          <LinearGradient colors={isDark ? ['rgba(217,241,93,0.12)', 'transparent'] : ['rgba(217,241,93,0.2)', 'transparent']} style={styles.blobInner} />
        </Animated.View>
        <Animated.View style={[styles.blob, { bottom: '15%', right: '-10%', width: 400, height: 400, opacity: 0.6 }]}>
          <LinearGradient colors={isDark ? ['rgba(52,199,89,0.08)', 'transparent'] : ['rgba(52,199,89,0.15)', 'transparent']} style={styles.blobInner} />
        </Animated.View>
      </View>

      <View style={styles.container}>
        {/* Central Logo Experience */}
        <View style={styles.centerStage}>
          <Animated.View style={[styles.logoContainer, logoStyle]}>
             {/* Note: In a real app, this would be your SVG or local Image asset */}
             <View style={[styles.logoIconPlaceholder, { backgroundColor: isDark ? '#D9F15D' : '#000' }]}>
                <Text style={[styles.logoInitial, { color: isDark ? '#000' : '#FFF' }]}>A</Text>
             </View>
          </Animated.View>

          {showButtons && (
            <Animated.View entering={FadeInUp.delay(200)} style={styles.brandingText}>
               <Text style={[styles.title, { color: theme.text }]}>Architect</Text>
               <Text style={[styles.subtitle, { color: theme.text }]}>Nexus Student FIN</Text>
            </Animated.View>
          )}
        </View>

        {/* Action Buttons - revealed only if guest */}
        {showButtons && (
          <Animated.View entering={FadeInDown.delay(500)} style={styles.footer}>
             <TouchableOpacity
                style={[styles.button, { backgroundColor: isDark ? '#D9F15D' : '#0F0F0F' }]}
                onPress={() => router.push('/create-account')}
              >
                <Text style={[styles.buttonText, { color: isDark ? '#000' : '#FFF' }]}>Create an account</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.outlineButton, { borderColor: theme.border }]}
                onPress={() => router.push('/sign-in')}
              >
                <Text style={[styles.outlineButtonText, { color: theme.text }]}>Sign in</Text>
              </TouchableOpacity>
          </Animated.View>
        )}

        {isAuthChecking && (
          <View style={styles.loadingContainer}>
             <ActivityIndicator size="small" color={isDark ? '#D9F15D' : '#000'} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 30, justifyContent: 'space-between', paddingBottom: 50 },
  centerStage: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  logoContainer: { marginBottom: 20 },
  logoIconPlaceholder: { width: 80, height: 80, borderRadius: 20, justifyContent: 'center', alignItems: 'center', shadowColor: '#D9F15D', shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 0 } },
  logoInitial: { fontSize: 40, fontWeight: '900' },
  brandingText: { alignItems: 'center' },
  title: { fontSize: 48, fontFamily: 'KodeMono_700Bold', letterSpacing: -1 },
  subtitle: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', letterSpacing: 2, opacity: 0.7, marginTop: 4 },
  footer: { gap: 15 },
  button: { paddingVertical: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontFamily: 'Poppins_600SemiBold' },
  outlineButton: { paddingVertical: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  outlineButtonText: { fontSize: 16, fontFamily: 'Poppins_600SemiBold' },
  loadingContainer: { position: 'absolute', bottom: 100, left: 0, right: 0, alignItems: 'center' },
  blob: { position: 'absolute', width: 350, height: 350, borderRadius: 175 },
  blobInner: { flex: 1, borderRadius: 175 },
});
