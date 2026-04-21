import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { Ionicons } from '@expo/vector-icons';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { useTheme } from '../context/ThemeContext';

export default function SignInScreen() {
  const router = useRouter();
  const { isDark, theme } = useTheme();
  const { width } = useWindowDimensions();

  // Basic breakpoints for centered column on large screens
  const isTabletOrPC = width >= 768;
  const contentMaxWidth = isTabletOrPC ? 450 : undefined;
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const { signIn: googleSignIn, userInfo: googleUser, loading: googleLoading } = useGoogleAuth();

  useEffect(() => {
    if (googleUser) {
      console.log('Google Auth Success:', googleUser);
      // alert(`Welcome back ${googleUser.name}!`);
    }
  }, [googleUser]);

  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [genericError, setGenericError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    let isValid = true;
    setEmailError('');
    setPasswordError('');
    setGenericError('');

    if (!email) {
      setEmailError('Email is required');
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('Please enter a valid email address');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Password is required');
      isValid = false;
    }

    if (isValid) {
      setLoading(true);
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
        const userData = userDoc.data();

        // ── Banned user check ─────────────────────────────────────────────
        if (userData?.isBanned) {
          await auth.signOut();
          const reason = userData.banReason
            ? `Reason: ${userData.banReason}`
            : 'Please contact support for more information.';
          setGenericError(`⛔ Your account has been suspended.\n${reason}`);
          setLoading(false);
          return;
        }

        if (userDoc.exists() && userData?.onboardingCompleted) {
          router.replace('/dashboard');
        } else {
          router.replace('/onboarding');
        }
      } catch (error: any) {
        console.error("Manual sign in error:", error);
        if (error.code === 'auth/invalid-credential') {
          setGenericError('Incorrect email or password.');
        } else if (error.code === 'auth/user-not-found') {
          setGenericError('No account found with this email.');
        } else if (error.code === 'auth/wrong-password') {
          setGenericError('Incorrect password.');
        } else {
          setGenericError('Login failed. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <View style={[styles.safe, { backgroundColor: theme.bg }]}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={[
            styles.content,
            contentMaxWidth ? { maxWidth: contentMaxWidth, width: '100%', alignSelf: 'center' } : null
          ]}>
            <Text style={[styles.title, { color: theme.text }]}>Welcome Back</Text>

            {genericError ? <Text style={[styles.errorText, {textAlign: 'center', marginBottom: 15}]}>{genericError}</Text> : null}

            {/* Email Input */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Your email</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: theme.cardAlt, borderColor: theme.border, color: theme.inputText },
                  { fontFamily: email.length > 0 ? 'Helvetica' : 'Inter_400Regular' },
                  emailError ? styles.inputError : null
                ]}
                placeholder="Enter your Email"
                placeholderTextColor={theme.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setEmailError('');
                }}
              />
              {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
            </View>

            {/* Password Input */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Password</Text>
              <View style={[
                styles.passwordContainer,
                { backgroundColor: theme.cardAlt, borderColor: theme.border },
                passwordError ? styles.inputError : null
              ]}>
                <TextInput
                  style={[
                    styles.passwordInput,
                    { color: theme.inputText },
                    { fontFamily: password.length > 0 ? 'Helvetica' : 'Inter_400Regular' }
                  ]}
                  placeholder="Enter your Password"
                  placeholderTextColor={theme.placeholder}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setPasswordError('');
                  }}
                />
                <TouchableOpacity
                  style={styles.eyeIconContainer}
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={showPassword ? "eye" : "eye-off"} size={20} color={theme.text} />
                </TouchableOpacity>
              </View>
              {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
            </View>

            {/* Forgot Password */}
            <TouchableOpacity 
              style={styles.forgotPasswordContainer} 
              activeOpacity={0.7}
              onPress={() => router.push('/forgot-password')}
            >
              <Text style={[styles.forgotPasswordText, { color: theme.text }]}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity 
              style={[styles.primaryButton, { backgroundColor: isDark ? '#D9F15D' : '#0F0F0F' }, loading && { opacity: 0.7 }]} 
              activeOpacity={0.8} 
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={[styles.primaryButtonText, { color: isDark ? '#000' : '#FFF' }]}>
                {loading ? 'Logging in...' : 'Login'}
              </Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={[styles.dividerLine, { backgroundColor: theme.divider }]} />
              <Text style={[styles.dividerText, { color: theme.text }]}>or login with</Text>
              <View style={[styles.dividerLine, { backgroundColor: theme.divider }]} />
            </View>

            {/* Social Login Buttons */}
            <TouchableOpacity 
              style={[styles.socialButton, { backgroundColor: theme.cardAlt, borderWidth: 1, borderColor: theme.divider }, googleLoading && { opacity: 0.7 }]} 
              activeOpacity={0.8}
              onPress={googleSignIn}
              disabled={googleLoading}
            >
              <Text style={[styles.socialButtonText, { color: theme.text }]}>Sign in with Google</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.socialButton, { backgroundColor: theme.cardAlt, borderWidth: 1, borderColor: theme.divider }]} activeOpacity={0.8}>
              <Text style={[styles.socialButtonText, { color: theme.text }]}>Sign in with Apple</Text>
            </TouchableOpacity>

            {/* Footer / Sign Up */}
            <View style={styles.footerContainer}>
              <Text style={[styles.footerText, { color: theme.text }]}>
                Don't have an account?{' '}
                <Text 
                  style={[styles.signUpText, { color: theme.text }]} 
                  onPress={() => router.push('/create-account')}
                >
                  Sign Up
                </Text>
              </Text>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 25,
    paddingBottom: 40,
  },
  content: {
    flex: 1,
    width: '100%',
    paddingTop: 140,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 40,
    marginBottom: 40,
    textAlign: 'center',
    marginTop: 10,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontFamily: 'Helvetica',
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 15,
    paddingVertical: 14,
    fontSize: 15,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 4,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 15,
    paddingVertical: 14,
    fontSize: 15,
  },
  eyeIconContainer: {
    paddingHorizontal: 15,
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginBottom: 30,
  },
  forgotPasswordText: {
    fontFamily: 'Helvetica',
    fontSize: 13,
  },
  primaryButton: {
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 30,
  },
  primaryButtonText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontFamily: 'Helvetica',
    fontSize: 14,
    paddingHorizontal: 15,
  },
  socialButton: {
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 15,
  },
  socialButtonText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
  },
  footerContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: 'Helvetica',
    fontSize: 14,
  },
   signUpText: {
    fontFamily: 'Helvetica',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontFamily: 'Helvetica',
    fontSize: 12,
    marginTop: 5,
    marginLeft: 2,
  },
});
