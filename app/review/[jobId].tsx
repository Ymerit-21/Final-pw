import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, SafeAreaView, Animated
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  doc, getDoc, collection, serverTimestamp, runTransaction
} from 'firebase/firestore';
import { db, auth } from '../../config/firebase';

const LABELS = ['Terrible', 'Poor', 'Okay', 'Good', 'Excellent!'];
const QUICK_TAGS = ['Professional', 'On Time', 'Great Quality', 'Would Hire Again', 'Friendly', 'Clean Work'];

export default function ReviewScreen() {
  const { jobId } = useLocalSearchParams();
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Star animation values
  const starScales = useRef([1, 2, 3, 4, 5].map(() => new Animated.Value(1))).current;

  useEffect(() => {
    async function fetchJob() {
      if (!jobId) return;
      const snap = await getDoc(doc(db, 'jobs', jobId as string));
      if (snap.exists()) setJob({ id: snap.id, ...snap.data() });
      setLoading(false);
    }
    fetchJob();
  }, [jobId]);

  const handleStarPress = (s: number) => {
    setRating(s);
    // Bounce animation on selected star and all previous ones
    [1, 2, 3, 4, 5].forEach((star, i) => {
      if (star <= s) {
        Animated.sequence([
          Animated.timing(starScales[i], { toValue: 1.4, duration: 80, useNativeDriver: true }),
          Animated.spring(starScales[i], { toValue: 1, useNativeDriver: true }),
        ]).start();
      } else {
        Animated.spring(starScales[i], { toValue: 1, useNativeDriver: true }).start();
      }
    });
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const submitReview = async () => {
    if (!job || !auth.currentUser) return;
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a star rating before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const expertId = job.expertId;
      const finalComment = [
        selectedTags.length > 0 ? selectedTags.join(' · ') : '',
        comment
      ].filter(Boolean).join('\n\n');

      await runTransaction(db, async (transaction) => {
        const expertRef = doc(db, 'users', expertId);
        const expertSnap = await transaction.get(expertRef);
        if (!expertSnap.exists()) throw 'Expert does not exist';

        const data = expertSnap.data();
        const currentTotal = data.reviews || 0;
        const currentAvg = data.rating || 5.0;
        const newTotal = currentTotal + 1;
        const newAvg = ((currentAvg * currentTotal) + rating) / newTotal;

        // 1. Update expert avg rating
        transaction.update(expertRef, {
          rating: Number(newAvg.toFixed(1)),
          reviews: newTotal,
        });

        // 2. Mark job as reviewed
        transaction.update(doc(db, 'jobs', job.id), { isReviewed: true });

        // 3. Save review doc
        const newReviewRef = doc(collection(db, 'reviews'));
        transaction.set(newReviewRef, {
          jobId: job.id,
          studentId: auth.currentUser!.uid,
          studentName: auth.currentUser!.displayName || 'Student',
          expertId,
          expertName: job.expertName,
          rating,
          tags: selectedTags,
          comment,
          createdAt: serverTimestamp(),
        });

        // 4. Notify expert about the review
        const notifRef = doc(collection(db, 'users', expertId, 'notifications'));
        transaction.set(notifRef, {
          title: `⭐ New ${rating}-Star Review`,
          message: `${auth.currentUser!.displayName || 'A client'} left you a review for ${job.trade}. Keep up the great work!`,
          type: 'review',
          read: false,
          createdAt: serverTimestamp(),
        });
      });

      Alert.alert('Review Submitted!', 'Thank you for your feedback. It helps the community.', [
        { text: 'Done', onPress: () => router.replace('/jobs') }
      ]);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.bg }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.closeBtn, { backgroundColor: theme.cardAlt }]}>
          <Ionicons name="close" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Rate Your Experience</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Expert Info Card */}
        <View style={[styles.expertCard, { backgroundColor: theme.card }]}>
          <View style={[styles.expertAvatar, { backgroundColor: '#D9F15D' }]}>
            <Text style={[styles.expertAvatarText, { color: '#000' }]}>
              {job?.expertName?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>
          <View style={{ marginTop: 12, alignItems: 'center' }}>
            <Text style={[styles.expertName, { color: theme.text }]}>{job?.expertName || 'Expert'}</Text>
            <Text style={[styles.tradeBadge, { color: theme.subtext }]}>{job?.trade || 'Service'}</Text>
          </View>
          <View style={[styles.completedPill, { backgroundColor: isDark ? '#1A3A1A' : '#E5F8E5' }]}>
            <Ionicons name="checkmark-circle" size={14} color="#34C759" />
            <Text style={[styles.completedText, { color: '#34C759' }]}>Job Completed</Text>
          </View>
        </View>

        {/* Star Rating */}
        <View style={[styles.ratingCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionLabel, { color: theme.subtext }]}>HOW WAS THE SERVICE?</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((s, i) => (
              <TouchableOpacity key={s} onPress={() => handleStarPress(s)} activeOpacity={0.7}>
                <Animated.View style={{ transform: [{ scale: starScales[i] }] }}>
                  <Ionicons
                    name={s <= rating ? 'star' : 'star-outline'}
                    size={46}
                    color={s <= rating ? '#FFD700' : (isDark ? '#3A3A3C' : '#D1D1D6')}
                  />
                </Animated.View>
              </TouchableOpacity>
            ))}
          </View>
          {rating > 0 && (
            <Text style={[styles.ratingLabel, { color: theme.text }]}>{LABELS[rating - 1]}</Text>
          )}
        </View>

        {/* Quick Tags */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.subtext }]}>QUICK TAGS (OPTIONAL)</Text>
          <View style={styles.tagsRow}>
            {QUICK_TAGS.map(tag => (
              <TouchableOpacity
                key={tag}
                style={[
                  styles.tag, 
                  { backgroundColor: theme.card, borderColor: theme.border },
                  selectedTags.includes(tag) && [styles.tagActive, { backgroundColor: isDark ? '#D9F15D' : '#000', borderColor: isDark ? '#D9F15D' : '#000' }]
                ]}
                onPress={() => toggleTag(tag)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.tagText, 
                  { color: theme.subtext },
                  selectedTags.includes(tag) && [styles.tagTextActive, { color: isDark ? '#000' : '#FFF' }]
                ]}>
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Written Feedback */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.subtext }]}>WRITTEN FEEDBACK (OPTIONAL)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
            placeholder="Describe your experience in more detail..."
            placeholderTextColor={theme.placeholder}
            multiline
            numberOfLines={4}
            value={comment}
            onChangeText={setComment}
            maxLength={500}
          />
          <Text style={[styles.charCount, { color: theme.subtext }]}>{comment.length}/500</Text>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[
            styles.submitBtn, 
            { backgroundColor: isDark ? '#D9F15D' : '#000' },
            (submitting || rating === 0) && { opacity: 0.5 }
          ]}
          onPress={submitReview}
          disabled={submitting || rating === 0}
          activeOpacity={0.8}
        >
          {submitting
            ? <ActivityIndicator color={isDark ? '#000' : '#FFF'} />
            : <>
                <Ionicons name="star" size={18} color={isDark ? '#000' : '#FFF'} />
                <Text style={[styles.submitText, { color: isDark ? '#000' : '#FFF' }]}>Submit Review</Text>
              </>
          }
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Your review is public and helps other students hire confidently.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: '#F2F2F7',
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#E5E5EA', justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 17 },

  content: { paddingHorizontal: 20, paddingTop: 10 },

  // Expert card
  expertCard: {
    backgroundColor: '#FFF', borderRadius: 24, padding: 24,
    alignItems: 'center', marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  expertAvatar: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: '#D9F15D', justifyContent: 'center', alignItems: 'center',
  },
  expertAvatarText: { fontFamily: 'Inter_700Bold', fontSize: 30, color: '#000' },
  expertName: { fontFamily: 'Inter_700Bold', fontSize: 20, textAlign: 'center', marginBottom: 6 },
  tradeBadge: {
    fontFamily: 'Inter_400Regular', fontSize: 14, textAlign: 'center',
  },
  completedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#E5F8E5', paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20, marginTop: 14,
  },
  completedText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#34C759' },

  // Rating
  ratingCard: {
    backgroundColor: '#FFF', borderRadius: 24, padding: 24,
    alignItems: 'center', marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  starsRow: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 12 },
  ratingLabel: {
    fontFamily: 'Inter_700Bold', fontSize: 18, marginTop: 4,
  },

  // Tags / sections
  section: { marginBottom: 16 },
  sectionLabel: {
    fontFamily: 'Inter_700Bold', fontSize: 11, color: '#8E8E93',
    letterSpacing: 0.5, marginBottom: 12, marginLeft: 4,
  },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E5EA',
  },
  tagActive: { },
  tagText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  tagTextActive: { },

  // Input
  input: {
    borderRadius: 16, padding: 16,
    fontSize: 15, fontFamily: 'Inter_400Regular',
    textAlignVertical: 'top', minHeight: 110,
    borderWidth: 1,
  },
  charCount: {
    fontFamily: 'Inter_400Regular', fontSize: 11, color: '#C6C6C8',
    textAlign: 'right', marginTop: 6, marginRight: 4,
  },

  // Submit
  submitBtn: {
    backgroundColor: '#D9F15D', borderRadius: 50, paddingVertical: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 8, marginBottom: 16,
    shadowColor: '#D9F15D', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 10,
  },
  submitText: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  disclaimer: {
    fontFamily: 'Inter_400Regular', fontSize: 12, color: '#C6C6C8',
    textAlign: 'center', paddingHorizontal: 30,
  },
});
