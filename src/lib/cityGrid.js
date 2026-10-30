// 500 × 500 Cross Coordinate City Grid (HALF = 250, footprint -250 to +250)
// 31 × 31 Intersections (961 junctions, 900 blocks) spanning 500 × 500 world units.
// Features:
// - Meandering zig-zag river cutting through the metropolis with realistic suspension bridges
// - Extreme Urban Cyber Citadel strictly isolated from informal slum settlements
// - Far peripheral outer slum badlands with heavy crater clusters
// - Scenic riverfront St. Aurora Medical Center campus and Grand Suspension Bridge corridors

import { createRoadLayout, pointInPolygon, roadClearanceIndex } from "./roadLayout";

export const GRID = 31;
export const ROAD_LAYOUT_VERSION = "mixed-streets-v2";
export const HALF = 250; // -250 to +250 cross coordinate boundary (500 total width & length)
export const SPACING = (HALF * 2) / (GRID - 1); // 500 / 30 = 16.6667 world units per block
export const ROAD_W = 4.8;
export const LANE = 1.15;
export const BLOCK_KM = 0.45;

export const coord = (i) => i * SPACING - HALF;

// 31 Named Avenues (North-South, constant x)
export const AVENUES = [
  "Harbor Blvd",
  "Seaside Way",
  "Pacific Ave",
  "Westgate Ave",
  "Bayview St",
  "Tech Park Ave",
  "Cyber Way",
  "Silicon Ave",
  "Innovation Rd",
  "Matrix Blvd",
  "Quantum Way",
  "Skyline Ave",
  "Metro Ave",
  "West Riverwalk",
  "Grand Central",
  "Bridgehead Way",
  "East Riverwalk",
  "Lotus Ave",
  "Brigade Rd",
  "Victoria Ave",
  "Old Colony Rd",
  "Heritage Way",
  "Hospital Ave",
  "Medical Way",
  "Apollo Rd",
  "Sunrise Ave",
  "Eastgate Ave",
  "Slum Bypass",
  "Canal Rd",
  "Frontier Rd",
  "Outer Perimeter Ave",
];

// 31 Named Streets (East-West, constant z)
export const STREETS = [
  "North Ring Rd",
  "Skyway 101",
  "Cyber Peak Rd",
  "Outer Loop",
  "North Pier Way",
  "Commercial St",
  "Park Rd",
  "Botanical Way",
  "Lakeview St",
  "North Bridge Crossing",
  "Central Ring Rd",
  "Residency Rd",
  "Market St",
  "Grand Suspension Way", // Premier Central River Bridge
  "Old Bazaar St",
  "Grand Trunk Rd",
  "Station Rd",
  "South Central Rd",
  "South Bridge Crossing",
  "Industrial Bypass",
  "Railway Cross",
  "Scrap Yard Rd",
  "Muddy Creek Way",
  "Broken Wheel St",
  "Pothole Alley",
  "Shanty Lane",
  "Dharavi Slum Rd",
  "South Ring Rd",
  "Highway 44",
  "Outer Perimeter Rd",
  "Southern Frontier Way",
];

// Directions: 0 = +x (east), 1 = −x (west), 2 = +z (south), 3 = −z (north)
export const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
export const OPPOSITE = [1, 0, 3, 2];
export const axisOfDir = (d) => (d < 2 ? 0 : 1);

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

// ───────────────────── Meandering Zig-Zag River & Bridge Geometry ─────────────────────
export const RIVER_WIDTH = 38; // 38 world units wide river
export const RIVER_SETBACK = 8; // Landscaped flood-protection strip between water and roads.
export const WATER_LEVEL = -1.8;
export const RIVERBED_LEVEL = -4.2;
export const BRIDGE_ROWS = [9, 13, 18];

// Meandering sinusoidal path cutting smoothly through the metropolis from North to South
export function riverCenter(z) {
  return Math.sin(z * 0.012) * 54 + Math.sin(z * 0.032 + 1.0) * 22 + z * 0.08;
}

// First derivative dx/dz for accurate perpendicular bank normals
export function riverTangent(z) {
  return 0.012 * 54 * Math.cos(z * 0.012) + 0.032 * 22 * Math.cos(z * 0.032 + 1.0) + 0.08;
}

