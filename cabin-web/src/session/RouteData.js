export const ROUTES = [
  {
    id: 'LAX-LHR',
    origin: 'LAX', destination: 'LHR',
    originCity: 'Los Angeles', destinationCity: 'London',
    originName: 'Los Angeles International', destinationName: 'London Heathrow',
    distanceNm: 5456, flightTimeMin: 620,
    cruiseAltitudeFt: 37000, cruiseSpeedKts: 545,
    originTZ: -8, destinationTZ: 0
  },
  {
    id: 'JFK-NRT',
    origin: 'JFK', destination: 'NRT',
    originCity: 'New York', destinationCity: 'Tokyo',
    originName: 'John F. Kennedy International', destinationName: 'Tokyo Narita',
    distanceNm: 6740, flightTimeMin: 790,
    cruiseAltitudeFt: 39000, cruiseSpeedKts: 530,
    originTZ: -5, destinationTZ: 9
  },
  {
    id: 'SFO-SIN',
    origin: 'SFO', destination: 'SIN',
    originCity: 'San Francisco', destinationCity: 'Singapore',
    originName: 'San Francisco International', destinationName: 'Singapore Changi',
    distanceNm: 8446, flightTimeMin: 1020,
    cruiseAltitudeFt: 41000, cruiseSpeedKts: 555,
    originTZ: -8, destinationTZ: 8
  },
  {
    id: 'LAX-SYD',
    origin: 'LAX', destination: 'SYD',
    originCity: 'Los Angeles', destinationCity: 'Sydney',
    originName: 'Los Angeles International', destinationName: 'Sydney Kingsford Smith',
    distanceNm: 7480, flightTimeMin: 900,
    cruiseAltitudeFt: 39000, cruiseSpeedKts: 540,
    originTZ: -8, destinationTZ: 11
  },
  {
    id: 'ORD-DXB',
    origin: 'ORD', destination: 'DXB',
    originCity: 'Chicago', destinationCity: 'Dubai',
    originName: "Chicago O'Hare International", destinationName: 'Dubai International',
    distanceNm: 6288, flightTimeMin: 740,
    cruiseAltitudeFt: 38000, cruiseSpeedKts: 540,
    originTZ: -6, destinationTZ: 4
  },
  {
    id: 'MIA-GRU',
    origin: 'MIA', destination: 'GRU',
    originCity: 'Miami', destinationCity: 'São Paulo',
    originName: 'Miami International', destinationName: 'São Paulo Guarulhos',
    distanceNm: 3760, flightTimeMin: 450,
    cruiseAltitudeFt: 36000, cruiseSpeedKts: 520,
    originTZ: -5, destinationTZ: -3
  },
  {
    id: 'LHR-HKG',
    origin: 'LHR', destination: 'HKG',
    originCity: 'London', destinationCity: 'Hong Kong',
    originName: 'London Heathrow', destinationName: 'Hong Kong International',
    distanceNm: 5982, flightTimeMin: 700,
    cruiseAltitudeFt: 38000, cruiseSpeedKts: 550,
    originTZ: 0, destinationTZ: 8
  },
  {
    id: 'CDG-NRT',
    origin: 'CDG', destination: 'NRT',
    originCity: 'Paris', destinationCity: 'Tokyo',
    originName: 'Paris Charles de Gaulle', destinationName: 'Tokyo Narita',
    distanceNm: 5990, flightTimeMin: 720,
    cruiseAltitudeFt: 39000, cruiseSpeedKts: 540,
    originTZ: 1, destinationTZ: 9
  },
  {
    id: 'SYD-DXB',
    origin: 'SYD', destination: 'DXB',
    originCity: 'Sydney', destinationCity: 'Dubai',
    originName: 'Sydney Kingsford Smith', destinationName: 'Dubai International',
    distanceNm: 7480, flightTimeMin: 880,
    cruiseAltitudeFt: 40000, cruiseSpeedKts: 550,
    originTZ: 11, destinationTZ: 4
  },
  {
    id: 'JFK-CDG',
    origin: 'JFK', destination: 'CDG',
    originCity: 'New York', destinationCity: 'Paris',
    originName: 'John F. Kennedy International', destinationName: 'Paris Charles de Gaulle',
    distanceNm: 3625, flightTimeMin: 440,
    cruiseAltitudeFt: 36000, cruiseSpeedKts: 520,
    originTZ: -5, destinationTZ: 1
  },
  {
    id: 'SIN-LHR',
    origin: 'SIN', destination: 'LHR',
    originCity: 'Singapore', destinationCity: 'London',
    originName: 'Singapore Changi', destinationName: 'London Heathrow',
    distanceNm: 6757, flightTimeMin: 800,
    cruiseAltitudeFt: 41000, cruiseSpeedKts: 560,
    originTZ: 8, destinationTZ: 0
  },
  {
    id: 'DXB-BKK',
    origin: 'DXB', destination: 'BKK',
    originCity: 'Dubai', destinationCity: 'Bangkok',
    originName: 'Dubai International', destinationName: 'Bangkok Suvarnabhumi',
    distanceNm: 3019, flightTimeMin: 380,
    cruiseAltitudeFt: 36000, cruiseSpeedKts: 510,
    originTZ: 4, destinationTZ: 7
  },
  {
    id: 'LAX-TPE',
    origin: 'LAX', destination: 'TPE',
    originCity: 'Los Angeles', destinationCity: 'Taipei',
    originName: 'Los Angeles International', destinationName: 'Taipei Taoyuan',
    distanceNm: 6020, flightTimeMin: 720,
    cruiseAltitudeFt: 39000, cruiseSpeedKts: 540,
    originTZ: -8, destinationTZ: 8
  },
  {
    id: 'FRA-PEK',
    origin: 'FRA', destination: 'PEK',
    originCity: 'Frankfurt', destinationCity: 'Beijing',
    originName: 'Frankfurt am Main', destinationName: 'Beijing Capital',
    distanceNm: 4747, flightTimeMin: 580,
    cruiseAltitudeFt: 38000, cruiseSpeedKts: 530,
    originTZ: 1, destinationTZ: 8
  },
  {
    id: 'NYC-SCL',
    origin: 'JFK', destination: 'SCL',
    originCity: 'New York', destinationCity: 'Santiago',
    originName: 'John F. Kennedy International', destinationName: 'Santiago Arturo Merino',
    distanceNm: 5090, flightTimeMin: 620,
    cruiseAltitudeFt: 37000, cruiseSpeedKts: 530,
    originTZ: -5, destinationTZ: -3
  },
  {
    id: 'ORD-NRT',
    origin: 'ORD', destination: 'NRT',
    originCity: 'Chicago', destinationCity: 'Tokyo',
    originName: "Chicago O'Hare International", destinationName: 'Tokyo Narita',
    distanceNm: 6290, flightTimeMin: 740,
    cruiseAltitudeFt: 39000, cruiseSpeedKts: 545,
    originTZ: -6, destinationTZ: 9
  },
  {
    id: 'LHR-JNB',
    origin: 'LHR', destination: 'JNB',
    originCity: 'London', destinationCity: 'Johannesburg',
    originName: 'London Heathrow', destinationName: 'Johannesburg OR Tambo',
    distanceNm: 5619, flightTimeMin: 660,
    cruiseAltitudeFt: 37000, cruiseSpeedKts: 535,
    originTZ: 0, destinationTZ: 2
  },
  {
    id: 'AMS-EZE',
    origin: 'AMS', destination: 'EZE',
    originCity: 'Amsterdam', destinationCity: 'Buenos Aires',
    originName: 'Amsterdam Schiphol', destinationName: 'Buenos Aires Ezeiza',
    distanceNm: 7120, flightTimeMin: 840,
    cruiseAltitudeFt: 39000, cruiseSpeedKts: 545,
    originTZ: 1, destinationTZ: -3
  },
  {
    id: 'SFO-LHR',
    origin: 'SFO', destination: 'LHR',
    originCity: 'San Francisco', destinationCity: 'London',
    originName: 'San Francisco International', destinationName: 'London Heathrow',
    distanceNm: 5357, flightTimeMin: 630,
    cruiseAltitudeFt: 37000, cruiseSpeedKts: 540,
    originTZ: -8, destinationTZ: 0
  },
  {
    id: 'DXB-SYD',
    origin: 'DXB', destination: 'SYD',
    originCity: 'Dubai', destinationCity: 'Sydney',
    originName: 'Dubai International', destinationName: 'Sydney Kingsford Smith',
    distanceNm: 7480, flightTimeMin: 880,
    cruiseAltitudeFt: 41000, cruiseSpeedKts: 555,
    originTZ: 4, destinationTZ: 11
  }
];

export function getRouteById(id) {
  return ROUTES.find(r => r.id === id) || ROUTES[0];
}

export function formatFlightTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m.toString().padStart(2,'0')}m`;
}
