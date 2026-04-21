import * as h3 from 'h3-js';

const DEFAULT_RES = 7;

export const generateH3 = (lat: number, lng: number, res: number = DEFAULT_RES) => {
  return h3.latLngToCell(lat, lng, res);
};

export const getNeighboringH3 = (h3Index: string) => {
  // Returns the cell and its immediate neighbors (k=1)
  // This provides a coverage area of ~10-20 square kilometers at res 7
  return h3.gridDisk(h3Index, 1);
};

export const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; 
  return d;
};

const deg2rad = (deg: number) => deg * (Math.PI/180);
