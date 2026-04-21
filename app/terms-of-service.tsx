import React from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../context/ThemeContext';

const TERMS_SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    body: `By accessing or using the Architect application ("App"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use the App.\n\nThese Terms apply to all users, including students, freelance experts, and administrators. We reserve the right to update these Terms at any time. Continued use of the App after changes constitutes acceptance of the revised Terms.`,
  },
  {
    title: '2. Eligibility',
    body: `You must be at least 16 years of age to use the App. By using the App, you represent that you meet this age requirement and that all information you provide is accurate, current, and complete.\n\nUsers under 18 must have parental or guardian consent to use financial features including wallet deposits, withdrawals, and marketplace transactions.`,
  },
  {
    title: '3. User Accounts',
    body: `You are responsible for maintaining the confidentiality of your account credentials. You agree to:\n\n• Not share your password with any third party.\n• Notify us immediately of any unauthorized access to your account.\n• Accept responsibility for all activities that occur under your account.\n\nWe reserve the right to suspend or terminate accounts that violate these Terms or engage in fraudulent activity.`,
  },
  {
    title: '4. Financial Hub & Wallet',
    body: `The Architect Wallet is a digital wallet feature designed for educational savings and peer-to-peer payments within the App. By using the Wallet, you agree that:\n\n• All transactions are final once confirmed.\n• Withdrawal processing times may vary (typically 1–3 business days).\n• Locked milestone funds cannot be withdrawn until the goal deadline is reached.\n• We are not a licensed bank or financial institution. The Wallet is a utility feature for in-app transactions only.`,
  },
  {
    title: '5. Marketplace & Expert Services',
    body: `The Architect Marketplace connects students with verified freelance experts. Architect acts as an intermediary facilitating the connection and payment; it is not a party to the agreement between users.\n\n• Expert listings must be accurate and not misleading.\n• Clients must release payment only upon satisfactory job completion.\n• Disputes must be raised within 48 hours of job completion.\n• We reserve the right to suspend experts found to be engaging in fraudulent or unprofessional conduct.`,
  },
  {
    title: '6. Prohibited Conduct',
    body: `You agree not to:\n\n• Use the App for any illegal or unauthorized purpose.\n• Attempt to hack, reverse-engineer, or disrupt the App or its servers.\n• Use the App to harass, abuse, or harm other users.\n• Post false reviews or ratings.\n• Attempt to manipulate your Financial Score through fraudulent means.\n• Create multiple accounts to circumvent suspensions.`,
  },
  {
    title: '7. Intellectual Property',
    body: `All content within the App, including but not limited to design, text, graphics, logos, and software, is the property of Architect and protected by applicable intellectual property laws.\n\nYou are granted a limited, non-exclusive, non-transferable licence to use the App for its intended purpose. You may not copy, modify, distribute, or create derivative works without our prior written consent.`,
  },
  {
    title: '8. Privacy & Data',
    body: `Your use of the App is also governed by our Privacy Policy. By using the App, you consent to the collection and use of your data as described therein.\n\nWe implement industry-standard security measures. However, no system is completely secure. We are not liable for unauthorized third-party access to your data beyond our reasonable control.`,
  },
  {
    title: '9. Disclaimers & Limitation of Liability',
    body: `The App is provided on an "as is" and "as available" basis without warranties of any kind. To the fullest extent permitted by law:\n\n• We disclaim all implied warranties including fitness for a particular purpose.\n• We are not liable for any indirect, incidental, or consequential damages arising from your use of the App.\n• Our total liability to you shall not exceed the amount you paid (if any) in the 30 days preceding the claim.`,
  },
  {
    title: '10. Governing Law',
    body: `These Terms shall be governed by and interpreted in accordance with the laws of the Republic of South Africa. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the courts of South Africa.\n\nIf any provision of these Terms is found to be unenforceable, the remaining provisions shall continue in full force and effect.`,
  },
  {
    title: '11. Contact Us',
    body: `If you have any questions about these Terms, please contact us:\n\n📧 legal@architectapp.co\n🌐 www.architectapp.co/legal\n\nThese Terms were last updated on 1 April 2026.`,
  },
];

export default function TermsOfServiceScreen() {
  const router = useRouter();
  const { isDark, theme } = useTheme();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Terms of Service</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={[styles.heroSection, { backgroundColor: isDark ? '#1C1C1E' : '#000' }]}>
            <View style={[styles.heroIconBg, { backgroundColor: '#D9F15D' }]}>
              <Ionicons name="document-text" size={30} color="#000" />
            </View>
            <Text style={[styles.heroTitle, { color: '#FFF' }]}>Legal Terms</Text>
            <Text style={styles.heroSub}>Last updated: April 2026</Text>
            <Text style={[styles.heroDesc, { color: theme.subtext }]}>
              Please read these terms carefully before using the Architect app. They outline your rights, responsibilities, and how we operate.
            </Text>
          </View>

          {/* Terms Sections */}
          {TERMS_SECTIONS.map((section, index) => (
            <View key={index} style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{section.title}</Text>
              <Text style={[styles.text, { color: theme.label }]}>{section.body}</Text>
            </View>
          ))}

          {/* Footer note */}
          <View style={styles.footer}>
            <Ionicons name="shield-checkmark-outline" size={16} color={theme.subtext} />
            <Text style={[styles.footerText, { color: theme.subtext }]}>
              By using Architect, you agree to these terms.
            </Text>
          </View>

          <View style={{ height: 50 }} />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
    paddingHorizontal: 20, height: 60,
    borderBottomWidth: 1
  },
  backBtn: { padding: 5 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  content: { padding: 25 },
  
  heroSection: {
    padding: 30, alignItems: 'center', borderRadius: 24, marginBottom: 30,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5
  },
  heroIconBg: {
    width: 64, height: 64, borderRadius: 32, marginBottom: 15,
    justifyContent: 'center', alignItems: 'center'
  },
  heroTitle: { fontFamily: 'Inter_700Bold', fontSize: 24, marginBottom: 6 },
  heroSub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#8E8E93', marginBottom: 10 },
  heroDesc: {
    fontFamily: 'Inter_400Regular', fontSize: 14,
    textAlign: 'center', maxWidth: 300, lineHeight: 20,
  },

  section: { marginBottom: 30 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, marginBottom: 12 },
  text: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 24, paddingBottom: 10 },

  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 20,
  },
});
