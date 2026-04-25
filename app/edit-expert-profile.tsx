import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { useTheme } from '../context/ThemeContext';

const TRADES = [
  'Plumber', 'Electrician', 'Carpenter', 'Painter', 'Welder',
  'Graphic Designer', 'Web Developer', 'Photographer', 'Videographer',
  'Tutor', 'Mechanic', 'Tailor', 'Barber', 'Chef', 'Other'
];

export default function EditExpertProfileScreen() {
  const router = useRouter();
  const { isDark, theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedTrade, setSelectedTrade] = useState('');
  const [customTrade, setCustomTrade] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [bio, setBio] = useState('');
  const [basePrice, setBasePrice] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        const snap = await getDoc(doc(db, 'users', uid));
        if (snap.exists()) {
          const d = snap.data();
          const trade = d.trade || '';
          if (TRADES.includes(trade)) {
            setSelectedTrade(trade);
          } else if (trade) {
            setSelectedTrade('Other');
            setCustomTrade(trade);
          }
          setSkills(d.skills || []);
          setBio(d.expertBio || '');
          setBasePrice(d.basePrice?.toString() || '');
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const addSkill = () => {
    const trimmed = skillInput.trim();
    if (!trimmed || skills.includes(trimmed)) return;
    setSkills([...skills, trimmed]);
    setSkillInput('');
  };

  const removeSkill = (s: string) => setSkills(skills.filter(x => x !== s));

  const handleSave = async () => {
    if (!selectedTrade) {
      Alert.alert('Trade Required', 'Please select your trade.');
      return;
    }
    const finalTrade = selectedTrade === 'Other' ? customTrade.trim() : selectedTrade;
    if (!finalTrade) {
      Alert.alert('Trade Required', 'Please specify your trade.');
      return;
    }

    setSaving(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Not authenticated');
      await updateDoc(doc(db, 'users', uid), {
        trade: finalTrade,
        skills,
        expertBio: bio.trim(),
        basePrice: Number(basePrice) || 0,
      });
      Alert.alert('Updated!', 'Your expert profile has been updated successfully.', [
        { text: 'Done', onPress: () => router.back() }
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator size="large" color={theme.text} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style={isDark ? "light" : "dark"} />
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>

        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.bg }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Edit Expert Profile</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* Trade Selection */}
          <Text style={[styles.sectionLabel, { color: theme.subtext }]}>YOUR TRADE</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}>
            <View style={styles.tradesGrid}>
              {TRADES.map(trade => (
                <TouchableOpacity
                  key={trade}
                  style={[
                    styles.tradePill, 
                    { backgroundColor: theme.cardAlt },
                    selectedTrade === trade && [styles.tradePillActive, { backgroundColor: isDark ? '#D9F15D' : '#000', borderColor: isDark ? '#D9F15D' : '#000' }]
                  ]}
                  onPress={() => setSelectedTrade(trade)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                      styles.tradePillText, 
                      { color: theme.text },
                      selectedTrade === trade && [styles.tradePillTextActive, { color: isDark ? '#000' : '#FFF' }]
                  ]}>
                    {trade}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedTrade === 'Other' && (
              <TextInput
                style={[styles.input, { marginTop: 12, backgroundColor: theme.cardAlt, color: theme.inputText }]}
                placeholder="Specify your trade..."
                placeholderTextColor={theme.placeholder}
                value={customTrade}
                onChangeText={setCustomTrade}
              />
            )}
          </View>

          {/* Skills */}
          <Text style={[styles.sectionLabel, { color: theme.subtext }]}>YOUR SKILLS</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}>
            <View style={styles.skillsRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0, backgroundColor: theme.cardAlt, color: theme.inputText }]}
                placeholder="Add a skill..."
                placeholderTextColor={theme.placeholder}
                value={skillInput}
                onChangeText={setSkillInput}
                onSubmitEditing={addSkill}
                returnKeyType="done"
              />
              <TouchableOpacity style={[styles.addSkillBtn, { backgroundColor: isDark ? '#D9F15D' : '#000' }]} onPress={addSkill}>
                <Ionicons name="add" size={22} color={isDark ? '#000' : '#FFF'} />
              </TouchableOpacity>
            </View>

            {skills.length > 0 && (
              <View style={styles.skillTags}>
                {skills.map((s, i) => (
                  <TouchableOpacity key={i} style={[styles.skillTag, { backgroundColor: theme.cardAlt }]} onPress={() => removeSkill(s)}>
                    <Text style={[styles.skillText, { color: theme.text }]}>{s}</Text>
                    <Ionicons name="close" size={12} color={theme.subtext} style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <Text style={[styles.hint, { color: theme.subtext }]}>Tap a skill to remove it.</Text>
          </View>

          {/* Bio */}
          <Text style={[styles.sectionLabel, { color: theme.subtext }]}>BIO / ABOUT YOU</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}>
            <TextInput
              style={[styles.input, styles.bioInput, { backgroundColor: theme.cardAlt, color: theme.inputText }]}
              placeholder="Tell clients what you do and what makes you stand out..."
              placeholderTextColor={theme.placeholder}
              multiline
              numberOfLines={5}
              value={bio}
              onChangeText={setBio}
            />
            <Text style={[styles.hint, { color: theme.subtext }]}>{bio.length} characters</Text>
          </View>

          {/* Pricing */}
          <Text style={[styles.sectionLabel, { color: theme.subtext }]}>AVERAGE CHARGE (₵)</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}>
            <TextInput
              style={[styles.input, { backgroundColor: theme.cardAlt, color: theme.inputText }]}
              placeholder="e.g. 50"
              placeholderTextColor={theme.placeholder}
              keyboardType="numeric"
              value={basePrice}
              onChangeText={setBasePrice}
            />
            <Text style={[styles.hint, { color: theme.subtext }]}>This is the starting price shown to clients.</Text>
          </View>

          {/* Save */}
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: isDark ? '#D9F15D' : '#000' }, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color={isDark ? '#000' : '#FFF'} />
            ) : (
              <Text style={[styles.saveBtnText, { color: isDark ? '#000' : '#FFF' }]}>Save Changes</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F2F2F7' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: '#F2F2F7',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#000' },

  content: { padding: 20 },
  sectionLabel: {
    fontFamily: 'Inter_700Bold', fontSize: 13, color: '#8E8E93',
    letterSpacing: 0.5, marginBottom: 10, marginLeft: 6, textTransform: 'uppercase'
  },
  card: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8
  },

  tradesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tradePill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#F0F0F0', borderWidth: 1.5, borderColor: 'transparent'
  },
  tradePillActive: { backgroundColor: '#000', borderColor: '#000' },
  tradePillText: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#555' },
  tradePillTextActive: { color: '#FFF' },

  input: {
    backgroundColor: '#F7F7F7', borderRadius: 12, padding: 14,
    fontFamily: 'Inter_400Regular', fontSize: 15, color: '#000', marginBottom: 8
  },
  bioInput: { minHeight: 120, textAlignVertical: 'top' },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#AEAEB2', marginTop: 6 },

  skillsRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  addSkillBtn: {
    width: 46, height: 46, borderRadius: 12, backgroundColor: '#000',
    justifyContent: 'center', alignItems: 'center'
  },
  skillTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  skillTag: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F0F0F0', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20
  },
  skillText: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#000' },

  saveBtn: {
    backgroundColor: '#000', borderRadius: 16, paddingVertical: 18,
    alignItems: 'center', marginTop: 8
  },
  saveBtnText: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#FFF' },
});
