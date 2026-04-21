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
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { useTheme } from '../context/ThemeContext';

export default function CreateAccountScreen() {
  const router = useRouter();
  const { isDark, theme } = useTheme();
  const { width } = useWindowDimensions();

  // Basic breakpoints for centered column on large screens
  const isTabletOrPC = width >= 768;
  const contentMaxWidth = isTabletOrPC ? 450 : undefined;
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { signIn: googleSignIn, userInfo: googleUser, loading: googleLoading } = useGoogleAuth();

  useEffect(() => {
    if (googleUser) {
      console.log('Google Auth Success:', googleUser);
    }
  }, [googleUser]);

  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [genericError, setGenericError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    let isValid = true;
    setEmailError('');
    setPasswordError('');
    setConfirmPasswordError('');
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

    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password');
      isValid = false;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      isValid = false;
    }

    if (isValid) {
      setLoading(true);
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          name: '',
          profilePicture: null,
          createdAt: new Date().toISOString(),
          onboardingCompleted: false
        });

        router.replace('/onboarding');
      } catch (error: any) {
        console.error("Manual registration error:", error);
        if (error.code === 'auth/email-already-in-use') {
          setGenericError('This email is already registered.');
        } else if (error.code === 'auth/weak-password') {
          setGenericError('Your password is too weak.');
        } else if (error.code === 'auth/invalid-email') {
          setGenericError('The email address is improperly formatted.');
        } else {
          setGenericError(error.message || 'An error occurred during registration.');
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
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
              <Ionicons name="arrow-back" size={24} color={theme.text} />
              <Text style={[styles.headerTitle, { color: theme.text }]}>Registration</Text>
            </TouchableOpacity>
          </View>

          <View style={[
            styles.content,
            contentMaxWidth ? { maxWidth: contentMaxWidth, width: '100%', alignSelf: 'center' } : null
          ]}>
            <Text style={[styles.title, { color: theme.text }]}>Create an account</Text>
            
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
                placeholder="Enter your email"
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
                  placeholder="Enter your password"
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

            {/* Confirm Password Input */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Confirm password</Text>
              <View style={[
                styles.passwordContainer,
                { backgroundColor: theme.cardAlt, borderColor: theme.border },
                confirmPasswordError ? styles.inputError : null
              ]}>
                <TextInput
                  style={[
                    styles.passwordInput,
                    { color: theme.inputText },
                    { fontFamily: confirmPassword.length > 0 ? 'Helvetica' : 'Inter_400Regular' }
                  ]}
                  placeholder="Confirm your Password"
                  placeholderTextColor={theme.placeholder}
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    setConfirmPasswordError('');
                  }}
                />
                <TouchableOpacity
                  style={styles.eyeIconContainer}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={showConfirmPassword ? "eye" : "eye-off"} size={20} color={theme.text} />
                </TouchableOpacity>
              </View>
              {confirmPasswordError ? <Text style={styles.errorText}>{confirmPasswordError}</Text> : null}
            </View>


            {/* Register Button */}
            <TouchableOpacity 
              style={[styles.primaryButton, { backgroundColor: isDark ? '#D9F15D' : '#0F0F0F' }, loading && { opacity: 0.7 }]} 
              activeOpacity={0.8} 
              onPress={handleRegister}
              disabled={loading}
            >
              <Text style={[styles.primaryButtonText, { color: isDark ? '#000' : '#FFF' }]}>
                {loading ? 'Creating...' : 'Create an account'}
              </Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={[styles.dividerLine, { backgroundColor: theme.divider }]} />
              <Text style={[styles.dividerText, { color: theme.text }]}>or sign up with</Text>
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

            {/* Footer / Sign In */}
            <View style={styles.footerContainer}>
              <Text style={[styles.footerText, { color: theme.text }]}>
                Already have an account?{' '}
                <Text 
                  style={[styles.signInText, { color: theme.text }]} 
                  onPress={() => router.push('/sign-in')}
                >
                  Sign In
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
  header: {
    marginTop: Platform.OS === 'android' ? 40 : 20,
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 5,
    marginLeft: -5,
  },
  headerTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    marginLeft: 8,
  },
  content: {
    flex: 1,
    width: '100%',
    paddingTop: 60,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 38,
    marginBottom: 35,
    textAlign: 'center',
    lineHeight: 45,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontFamily: 'Helvetica',
    fontSize: 13,
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
  primaryButton: {
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 25,
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
  signInText: {
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