// Return left and right bank X coordinates with uniform perpendicular channel width
export function riverBankX(z) {
  const c = riverCenter(z);
  const slope = riverTangent(z);
  // Normal expansion factor to keep perpendicular channel width constant across bends
  const factor = Math.min(1.4, Math.sqrt(1 + slope * slope));
  const halfW = (RIVER_WIDTH / 2) * factor;
  return { left: c - halfW, right: c + halfW, center: c };
}

// Check if a block index (bx, bz) intersects the flowing river channel
export function isRiverBlock(bx, bz) {
  const x1 = coord(bx) + ROAD_W / 2;
  const x2 = coord(bx + 1) - ROAD_W / 2;
  for (let s = 0; s <= 8; s++) {
    const { left, right } = riverBankX(coord(bz) + (s / 8) * SPACING);
    if (x1 < right + RIVER_SETBACK && x2 > left - RIVER_SETBACK) return true;
  }
  return false;
}

// Snap bridge approaches to dry grid junctions, allowing room for bank curvature
// across the full deck width rather than measuring only its centerline.
export function bridgeBounds(iz) {
  let left = Infinity;
  let right = -Infinity;
  for (const dz of [-ROAD_W, 0, ROAD_W]) {
    const banks = riverBankX(coord(iz) + dz);
    left = Math.min(left, banks.left - RIVER_SETBACK - ROAD_W / 2);
    right = Math.max(right, banks.right + RIVER_SETBACK + ROAD_W / 2);
  }
  return {
    left: coord(Math.floor((left + HALF) / SPACING)),
    right: coord(Math.ceil((right + HALF) / SPACING)),
  };
}

// Check if an East-West road segment crosses over the river (and is therefore an elevated Bridge)
export function isBridgeSegment(ix, iz, axis) {
  if (axis !== 0 || !BRIDGE_ROWS.includes(iz) || ix >= GRID - 1) return false;
  const x1 = coord(ix);
  const x2 = coord(ix + 1);
  const { left, right } = bridgeBounds(iz);
  return x1 < right && x2 > left;
}

const layout = createRoadLayout({ grid: GRID, half: HALF, spacing: SPACING, roadWidth: ROAD_W, bridgeRows: BRIDGE_ROWS, bridgeBounds });
export const nodePosition = layout.nodePosition;
export const segmentGeometry = layout.segmentGeometry;
export const directedRoadSample = layout.directedRoadSample;
export const roadLength = layout.roadLength;
export const routePolyline = layout.routePolyline;
export const ROAD_DISTRICTS = layout.districts;
export const isInsideRoadDistrict = (x, z) => ROAD_DISTRICTS.some((d) => pointInPolygon(x, z, d.polygon));

function dryRoadSegment(ix, iz, axis) {
  const margin = ROAD_W / 2 + RIVER_SETBACK;
  let west = true;
  let east = true;
  for (const { x, z } of segmentGeometry(ix, iz, axis).points) {
    const { left, right } = riverBankX(z);
    west &&= x < left - margin;
    east &&= x > right + margin;
  }
  return west || east;
}

export const ROAD_SEGMENTS = [];
const ROAD_KEYS = new Set();
for (let iz = 0; iz < GRID; iz++) {
  for (let ix = 0; ix < GRID; ix++) {
    for (const axis of [0, 1]) {
      if ((axis === 0 && ix === GRID - 1) || (axis === 1 && iz === GRID - 1)) continue;
      const bridge = isBridgeSegment(ix, iz, axis);
      if (!bridge && !layout.segmentAllowed(ix, iz, axis)) continue;
      if (!bridge && !dryRoadSegment(ix, iz, axis)) continue;
      const geometry = segmentGeometry(ix, iz, axis);
      const midpoint = directedRoadSample(ix, iz, axis === 0 ? 0 : 2, geometry.length / 2);
      ROAD_KEYS.add(`${ix},${iz},${axis}`);
      ROAD_SEGMENTS.push({ ix, iz, axis, bridge, ...geometry, x: midpoint.x, z: midpoint.z });
    }
  }
}
// Bank clipping can leave short isolated stubs. Keep the connected, returnable
// street network so every visible road can be reached from the medical campus.
const reachableRoadNodes = (reverse = false) => {
  const queue = [[23, 7]], visited = new Set(["23,7"]);
  for (let i = 0; i < queue.length; i++) {
    const [x, z] = queue[i];
    DIRS.forEach(([dx, dz], d) => {
      const nx = x + dx, nz = z + dz;
      const sx = reverse ? nx : x, sz = reverse ? nz : z;
      const direction = reverse ? OPPOSITE[d] : d;
      const key = `${sx - (direction === 1 ? 1 : 0)},${sz - (direction === 3 ? 1 : 0)},${axisOfDir(direction)}`;
      if (!ROAD_KEYS.has(key) || !layout.directionAllowed(sx, sz, direction) || visited.has(`${nx},${nz}`)) return;
      visited.add(`${nx},${nz}`); queue.push([nx, nz]);
    });
  }
  return visited;
};
const outboundNodes = reachableRoadNodes(), inboundNodes = reachableRoadNodes(true);
for (let i = ROAD_SEGMENTS.length - 1; i >= 0; i--) {
  const s = ROAD_SEGMENTS[i];
  const a = `${s.ix},${s.iz}`, b = `${s.ix + (s.axis === 0 ? 1 : 0)},${s.iz + (s.axis === 1 ? 1 : 0)}`;
  if (![a, b].every((key) => outboundNodes.has(key) && inboundNodes.has(key))) {
    ROAD_KEYS.delete(`${s.ix},${s.iz},${s.axis}`); ROAD_SEGMENTS.splice(i, 1);
  }
}
export const isNearRoad = roadClearanceIndex(ROAD_SEGMENTS, ROAD_W);

