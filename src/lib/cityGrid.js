// 500 × 500 Cross Coordinate City Grid (HALF = 250, footprint -250 to +250)
// 31 × 31 Intersections (961 junctions, 900 blocks) spanning 500 × 500 world units.
// Features:
// - Meandering zig-zag river cutting through the metropolis with realistic suspension bridges
// - Extreme Urban Cyber Citadel strictly isolated from informal slum settlements
// - Far peripheral outer slum badlands with heavy crater clusters
// - Scenic riverfront St. Aurora Medical Center campus and Grand Suspension Bridge corridors

export const GRID = 31;
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
  const cx = coord(bx) + SPACING / 2;
  const cz = coord(bz) + SPACING / 2;
  const { left, right } = riverBankX(cz);
  return cx > left - 3.8 && cx < right + 3.8;
}

// Check if an East-West road segment crosses over the river (and is therefore an elevated Bridge)
export function isBridgeSegment(ix, iz, axis) {
  if (axis !== 0 || ix >= GRID - 1) return false;
  const x1 = coord(ix);
  const x2 = coord(ix + 1);
  const z = coord(iz);
  const { left, right } = riverBankX(z);
  return x1 < right + 5 && x2 > left - 5;
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

export const DISPATCH_BASES = [
  { id: "sec4", name: "Sector 4 Cyber Citadel Depot", node: [5, 5], sector: "Sector 4", street: "Westgate Ave × Commercial St" },
  { id: "sec1", name: "Sector 1 North Hub", node: [15, 4], sector: "Sector 1", street: "Bridgehead Way × North Pier Way" },
  { id: "sec7", name: "Sector 7 Grand Bridge Base", node: [15, 13], sector: "Sector 7", street: "Bridgehead Way × Grand Suspension Way" },
  { id: "sec9", name: "Sector 9 Peripheral Slum Post", node: [27, 25], sector: "Sector 9", sectorLabel: "Outer Badlands", street: "Slum Bypass × Shanty Lane" },
];

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
    const k = segKey(ix, iz, d);
    if (!hazardsBySeg.has(k)) hazardsBySeg.set(k, []);
    hazardsBySeg.get(k).push(item);
  };

  // Unified monumental bridge crossings spanning bank-to-bank for each crossing street
  for (let bz = 0; bz < GRID; bz++) {
    const bzCoord = coord(bz);
    const rc = riverCenter(bzCoord);
    bridges.push({
      iz: bz,
      z: bzCoord,
      x: rc,
      span: RIVER_WIDTH + 24,
      isGrand: bz === 13,
      isArch: bz === 9,
      isCableStay: bz === 18,
    });
  }
for (let iz = 0; iz < GRID; iz++) {
    for (let ix = 0; ix < GRID; ix++) {
      const zone = zoneOf(ix, iz);

      // East edge: (ix, iz) <-> (ix+1, iz)
      if (ix < GRID - 1) {
        const isBridge = isBridgeSegment(ix, iz, 0);
        if (isBridge) {
          // Bridges are pristine expressways — 0 POTHOLES & 0 BUMPERS!
          continue;
        }

        // Speed bumpers in commercial corridors
        if (zone === "commercial_oldtown" && rand() < 0.18) {
          const offset = 4.0 + rand() * (SPACING - 8.0);
          const x = coord(ix) + offset;
          const z = coord(iz);
          bumpers.push({ x, z, axis: 0 });
          pushSeg(ix, iz, 0, { type: "bumper", t: offset, severity: 0.75 });
          pushSeg(ix + 1, iz, 1, { type: "bumper", t: SPACING - offset, severity: 0.75 });
        }

        // Heavy pothole distribution in peripheral slums
        if (zone === "underdeveloped_slum") {
          const numHoles = 3 + Math.floor(rand() * 4);
          for (let h = 0; h < numHoles; h++) {
            const d = rand() < 0.5 ? 0 : 1;
            const [sx, sz] = d === 0 ? [ix, iz] : [ix + 1, iz];
            const t = 2.5 + rand() * (SPACING - 5.0);
            const [fx, fz] = DIRS[d];
            const lat = (rand() - 0.5) * (ROAD_W * 0.7);
            const x = coord(sx) + fx * t - fz * lat;
            const z = coord(sz) + fz * t + fx * lat;
            const radius = 0.45 + rand() * 0.42;
            potholes.push({ x, z, radius, isSlum: true });
            pushSeg(sx, sz, d, { type: "pothole", t, lat, radius, severity: 0.95, isSlum: true });
          }
        } else if (zone === "commercial_oldtown" && rand() < 0.14) {
          const d = rand() < 0.5 ? 0 : 1;
          const [sx, sz] = d === 0 ? [ix, iz] : [ix + 1, iz];
          const t = 3.0 + rand() * (SPACING - 6.0);
          const [fx, fz] = DIRS[d];
          const lat = (rand() - 0.5) * (ROAD_W * 0.5);
          const x = coord(sx) + fx * t - fz * lat;
          const z = coord(sz) + fz * t + fx * lat;
          const radius = 0.38 + rand() * 0.3;
          potholes.push({ x, z, radius, isSlum: false });
          pushSeg(sx, sz, d, { type: "pothole", t, lat, radius, severity: 0.75, isSlum: false });
        }
      }

      // South edge: (ix, iz) <-> (ix, iz+1)
      if (iz < GRID - 1) {
        if (zone === "commercial_oldtown" && rand() < 0.18) {
          const offset = 4.0 + rand() * (SPACING - 8.0);
          const x = coord(ix);
          const z = coord(iz) + offset;
          bumpers.push({ x, z, axis: 1 });
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
            const x = coord(sx) + fx * t - fz * lat;
            const z = coord(sz) + fz * t + fx * lat;
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
          const x = coord(sx) + fx * t - fz * lat;
          const z = coord(sz) + fz * t + fx * lat;
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
    if (isBridgeSegment(Math.min(a[0], b[0]), a[1], 0)) bridges++;
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
  const distKm = Math.max(1, route.length - 1) * BLOCK_KM;
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
export function findOptimalCorridor(startNode, endNode = HOSPITAL.node, liveBuckets = null) {
  const key = (x, z) => `${x},${z}`;
  const unkey = (k) => k.split(",").map(Number);

  const startK = key(startNode[0], startNode[1]);
  const endK = key(endNode[0], endNode[1]);

  const openSet = new Set([startK]);
  const cameFrom = new Map();

  const gScore = new Map();
  gScore.set(startK, 0);

  const fScore = new Map();
  const h = (x, z) => Math.abs(x - endNode[0]) + Math.abs(z - endNode[1]);
  fScore.set(startK, h(startNode[0], startNode[1]));

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
      if (!inGrid(nx, nz)) continue;

      const neighborK = key(nx, nz);

      // Base distance
      let edgeCost = 1.0;

      // Bridges are high-speed express corridors over the river (-0.3 incentive)
      if (isBridgeSegment(Math.min(cx, nx), cz, 0)) {
        edgeCost -= 0.35;
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
        fScore.set(neighborK, tentativeG + h(nx, nz));
        openSet.add(neighborK);
      }
    }
  }

  return routeBetween(startNode, endNode);
}
