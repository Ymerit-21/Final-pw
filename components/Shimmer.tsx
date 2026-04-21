import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';

interface ShimmerProps {
  width: any;
  height: any;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Shimmer = ({ width, height, borderRadius = 8, style }: ShimmerProps) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: '#E1E9EE',
          opacity,
        },
        style,
      ]}
    />
  );
};

export const GoalSkeleton = () => (
  <View style={skeletonStyles.goalCard}>
    <View style={skeletonStyles.goalRow}>
      <Shimmer width={40} height={40} borderRadius={20} />
      <View style={{ marginLeft: 12 }}>
        <Shimmer width={120} height={16} />
        <Shimmer width={80} height={12} style={{ marginTop: 6 }} />
      </View>
    </View>
    <Shimmer width="100%" height={8} borderRadius={4} style={{ marginTop: 15 }} />
  </View>
);

export const ExpertSkeleton = () => (
  <View style={skeletonStyles.expertCard}>
    <Shimmer width={50} height={50} borderRadius={12} style={{ marginRight: 12 }} />
    <View style={{ flex: 1 }}>
      <Shimmer width={100} height={15} />
      <Shimmer width={60} height={10} style={{ marginTop: 6 }} />
    </View>
  </View>
);

const skeletonStyles = StyleSheet.create({
  goalCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  goalRow: { flexDirection: 'row', alignItems: 'center' },
  expertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
  }
});