export const isRoadSegment = (ix, iz, axis) => ROAD_KEYS.has(`${ix},${iz},${axis}`);
export function canTravel(ix, iz, d) {
  return isRoadSegment(ix - (d === 1 ? 1 : 0), iz - (d === 3 ? 1 : 0), axisOfDir(d)) && layout.directionAllowed(ix, iz, d);
}
export function roadKey(ix, iz, d) {
  return `${ix - (d === 1 ? 1 : 0)},${iz - (d === 3 ? 1 : 0)},${axisOfDir(d)}`;
}
export const isRoadNode = (ix, iz) => DIRS.some((_, d) => canTravel(ix, iz, d));
export const ROAD_NODE_COUNT = Array.from({ length: GRID * GRID }, (_, i) =>
  isRoadNode(i % GRID, Math.floor(i / GRID))).filter(Boolean).length;
export function roadHeightAt(x, z) {
  const iz = Math.round((z + HALF) / SPACING);
  const dz = Math.abs(z - coord(iz));
  if (!BRIDGE_ROWS.includes(iz) || dz > ROAD_W / 2 + 6) return 0;
  const { left, right } = bridgeBounds(iz);
  if (x < left - 6 || x > right + 6) return 0;
  return 0.81 * Math.min(1, (x - left + 6) / 6, (right + 6 - x) / 6)
    * Math.min(1, (ROAD_W / 2 + 6 - dz) / 6);
}

export function nearestRoadNode(node) {
  if (isRoadNode(...node)) return node;
  let best;
  let distance = Infinity;
  for (let iz = 0; iz < GRID; iz++) for (let ix = 0; ix < GRID; ix++) {
    const dist = Math.abs(ix - node[0]) + Math.abs(iz - node[1]);
    if (dist < distance && isRoadNode(ix, iz)) { best = [ix, iz]; distance = dist; }
  }
  return best;
}

export function nearestRoadNodeFromWorld(x, z) {
  let best = null;
  let bestDistSq = Infinity;
  for (let iz = 0; iz < GRID; iz++) {
    for (let ix = 0; ix < GRID; ix++) {
      if (!isRoadNode(ix, iz)) continue;
      const pos = nodePosition(ix, iz);
      const dx = pos.x - x;
      const dz = pos.z - z;
      const distSq = dx * dx + dz * dz;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        best = [ix, iz];
      }
    }
  }
  return best || HOSPITAL.node;
}

// Unweighted road search also repairs imported waypoint routes around the river.
function roadPath(start, end) {
  start = nearestRoadNode(start);
  end = nearestRoadNode(end);
  const key = ([x, z]) => `${x},${z}`;
  const queue = [start];
  const previous = new Map([[key(start), null]]);
  for (let i = 0; i < queue.length; i++) {
    const node = queue[i];
    if (key(node) === key(end)) {
      const path = [];
      for (let at = node; at; at = previous.get(key(at))) path.unshift(at);
      return path;
    }
    DIRS.forEach(([dx, dz], d) => {
      const next = [node[0] + dx, node[1] + dz];
      if (canTravel(...node, d) && !previous.has(key(next))) {
        previous.set(key(next), node); queue.push(next);
      }
    });
  }
  return [];
}

