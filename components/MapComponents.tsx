import React, { forwardRef, useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';

const PROVIDER_GOOGLE = 'google';

interface MapViewProps {
  style?: any;
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  customMapStyle?: any;
  provider?: string;
  children?: any;
  ref?: any;
  [key: string]: any;
}

const MapViewComponent = forwardRef((props: MapViewProps, ref: any) => {
  const containerRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || scriptLoadedRef.current) return;
    scriptLoadedRef.current = true;

    // Load Leaflet CSS
    if (!document.querySelector('link[href*="leaflet.min.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
      document.head.appendChild(link);
    }

    // Load Leaflet Script
    if (!document.querySelector('script[src*="leaflet.min.js"]')) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
      script.async = true;
      script.onload = () => {
        setTimeout(() => {
          const L = (window as any).L;
          if (!L || !containerRef.current) return;

          try {
            const map = L.map(containerRef.current).setView(
              [props.initialRegion?.latitude || 5.6, props.initialRegion?.longitude || -0.2],
              props.initialRegion?.latitude ? 12 : 2
            );

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '© OpenStreetMap contributors',
              maxZoom: 19,
            }).addTo(map);

            mapRef.current = map;
            if (ref) {
              ref.current = map;
            }
          } catch (err) {
            console.error('Map initialization error:', err);
          }
        }, 100);
      };
      document.body.appendChild(script);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        flex: 1,
        ...props.style,
      }}
    />
  );
});

MapViewComponent.displayName = 'MapView';

const Marker = ({ coordinate, title, children, ...props }: any) => {
  return null;
};

const Callout = ({ children, ...props }: any) => {
  return <>{children}</>;
};

const Polyline = ({ coordinates, strokeColor = '#FF0000', ...props }: any) => {
  return null;
};

const MapViewDirections = ({ 
  origin, 
  destination, 
  apikey, 
  strokeColor = '#FF0000',
  ...props 
}: any) => {
  return null;
};

export { Marker, Callout, PROVIDER_GOOGLE, Polyline, MapViewDirections };
export default MapViewComponent;
