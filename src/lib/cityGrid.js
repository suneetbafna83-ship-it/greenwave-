// City grid definition shared by the 3D simulation, the AI triage engine and analytics.
// 7 × 7 intersections, 12 world units apart (≈ one 400 m city block).

export const GRID = 7;
export const SPACING = 12;
export const HALF = ((GRID - 1) * SPACING) / 2;
export const ROAD_W = 4.4;
export const LANE = 1.05;
export const BLOCK_KM = 0.4;

export const coord = (i) => i * SPACING - HALF;

// Avenues run north–south (constant x), streets run east–west (constant z).
export const AVENUES = [
  "Harbor Ave",
  "Tech Park Ave",
  "Metro Ave",
  "Central Ave",
  "Lotus Ave",
  "Hospital Ave",
  "Eastgate Ave",
];
export const STREETS = [
  "North Blvd",
  "MG Rd",
  "Park St",
  "Lake Rd",
  "Ring Rd",
  "Market St",
  "South Blvd",
];

// Directions: 0 = +x (east), 1 = −x (west), 2 = +z (south), 3 = −z (north)
export const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
export const OPPOSITE = [1, 0, 3, 2];
export const axisOfDir = (d) => (d < 2 ? 0 : 1); // 0 = east–west axis, 1 = north–south axis

export const nodeIndex = (ix, iz) => iz * GRID + ix;
export const inGrid = (ix, iz) => ix >= 0 && iz >= 0 && ix < GRID && iz < GRID;

export function dirBetween(a, b) {
  const dx = Math.sign(b[0] - a[0]);
  const dz = Math.sign(b[1] - a[1]);
  if (dx === 1) return 0;
  if (dx === -1) return 1;
  if (dz === 1) return 2;
  return 3;
}

export const intersectionName = (ix, iz) => `${STREETS[iz]} × ${AVENUES[ix]}`;

export const ALL_INTERSECTIONS = Array.from({ length: GRID * GRID }, (_, i) =>
  intersectionName(i % GRID, Math.floor(i / GRID))
);

// 3 × 3 sector map, numbered 1–9 from the north-west corner.
export function sectorOf(ix, iz) {
  const col = Math.min(2, Math.floor(ix / (GRID / 3)));
  const row = Math.min(2, Math.floor(iz / (GRID / 3)));
  return `Sector ${row * 3 + col + 1}`;
}

export const HOSPITAL = {
  name: "St. Aurora Medical Center",
  node: [5, 1],
  block: [5, 0], // north-east block whose south-west corner is the hospital intersection
};

export const DISPATCH_BASE = { node: [0, 4], sector: "Sector 4" };

export const DEFAULT_WAYPOINTS = [
  [0, 4],
  [3, 4],
  [3, 2],
  [5, 2],
  [5, 1],
];

// Expand a list of waypoints into unit steps between adjacent intersections (x first, then z).
export function expandWaypoints(waypoints) {
  const route = [];
  waypoints.forEach((wp, i) => {
    if (i === 0) {
      route.push([wp[0], wp[1]]);
      return;
    }
    let [cx, cz] = route[route.length - 1];
    while (cx !== wp[0]) {
      cx += Math.sign(wp[0] - cx);
      route.push([cx, cz]);
    }
    while (cz !== wp[1]) {
      cz += Math.sign(wp[1] - cz);
      route.push([cx, cz]);
    }
  });
  // drop consecutive duplicates
  return route.filter((p, i) => i === 0 || p[0] !== route[i - 1][0] || p[1] !== route[i - 1][1]);
}

export const DEFAULT_ROUTE = expandWaypoints(DEFAULT_WAYPOINTS);

export function routeBetween(start, end, jogX) {
  const jx = jogX ?? Math.round((start[0] + end[0]) / 2);
  return expandWaypoints([start, [jx, start[1]], [jx, end[1]], end]);
}

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Tolerant parser: accepts "Ring Rd × Metro Ave", "Metro Ave & Ring Rd", "ring rd x metro ave", …
export function parseIntersection(name) {
  if (typeof name !== "string") return null;
  const n = norm(name);
  const iz = STREETS.findIndex((s) => n.includes(norm(s)));
  const ix = AVENUES.findIndex((a) => n.includes(norm(a)));
  if (ix < 0 || iz < 0) return null;
  return [ix, iz];
}

// Turn AI-provided intersection names into a drivable, contiguous route.
export function routeFromNames(names) {
  const pts = (Array.isArray(names) ? names : []).map(parseIntersection).filter(Boolean);
  if (pts.length < 2) return DEFAULT_ROUTE;
  const route = expandWaypoints(pts);
  return route.length >= 2 ? route : DEFAULT_ROUTE;
}

export const routeNames = (route) => route.map(([ix, iz]) => intersectionName(ix, iz));

export const round1 = (v) => Math.round(v * 10) / 10;

// GreenWave transit model: standard GPS speed collapses with congestion,
// a pre-flushed corridor sustains ~31 km/h door to door.
export function etaMinutes(route, severityPct) {
  const distKm = Math.max(1, route.length - 1) * BLOCK_KM;
  const s = Math.min(1, Math.max(0, severityPct / 100));
  const gpsKmh = 32 - 23 * s;
  const standard = (distKm / gpsKmh) * 60;
  const greenwave = (distKm / 31) * 60;
  return {
    distKm: round1(distKm),
    standard: round1(standard),
    greenwave: round1(greenwave),
    saved: round1(standard - greenwave),
  };
}
