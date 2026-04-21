import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../config/firebase';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { isDark, theme } = useTheme();
  const { width } = useWindowDimensions();

  // Basic breakpoints for centered column on large screens
  const isTabletOrPC = width >= 768;
  const contentMaxWidth = isTabletOrPC ? 450 : undefined;
  
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    let isValid = true;
    setEmailError('');
    setMessage('');

    if (!email) {
      setEmailError('Email is required');
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('Please enter a valid email address');
      isValid = false;
    }

    if (isValid) {
      setLoading(true);
      try {
        await sendPasswordResetEmail(auth, email);
        setMessage('Password reset email sent. Please check your inbox.');
      } catch (error: any) {
        console.error("Reset error:", error);
        setMessage('Failed to send reset email. Please try again.');
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
              <Text style={[styles.headerTitle, { color: theme.text }]}>Forgotten Password</Text>
            </TouchableOpacity>
          </View>

          <View style={[
            styles.content,
            contentMaxWidth ? { maxWidth: contentMaxWidth, width: '100%', alignSelf: 'center' } : null
          ]}>
            <Text style={[styles.title, { color: theme.text }]}>Reset Password</Text>

            {message ? <Text style={[styles.messageText, { color: isDark ? '#D9F15D' : '#00C853', textAlign: 'center', marginBottom: 20 }]}>{message}</Text> : null}

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



            {/* Submit Button */}
            <TouchableOpacity 
              style={[styles.primaryButton, { backgroundColor: isDark ? '#D9F15D' : '#0F0F0F' }, loading && { opacity: 0.7 }]} 
              activeOpacity={0.8} 
              onPress={handleReset}
              disabled={loading}
            >
              <Text style={[styles.primaryButtonText, { color: isDark ? '#000' : '#FFF' }]}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Text>
            </TouchableOpacity>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    marginBottom: 40,
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
    color: '#000000',
    marginLeft: 8,
  },
  content: {
    flex: 1,
    width: '100%',
    paddingTop: 10,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 40,
    color: '#000000',
    marginBottom: 40,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontFamily: 'Helvetica',
    fontSize: 13,
    color: '#000000',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D3D3D3',
    borderWidth: 1,
    borderRadius: 4,
    color: '#000000',
    paddingHorizontal: 15,
    paddingVertical: 14,
    fontSize: 15,
  },
  primaryButton: {
    backgroundColor: '#0F0F0F',
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
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
  messageText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  }
});
