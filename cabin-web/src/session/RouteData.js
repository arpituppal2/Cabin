export const AIRPORTS = {
  LAX: { lat: 33.94, lon: -118.41, city: 'Los Angeles',  name: 'Los Angeles Intl' },
  JFK: { lat: 40.64, lon: -73.78,  city: 'New York',     name: 'John F Kennedy Intl' },
  LHR: { lat: 51.48, lon: -0.45,   city: 'London',       name: 'Heathrow' },
  CDG: { lat: 49.01, lon: 2.55,    city: 'Paris',        name: 'Charles de Gaulle' },
  NRT: { lat: 35.76, lon: 140.39,  city: 'Tokyo',        name: 'Narita Intl' },
  SIN: { lat: 1.36,  lon: 103.99,  city: 'Singapore',    name: 'Changi' },
  DXB: { lat: 25.25, lon: 55.36,   city: 'Dubai',        name: 'Dubai Intl' },
  SYD: { lat: -33.95,lon: 151.18,  city: 'Sydney',       name: 'Kingsford Smith' },
  HKG: { lat: 22.31, lon: 113.91,  city: 'Hong Kong',    name: 'Hong Kong Intl' },
  ORD: { lat: 41.98, lon: -87.90,  city: 'Chicago',      name: "O'Hare Intl" },
  MIA: { lat: 25.79, lon: -80.29,  city: 'Miami',        name: 'Miami Intl' },
  GRU: { lat: -23.43,lon: -46.47,  city: 'São Paulo',    name: 'Guarulhos Intl' },
  FRA: { lat: 50.04, lon: 8.57,    city: 'Frankfurt',    name: 'Frankfurt Intl' },
  AMS: { lat: 52.31, lon: 4.77,    city: 'Amsterdam',    name: 'Schiphol' },
  ICN: { lat: 37.46, lon: 126.44,  city: 'Seoul',        name: 'Incheon Intl' },
  BOM: { lat: 19.09, lon: 72.87,   city: 'Mumbai',       name: 'Chhatrapati Shivaji' },
  MEX: { lat: 19.44, lon: -99.07,  city: 'Mexico City',  name: 'Benito Juárez Intl' },
  EZE: { lat: -34.82,lon: -58.54,  city: 'Buenos Aires', name: 'Ezeiza Intl' },
  CPT: { lat: -33.97,lon: 18.60,   city: 'Cape Town',    name: 'Cape Town Intl' },
  NBO: { lat: -1.32, lon: 36.93,   city: 'Nairobi',      name: 'Jomo Kenyatta Intl' },
  YYZ: { lat: 43.68, lon: -79.63,  city: 'Toronto',      name: 'Pearson Intl' },
  BKK: { lat: 13.68, lon: 100.75,  city: 'Bangkok',      name: 'Suvarnabhumi' },
  ZRH: { lat: 47.45, lon: 8.55,    city: 'Zurich',       name: 'Zurich Airport' },
  FCO: { lat: 41.80, lon: 12.24,   city: 'Rome',         name: 'Fiumicino' },
};

export function haversineNm(lat1, lon1, lat2, lon2) {
  const R = 3443.9;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function computeFlightTimeMin(nm) {
  return Math.round((nm / 490) * 60 * 1.06);
}

export const ROUTES = [];

export function buildRoute(originCode, destCode) {
  const A = AIRPORTS[originCode];
  const B = AIRPORTS[destCode];
  if (!A || !B) return null;
  const nm = haversineNm(A.lat, A.lon, B.lat, B.lon);
  const min = computeFlightTimeMin(nm);
  return {
    id: `${originCode}-${destCode}`,
    origin: originCode, destination: destCode,
    originCity: A.city, destinationCity: B.city,
    originName: A.name, destinationName: B.name,
    distanceNm: nm, flightTimeMin: min,
    cruiseAltitudeFt: 38000, cruiseSpeedKts: 490,
    originTZ: 0, destinationTZ: 0
  };
}

export function formatFlightTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}
