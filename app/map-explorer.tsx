import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  ActivityIndicator, Image, Dimensions, Platform, Alert, TextInput
} from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE, Polyline, MapViewDirections } from '../components/MapComponents';
import { Stack, useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { auth, db, registerListener, sessionState } from '../config/firebase';
import { collection, query, where, onSnapshot, limit, Timestamp } from 'firebase/firestore';
import { generateH3, getNeighboringH3, getDistanceKm } from '../hooks/useGeospatial';
import { useTheme } from '../context/ThemeContext';

const GOOGLE_MAPS_APIKEY = 'AIzaSyAC_-ibrPEYdhxPFl6Y_YWdNpDR2qfB-Ps';

const { width, height } = Dimensions.get('window');

const silverMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }] },
  { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#f5f5f5" }] },
  { "featureType": "administrative.land_parcel", "elementType": "labels.text.fill", "stylers": [{ "color": "#bdbdbd" }] },
  { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#e5e5e5" }] },
  { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
  { "featureType": "road.arterial", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#dadada" }] },
  { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
  { "featureType": "road.local", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
  { "featureType": "transit.line", "elementType": "geometry", "stylers": [{ "color": "#e5e5e5" }] },
  { "featureType": "transit.station", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#c9c9c9" }] },
  { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] }
];

const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#212121" }] },
  { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#212121" }] },
  { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#757575" }] },
  { "featureType": "administrative.country", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
  { "featureType": "administrative.land_parcel", "stylers": [{ "visibility": "off" }] },
  { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#bdbdbd" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#181818" }] },
  { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
  { "featureType": "poi.park", "elementType": "labels.text.stroke", "stylers": [{ "color": "#1b1b1b" }] },
  { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#2c2c2c" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#8a8a8a" }] },
  { "featureType": "road.arterial", "elementType": "geometry", "stylers": [{ "color": "#373737" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#3c3c3c" }] },
  { "featureType": "road.highway.controlled_access", "elementType": "geometry", "stylers": [{ "color": "#4e4e4e" }] },
  { "featureType": "road.local", "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
  { "featureType": "transit", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] },
  { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#3d3d3d" }] }
];

interface Expert {
  id: string;
  name: string;
  trade: string;
  rating?: number;
  location?: string;
  coords?: {
    latitude: number;
    longitude: number;
  };
}

export default function MapExplorerScreen() {
  const router = useRouter();
  const { isDark, theme } = useTheme();
  const mapRef = useRef<MapView>(null);
  
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [experts, setExperts] = useState<Expert[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExpert, setSelectedExpert] = useState<Expert | null>(null);
  const [showRoute, setShowRoute] = useState(false);
  const [eta, setEta] = useState<string | null>(null);
  const [distance, setDistance] = useState<string | null>(null);
  const [routingFailed, setRoutingFailed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Use Web Geolocation API
        if (!navigator.geolocation) {
          Alert.alert('Geolocation', 'Geolocation is not supported by your browser.');
          setLoading(false);
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            const currentLocation = {
              coords: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                altitude: position.coords.altitude,
                altitudeAccuracy: position.coords.altitudeAccuracy,
                heading: position.coords.heading,
                speed: position.coords.speed,
              },
              timestamp: position.timestamp,
            };
            setLocation(currentLocation as any);
            const userH3 = generateH3(currentLocation.coords.latitude, currentLocation.coords.longitude);
            const nearbyH3Cells = getNeighboringH3(userH3);

            setLoading(false);

            // Query Experts who are ONLINE and in NEARBY H3 CELLS
            // For production, we'd query by the currentH3 field.
            // For this demo, we'll listen to all online experts and filter locally for H3 proximity.
            const q = query(
              collection(db, 'users'), 
              where('isExpert', '==', true)
            );

            const unsub = registerListener(onSnapshot(q, (snap) => {
              const list = snap.docs.map(doc => {
                const data = doc.data();
                return {
                  id: doc.id,
                  name: data.name,
                  trade: data.trade,
                  rating: data.rating || 4.5,
                  coords: data.currentCoords || data.coords || generateMockAccraCoords(),
                  currentH3: data.currentH3
                };
              });
              setExperts(list);
            }, (err) => {
              if (err.code === 'permission-denied' || sessionState.isEnding) return;
              console.error("Map Snapshot Error:", err);
            }));

            return () => unsub();
          },
          (error) => {
            Alert.alert('Location Error', 'Unable to get your location. ' + error.message);
            setLoading(false);
          }
        );
      } catch (error) {
        console.error('Geolocation error:', error);
        setLoading(false);
      }
    })();
  }, [auth.currentUser]);

  const filteredExperts = useMemo(() => {
    return experts.filter(expert => 
      expert.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expert.trade.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [experts, searchQuery]);

  // For demo: Generate markers specifically in Greater Accra
  const generateMockAccraCoords = () => {
    return {
      latitude: 5.6037 + (Math.random() - 0.5) * 0.1,
      longitude: -0.1870 + (Math.random() - 0.5) * 0.1,
    };
  };

  const centerOnUser = () => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    } else {
      mapRef.current?.animateToRegion({
        latitude: 5.6037,
        longitude: -0.1870,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    }
  };

  /**
   * YANGO-STYLE LOGIC: Find the nearest worker based on current search
   * and zoom directly into them.
   */
  const findAndZoomToNearest = (queryText: string) => {
    if (!queryText || queryText.length < 2) return;
    
    if (!location) {
      Alert.alert("Location needed", "We need your GPS to find the nearest expert.");
      return;
    }

    if (experts.length === 0) {
      console.log("No experts loaded yet.");
      return;
    }

    // 1. Filter experts locally matching the query
    const matches = experts.filter(e => 
      (e.name || '').toLowerCase().includes(queryText.toLowerCase()) ||
      (e.trade || '').toLowerCase().includes(queryText.toLowerCase())
    );

    if (matches.length === 0) {
      Alert.alert("Not Found", `No experts found matching "${queryText}" in your area.`);
      return;
    }

    // 2. Find the closest one
    let nearest = matches[0];
    let minDistance = getDistanceKm(
      location.coords.latitude, location.coords.longitude,
      nearest.coords!.latitude, nearest.coords!.longitude
    );

    matches.forEach(m => {
      if (!m.coords) return;
      const d = getDistanceKm(
        location.coords.latitude, location.coords.longitude,
        m.coords.latitude, m.coords.longitude
      );
      if (d < minDistance) {
        minDistance = d;
        nearest = m;
      }
    });

    // 3. Zoom into them and show card
    console.log("Zooming to nearest:", nearest.name, "at distance:", minDistance);
    setSelectedExpert(nearest);
    mapRef.current?.animateToRegion({
      latitude: nearest.coords!.latitude,
      longitude: nearest.coords!.longitude,
      latitudeDelta: 0.005, 
      longitudeDelta: 0.005,
    }, 1000);
  };

  const handleBook = () => {
    if (selectedExpert && location) {
      setShowRoute(true);
      // Fit to both coordinates
      const coords = [
        { latitude: location.coords.latitude, longitude: location.coords.longitude },
        { latitude: selectedExpert.coords!.latitude, longitude: selectedExpert.coords!.longitude }
      ];
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 100, right: 50, bottom: 350, left: 50 },
        animated: true,
      });
    }
  };

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    return getDistanceKm(lat1, lon1, lat2, lon2).toFixed(1);
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.text} />
        <Text style={[styles.loadingText, { color: theme.subtext }]}>Locating experts in Accra...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <MapView
        ref={mapRef}
        style={styles.map}
        customMapStyle={isDark ? darkMapStyle : silverMapStyle}
        initialRegion={{
          latitude: 5.6037, 
          longitude: -0.1870,
          latitudeDelta: 0.15,
          longitudeDelta: 0.15,
        }}
        showsUserLocation={false} 
        showsMyLocationButton={false}
      >
        {location && (
          <Marker
            coordinate={{ latitude: location.coords.latitude, longitude: location.coords.longitude }}
          >
            <View style={styles.customMarkerWrapper}>
              <View style={[styles.markerTooltip, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: isDark ? 1 : 0 }]}>
                <Text style={[styles.markerTooltipSmall, { color: theme.subtext }]}>Searching near</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                   <Text style={[styles.markerTooltipLarge, { color: theme.text }]}>Your Location</Text>
                   <Ionicons name="chevron-forward" size={12} color={theme.text} />
                </View>
              </View>
              <View style={styles.tooltipConnector} />
              <View style={styles.markerDotOuter}>
                <View style={styles.markerDotInner} />
              </View>
            </View>
          </Marker>
        )}

        {filteredExperts.map((expert) => (
          <Marker
            key={expert.id}
            coordinate={expert.coords!}
            onPress={() => {
              setSelectedExpert(expert);
              setShowRoute(false);
              setRoutingFailed(false);
            }}
          >
            <View style={styles.markerContainer}>
              <View style={[styles.markerBubble, { backgroundColor: isDark ? '#D9F15D' : '#000', borderColor: isDark ? '#000' : '#FFF' }]}>
                <Ionicons name={getTradeIcon(expert.trade)} size={16} color={isDark ? '#000' : '#FFF'} />
              </View>
              <View style={[styles.markerArrow, { borderTopColor: isDark ? '#D9F15D' : '#000' }]} />
            </View>
          </Marker>
        ))}

        {showRoute && selectedExpert && location && (
          <MapViewDirections
            origin={{ latitude: location.coords.latitude, longitude: location.coords.longitude }}
            destination={{ latitude: selectedExpert.coords!.latitude, longitude: selectedExpert.coords!.longitude }}
            apikey={GOOGLE_MAPS_APIKEY}
            strokeWidth={4}
            strokeColor={isDark ? '#D9F15D' : '#000'}
            optimizeWaypoints={true}
            mode="DRIVING"
            onReady={result => {
              setEta(Math.ceil(result.duration).toString());
              setDistance(result.distance.toFixed(1));
              mapRef.current?.fitToCoordinates(result.coordinates, {
                edgePadding: { top: 100, right: 50, bottom: 400, left: 50 },
                animated: true,
              });
            }}
            onError={(errorMessage) => {
              console.error('MapViewDirections Error:', errorMessage);
              Alert.alert('Routing Error', `Google Maps says: ${errorMessage}.`);
              setShowRoute(false);
              setRoutingFailed(true);
            }}
          />
        )}

        {showRoute && routingFailed && selectedExpert && location && (
          <Polyline
            coordinates={[
              { latitude: location.coords.latitude, longitude: location.coords.longitude },
              { latitude: selectedExpert.coords!.latitude, longitude: selectedExpert.coords!.longitude }
            ]}
            strokeColor={isDark ? '#D9F15D' : '#000'}
            strokeWidth={3}
            lineDashPattern={[10, 10]}
          />
        )}
      </MapView>

      {/* Floating Hamburger Menu */}
      <TouchableOpacity style={[styles.hamburgerBtn, { backgroundColor: theme.card }]} onPress={() => router.back()}>
        <Ionicons name="menu" size={28} color={theme.text} />
      </TouchableOpacity>

      {/* Floating Locate Button */}
      <TouchableOpacity style={[styles.myLocBtnAnchored, { backgroundColor: theme.card }]} onPress={centerOnUser}>
        <Feather name="navigation" size={22} color={theme.text} style={{ transform: [{ rotate: '45deg' }] }} />
      </TouchableOpacity>

      {/* Persistent Ride Bottom Sheet */}
      <View style={[styles.bottomSheetContainer, { backgroundColor: theme.card }]}>
        <View style={[styles.dragPill, { backgroundColor: theme.divider }]} />
        
        {(!selectedExpert && !showRoute) ? (
          <>
            <View style={[styles.searchPrompt, { backgroundColor: theme.cardAlt }]}>
              <Ionicons name="search" size={20} color={theme.text} />
              <TextInput
                style={[styles.searchInputField, { color: theme.text }]}
                placeholder="Search Trade (e.g. Plumber)"
                placeholderTextColor={theme.placeholder}
                value={searchQuery}
                returnKeyType="search"
                autoCorrect={false}
                onSubmitEditing={() => findAndZoomToNearest(searchQuery)}
                onChangeText={(text) => {
                  setSearchQuery(text);
                }}
              />
            </View>

            <View style={styles.locationRowBlock}>
              <Ionicons name="location-outline" size={20} color={theme.subtext} />
              <Text style={[styles.locationRowText, { color: theme.text }]}>Current Location</Text>
            </View>

            <View style={styles.rideGrid}>
               <TouchableOpacity style={[styles.bigLeftCard, { backgroundColor: theme.cardAlt }]} onPress={() => findAndZoomToNearest('general')}>
                  <View>
                    <Text style={[styles.cardTitleBig, { color: theme.text }]}>Home Services</Text>
                    <Text style={[styles.cardSubtitleBig, { color: theme.subtext }]}>Hire trusted pros safely</Text>
                  </View>
                  <View style={styles.bigLeftGraphicBlock}>
                    <Ionicons name="construct" size={54} color={isDark ? '#000' : '#FFF'} style={{ opacity: 0.9, marginTop: 25, transform: [{ rotate: '-15deg' }] }} />
                  </View>
               </TouchableOpacity>

               <View style={styles.rightColumn}>
                  <TouchableOpacity style={[styles.couriersCard, { backgroundColor: theme.cardAlt }]} onPress={() => findAndZoomToNearest('designer')}>
                    <Text style={[styles.cardTitleSm, { color: theme.text }]}>Designers</Text>
                    <View style={styles.couriersGraphicBlock}>
                      <Ionicons name="color-palette" size={34} color={isDark ? '#000' : '#FFF'} style={{ opacity: 0.9, marginTop: 5 }} />
                    </View>
                  </TouchableOpacity>
                  
                  <View style={styles.bottomRightCardsRow}>
                     <TouchableOpacity style={[styles.smallSquareCard, { backgroundColor: theme.cardAlt }]} onPress={() => findAndZoomToNearest('electrician')}>
                        <Text style={[styles.cardTitleXs, { color: theme.text }]}>Electricians</Text>
                        <Ionicons name="flash" size={24} color={isDark ? '#000' : '#FFF'} style={{ position: 'absolute', bottom: 5, right: 8, opacity: 0.9 }} />
                     </TouchableOpacity>
                     <TouchableOpacity style={[styles.smallSquareCard, { backgroundColor: theme.cardAlt }]} onPress={() => findAndZoomToNearest('plumber')}>
                        <Text style={[styles.cardTitleXs, { color: theme.text }]}>Plumbers</Text>
                        <Ionicons name="water" size={24} color={isDark ? '#000' : '#FFF'} style={{ position: 'absolute', bottom: 5, right: 8, opacity: 0.9 }} />
                     </TouchableOpacity>
                  </View>
               </View>
            </View>
          </>
        ) : selectedExpert && !showRoute ? (
          <View style={styles.bottomSheetExpertCard}>
             <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 20, color: theme.text }}>{selectedExpert.name}</Text>
                <TouchableOpacity onPress={() => setSelectedExpert(null)}>
                  <Ionicons name="close-circle" size={26} color={theme.divider} />
                </TouchableOpacity>
             </View>
             
             <View style={styles.expertRow}>
               <View style={[styles.expertImgPlaceholder, { backgroundColor: theme.cardAlt }]}>
                 <Ionicons name="person-circle" size={40} color={theme.divider} />
               </View>
               <View style={styles.expertInfo}>
                 <Text style={[styles.expertTrade, { color: theme.subtext }]}>{selectedExpert.trade}</Text>
                 <View style={styles.ratingRow}>
                   <Ionicons name="star" size={14} color="#FFD700" />
                   <Text style={[styles.ratingText, { color: theme.text }]}>{selectedExpert.rating}</Text>
                   {location && (
                     <Text style={[styles.distanceText, { color: theme.subtext }]}> • {getDistance(location.coords.latitude, location.coords.longitude, selectedExpert.coords!.latitude, selectedExpert.coords!.longitude)} km away</Text>
                   )}
                 </View>
               </View>
             </View>

              <TouchableOpacity style={[styles.viewProfileBtn, { backgroundColor: isDark ? '#D9F15D' : '#000' }]} onPress={handleBook}>
                <Text style={[styles.viewProfileText, { color: isDark ? '#000' : '#FFF' }]}>Book Now & See Route</Text>
              </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.bottomSheetRouteCard}>
             <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 20, color: theme.text }}>Heading to {selectedExpert?.name}</Text>
             </View>
             {eta && (
                <View style={[styles.etaBadge, { backgroundColor: theme.cardAlt }]}>
                    <Text style={[styles.etaText, { color: theme.subtext }]}>⚡ {eta} min • {distance} km away</Text>
                </View>
             )}
              <TouchableOpacity style={[styles.finishBtn, { backgroundColor: isDark ? '#D9F15D' : '#000' }]} onPress={() => { setShowRoute(false); setSelectedExpert(null); }}>
                <Text style={[styles.viewProfileText, { color: isDark ? '#000' : '#FFF' }]}>Arrived / Finish Job</Text>
              </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

function getTradeIcon(trade: string): any {
  const t = trade.toLowerCase();
  if (t.includes('plumber')) return 'water';
  if (t.includes('electrician') || t.includes('ac')) return 'flash';
  if (t.includes('painter')) return 'brush';
  if (t.includes('graphic') || t.includes('photo')) return 'image';
  if (t.includes('mechanic')) return 'settings';
  if (t.includes('tutor')) return 'book';
  return 'construct';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  map: { width: width, height: height },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
  loadingText: { marginTop: 10, fontFamily: 'Inter_400Regular', color: '#666' },
  
  // Custom Marker
  customMarkerWrapper: { alignItems: 'center', justifyContent: 'center', width: 120, height: 100 },
  markerTooltip: { backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, elevation: 5 },
  markerTooltipSmall: { fontFamily: 'Inter_400Regular', fontSize: 10, color: '#666' },
  markerTooltipLarge: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#000' },
  tooltipConnector: { width: 1.5, height: 15, backgroundColor: '#4A90E2', marginBottom: 2 },
  markerDotOuter: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(74, 144, 226, 0.4)', justifyContent: 'center', alignItems: 'center' },
  markerDotInner: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#4A90E2', borderWidth: 2, borderColor: '#FFF' },

  // Floating Elements
  hamburgerBtn: { 
    position: 'absolute', 
    top: Platform.OS === 'ios' ? 60 : 40, 
    left: 20, 
    backgroundColor: '#FFF', 
    width: 50, 
    height: 50, 
    borderRadius: 25, 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 5
  },
  myLocBtnAnchored: {
    position: 'absolute', 
    bottom: 350, // Floating exactly above the bottom sheet height
    right: 20, 
    backgroundColor: '#FFF', 
    width: 50, 
    height: 50, 
    borderRadius: 25, 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 5
  },

  // Bottom Sheet
  bottomSheetContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#FFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, elevation: 15
  },
  dragPill: { width: 40, height: 4, backgroundColor: '#E0E0E0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  
  searchPrompt: {
    backgroundColor: '#F7F7F7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 18,
    borderRadius: 16,
    gap: 12,
    marginBottom: 15
  },
  searchPromptText: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#000' },
  
  locationRowBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 5,
    marginBottom: 25
  },
  locationRowText: { fontFamily: 'Inter_400Regular', fontSize: 15, color: '#000' },

  // Grid
  rideGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12
  },
  bigLeftCard: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    padding: 16,
    height: 190,
    justifyContent: 'space-between',
    overflow: 'hidden'
  },
  cardTitleBig: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#000' },
  cardSubtitleBig: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#444', marginTop: 4 },
  bigLeftGraphicBlock: {
    position: 'absolute',
    bottom: -10,
    right: -20,
    width: 140,
    height: 100,
    backgroundColor: '#D9F15D',
    borderRadius: 20,
    transform: [{ rotate: '-10deg' }],
    justifyContent: 'center',
    alignItems: 'center'
  },

  rightColumn: {
    flex: 1,
    gap: 12,
    height: 190
  },
  couriersCard: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    padding: 12,
    justifyContent: 'space-between',
    overflow: 'hidden'
  },
  cardTitleSm: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#000' },
  couriersGraphicBlock: {
    position: 'absolute',
    bottom: -5,
    right: -10,
    width: 80,
    height: 60,
    backgroundColor: '#D9F15D',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center'
  },

  bottomRightCardsRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 12
  },
  smallSquareCard: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    padding: 12,
    overflow: 'hidden'
  },
  cardTitleXs: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#000' },

  // HUD Dynamic Components
  searchInputField: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 16, color: '#000' },
  bottomSheetExpertCard: { width: '100%', paddingBottom: 10 },
  bottomSheetRouteCard: { width: '100%', paddingBottom: 10 },
  expertRow: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 20 },
  expertImgPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },
  expertInfo: { flex: 1 },
  expertTrade: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#666' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ratingText: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#000' },
  distanceText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#A0A0A0' },
  
  viewProfileBtn: { 
    backgroundColor: '#000', 
    borderRadius: 50, 
    paddingVertical: 15, 
    alignItems: 'center', 
  },
  finishBtn: { 
    backgroundColor: '#000', 
    borderRadius: 50, 
    paddingVertical: 15, 
    alignItems: 'center', 
    marginTop: 20 
  },
  viewProfileText: { color: '#FFF', fontFamily: 'Inter_700Bold', fontSize: 15 },
  
  etaBadge: { backgroundColor: '#F0F0F0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 5, marginTop: 5 },
  etaText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#666' },
  
  // Custom Map Markers for experts
  markerContainer: { alignItems: 'center', justifyContent: 'center' },
  markerBubble: { 
    backgroundColor: '#000', 
    width: 28, 
    height: 28, 
    borderRadius: 14, 
    alignItems: 'center', 
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF'
  },
  markerArrow: { 
    width: 0, 
    height: 0, 
    backgroundColor: 'transparent', 
    borderStyle: 'solid', 
    borderLeftWidth: 5, 
    borderRightWidth: 5, 
    borderTopWidth: 8, 
    borderLeftColor: 'transparent', 
    borderRightColor: 'transparent', 
    borderTopColor: '#000',
    transform: [{ translateY: -1 }]
  },
});
