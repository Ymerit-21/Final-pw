import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../context/ThemeContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FAQ_SECTIONS = [
  {
    title: '🏦 Financial Hub & Wallet',
    items: [
      {
        q: 'How do I add money to my wallet?',
        a: 'Go to Financial Hub → tap "Add Money". You can top up via bank transfer or mobile money. Funds reflect instantly once your payment provider confirms the transaction.',
      },
      {
        q: 'How do I withdraw my earnings?',
        a: 'Navigate to Financial Hub → tap "Withdraw". Enter the amount and your destination account. Withdrawals are processed within 1–3 business days.',
      },
      {
        q: 'What is a Financial Score?',
        a: 'Your Financial Score (0–100) reflects your saving habits, milestone completion, and budget discipline. Scores above 75 unlock Pro tier, and 90+ unlocks Elite tier benefits.',
      },
      {
        q: 'What are Financial Milestones?',
        a: 'Milestones are savings goals you create with a target amount and deadline. You can optionally lock funds so they cannot be withdrawn until the goal is reached.',
      },
    ],
  },
  {
    title: '👤 Account & Profile',
    items: [
      {
        q: 'How do I change my display name?',
        a: 'Go to Profile → tap your name or "Personal Information". Enter your new name and hit Save.',
      },
      {
        q: 'How do I reset my password?',
        a: 'Go to Profile → Security & Password → Send Reset Link. A password reset email will be sent to your registered address.',
      },
      {
        q: 'How do I become an Expert?',
        a: 'Go to Profile → Strategy & Earnings → Become an Expert. Fill in your skills, hourly rate, and service area. Your listing goes live after admin verification.',
      },
      {
        q: 'Can I change my avatar colour?',
        a: 'Yes! Tap your avatar on the Profile screen and choose from the colour swatches displayed beneath it.',
      },
    ],
  },
  {
    title: '🛒 Marketplace & Jobs',
    items: [
      {
        q: 'How do I find experts near me?',
        a: 'Use the Map Explorer tab to browse verified experts in your area filtered by skill, rating, and availability.',
      },
      {
        q: 'How does payment for a job work?',
        a: 'When you hire an expert, the agreed amount is held in escrow from your wallet. Funds are released to the expert only after you mark the job as complete.',
      },
      {
        q: 'What happens if there is a dispute?',
        a: 'Contact our support team via the chat feature. An admin will review the job timeline and mediate a fair resolution.',
      },
    ],
  },
  {
    title: '🔔 Notifications & Messaging',
    items: [
      {
        q: 'How do I turn off notifications?',
        a: 'Go to Profile → Account Settings → Notifications and toggle it off.',
      },
      {
        q: 'Why am I not receiving messages?',
        a: 'Ensure notifications are enabled in your device settings for this app. Also check your internet connection and try restarting the app.',
      },
    ],
  },
  {
    title: '🔒 Privacy & Security',
    items: [
      {
        q: 'Is my financial data secure?',
        a: 'Yes. All financial data is encrypted and stored securely in Firebase. We never store raw payment credentials.',
      },
      {
        q: 'Who can see my profile?',
        a: 'Your name and skills are visible to other users if you are a registered expert. Your email and financial details are private.',
      },
      {
        q: 'How do I delete my account?',
        a: 'Account deletion requests can be submitted by contacting our support team at support@architectapp.co. Data will be removed within 30 days.',
      },
    ],
  },
];

export default function HelpCenterScreen() {
  const router = useRouter();
  const { isDark, theme } = useTheme();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const toggleSection = (title: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenSections(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const toggleItem = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleContact = () => {};

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Help Center</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.heroSection, { backgroundColor: isDark ? '#1C1C1E' : '#000' }]}>
            <View style={styles.heroContent}>
              <View style={[styles.heroIconBg, { backgroundColor: '#D9F15D' }]}>
                <Ionicons name="headset" size={28} color="#000" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.heroTitle, { color: '#FFF' }]}>How can we help?</Text>
                <Text style={styles.heroSubtitle}>Search our FAQ or contact support.</Text>
              </View>
            </View>
          </View>

          <View style={[styles.contactCard, { backgroundColor: theme.cardAlt }]}>
            <Text style={[styles.contactTitle, { color: theme.text }]}>Still need help?</Text>
            <Text style={[styles.contactDesc, { color: theme.subtext }]}>Our support team is available 24/7 to assist you.</Text>
            <TouchableOpacity style={[styles.contactBtn, { backgroundColor: isDark ? '#D9F15D' : '#000' }]} onPress={handleContact}>
              <Text style={[styles.contactBtnText, { color: isDark ? '#000' : '#FFF' }]}>Contact Us</Text>
            </TouchableOpacity>
          </View>

          {FAQ_SECTIONS.map(section => (
            <View key={section.title} style={[styles.section, { backgroundColor: theme.card }]}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection(section.title)} activeOpacity={0.7}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>{section.title}</Text>
                <Ionicons
                  name={openSections[section.title] ? 'chevron-up' : 'chevron-down'}
                  size={18} color={theme.subtext}
                />
              </TouchableOpacity>

              {openSections[section.title] && (
                <View style={[styles.sectionBody, { borderTopColor: theme.divider }]}>
                  {section.items.map((item, idx) => {
                    const key = `${section.title}-${idx}`;
                    const isOpen = !!openItems[key];
                    const isLast = idx === section.items.length - 1;
                    return (
                      <View key={key} style={[styles.faqItem, isLast && { borderBottomWidth: 0 }, { borderBottomColor: theme.divider }]}>
                        <TouchableOpacity onPress={() => toggleItem(key)} activeOpacity={0.7} style={styles.faqQ}>
                          <Text style={[styles.faqQuestion, { color: theme.text }]}>{item.q}</Text>
                          <Ionicons
                            name={isOpen ? 'remove' : 'add'}
                            size={18} color={isOpen ? theme.text : theme.subtext}
                          />
                        </TouchableOpacity>
                        {isOpen && (
                          <Text style={[styles.faqAnswer, { color: theme.subtext }]}>{item.a}</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          ))}

          <View style={{ height: 50 }} />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  heroTitle: { fontFamily: 'Inter_700Bold', fontSize: 24, marginBottom: 6 },
  section: {
    backgroundColor: '#FFF', borderRadius: 16, marginBottom: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4,
  },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16,
  },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, marginBottom: 12 },
  sectionBody: { borderTopWidth: 1 },
  faqItem: {
    borderBottomWidth: 1, paddingHorizontal: 16,
  },
  faqQ: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14,
  },
  faqQuestion: { fontFamily: 'Inter_400Regular', fontSize: 14, flex: 1, marginRight: 10 },
  faqAnswer: {
    fontFamily: 'Inter_400Regular', fontSize: 13,
    lineHeight: 20, paddingBottom: 14,
  },
});