// ───────────────────── Zonal Urban Layout & Strict Separation ─────────────────────
// Rule: NEVER keep slums close to extreme urban areas!
// Extreme Urban Cyber Core: West Bank (-200 to -80 X, -200 to -80 Z)
// Natural River Barrier: X ~ -25 to +25
// Slums: Confined strictly to far peripheral outskirts (East Bank, X > 70 & Z > 50), at least 220m away from Cyber Core!

export function isSlumArea(ix, iz) {
  const wx = coord(ix);
  const wz = coord(iz);

  // Extreme Urban Core center is at (-150, -150)
  const distToCyber = Math.hypot(wx - (-150), wz - (-150));
  // STRICT SEPARATION: Slums can NEVER be close to extreme urban areas!
  if (distToCyber < 210) return false;

  // St. Aurora Riverfront Medical Center is at (133, -133)
  if (Math.hypot(wx - 133, wz - (-133)) < 80) return false;

  // No slums directly along the central riverfront corridor
  if (Math.abs(wx - riverCenter(wz)) < 55) return false;

  // Must be strictly on far peripheral outer outskirts (East / South-East far quadrants)
  if (wx < 60 && wz < 70) return false;

  // Multi-frequency organic undulating noise creates natural irregular pockets in the outer badlands
  const n1 = Math.sin(ix * 0.45 + 1.1) * Math.cos(iz * 0.42 + 0.8);
  const n2 = Math.sin(ix * 0.85 - iz * 0.65 + 1.9) * 0.48;
  return n1 + n2 > 0.35;
}

export function zoneOf(ix, iz) {
  const wx = coord(ix);
  const wz = coord(iz);

  if (Math.hypot(wx - 133, wz - (-133)) < 65) return "medical_district";
  if (isSlumArea(ix, iz)) return "underdeveloped_slum";
  if (wx < -50 && wz < -50) return "cyber_district"; // Extreme Urban Cyber Citadel
  return "commercial_oldtown"; // Mixed mid-rises & commercial districts
}

export function sectorOf(ix, iz) {
  const col = Math.min(2, Math.floor(ix / (GRID / 3)));
  const row = Math.min(2, Math.floor(iz / (GRID / 3)));
  return `Sector ${row * 3 + col + 1}`;
}

// Major Landmarks
export const HOSPITAL = {
  name: "St. Aurora Riverfront Medical",
  node: [23, 7], // [coord: 133.3, -133.3] on the scenic East Riverbank
  block: [23, 6],
};

export const EMERGENCY_DESTINATIONS = [
  { id: "sec4", name: "Sector 4 Cyber Citadel Plaza", node: [5, 5], sector: "Sector 4 (Cyber Core)", street: "Westgate Ave × Commercial St", incident: "Code Red Triage" },
  { id: "sec1", name: "Sector 1 North Waterfront Pier", node: [15, 4], sector: "Sector 1 (Harbor)", street: "Bridgehead Way × North Pier Way", incident: "Dockside Multi-Casualty" },
  { id: "sec7", name: "Sector 7 Grand Bridge Midspan", node: [10, 13], sector: "Sector 7 (Bridge)", street: "Quantum Way × Grand Suspension Way", incident: "High-Speed Collision" },
  { id: "sec9", name: "Sector 9 Peripheral Slum Post", node: [27, 25], sector: "Sector 9 (Badlands)", sectorLabel: "Outer Badlands", street: "Slum Bypass × Shanty Lane", incident: "Structural Fire Outbreak" },
  { id: "sec5", name: "Sector 5 Metro Central Station", node: [15, 18], sector: "Sector 5 (Central)", street: "Bridgehead Way × Southern Express", incident: "Pedestrian Transit Crisis" },
];

export const DISPATCH_BASES = EMERGENCY_DESTINATIONS;
export const DISPATCH_BASE = DISPATCH_BASES[0];

// Default corridor crosses from the Cyber Citadel across the Grand Suspension Bridge to St. Aurora Medical!
export const DEFAULT_WAYPOINTS = [
  [5, 5],
  [15, 5],
  [15, 13], // Central Grand Suspension Bridge
  [23, 13],
  [23, 7],
];

