import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const MapView = ({ children, style, ...props }: any) => (
  <View style={[style, styles.placeholder]}>
    <Text style={styles.text}>Map View is not available on Web.</Text>
    <Text style={styles.subtext}>Showing mock layout for testing.</Text>
    {children}
  </View>
);

export const Marker = ({ children, ...props }: any) => (
  <View style={styles.markerMock}>{children}</View>
);

export const Callout = ({ children, ...props }: any) => <View>{children}</View>;
export const Polyline = () => <View />;
export const PROVIDER_GOOGLE = 'google';

export default MapView;

// Mock for directions
export const MapViewDirections = () => null;

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#E6E6E6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontFamily: 'System',
    fontSize: 16,
    color: '#666',
  },
  subtext: {
    fontFamily: 'System',
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  markerMock: {
    position: 'absolute',
  }
});
