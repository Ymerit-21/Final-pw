import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  TextInput, Alert, ActivityIndicator, Image, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { auth, db, storage } from '../config/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useTheme } from '../context/ThemeContext';

const TRADES = [
  { id: 'plumber', label: 'Plumber', icon: 'water-outline' },
  { id: 'electrician', label: 'Electrician', icon: 'flash-outline' },
  { id: 'painter', label: 'Painter', icon: 'brush-outline' },
  { id: 'carpenter', label: 'Carpenter', icon: 'hammer-outline' },
  { id: 'graphic', label: 'Graphic Designer', icon: 'color-palette-outline' },
  { id: 'tutor', label: 'Tutor', icon: 'book-outline' },
  { id: 'ac', label: 'AC Technician', icon: 'snow-outline' },
  { id: 'mechanic', label: 'Mechanic', icon: 'settings-outline' },
  { id: 'tailor', label: 'Tailor', icon: 'cut-outline' },
  { id: 'hair', label: 'Hairdresser', icon: 'woman-outline' },
  { id: 'mason', label: 'Mason', icon: 'square-outline' },
  { id: 'cleaner', label: 'Cleaner', icon: 'leaf-outline' },
  { id: 'photo', label: 'Photographer', icon: 'camera-outline' },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
];

export default function ExpertRegistrationScreen() {
  const router = useRouter();
  const { isDark, theme } = useTheme();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [fullName, setFullName] = useState('');
  const [selectedTrade, setSelectedTrade] = useState('');
  const [customTrade, setCustomTrade] = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [bio, setBio] = useState('');
  const [ghanaCardNumber, setGhanaCardNumber] = useState('');
  const [ghanaCardImage, setGhanaCardImage] = useState<string | null>(null);
  const [ghanaCardBack, setGhanaCardBack] = useState<string | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [basePrice, setBasePrice] = useState('');

  const pickImage = async (type: 'cardFront' | 'cardBack' | 'selfie') => {
    // Create a file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Read file as base64
      const reader = new FileReader();
      reader.onload = (event: any) => {
        const b64Data = event.target.result; // Already in data:image/... format
        if (type === 'cardFront') setGhanaCardImage(b64Data);
        else if (type === 'cardBack') setGhanaCardBack(b64Data);
        else setSelfieImage(b64Data);
      };
      reader.readAsDataURL(file);
    };

    input.click();
  };

  const addSkill = () => {
    if (skillInput.trim()) {
      if (!skills.includes(skillInput.trim())) {
        setSkills([...skills, skillInput.trim()]);
      }
      setSkillInput('');
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setSkills(skills.filter(s => s !== skillToRemove));
  };

  const handleNext = () => {
    if (step === 1 && !selectedTrade) {
      Alert.alert('Select Trade', 'Please select your primary skill.');
      return;
    }
    if (step === 1 && selectedTrade === 'Other' && !customTrade) {
      Alert.alert('Custom Trade', 'Please specify what you do.');
      return;
    }
    if (step === 1 && (!basePrice || isNaN(Number(basePrice)) || Number(basePrice) <= 0)) {
      Alert.alert('Valid Price Required', 'Please set a valid average charge for your services.');
      return;
    }
    if (step === 2 && (!fullName || !ghanaCardNumber || !ghanaCardImage || !ghanaCardBack)) {
      Alert.alert('Incomplete Info', 'Please provide your full legal name, ID number, and both photos of your ID.');
      return;
    }
    setStep(step + 1);
  };

  const handleFinish = async () => {
    if (!selfieImage) {
      Alert.alert('Selfie Required', 'Please take a live selfie to continue.');
      return;
    }

    setLoading(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('User not authenticated');

      // Fetch existing user data to bundle with the application
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data() || {};
      
      const safeName = fullName.trim() || userData.name || 'Unknown Applicant';
      const safeEmail = userData.email || auth.currentUser?.email || 'No Email';
      const safeColor = userData.color || '#D9F15D';

      // Submit the official application to the backend queue with base64 embedded directly
      await setDoc(doc(db, 'expertApplications', uid), {
        userId: uid,
        name: safeName,
        email: safeEmail,
        color: safeColor,
        status: 'pending',
        trade: selectedTrade === 'Other' ? customTrade : selectedTrade,
        skills,
        expertBio: bio,
        ghanaCardNumber,
        ghanaCardImage,
        ghanaCardBack,
        selfiePic: selfieImage,
        basePrice: Number(basePrice) || 0,
        submittedAt: serverTimestamp(),
      });

      Alert.alert(
        'Registration Sent!',
        'Your expert profile is under review. You will be notified once verified.',
        [{ text: 'Great!', onPress: () => router.replace('/marketplace') }]
      );
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', `Failed to register: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
        <View style={[styles.header, { borderBottomColor: theme.divider }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Become an Expert</Text>
          <Text style={[styles.stepIndicator, { color: theme.subtext }]}>{step}/3</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {step === 1 && (
            <View style={styles.stepContainer}>
              <Text style={[styles.title, { color: theme.text }]}>What is your trade?</Text>
              <Text style={[styles.subtitle, { color: theme.subtext }]}>Select the primary service you want to offer.</Text>
              
              <View style={styles.tradeGrid}>
                {TRADES.map((trade) => (
                  <TouchableOpacity 
                    key={trade.id}
                    style={[
                      styles.tradeCard,
                      { backgroundColor: theme.cardAlt, borderColor: theme.border },
                      selectedTrade === trade.label && [styles.tradeCardActive, { backgroundColor: isDark ? '#D9F15D' : '#D9F15D', borderColor: isDark ? '#D9F15D' : '#D9F15D' }]
                    ]}
                    onPress={() => setSelectedTrade(trade.label)}
                  >
                    <Ionicons 
                      name={trade.icon as any} 
                      size={32} 
                      color={selectedTrade === trade.label ? '#000' : theme.text} 
                    />
                    <Text style={[
                      styles.tradeLabel,
                      { color: theme.text },
                      selectedTrade === trade.label && [styles.tradeLabelActive, { color: '#000' }]
                    ]}>
                      {trade.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {selectedTrade === 'Other' && (
                <View style={{ marginTop: 20 }}>
                  <Text style={[styles.inputLabel, { color: theme.text }]}>Please specify what you do</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.cardAlt, borderColor: theme.border, color: theme.inputText }]}
                    placeholder="e.g. Fashion Designer, Barber, etc."
                    placeholderTextColor={theme.placeholder}
                    value={customTrade}
                    onChangeText={setCustomTrade}
                    autoFocus
                  />
                </View>
              )}

              <Text style={[styles.title, { marginTop: 30, color: theme.text }]}>Your Skills</Text>
              <Text style={[styles.subtitle, { color: theme.subtext }]}>What are you specifically good at? Add your top skills.</Text>
              
              <View style={styles.skillInputRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0, backgroundColor: theme.cardAlt, borderColor: theme.border, color: theme.inputText }]}
                  placeholder="e.g. Logo Design"
                  placeholderTextColor={theme.placeholder}
                  value={skillInput}
                  onChangeText={setSkillInput}
                  onSubmitEditing={addSkill}
                />
                <TouchableOpacity style={[styles.addSkillBtn, { backgroundColor: isDark ? '#D9F15D' : '#D9F15D' }]} onPress={addSkill}>
                  <Ionicons name="add" size={24} color="#000" />
                </TouchableOpacity>
              </View>

              <View style={styles.skillsTagContainer}>
                {skills.map((skill) => (
                  <View key={skill} style={[styles.skillTag, { backgroundColor: theme.cardAlt }]}>
                    <Text style={[styles.skillTagText, { color: theme.text }]}>{skill}</Text>
                    <TouchableOpacity onPress={() => removeSkill(skill)}>
                      <Ionicons name="close-circle" size={16} color={theme.subtext} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <Text style={[styles.title, { marginTop: 30, color: theme.text }]}>Short Bio</Text>
              <Text style={[styles.subtitle, { color: theme.subtext }]}>Tell clients why they should hire you...</Text>
              <TextInput
                style={[styles.bioInput, { backgroundColor: theme.cardAlt, borderColor: theme.border, color: theme.inputText }]}
                placeholder="I am a professional electrician with 5 years experience..."
                placeholderTextColor={theme.placeholder}
                multiline
                numberOfLines={4}
                value={bio}
                onChangeText={setBio}
              />

              <Text style={[styles.title, { marginTop: 30, color: theme.text }]}>Average Charge (₵)</Text>
              <Text style={[styles.subtitle, { color: theme.subtext }]}>Set the average amount you charge per job.</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.cardAlt, borderColor: theme.border, color: theme.inputText }]}
                placeholder="e.g. 50"
                placeholderTextColor={theme.placeholder}
                keyboardType="numeric"
                value={basePrice}
                onChangeText={setBasePrice}
              />
            </View>
          )}

          {step === 2 && (
            <View style={styles.stepContainer}>
              <Text style={[styles.title, { color: theme.text }]}>Identity Verification</Text>
              <Text style={[styles.subtitle, { color: theme.subtext }]}>Please provide your legal name and Ghana Card details.</Text>
              
              <View style={styles.inputWrapper}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Legal Full Name</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.cardAlt, borderColor: theme.border, color: theme.inputText }]}
                  placeholder="As it appears on your ID"
                  placeholderTextColor={theme.placeholder}
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>

              <View style={styles.inputWrapper}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Ghana Card Number (GHA-XXXXXXXXX-X)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.cardAlt, borderColor: theme.border, color: theme.inputText }]}
                  placeholder="GHA-"
                  placeholderTextColor={theme.placeholder}
                  value={ghanaCardNumber}
                  onChangeText={setGhanaCardNumber}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 15 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: theme.text }]}>Card (Front)</Text>
                  <TouchableOpacity style={[styles.photoBoxHalf, { backgroundColor: theme.cardAlt, borderColor: theme.divider }]} onPress={() => pickImage('cardFront')}>
                    {ghanaCardImage ? (
                      <Image source={{ uri: ghanaCardImage }} style={styles.previewImage} />
                    ) : (
                      <View style={styles.photoPlaceholder}>
                        <Ionicons name="card-outline" size={30} color={theme.subtext} />
                        <Text style={[styles.photoText, { fontSize: 12, color: theme.subtext }]}>Add Front</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
                
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: theme.text }]}>Card (Back)</Text>
                  <TouchableOpacity style={[styles.photoBoxHalf, { backgroundColor: theme.cardAlt, borderColor: theme.divider }]} onPress={() => pickImage('cardBack')}>
                    {ghanaCardBack ? (
                      <Image source={{ uri: ghanaCardBack }} style={styles.previewImage} />
                    ) : (
                      <View style={styles.photoPlaceholder}>
                        <Ionicons name="card-outline" size={30} color={theme.subtext} />
                        <Text style={[styles.photoText, { fontSize: 12, color: theme.subtext }]}>Add Back</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={styles.stepContainer}>
              <Text style={[styles.title, { color: theme.text }]}>Live Selfie</Text>
              <Text style={[styles.subtitle, { color: theme.subtext }]}>Take a clear photo of your face to verify it matches your ID.</Text>
              
              <TouchableOpacity style={[styles.selfieBox, { backgroundColor: theme.cardAlt, borderColor: theme.divider }]} onPress={() => pickImage('selfie')}>
                {selfieImage ? (
                  <Image source={{ uri: selfieImage }} style={styles.previewSelfie} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="camera-outline" size={50} color={theme.subtext} />
                    <Text style={[styles.photoText, { color: theme.subtext }]}>Open Camera</Text>
                  </View>
                )}
              </TouchableOpacity>

              <View style={[styles.infoCard, { backgroundColor: isDark ? 'rgba(217,241,93,0.1)' : '#F0F7FF' }]}>
                <Ionicons name="information-circle-outline" size={20} color={isDark ? '#D9F15D' : '#004A99'} />
                <Text style={[styles.infoText, { color: isDark ? theme.text : '#004A99' }]}>Make sure your face is well-lit and clearly visible in the frame.</Text>
              </View>
            </View>
          )}

        </ScrollView>

        <View style={[styles.footer, { borderTopColor: theme.divider }]}>
          {step < 3 ? (
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: isDark ? '#D9F15D' : '#000' }]} onPress={handleNext}>
              <Text style={[styles.primaryBtnText, { color: isDark ? '#000' : '#FFF' }]}>Continue</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[styles.primaryBtn, { backgroundColor: isDark ? '#D9F15D' : '#000' }, loading && { opacity: 0.7 }]} 
              onPress={handleFinish}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={isDark ? '#000' : '#FFF'} />
              ) : (
                <Text style={[styles.primaryBtnText, { color: isDark ? '#000' : '#FFF' }]}>Submit Registration</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 20, 
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0'
  },
  backBtn: { padding: 5 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#000' },
  stepIndicator: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: '#888' },
  scrollContent: { padding: 25 },
  stepContainer: { flex: 1 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 24, color: '#000', marginBottom: 8 },
  subtitle: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: '#666', marginBottom: 25 },
  tradeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tradeCard: { 
    width: '48%', 
    backgroundColor: '#F9F9F9', 
    borderRadius: 16, 
    padding: 20, 
    alignItems: 'center', 
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#EEE'
  },
  tradeCardActive: { backgroundColor: '#D9F15D', borderColor: '#D9F15D' },
  tradeLabel: { fontFamily: 'Inter_700Bold', fontSize: 13, marginTop: 10, color: '#000' },
  tradeLabelActive: { color: '#000' },
  bioInput: { 
    backgroundColor: '#F9F9F9', 
    borderRadius: 12, 
    padding: 15, 
    fontSize: 15, 
    fontFamily: 'Poppins_400Regular', 
    color: '#000',
    height: 120,
    textAlignVertical: 'top'
  },
  inputWrapper: { marginBottom: 20 },
  inputLabel: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#000', marginBottom: 8 },
  input: { 
    backgroundColor: '#F9F9F9', 
    borderRadius: 12, 
    padding: 18, 
    fontSize: 16, 
    fontFamily: 'Poppins_400Regular', 
    color: '#000',
    borderWidth: 1,
    borderColor: '#EEE'
  },
  photoBox: { 
    width: '100%', 
    height: 200, 
    backgroundColor: '#F9F9F9', 
    borderRadius: 16, 
    borderStyle: 'dashed', 
    borderWidth: 2, 
    borderColor: '#CCC',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center'
  },
  photoBoxHalf: { 
    width: '100%', 
    height: 120, 
    backgroundColor: '#F9F9F9', 
    borderRadius: 16, 
    borderStyle: 'dashed', 
    borderWidth: 2, 
    borderColor: '#CCC',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center'
  },
  photoPlaceholder: { alignItems: 'center' },
  photoText: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: '#AAA', marginTop: 10 },
  previewImage: { width: '100%', height: '100%' },
  selfieBox: { 
    width: '100%', 
    aspectRatio: 1, 
    backgroundColor: '#F9F9F9', 
    borderRadius: 20, 
    borderStyle: 'dashed', 
    borderWidth: 2, 
    borderColor: '#CCC',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20
  },
  previewSelfie: { width: '100%', height: '100%' },
  infoCard: { flexDirection: 'row', backgroundColor: '#F0F7FF', padding: 15, borderRadius: 12, gap: 10 },
  infoText: { flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 13, color: '#004A99', lineHeight: 20 },
  footer: { padding: 25, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  primaryBtn: { backgroundColor: '#000', borderRadius: 24, paddingVertical: 20, alignItems: 'center' },
  primaryBtnText: { color: '#FFF', fontFamily: 'Inter_700Bold', fontSize: 16 },
  skillInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 15,
  },
  addSkillBtn: {
    backgroundColor: '#D9F15D',
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skillsTagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  skillTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 8,
  },
  skillTagText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: '#000',
  },
});
