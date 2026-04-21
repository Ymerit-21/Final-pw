import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { auth, db } from '../config/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export default function OnboardingScreen() {
  const router = useRouter();
  const { isDark, theme } = useTheme();
  const [step, setStep] = useState(1);
  const isNavigating = useRef(false);
  
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [location, setLocation] = useState('');

  const totalSteps = 3;

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // Don't do anything if we're already mid-navigation
      if (isNavigating.current) return;

      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists() && isMounted) {
            const data = userDoc.data();
            if (data.name) setName(data.name);
            // Only auto-skip if they already fully completed onboarding before
            if (data.onboardingCompleted && data.location) {
              isNavigating.current = true;
              router.replace('/dashboard');
            }
          }
        } catch (error) {
          console.log("Error checking user doc for onboarding", error);
        }
      } else {
        setTimeout(() => {
           if (isMounted && !auth.currentUser && !isNavigating.current) {
             router.replace('/sign-in');
           }
        }, 500);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const handleNext = () => {
    if (step < totalSteps) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleFinish = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        name,
        role: 'hire',
        budgetGoal: budget,
        location,
        isExpert: false,
        isVerified: true, // Students are auto-verified, Experts need Admin
        onboardingCompleted: true,
        updatedAt: new Date().toISOString()
      });
      isNavigating.current = true;
      router.replace('/dashboard');
    } catch (error) {
      console.error("Error saving onboarding data", error);
      alert("Failed to save data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Details' }} />
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
        <KeyboardAvoidingView 
          style={{flex: 1}} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTop}>
              {step > 1 ? (
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                  <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
              ) : <View style={{width: 34}} />}
              
              <Text style={[styles.stepIndicator, { color: theme.subtext }]}>Step {step} of {totalSteps}</Text>
              <View style={{width: 34}} /> 
            </View>
            
            <View style={[styles.progressBarBackground, { backgroundColor: theme.divider }]}>
              <View style={[styles.progressBarFill, { backgroundColor: isDark ? '#D9F15D' : '#0F0F0F', width: `${(step / totalSteps) * 100}%` }]} />
            </View>
          </View>

          {/* Content */}
          <View style={styles.content}>
            
            {/* Step 1: Name */}
            {step === 1 && (
              <View style={styles.stepContainer}>
                <Text style={[styles.title, { color: theme.text }]}>What should we call you?</Text>
                <Text style={[styles.subtitle, { color: theme.subtext }]}>Enter your name or preferred alias.</Text>
                
                <TextInput
                  style={[styles.input, { backgroundColor: theme.cardAlt, borderColor: theme.border, color: theme.inputText }]}
                  placeholder="Your Name"
                  placeholderTextColor={theme.placeholder}
                  value={name}
                  onChangeText={setName}
                  autoFocus
                />
              </View>
            )}

            {/* Step 2: Budget */}
            {step === 2 && (
              <View style={styles.stepContainer}>
                <Text style={[styles.title, { color: theme.text }]}>What is your monthly budget goal?</Text>
                <Text style={[styles.subtitle, { color: theme.subtext }]}>Helps us match you with the right opportunities.</Text>
                
                {['Under GH₵ 1k', 'GH₵ 1k - GH₵ 5k', 'GH₵ 5k - GH₵ 10k', 'GH₵ 10k+'].map((option) => (
                  <TouchableOpacity 
                    key={option}
                    style={[
                      styles.cardButton, 
                      { backgroundColor: theme.cardAlt, borderColor: theme.border },
                      budget === option && [styles.cardButtonActive, { backgroundColor: isDark ? '#D9F15D' : '#0F0F0F', borderColor: isDark ? '#D9F15D' : '#0F0F0F' }]
                    ]}
                    activeOpacity={0.7}
                    onPress={() => setBudget(option)}
                  >
                    <Text style={[
                      styles.cardTitle, 
                      { color: theme.text, textAlign: 'center' },
                      budget === option && [styles.cardTextActive, { color: isDark ? '#000' : '#FFF' }]
                    ]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Step 3: Location */}
            {step === 3 && (
              <View style={styles.stepContainer}>
                <Text style={[styles.title, { color: theme.text }]}>What's your primary location?</Text>
                <Text style={[styles.subtitle, { color: theme.subtext }]}>City, State, or Country</Text>
                
                <TextInput
                  style={[styles.input, { backgroundColor: theme.cardAlt, borderColor: theme.border, color: theme.inputText, fontFamily: 'Poppins_400Regular' }]}
                  placeholder="e.g. New York, NY"
                  placeholderTextColor={theme.placeholder}
                  value={location}
                  onChangeText={setLocation}
                  autoFocus
                />
              </View>
            )}

          </View>

          <View style={styles.footer}>
            {step < totalSteps ? (
              <TouchableOpacity 
                style={[styles.primaryButton, { backgroundColor: isDark ? '#D9F15D' : '#0F0F0F' }, (!isStepValid()) && {opacity: 0.5}]} 
                onPress={handleNext}
                disabled={!isStepValid()}
                activeOpacity={0.8}
              >
                <Text style={[styles.primaryButtonText, { color: isDark ? '#000' : '#FFF' }]}>Continue</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={[styles.primaryButton, { backgroundColor: isDark ? '#D9F15D' : '#0F0F0F' }, (!isStepValid() || loading) && {opacity: 0.5}]} 
                onPress={handleFinish}
                disabled={!isStepValid() || loading}
                activeOpacity={0.8}
              >
                <Text style={[styles.primaryButtonText, { color: isDark ? '#000' : '#FFF' }]}>
                  {loading ? 'Completing Setup...' : 'Finish Setup'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </>
  );

  // Validates if the user can move to the next step
  function isStepValid() {
    if (step === 1) return (name || '').trim().length > 1;
    if (step === 2) return budget !== '';
    if (step === 3) return (location || '').trim().length > 1;
    return false;
  }
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 25,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 40,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    padding: 5,
    marginLeft: -5,
  },
  stepIndicator: {
    fontFamily: 'Helvetica',
    fontSize: 16,
    fontWeight: '600',
  },
  progressBarBackground: {
    height: 4,
    borderRadius: 2,
    width: '100%',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 32,
    marginBottom: 10,
    lineHeight: 40,
  },
  subtitle: {
    fontFamily: 'Helvetica',
    fontSize: 15,
    marginBottom: 40,
    lineHeight: 22,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 18,
    fontSize: 16,
    fontFamily: 'Helvetica',
  },
  cardButton: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
  },
  tradeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  cardButtonActive: {
    backgroundColor: '#0F0F0F',
    borderColor: '#0F0F0F',
  },
  cardTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    marginBottom: 5,
  },
  cardSubtitle: {
    fontFamily: 'Helvetica',
    fontSize: 14,
    lineHeight: 20,
  },
  cardTextActive: {
    color: '#FFFFFF'
  },
  footer: {
    marginTop: 20,
  },
  primaryButton: {
    borderRadius: 50,
    paddingVertical: 18,
    alignItems: 'center',
    width: '100%',
  },
  primaryButtonText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
  },
});