export function expandWaypoints(waypoints) {
  const route = [];
  waypoints.forEach((wp, i) => {
    if (i === 0) {
      route.push(nearestRoadNode(wp));
      return;
    }
    route.push(...roadPath(route[route.length - 1], wp).slice(1));
  });
  return route.filter((p, i) => i === 0 || p[0] !== route[i - 1][0] || p[1] !== route[i - 1][1]);
}

export const DEFAULT_ROUTE = expandWaypoints(DEFAULT_WAYPOINTS);

export function routeBetween(start, end, jogX) {
  const jx = jogX ?? Math.round((start[0] + end[0]) / 2);
  return expandWaypoints([start, [jx, start[1]], [jx, end[1]], end]);
}

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function parseIntersection(name) {
  if (typeof name !== "string") return null;
  const n = norm(name);
  const iz = STREETS.findIndex((s) => n.includes(norm(s)));
  const ix = AVENUES.findIndex((a) => n.includes(norm(a)));
  if (ix < 0 || iz < 0) return null;
  return [ix, iz];
}

export function routeFromNames(names) {
  const pts = (Array.isArray(names) ? names : []).map(parseIntersection).filter(Boolean);
  if (pts.length < 2) return DEFAULT_ROUTE;
  const route = expandWaypoints(pts);
  return route.length >= 2 ? route : DEFAULT_ROUTE;
}

export const routeNames = (route) => route.map(([ix, iz]) => intersectionName(ix, iz));
export const round1 = (v) => Math.round(v * 10) / 10;

// ───────────────────── Zonal Potholes & Speed Bumpers ─────────────────────
// - Extreme Urban Cyber Citadel & Bridges: Strictly 0 potholes!
// - Peripheral Slums: Dense clusters of 3-6 craters per segment.
// - Commercial Districts: 0-1 occasional bumper/pothole.

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const segKey = (ix, iz, d) => nodeIndex(ix, iz) * 4 + d;

function buildRoadHazards() {
  const rand = mulberry32(7072026);
  const bumpers = [];
  const potholes = [];
  const bridges = [];
  const hazardsBySeg = new Map();

  const pushSeg = (ix, iz, d, item) => {
    if (!canTravel(ix, iz, d)) return;
    item.t = item.t / SPACING * roadLength(ix, iz, d);
    const k = segKey(ix, iz, d);
    if (!hazardsBySeg.has(k)) hazardsBySeg.set(k, []);
    hazardsBySeg.get(k).push(item);
  };
  const hazardPose = (ix, iz, d, t, lat = 0) => directedRoadSample(ix, iz, d, t / SPACING * roadLength(ix, iz, d), lat);

  // Three spaced landmark crossings, each spanning the protected riverbanks.
  for (const bz of BRIDGE_ROWS) {
    const bzCoord = coord(bz);
    const { left, right } = bridgeBounds(bz);
    bridges.push({
      iz: bz,
      z: bzCoord,
      x: (left + right) / 2,
      span: right - left,
      isGrand: bz === 13,
      isArch: bz === 9,
      isCableStay: bz === 18,
    });
  }
  for (let iz = 0; iz < GRID; iz++) {
    for (let ix = 0; ix < GRID; ix++) {
      const zone = zoneOf(ix, iz);
      if (ROAD_DISTRICTS.some((d) => d.oneWay && ix >= d.bounds[0] && ix <= d.bounds[2] && iz >= d.bounds[1] && iz <= d.bounds[3])) continue;

      // East edge: (ix, iz) <-> (ix+1, iz)
      if (isRoadSegment(ix, iz, 0)) {
        const isBridge = isBridgeSegment(ix, iz, 0);

        // Speed bumpers in commercial corridors
        if (!isBridge && zone === "commercial_oldtown" && rand() < 0.18) {
          const offset = 4.0 + rand() * (SPACING - 8.0);
          const { x, z, heading } = hazardPose(ix, iz, 0, offset);
          bumpers.push({ x, z, heading, axis: 0 });
          pushSeg(ix, iz, 0, { type: "bumper", t: offset, severity: 0.75 });
          pushSeg(ix + 1, iz, 1, { type: "bumper", t: SPACING - offset, severity: 0.75 });
        }

        // Heavy pothole distribution in peripheral slums
        if (!isBridge && zone === "underdeveloped_slum") {
          const numHoles = 3 + Math.floor(rand() * 4);
          for (let h = 0; h < numHoles; h++) {
            const d = rand() < 0.5 ? 0 : 1;
            const [sx, sz] = d === 0 ? [ix, iz] : [ix + 1, iz];
            const t = 2.5 + rand() * (SPACING - 5.0);
            const [fx, fz] = DIRS[d];
            const lat = (rand() - 0.5) * (ROAD_W * 0.7);
            const { x, z } = hazardPose(sx, sz, d, t, lat);
            const radius = 0.45 + rand() * 0.42;
            potholes.push({ x, z, radius, isSlum: true });
            pushSeg(sx, sz, d, { type: "pothole", t, lat, radius, severity: 0.95, isSlum: true });
          }
        } else if (!isBridge && zone === "commercial_oldtown" && rand() < 0.14) {
          const d = rand() < 0.5 ? 0 : 1;
          const [sx, sz] = d === 0 ? [ix, iz] : [ix + 1, iz];
          const t = 3.0 + rand() * (SPACING - 6.0);
          const [fx, fz] = DIRS[d];
          const lat = (rand() - 0.5) * (ROAD_W * 0.5);
          const { x, z } = hazardPose(sx, sz, d, t, lat);
          const radius = 0.38 + rand() * 0.3;
          potholes.push({ x, z, radius, isSlum: false });
          pushSeg(sx, sz, d, { type: "pothole", t, lat, radius, severity: 0.75, isSlum: false });
        }
      }

      // South edge: (ix, iz) <-> (ix, iz+1)
      if (isRoadSegment(ix, iz, 1)) {
        if (zone === "commercial_oldtown" && rand() < 0.18) {
          const offset = 4.0 + rand() * (SPACING - 8.0);
          const { x, z, heading } = hazardPose(ix, iz, 2, offset);
          bumpers.push({ x, z, heading, axis: 1 });
          pushSeg(ix, iz, 2, { type: "bumper", t: offset, severity: 0.75 });
          pushSeg(ix, iz + 1, 3, { type: "bumper", t: SPACING - offset, severity: 0.75 });
        }

        if (zone === "underdeveloped_slum") {
          const numHoles = 3 + Math.floor(rand() * 4);
          for (let h = 0; h < numHoles; h++) {
            const d = rand() < 0.5 ? 2 : 3;
            const [sx, sz] = d === 2 ? [ix, iz] : [ix, iz + 1];
            const t = 2.5 + rand() * (SPACING - 5.0);
            const [fx, fz] = DIRS[d];
            const lat = (rand() - 0.5) * (ROAD_W * 0.7);
            const { x, z } = hazardPose(sx, sz, d, t, lat);
            const radius = 0.45 + rand() * 0.42;
            potholes.push({ x, z, radius, isSlum: true });
            pushSeg(sx, sz, d, { type: "pothole", t, lat, radius, severity: 0.95, isSlum: true });
          }
        } else if (zone === "commercial_oldtown" && rand() < 0.14) {
          const d = rand() < 0.5 ? 2 : 3;
          const [sx, sz] = d === 2 ? [ix, iz] : [ix, iz + 1];
          const t = 3.0 + rand() * (SPACING - 6.0);
          const [fx, fz] = DIRS[d];
          const lat = (rand() - 0.5) * (ROAD_W * 0.5);
          const { x, z } = hazardPose(sx, sz, d, t, lat);
          const radius = 0.38 + rand() * 0.3;
          potholes.push({ x, z, radius, isSlum: false });
          pushSeg(sx, sz, d, { type: "pothole", t, lat, radius, severity: 0.75, isSlum: false });
        }
      }
    }
  }

  return { bumpers, potholes, bridges, hazardsBySeg };
}

export const ROAD_HAZARDS = buildRoadHazards();

// ───────────────────── ETA Math with Exact Pothole Penalties ─────────────────────
export function countRouteHazards(route) {
  let potholes = 0;
  let slumPotholes = 0;
  let bumpers = 0;
  let bridges = 0;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    const d = dirBetween(a, b);
    if (d < 2 && isBridgeSegment(Math.min(a[0], b[0]), a[1], 0)) bridges++;
    const hazards = ROAD_HAZARDS.hazardsBySeg.get(segKey(a[0], a[1], d)) || [];
    hazards.forEach((h) => {
      if (h.type === "pothole") {
        potholes++;
        if (h.isSlum) slumPotholes++;
      } else if (h.type === "bumper") {
        bumpers++;
      }
    });
  }
  return { potholes, slumPotholes, bumpers, bridges };
}

export function etaMinutes(route, severityPct) {
  const distKm = Math.max(1, route.slice(1).reduce((sum, b, i) => sum + roadLength(...route[i], dirBetween(route[i], b)), 0)) / SPACING * BLOCK_KM;
  const s = Math.min(1, Math.max(0, severityPct / 100));
  const { potholes, slumPotholes, bumpers, bridges } = countRouteHazards(route);

  // Severe slum craters add ~24s delay; clean bridges allow sustained speed
  const hazardDelayMins = (potholes - slumPotholes) * 0.22 + slumPotholes * 0.42 + bumpers * 0.14;

  const gpsKmh = Math.max(8.0, 36 - 25 * s);
  const rawStandard = (distKm / gpsKmh) * 60;
  const standard = rawStandard + hazardDelayMins;

  // GreenWave corridor pre-flushes traffic and enables high-speed bridge crossings
  const greenwave = (distKm / 38) * 60 + bumpers * 0.04;
  const saved = Math.max(1.0, standard - greenwave);

  return {
    distKm: round1(distKm),
    standard: round1(standard),
    greenwave: round1(greenwave),
    saved: round1(saved),
    potholes,
    slumPotholes,
    bumpers,
    bridges,
    hazardDelayMins: round1(hazardDelayMins),
  };
}

// ───────────────────── Dynamic A* Corridor Router ─────────────────────
// Intelligently routes ambulances across pristine river bridges and detours around outer slums
export function findOptimalCorridor(startNode, endNode = HOSPITAL.node, liveBuckets = null, closedSegments = new Set()) {
  startNode = nearestRoadNode(startNode);
  endNode = nearestRoadNode(endNode);
  const key = (x, z) => `${x},${z}`;
  const unkey = (k) => k.split(",").map(Number);

  const startK = key(startNode[0], startNode[1]);
  const endK = key(endNode[0], endNode[1]);

  const openSet = new Set([startK]);
  const cameFrom = new Map();

  const gScore = new Map();
  gScore.set(startK, 0);

  const fScore = new Map();
  // A zero heuristic remains admissible for curved and one-way streets.
  fScore.set(startK, 0);

  while (openSet.size > 0) {
    let currentK = null;
    let lowestF = Infinity;
    for (const k of openSet) {
      const f = fScore.get(k) ?? Infinity;
      if (f < lowestF) {
        lowestF = f;
        currentK = k;
      }
    }

    if (currentK === endK) {
      const path = [];
      let curr = endK;
      while (curr) {
        path.unshift(unkey(curr));
        curr = cameFrom.get(curr);
      }
      return path;
    }

    openSet.delete(currentK);
    const [cx, cz] = unkey(currentK);

    for (let d = 0; d < 4; d++) {
      const nx = cx + DIRS[d][0];
      const nz = cz + DIRS[d][1];
      if (!canTravel(cx, cz, d) || closedSegments.has(roadKey(cx, cz, d))) continue;

      const neighborK = key(nx, nz);

      // Base distance
      let edgeCost = roadLength(cx, cz, d) / SPACING;

      // Bridges are high-speed express corridors over the river (-0.3 incentive)
      if (d < 2 && isBridgeSegment(Math.min(cx, nx), cz, 0)) {
        edgeCost *= 0.65;
      }

      // Slum crater impedance detours around broken roads
      const hazards = ROAD_HAZARDS.hazardsBySeg.get(segKey(cx, cz, d)) || [];
      hazards.forEach((item) => {
        if (item.type === "pothole") {
          edgeCost += item.isSlum ? 2.8 : 0.9;
        } else if (item.type === "bumper") {
          edgeCost += 0.45;
        }
      });

      // Live vehicle queue density
      if (liveBuckets) {
        const bucket = liveBuckets[segKey(cx, cz, d)];
        if (bucket && bucket.length > 0) {
          edgeCost += bucket.length * 0.7;
        }
      }

      const tentativeG = (gScore.get(currentK) ?? Infinity) + edgeCost;

      if (tentativeG < (gScore.get(neighborK) ?? Infinity)) {
        cameFrom.set(neighborK, currentK);
        gScore.set(neighborK, tentativeG);
        // Dijkstra remains admissible when curved edges and shortcuts change world length.
        fScore.set(neighborK, tentativeG);
        openSet.add(neighborK);
      }
    }
  }

  return [];
}
