// Multi-modal urban traffic simulation engine for the 100 × 100 cross grid (25 × 25 intersections)
// with live segment congestion categorization, strict red-light enforcement, and dynamic routing.

import {
  GRID,
  ROAD_W,
  LANE,
  DIRS,
  OPPOSITE,
  axisOfDir,
  nodeIndex,
  inGrid,
  dirBetween,
  intersectionName,
  DEFAULT_ROUTE,
  DISPATCH_BASES,
  HOSPITAL,
  etaMinutes,
  ROAD_HAZARDS,
  segKey,
  findOptimalCorridor,
  canTravel,
  expandWaypoints,
  ROAD_NODE_COUNT,
  roadKey,
  roadLength,
  directedRoadSample,
  ROAD_SEGMENTS,
} from "./cityGrid";
import { URGENCY_POLICIES, adaptiveRoute, measureRoute, approachTraffic, crossingTraffic } from "./trafficPolicy";

export const MAX_VEHICLES = 800;
export const NORMAL_COUNT = 380;
export const RUSH_COUNT = 680;

const stopDistance = (length) => Math.max(0.8, length - ROAD_W / 2 - 0.45);
const SHOULDER = LANE + 1.25;
const GREEN = 6.5;
const YELLOW = 1.5;
const CYCLE = 2 * (GREEN + YELLOW);
const AMB_SPEED_CORRIDOR = 18.0;
const AMB_SPEED_NORMAL = 10.5;
const PREFLUSH_AHEAD = 3;
const YIELD_ZONE = 32;
const EMPTY_ROAD_TRAFFIC = Object.freeze({ status: "green", vehicles: 0, stopped: 0, slow: 0, avgSpeed: 0, load: 0, updatedAt: 0 });
const NODE_DEGREES = Array.from({ length: GRID * GRID }, (_, i) =>
  DIRS.reduce((count, _, d) => count + Number(canTravel(i % GRID, Math.floor(i / GRID), d)), 0));
export const SPEED_TO_KMH = 5.5;

export const VEHICLE_TYPES = ["bus", "truck", "auto", "bike", "suv", "car"];

export const VEHICLE_SPECS = {
  bus: {
    label: "City Bus",
    weight: 0.09,
    length: 3.2,
    pcu: 3.0,
    speedRange: [4.2, 5.5],
    accel: 3.2,
    decel: 16,
    bumperSpeed: 1.5,
    potholeSpeed: 1.2,
    weaveAmp: 0.0,
    swerveAmp: 0.12,
    laneBias: 0.08,
    colors: ["#10b981", "#0284c7", "#ea580c", "#059669"],
  },
  truck: {
    label: "Cargo Truck",
    weight: 0.08,
    length: 3.0,
    pcu: 2.8,
    speedRange: [4.3, 5.8],
    accel: 3.4,
    decel: 15,
    bumperSpeed: 1.4,
    potholeSpeed: 1.1,
    weaveAmp: 0.0,
    swerveAmp: 0.1,
    laneBias: 0.1,
    colors: ["#d97706", "#ca8a04", "#64748b", "#b45309"],
  },
  auto: {
    label: "Auto-Rickshaw",
    weight: 0.22,
    length: 1.4,
    pcu: 0.85,
    speedRange: [5.0, 7.0],
    accel: 6.8,
    decel: 25,
    bumperSpeed: 1.6,
    potholeSpeed: 1.15,
    weaveAmp: 0.22,
    swerveAmp: 0.44,
    laneBias: 0.14,
    colors: ["#facc15", "#fde047", "#eab308", "#22c55e"],
  },
  bike: {
    label: "Two-Wheeler",
    weight: 0.2,
    length: 1.05,
    pcu: 0.4,
    speedRange: [6.8, 9.5],
    accel: 9.5,
    decel: 32,
    bumperSpeed: 2.7,
    potholeSpeed: 2.0,
    weaveAmp: 0.28,
    swerveAmp: 0.52,
    laneBias: -0.24,
    colors: ["#38bdf8", "#06b6d4", "#a855f7", "#e2e8f0", "#fb923c"],
  },
  suv: {
    label: "SUV / MUV",
    weight: 0.18,
    length: 2.1,
    pcu: 1.35,
    speedRange: [6.4, 8.7],
    accel: 6.8,
    decel: 26,
    bumperSpeed: 3.1,
    potholeSpeed: 2.7,
    weaveAmp: 0.04,
    swerveAmp: 0.22,
    laneBias: -0.04,
    colors: ["#f8fafc", "#94a3b8", "#3b82f6", "#cbd5e1", "#334155"],
  },
  car: {
    label: "Sedan / Hatch",
    weight: 0.23,
    length: 1.8,
    pcu: 1.0,
    speedRange: [6.0, 8.4],
    accel: 6.5,
    decel: 25,
    bumperSpeed: 2.1,
    potholeSpeed: 1.6,
    weaveAmp: 0.06,
    swerveAmp: 0.32,
    laneBias: 0.0,
    colors: ["#e2e8f0", "#38bdf8", "#60a5fa", "#f1f5f9", "#93c5fd", "#818cf8"],
  },
};

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

function shortestAngle(from, to) {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

export class TrafficSim {
  constructor(options = {}) {
    this.rand = mulberry32(options.seed ?? 20261029);
    this.fixedDemand = options.vehicleCount ?? null;
    this.controlled = options.controlled ?? false;
    this.closedSegments = new Set(options.closedSegments || []);
    this.ambulanceMaxSpeed = options.ambulanceMaxSpeed ?? null;
    this.ambulanceHold = false;
    this.roadPose = { x: 0, z: 0, heading: 0 };
    this.time = 0;

    // 24-Hour Continuous Dynamic Time System
    this.hour = options.hour ?? 8.5;
    this.timeSpeed = 0.04; // ~1 hour per 25s real-time, can be scrubbed
    this.timePaused = this.controlled;

    // Unpredictable random traffic surges (flash gridlock)
    this.unpredictableSurge = false;
    this.surgeTimer = 0;
    this.nextSurgeIn = 55 + this.rand() * 90; // First random surge in 55-145s

    this.vehicles = [];
    this.nextId = 1;
    this.targetCount = this.fixedDemand ?? this.getNaturalDemand(this.hour);
    this.rushHour = false;
    this.greenWaveAI = true;
    this.manualOverride = false;
    this.showHazards = true;
    this.showTrafficFilter = true; // Optional Road Congestion Heatmap Filter
    this.show2DMinimap = true; // Optional Floating 2D Radar Map
    this.route = DEFAULT_ROUTE;
    this.routeVersion = 1;
    this.urgency = options.urgency in URGENCY_POLICIES ? options.urgency : "urgent";
    this.decision = null;
    this.decisionHistory = [];
    this.rerouteCount = 0;
    this.lastRouteChangeAt = -Infinity;
    this.nextPolicyReviewAt = 0;
    this.lastPolicyEdge = "";
    this.clearanceNodes = new Set();
    this.trafficVersion = 0;
    this.trafficUpdatedAt = -Infinity;
    this.roadTraffic = new Map();
    this.ambulance = null;
    this.lastTrip = null;
    this.hospital = HOSPITAL;
    this.spawnNode = HOSPITAL.node;
    this.pinnedDestination = DISPATCH_BASES[0];
    this.activeDestination = this.pinnedDestination;
    this.activeBase = this.activeDestination;
    this.closures = new Map();
    this.potholes = [...ROAD_HAZARDS.potholes.map((p, idx) => ({ id: idx + 1, ...p, active: true }))];
    this.repairedPotholesCount = 0;
    this.overrides = new Map();
    this.forcedNodes = [];
    this.events = [];
    this.eventId = 1;
    this.lightOffsets = Array.from({ length: GRID * GRID }, () => this.rand());
    this.buckets = Array.from({ length: GRID * GRID * 4 }, () => []);
    this.stats = {
      count: 0,
      avgKmh: 0,
      stopped: 0,
      congestion: 0,
      forced: 0,
      hazardSlowdowns: 0,
      busStopsActive: 0,
      fleetCounts: { bus: 0, truck: 0, auto: 0, bike: 0, suv: 0, car: 0 },
      fleetShare: { bus: 0, truck: 0, auto: 0, bike: 0, suv: 0, car: 0 },
    };

    for (let i = 0; i < this.targetCount; i++) this.spawnVehicle(true);
    this.fillBuckets();
    this.refreshTrafficState(true);
    this.log(
      "info",
      `500×500 Cross Digital Twin online · ${ROAD_NODE_COUNT} road junctions, protected riverbanks & 3 landmark bridges active`
    );
  }

  // 24-Hour Diurnal Demand Curve: Morning Rush & Evening Rush peaks, Noon dip, Night low, + Unpredictable Flash Spikes
  getNaturalDemand(hour) {
    const h = ((hour % 24) + 24) % 24;
    // Morning Rush Peak (07:30 - 09:30): center 8.5
    const morning = Math.exp(-Math.pow((h - 8.5) / 1.7, 2));
    // Evening Rush Peak (17:00 - 19:45): center 18.2
    const evening = Math.exp(-Math.pow((h - 18.2) / 1.8, 2));
    // Midday / Noon lull (12:00 - 14:00): moderate flow
    const noon = Math.exp(-Math.pow((h - 13.0) / 2.2, 2)) * 0.42;
    // Night baseline (23:00 - 05:00): quiet city
    const night = h >= 23 || h <= 5 ? 0.2 : 0.38;

    const trafficFactor = Math.max(0.18, Math.max(morning * 1.0, evening * 1.08, noon, night));
    // Baseline vehicle count scales from ~160 (deep night) to ~680 (rush hour)
    let demand = Math.round(160 + trafficFactor * 520);

    // If unpredictable random surge is active, inject an unexpected +220 vehicles!
    if (this.unpredictableSurge) {
      demand = Math.min(MAX_VEHICLES - 30, demand + 220);
    }

    if (this.rushHour) {
      demand = Math.min(MAX_VEHICLES - 20, Math.max(demand, 680));
    }

    return demand;
  }

  // Trigger an unpredictable random traffic surge (e.g., unexpected incident / sudden flash jam)
  triggerRandomSurge() {
    this.unpredictableSurge = true;
    this.surgeTimer = 40 + this.rand() * 30; // Lasts 40-70 seconds
    this.nextSurgeIn = 75 + this.rand() * 120; // Next unpredicted surge in 75-195s
    this.targetCount = this.getNaturalDemand(this.hour);
    this.log(
      "alert",
      `⚠️ UNPREDICTED SURGE INJECTED · Sudden flash gridlock on main arterials (+220 vehicles)`
    );
  }

  setHour(h) {
    this.hour = ((h % 24) + 24) % 24;
    this.targetCount = this.getNaturalDemand(this.hour);
  }

  setTimePaused(paused) {
    this.timePaused = paused;
  }

  getFormattedTime() {
    const totalMins = Math.floor(this.hour * 60) % 1440;
    const hh = String(Math.floor(totalMins / 60)).padStart(2, "0");
    const mm = String(totalMins % 60).padStart(2, "0");
    const hNum = Math.floor(totalMins / 60);
    const period = hNum >= 12 ? "PM" : "AM";
    const h12 = hNum % 12 || 12;

    let phase = "Late Night Low";
    if (this.hour >= 5.0 && this.hour < 7.0) phase = "Dawn Early Commute";
    else if (this.hour >= 7.0 && this.hour < 10.0) phase = "Morning Rush Peak";
    else if (this.hour >= 10.0 && this.hour < 12.0) phase = "Mid-Morning Flow";
    else if (this.hour >= 12.0 && this.hour < 14.5) phase = "Noon Lull";
    else if (this.hour >= 14.5 && this.hour < 16.5) phase = "Afternoon Flow";
    else if (this.hour >= 16.5 && this.hour < 19.5) phase = "Evening Rush Peak";
    else if (this.hour >= 19.5 && this.hour < 22.5) phase = "Dusk Commercial";

    if (this.unpredictableSurge) phase = "⚠️ UNPREDICTED FLASH SURGE";

    return {
      hhmm: `${hh}:${mm}`,
      display: `${h12}:${mm} ${period}`,
      phase,
    };
  }

  log(type, msg) {
    this.events.unshift({ id: this.eventId++, type, msg, at: new Date() });
    if (this.events.length > 40) this.events.length = 40;
  }

  setRoute(route) {
    this.route = route;
    this.routeVersion++;
  }

  // One authoritative, 10 Hz simulation-time traffic sample serves both maps.
  // Density is normalized by actual road length (including long bridge spans).
  refreshTrafficState(force = false) {
    if (!force && this.time - this.trafficUpdatedAt < 0.1 - 1e-8) return false;
    for (const segment of ROAD_SEGMENTS) {
      const { ix, iz, axis, length } = segment;
      const first = this.buckets[segKey(ix, iz, axis === 0 ? 0 : 2)];
      const second = this.buckets[segKey(ix + (axis === 0 ? 1 : 0), iz + (axis === 1 ? 1 : 0), axis === 0 ? 1 : 3)];
      let vehicles = 0, stopped = 0, slow = 0, speed = 0, occupied = 0;
      for (const bucket of [first, second]) for (const vehicle of bucket || []) {
        vehicles++; speed += vehicle.speed;
        stopped += Number(vehicle.speed < 0.9);
        slow += Number(vehicle.speed >= 0.9 && vehicle.speed < 3.2);
        occupied += (vehicle.spec?.length ?? 1.8) + 1.2;
      }
      const load = occupied / Math.max(5, length * 2);
      const status = (stopped >= 2 && vehicles >= 2) || load >= 0.42 ? "red"
        : vehicles && (stopped || slow || load >= 0.2) ? "yellow" : "green";
      const key = `${ix},${iz},${axis}`;
      const record = this.roadTraffic.get(key) || {};
      Object.assign(record, { status, vehicles, stopped, slow, avgSpeed: vehicles ? speed / vehicles : 0, load, updatedAt: this.time });
      this.roadTraffic.set(key, record);
    }
    this.trafficUpdatedAt = this.time;
    this.trafficVersion++;
    return true;
  }

  getRoadTraffic(ix, iz, axis) {
    return this.roadTraffic.get(`${ix},${iz},${axis}`) || EMPTY_ROAD_TRAFFIC;
  }

  getRoadStatus(ix, iz, axis) {
    return this.getRoadTraffic(ix, iz, axis).status;
  }

  // Backwards compatible segment lookup
  getSegmentStatus(ix, iz, d) {
    const axis = axisOfDir(d);
    return this.getRoadStatus(ix - Number(d === 1), iz - Number(d === 3), axis);
  }

  setActiveDestination(dest) {
    this.activeDestination = dest;
    this.pinnedDestination = dest;
    this.activeBase = dest;
    this.log("info", `Emergency target selected: ${dest.name} (${dest.sector || "City Sector"})`);
  }

  setPinnedLocation(node, name = null) {
    const [ix, iz] = node;
    const destName = name || `Pinned: ${intersectionName(ix, iz)}`;
    const destObj = {
      id: `pin-${ix}-${iz}`,
      name: destName,
      node: [ix, iz],
      sector: `District (${ix}, ${iz})`,
      incident: "Pinned Drop Emergency",
    };
    this.pinnedDestination = destObj;
    this.activeDestination = destObj;
    this.activeBase = destObj;
    if (!this.ambulance || this.ambulance.arrived) {
      try {
        const preview = adaptiveRoute(this, HOSPITAL.node, node);
        if (preview && preview.length >= 2) this.setRoute(preview);
      } catch {}
    }
    this.log("info", `📍 Pin dropped at ${destName}`);
    return destObj;
  }

  setActiveBase(base) {
    this.setActiveDestination(base);
  }

  dispatchDynamic(destinationNode = this.activeDestination?.node || this.activeBase.node, label = "Emergency Medical Response") {
    this.fillBuckets();
    this.refreshTrafficState(true);
    // Hospital is the permanent spawn point
    const outboundRoute = adaptiveRoute(this, HOSPITAL.node, destinationNode);
    if (!outboundRoute || outboundRoute.length < 2) {
      throw new Error("No navigable corridor from Hospital to emergency location.");
    }
    const returnRoute = adaptiveRoute(this, destinationNode, HOSPITAL.node);
    return this.dispatchRoundTrip(outboundRoute, returnRoute, label, destinationNode);
  }

  dispatchRoundTrip(outboundRoute, returnRoute = null, label = "Emergency Medical Response", destinationNode = null) {
    outboundRoute = expandWaypoints(outboundRoute);
    const dest = destinationNode || outboundRoute[outboundRoute.length - 1];
    if (!returnRoute) {
      returnRoute = adaptiveRoute(this, dest, HOSPITAL.node);
    }
    if (returnRoute) returnRoute = expandWaypoints(returnRoute);

    this.setRoute(outboundRoute);
    const [sx, sz] = outboundRoute[0];
    const start = directedRoadSample(sx, sz, dirBetween(outboundRoute[0], outboundRoute[1]), 0, LANE, this.roadPose);
    const destName = this.activeDestination?.name || intersectionName(dest[0], dest[1]);

    this.ambulance = {
      route: outboundRoute,
      outboundRoute,
      returnRoute,
      destinationNode: dest,
      destinationName: destName,
      phase: "OUTBOUND", // "OUTBOUND" -> "ON_SCENE" -> "INBOUND" -> "COMPLETED"
      onSceneTimer: 0,
      hasPatient: false,
      k: 0,
      t: 0,
      speed: 4,
      lateral: LANE,
      heading: start.heading,
      x: start.x,
      z: start.z,
      elapsed: 0,
      outboundElapsed: 0,
      inboundElapsed: 0,
      arrived: false,
      arrivedTimer: 0,
      label,
      trail: [],
    };
    this.prevForced = new Set();
    this.rerouteCount = 0;
    this.decisionHistory = [];
    this.clearanceNodes.clear();
    this.lastRouteChangeAt = -Infinity;
    this.nextPolicyReviewAt = this.time;
    this.lastPolicyEdge = "";
    this.decision = {
      action: this.greenWaveAI ? "clear" : "standard",
      urgency: this.urgency,
      reason: `Outbound response: clearing corridor from Hospital to ${destName}.`,
      location: intersectionName(sx, sz),
      at: this.time,
      nextReviewAt: this.time,
      queueVehicles: 0,
      crossTrafficVehicles: 0,
      etaSeconds: null,
      alternativeEtaSeconds: null,
      reroutes: 0,
    };
    this.log("alert", `🚨 ${label} · AMB-07 dispatched from Hospital to ${destName} (${outboundRoute.length} junctions)`);
    return this.ambulance;
  }

  edgeOpen(ix, iz, d) {
    return canTravel(ix, iz, d) && !this.closedSegments.has(roadKey(ix, iz, d));
  }

  findRoute(start, end = HOSPITAL.node, liveBuckets = null) {
    return findOptimalCorridor(start, end, liveBuckets, this.closedSegments);
  }

  closeRoads(keys) {
    keys.forEach((key) => {
      this.closedSegments.add(key);
      if (!this.closures.has(key)) {
        this.closures.set(key, { key, reason: "construction", name: `Road ${key}`, at: this.time, x: 0, z: 0 });
      }
    });
    this.log("warn", "Road closure active · new traffic must use an open approach");
  }

  closeRoadWithReason(key, reason = "construction", customName = null, x = 0, z = 0) {
    this.closedSegments.add(key);
    const item = { key, reason, name: customName || `Segment ${key}`, at: this.time, x, z };
    this.closures.set(key, item);
    this.log("warn", `${reason === "water_logging" ? "🌊 Water logging blockage" : "🚧 Construction barrier"} placed on ${item.name}`);
    if (this.ambulance && !this.ambulance.arrived) {
      this.reviewAmbulancePolicy(true);
    }
    return item;
  }

  openRoad(key) {
    this.closedSegments.delete(key);
    const rec = this.closures.get(key);
    this.closures.delete(key);
    this.log("info", `✅ Road reopened: ${rec?.name || key}`);
    if (this.ambulance && !this.ambulance.arrived) {
      this.reviewAmbulancePolicy(true);
    }
    return true;
  }

  toggleRoadClosure(key, reason = "construction", name = null, x = 0, z = 0) {
    if (this.closedSegments.has(key)) {
      return this.openRoad(key);
    } else {
      return this.closeRoadWithReason(key, reason, name, x, z);
    }
  }

  clearAllClosures() {
    this.closedSegments.clear();
    this.closures.clear();
    this.log("info", "All road closures and blockages cleared");
    if (this.ambulance && !this.ambulance.arrived) {
      this.reviewAmbulancePolicy(true);
    }
  }

  removePothole(potholeId) {
    const item = this.potholes.find((p) => p.id === potholeId);
    if (item && item.active !== false) {
      item.active = false;
      this.repairedPotholesCount++;
      this.log("success", `🛠️ Pothole #${potholeId} repaired & surface sealed.`);
      return true;
    }
    return false;
  }

  repairNearestPothole(x, z, maxDist = 8) {
    let best = null;
    let bestDist = Infinity;
    for (const p of this.potholes) {
      if (p.active === false) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bestDist && d <= maxDist) {
        bestDist = d;
        best = p;
      }
    }
    if (best) {
      return this.removePothole(best.id);
    }
    return false;
  }

  addPothole(x, z, radius = 0.8, isSlum = false) {
    const newId = this.potholes.length + 1;
    const pothole = { id: newId, x, z, radius, isSlum, active: true };
    this.potholes.push(pothole);
    this.log("warn", `🕳️ Road pothole reported at (${x.toFixed(1)}, ${z.toFixed(1)})`);
    return pothole;
  }

  repairAllPotholes() {
    let repaired = 0;
    for (const p of this.potholes) {
      if (p.active !== false) {
        p.active = false;
        repaired++;
      }
    }
    this.repairedPotholesCount += repaired;
    this.log("success", `🛠️ Repaired and resurfaced all ${repaired} city potholes.`);
  }

  resetPotholes() {
    this.potholes = [...ROAD_HAZARDS.potholes.map((p, idx) => ({ id: idx + 1, ...p, active: true }))];
    this.repairedPotholesCount = 0;
    this.log("info", "Road potholes reset to city survey distribution.");
  }

  redirectAmbulance(pathFromNextNode) {
    const amb = this.ambulance;
    if (!amb || amb.arrived || !pathFromNextNode.length) return false;
    const a = amb.route[amb.k];
    const next = amb.route[amb.k + 1];
    if (next.join() !== pathFromNextNode[0].join()) return false;
    const route = [a, ...pathFromNextNode];
    if (route.slice(2).some((b, i) => !this.edgeOpen(...route[i + 1], dirBetween(route[i + 1], b)))) return false;
    amb.route = route;
    amb.k = 0;
    this.setRoute(route);
    return true;
  }

  dispatch(route = this.route, label = "Critical Ambulance Dispatch") {
    if (!Array.isArray(route) || route.length < 2) throw new Error("No open route to the hospital.");
    route = expandWaypoints(route);
    if (route.slice(1).some((b, i) => !this.edgeOpen(...route[i], dirBetween(route[i], b)))) {
      throw new Error("The proposed route includes a closed road.");
    }
    this.setRoute(route);
    const [sx, sz] = route[0];
    const start = directedRoadSample(sx, sz, dirBetween(route[0], route[1]), 0, LANE, this.roadPose);
    const dest = route[route.length - 1];
    const destName = this.activeDestination?.name || intersectionName(dest[0], dest[1]);
    const endsAtHospital = dest[0] === HOSPITAL.node[0] && dest[1] === HOSPITAL.node[1];
    const startsAtHospital = sx === HOSPITAL.node[0] && sz === HOSPITAL.node[1];

    this.ambulance = {
      route,
      outboundRoute: route,
      returnRoute: startsAtHospital && !endsAtHospital ? adaptiveRoute(this, dest, HOSPITAL.node) : null,
      destinationNode: dest,
      destinationName: destName,
      phase: startsAtHospital && !endsAtHospital ? "OUTBOUND" : "INBOUND",
      onSceneTimer: 0,
      hasPatient: endsAtHospital,
      k: 0,
      t: 0,
      speed: 4,
      lateral: LANE,
      heading: start.heading,
      x: start.x,
      z: start.z,
      elapsed: 0,
      outboundElapsed: 0,
      inboundElapsed: 0,
      arrived: false,
      arrivedTimer: 0,
      label,
      trail: [],
    };
    this.prevForced = new Set();
    this.rerouteCount = 0;
    this.decisionHistory = [];
    this.clearanceNodes.clear();
    this.lastRouteChangeAt = -Infinity;
    this.nextPolicyReviewAt = this.time;
    this.lastPolicyEdge = "";
    this.decision = {
      action: this.greenWaveAI ? "clear" : "standard",
      urgency: this.urgency,
      reason: "Live traffic review begins at dispatch; the current road remains committed.",
      location: intersectionName(sx, sz),
      at: this.time,
      nextReviewAt: this.time,
      queueVehicles: 0,
      crossTrafficVehicles: 0,
      etaSeconds: null,
      alternativeEtaSeconds: null,
      reroutes: 0,
    };
    this.log("alert", `${label} · Unit AMB-07 dispatched from ${intersectionName(sx, sz)} (${route.length} junctions)`);
    return this.ambulance;
  }

  setRushHour(on) {
    this.rushHour = on;
    this.targetCount = on ? RUSH_COUNT : NORMAL_COUNT;
    this.log(
      on ? "warn" : "info",
      on
        ? "Heavy rush-hour gridlock injected · 680 vehicles across 100×100 matrix"
        : "Rush-hour surge cleared · returning to baseline 380 vehicles"
    );
  }

  setManualOverride(on) {
    this.manualOverride = on;
    this.nextPolicyReviewAt = this.time;
    this.log(on ? "wave" : "info", on ? "MANUAL GREEN WAVE OVERRIDE · full corridor forced green" : "Manual override released · adaptive timing restored");
  }

  setGreenWaveAI(on) {
    this.greenWaveAI = on;
    this.nextPolicyReviewAt = this.time;
    this.log(on ? "wave" : "warn", on ? "Adaptive routing armed · traffic and urgency reviewed every simulation second" : "GreenWave AI disarmed · ambulance obeys standard signals");
  }

  setUrgency(urgency) {
    if (!(urgency in URGENCY_POLICIES)) return false;
    this.urgency = urgency;
    this.nextPolicyReviewAt = this.time;
    return true;
  }

  setShowHazards(on) {
    this.showHazards = on;
  }

  setShowTrafficFilter(on) {
    this.showTrafficFilter = on;
  }

  setShow2DMinimap(on) {
    this.show2DMinimap = on;
  }

  corridorActive() {
    return this.manualOverride || (this.greenWaveAI && !this.ambulanceHold && !!this.ambulance && !this.ambulance.arrived && this.clearanceNodes.size > 0);
  }

  validDirs(ix, iz) {
    const out = [];
    for (let d = 0; d < 4; d++) if (this.edgeOpen(ix, iz, d)) out.push(d);
    return out;
  }

  chooseNext(ix, iz, fromD) {
    const exits = this.validDirs(ix, iz);
    const options = exits.filter((d) => d !== OPPOSITE[fromD]);
    if (!options.length) return exits.includes(OPPOSITE[fromD]) ? OPPOSITE[fromD] : exits[0] ?? null;
    if (options.includes(fromD) && this.rand() < 0.65) return fromD;
    return options[Math.floor(this.rand() * options.length)];
  }

  pickVehicleType() {
    const r = this.rand();
    let acc = 0;
    for (const type of VEHICLE_TYPES) {
      acc += VEHICLE_SPECS[type].weight;
      if (r <= acc) return type;
    }
    return "car";
  }

  spawnVehicle(initial = false) {
    const type = this.pickVehicleType();
    const spec = VEHICLE_SPECS[type];
    for (let attempt = 0; attempt < 64; attempt++) {
      const ix = Math.floor(this.rand() * GRID);
      const iz = Math.floor(this.rand() * GRID);
      const dirs = this.validDirs(ix, iz);
      if (!dirs.length) continue;
      const d = dirs[Math.floor(this.rand() * dirs.length)];
      const length = roadLength(ix, iz, d);
      const t = 0.3 + this.rand() * Math.max(0.1, stopDistance(length) - 1.2);
      const minClearance = spec.length + 0.8;
      const clash = this.vehicles.some(
        (v) => v.ix === ix && v.iz === iz && v.d === d && Math.abs(v.t - t) < minClearance
      );
      if (clash) continue;
      const nx = ix + DIRS[d][0];
      const nz = iz + DIRS[d][1];
      const nextD = this.chooseNext(nx, nz, d);
      if (nextD == null) continue;
      const [minS, maxS] = spec.speedRange;
      const baseSpeed = minS + this.rand() * (maxS - minS);
      const maxSpeed = this.rushHour ? baseSpeed * 0.82 : baseSpeed;
      const baseLateral = LANE + spec.laneBias + (this.rand() - 0.5) * 0.12;
      const pose = directedRoadSample(ix, iz, d, t, baseLateral, this.roadPose);
      this.vehicles.push({
        id: this.nextId++,
        type,
        spec,
        ix,
        iz,
        d,
        t,
        nextD,
        speed: initial ? maxSpeed * 0.65 : 0,
        maxSpeed,
        baseLateral,
        lateral: baseLateral,
        yOffset: 0,
        pitch: 0,
        heading: pose.heading,
        color: spec.colors[Math.floor(this.rand() * spec.colors.length)],
        scale: initial ? 1 : 0.01,
        dying: false,
        yielding: false,
        hazardSlowed: false,
        busStopTimer: 0,
        weavePhase: this.rand() * Math.PI * 2,
        x: pose.x,
        z: pose.z,
      });
      return true;
    }
    return false;
  }

  lightState(idx) {
    const forced = this.overrides.get(idx);
    if (forced !== undefined) return { axis: forced, yellow: false, forced: true };
    const local = (this.time + this.lightOffsets[idx] * CYCLE) % CYCLE;
    if (local < GREEN) return { axis: 0, yellow: false, forced: false };
    if (local < GREEN + YELLOW) return { axis: 0, yellow: true, forced: false };
    if (local < 2 * GREEN + YELLOW) return { axis: 1, yellow: false, forced: false };
    return { axis: 1, yellow: true, forced: false };
  }

  canGo(ix, iz, axis) {
    // Bends and intermediate roundabout nodes are not signalized junctions.
    if (NODE_DEGREES[nodeIndex(ix, iz)] <= 2) return true;
    const s = this.lightState(nodeIndex(ix, iz));
    return s.axis === axis && !s.yellow;
  }

  reviewAmbulancePolicy(force = false) {
    const amb = this.ambulance;
    if (!amb || amb.arrived) { this.clearanceNodes.clear(); return; }
    const a = amb.route[amb.k], next = amb.route[amb.k + 1];
    const edgeId = `${a.join()},${next.join()}`;
    const future = amb.route.slice(amb.k + 1);
    const blocked = future.slice(1).some((node, index) => !this.edgeOpen(...future[index], dirBetween(future[index], node)));
    const reachedJunction = edgeId !== this.lastPolicyEdge;
    if (!force && !blocked && this.time < this.nextPolicyReviewAt && !(reachedJunction && this.time - (this.decision?.at ?? -Infinity) >= 0.25)) return;
    this.lastPolicyEdge = edgeId;
    this.nextPolicyReviewAt = this.time + 1;
    this.clearanceNodes.clear();
    const location = intersectionName(...next);
    const base = { urgency: this.urgency, location, at: this.time, nextReviewAt: this.nextPolicyReviewAt,
      queueVehicles: 0, crossTrafficVehicles: 0, etaSeconds: null, alternativeEtaSeconds: null, reroutes: this.rerouteCount };
    if (this.ambulanceHold || this.manualOverride || !this.greenWaveAI) {
      const action = this.ambulanceHold ? "hold" : this.manualOverride ? "manual" : "standard";
      const reason = this.ambulanceHold ? "Planning hold: automatic routing is suspended until the selected plan is activated."
        : this.manualOverride ? "Manual override is forcing the entire remaining corridor green."
          : "Reference policy: ordinary traffic signals; automatic route and signal intervention disabled.";
      this.recordDecision({ ...base, action, reason });
      return;
    }

    const policy = URGENCY_POLICIES[this.urgency];
    const current = measureRoute(this, future);
    let candidate = adaptiveRoute(this, next, amb.route[amb.route.length - 1], a);
    // A closure can leave retreat as the only legal exit; turn at the next node.
    if (!candidate.length && blocked) candidate = adaptiveRoute(this, next, amb.route[amb.route.length - 1]);
    const alternative = candidate.length ? measureRoute(this, candidate) : { seconds: Infinity, score: Infinity };
    const changed = candidate.length && candidate.map((node) => node.join()).join(";") !== future.map((node) => node.join()).join(";");
    const saving = current.score - alternative.score;
    const worthwhile = saving >= Math.max(policy.minSaving, current.score * 0.08);
    const timely = alternative.seconds <= current.seconds * policy.maxDetourRatio;
    const cooldownPassed = this.time - this.lastRouteChangeAt >= 6;
    let rerouted = false;
    if (changed && (blocked || (cooldownPassed && worthwhile && timely))) {
      rerouted = this.redirectAmbulance(candidate);
      if (rerouted) { this.rerouteCount++; this.lastRouteChangeAt = this.time; }
    }

    // Preemption is decided separately at each of the next three true junctions.
    // A busy cross street keeps its normal cycle unless critical urgency has no
    // worthwhile timely detour. Bends and roundabout waypoints are never signals.
    let reviewed = 0, queueVehicles = 0, maxCross = 0, firstSignal = null;
    for (let j = amb.k; j < amb.route.length - 1; j++) {
      const from = amb.route[j], to = amb.route[j + 1], d = dirBetween(from, to);
      const traffic = approachTraffic(this, ...from, d);
      queueVehicles += traffic.vehicles;
      const id = nodeIndex(...to);
      if (NODE_DEGREES[id] < 3) continue;
      const cross = crossingTraffic(this, ...to, d);
      maxCross = Math.max(maxCross, cross.vehicles);
      if (firstSignal === null) firstSignal = id;
      if (cross.vehicles <= policy.crossLimit || (this.urgency === "critical" && !rerouted)) this.clearanceNodes.add(id);
      if (++reviewed >= PREFLUSH_AHEAD) break;
    }
    const canClearNext = firstSignal === null || this.clearanceNodes.has(firstSignal);
    const selected = rerouted ? alternative : current;
    const rounded = (value) => Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
    let action = rerouted ? "reroute" : canClearNext ? "clear" : "wait";
    let reason;
    if (rerouted) reason = blocked
      ? "A road ahead is closed. The new open route starts after this road; ambulance position and elapsed time are preserved."
      : `A lower-impact route improves the combined arrival/traffic score by ${Math.round(saving)}; avoids holding busy queues. ${this.urgency} urgency limits detour time to +${Math.round((policy.maxDetourRatio - 1) * 100)}%.`;
    else if (!candidate.length && blocked) { action = "wait"; reason = "No open route reaches the destination. Hold before the blocked road and review again in one simulation second."; }
    else if (canClearNext) reason = this.urgency === "critical" && maxCross > policy.crossLimit
      ? `Critical urgency: no worthwhile detour within +12% estimated time. Clear the approach despite ${maxCross} crossing vehicles.`
      : `Low-impact clearance: up to ${maxCross} crossing vehicles at the next junctions (limit ${policy.crossLimit}). Stop crossing traffic locally and ask cars ahead to yield.`;
    else reason = `Busy crossing (${maxCross} vehicles; clearance limit ${policy.crossLimit}). Keep its normal signals; no sufficiently better detour is available within the ${this.urgency} time allowance.`;
    this.recordDecision({ ...base, action, reason, queueVehicles, crossTrafficVehicles: maxCross,
      etaSeconds: rounded(selected.seconds), alternativeEtaSeconds: rounded(alternative.seconds), reroutes: this.rerouteCount });
  }

  recordDecision(decision) {
    const previous = this.decision;
    this.decision = decision;
    const changed = !previous || decision.action !== previous.action || decision.location !== previous.location || decision.reroutes !== previous.reroutes || decision.urgency !== previous.urgency;
    if (!changed) return;
    this.decisionHistory.push({ ...decision });
    if (this.decisionHistory.length > 120) this.decisionHistory.shift();
    if (decision.action === "reroute") this.log("wave", `Adaptive reroute at ${decision.location} · ${decision.reason}`);
    else if (["clear", "wait"].includes(decision.action) && previous?.action !== decision.action) this.log("info", `${decision.action === "clear" ? "Local clearance" : "Respect traffic cycle"} at ${decision.location} · ${decision.reason}`);
  }

  step(rawDt) {
    const dt = Math.min(rawDt, 0.05);
    if (dt <= 0) return;
    this.time += dt;

    // Advance continuous 24-hour clock (~1 sim hour per 25s real time)
    if (!this.timePaused) {
      this.hour = (this.hour + dt * this.timeSpeed) % 24;
    }

    // Process random unpredictable traffic surges
    if (!this.controlled && this.unpredictableSurge) {
      this.surgeTimer -= dt;
      if (this.surgeTimer <= 0) {
        this.unpredictableSurge = false;
        this.log("info", "Unpredicted flash surge cleared · traffic returning to normal diurnal flow");
      }
    } else if (!this.controlled) {
      this.nextSurgeIn -= dt;
      if (this.nextSurgeIn <= 0) {
        this.triggerRandomSurge();
      }
    }

    // Dynamically adjust vehicle target count to natural diurnal cycle
    this.targetCount = this.fixedDemand ?? this.getNaturalDemand(this.hour);

    this.fillBuckets();
    this.refreshTrafficState();
    this.reviewAmbulancePolicy();
    this.updateOverrides();
    const yieldIds = this.computeYielders();

    let speedSum = 0;
    let stopped = 0;
    let hazardSlowdowns = 0;
    let busStopsActive = 0;
    const fleetCounts = { bus: 0, truck: 0, auto: 0, bike: 0, suv: 0, car: 0 };
    const pcuLoad = { bus: 0, truck: 0, auto: 0, bike: 0, suv: 0, car: 0 };
    let totalPcuLoad = 0;

    const survivors = [];

    for (const v of this.vehicles) {
      this.updateVehicle(v, dt, yieldIds.has(v.id));
      if (v.dying) {
        v.scale -= dt * 2.5;
        if (v.scale <= 0) continue;
      } else if (v.scale < 1) {
        v.scale = Math.min(1, v.scale + dt * 2);
      }
      speedSum += v.speed;
      if (v.speed < 0.7) stopped++;
      if (v.hazardSlowed) hazardSlowdowns++;
      if (v.busStopTimer > 0) busStopsActive++;

      fleetCounts[v.type]++;
      const slowFactor = 1 + Math.max(0, (v.maxSpeed - v.speed) / Math.max(1, v.maxSpeed));
      const load = v.spec.pcu * slowFactor;
      pcuLoad[v.type] += load;
      totalPcuLoad += load;

      survivors.push(v);
    }
    this.vehicles = survivors;

    this.balancePopulation();
    if (this.ambulance) this.updateAmbulance(dt);

    const n = Math.max(1, this.vehicles.length);
    this.stats.count = this.vehicles.length;
    this.stats.avgKmh = Math.round((speedSum / n) * SPEED_TO_KMH);
    this.stats.stopped = stopped;
    this.stats.hazardSlowdowns = hazardSlowdowns;
    this.stats.busStopsActive = busStopsActive;
    this.stats.fleetCounts = fleetCounts;

    const share = {};
    for (const t of VEHICLE_TYPES) {
      share[t] = totalPcuLoad > 0 ? Math.round((pcuLoad[t] / totalPcuLoad) * 100) : 0;
    }
    this.stats.fleetShare = share;

    const hazardPenalty = Math.min(18, Math.round((hazardSlowdowns / n) * 45));
    this.stats.congestion = Math.min(
      99,
      Math.round((stopped / n) * 65 + (this.vehicles.length / RUSH_COUNT) * 28 + hazardPenalty)
    );
    this.stats.forced = this.overrides.size;
  }

  updateOverrides() {
    this.overrides.clear();
    const forced = [];
    const amb = this.ambulance && !this.ambulance.arrived ? this.ambulance : null;
    const route = amb ? amb.route : this.route;

    let from = -1;
    let to = -1;
    if (this.ambulanceHold) {
      from = -1;
    } else if (this.manualOverride) {
      from = amb ? amb.k + 1 : 1;
      to = route.length - 1;
    } else if (amb && this.greenWaveAI) {
      from = amb.k + 1;
      to = route.length - 1;
    }
    for (let j = Math.max(1, from); j <= to && from > 0; j++) {
      const index = nodeIndex(route[j][0], route[j][1]);
      if (NODE_DEGREES[index] < 3) continue;
      if (!this.manualOverride && !this.clearanceNodes.has(index)) continue;
      const axis = axisOfDir(dirBetween(route[j - 1], route[j]));
      this.overrides.set(index, axis);
      forced.push(route[j]);
      if (!this.manualOverride && forced.length >= PREFLUSH_AHEAD) break;
    }

    const now = new Set(forced.map(([x, z]) => nodeIndex(x, z)));
    if (amb && this.prevForced) {
      for (const idx of now) {
        if (!this.prevForced.has(idx)) {
          this.log("wave", `Pre-flush → ${intersectionName(idx % GRID, Math.floor(idx / GRID))} forced GREEN`);
        }
      }
    }
    this.prevForced = now;
    this.forcedNodes = forced;
  }

  fillBuckets() {
    for (const b of this.buckets) b.length = 0;
    for (const v of this.vehicles) this.buckets[segKey(v.ix, v.iz, v.d)].push(v);
    for (const b of this.buckets) if (b.length > 1) b.sort((a, c) => c.t - a.t);
  }

  computeYielders() {
    const ids = new Set();
    const amb = this.ambulance;
    if (!amb || amb.arrived || !this.corridorActive()) return ids;
    let distBase = -amb.t;
    for (let j = amb.k; j < amb.route.length - 1 && distBase < YIELD_ZONE; j++) {
      const a = amb.route[j];
      const d = dirBetween(a, amb.route[j + 1]);
      for (const v of this.buckets[segKey(a[0], a[1], d)]) {
        const ahead = distBase + v.t;
        if (ahead > -2.0 && ahead < YIELD_ZONE) ids.add(v.id);
      }
      distBase += roadLength(a[0], a[1], d);
    }
    return ids;
  }

  leaderGap(v) {
    const bucket = this.buckets[segKey(v.ix, v.iz, v.d)];
    const i = bucket.indexOf(v);
    if (i > 0) {
      const leader = bucket[i - 1];
      const combinedHalf = (leader.spec.length + v.spec.length) * 0.5 + 0.45;
      if (v.type === "bike" && Math.abs(leader.lateral - v.lateral) > 0.4) {
        return leader.t - v.t - 0.5;
      }
      return leader.t - v.t - combinedHalf;
    }
    const nx = v.ix + DIRS[v.d][0];
    const nz = v.iz + DIRS[v.d][1];

    if (v.nextD == null) return stopDistance(roadLength(v.ix, v.iz, v.d)) - v.t;
    if (!inGrid(nx + DIRS[v.nextD][0], nz + DIRS[v.nextD][1])) return Infinity;
    const next = this.buckets[segKey(nx, nz, v.nextD)];
    if (!next.length) return Infinity;
    const tail = next[next.length - 1];
    const combinedHalf = (tail.spec.length + v.spec.length) * 0.5 + 0.45;
    return roadLength(v.ix, v.iz, v.d) - v.t + tail.t - combinedHalf;
  }

  nextTail(v) {
    if (v.nextD == null) return 0;
    const nx = v.ix + DIRS[v.d][0];
    const nz = v.iz + DIRS[v.d][1];
    const next = this.buckets[segKey(nx, nz, v.nextD)];
    if (!next.length) return Infinity;
    const tail = next[next.length - 1];
    return tail.t - tail.spec.length * 0.5;
  }

  // ───────────────────── Vehicle Motion with Strict Red-Light Enforcement ─────────────────────
  updateVehicle(v, dt, yielding) {
    v.yielding = yielding;
    v.hazardSlowed = false;
    v.yOffset = 0;
    v.pitch = 0;

    const spec = v.spec;
    const nx = v.ix + DIRS[v.d][0];
    const nz = v.iz + DIRS[v.d][1];
    if (v.nextD == null || !this.edgeOpen(nx, nz, v.nextD)) v.nextD = this.chooseNext(nx, nz, v.d);
    const length = roadLength(v.ix, v.iz, v.d);
    const stopT = stopDistance(length);

    if (!this.controlled && v.type === "bus" && !yielding) {
      if (v.busStopTimer > 0) {
        v.busStopTimer = Math.max(0, v.busStopTimer - dt);
      } else if (v.t > 2.5 && v.t < 5.0 && this.rand() < 0.0018) {
        v.busStopTimer = 1.8 + this.rand() * 1.4;
      }
    } else {
      v.busStopTimer = 0;
    }

    let gap = this.leaderGap(v);

    // 🚦 STRICT RED LIGHT ENFORCEMENT:
    // Vehicles must never enter the intersection box when signal is red
    const isSignalOpen = v.nextD != null && this.canGo(nx, nz, axisOfDir(v.d));
    const distToStop = stopT - v.t;

    if (!isSignalOpen) {
      if (distToStop > 0.08) {
        const signalBrakingSpeed = Math.min(v.maxSpeed, Math.max(0, distToStop * 1.65));
        gap = Math.min(gap, distToStop);
        if (signalBrakingSpeed < v.speed) {
          v.speed = Math.max(signalBrakingSpeed, v.speed - spec.decel * 1.2 * dt);
        }
      } else if (distToStop > -0.2) {
        gap = 0;
        v.speed = 0;
        v.t = stopT; // Clamp hard behind stop line
      }
    } else {
      const boxBlocked = this.nextTail(v) < v.spec.length * 0.6 + 0.5;
      if (boxBlocked && distToStop > 0) {
        gap = Math.min(gap, distToStop);
      }
    }

    let target = Math.max(0, Math.min(v.maxSpeed, gap * 1.65));
    if (v.busStopTimer > 0) target = 0;

    // Evaluate Speed Bumpers & Potholes
    let swerveOffset = 0;
    const segHazards = ROAD_HAZARDS.hazardsBySeg.get(segKey(v.ix, v.iz, v.d));
    if (segHazards) {
      for (const h of segHazards) {
        const dist = h.t - v.t;
        if (h.type === "bumper") {
          if (dist > -0.5 && dist < 2.2) {
            target = Math.min(target, spec.bumperSpeed);
            v.hazardSlowed = true;
          }
          if (Math.abs(dist) < 0.55) {
            const phase = ((0.55 - Math.abs(dist)) / 0.55) * Math.PI;
            v.yOffset = Math.max(v.yOffset, Math.sin(phase) * 0.15);
            v.pitch = Math.sin((dist / 0.55) * Math.PI) * 0.08;
          }
        } else if (h.type === "pothole") {
          if (dist > -0.5 && dist < 2.4) {
            target = Math.min(target, spec.potholeSpeed);
            v.hazardSlowed = true;
            const dirSign = v.baseLateral >= h.lat ? 1 : -1;
            swerveOffset = dirSign * spec.swerveAmp * Math.exp(-Math.abs(dist) * 0.65);
          }
          if (Math.abs(dist) < 0.48 && Math.abs(v.lateral - h.lat) < h.radius + 0.3) {
            v.yOffset = -0.09;
            v.pitch = -0.06;
          }
        }
      }
    }

    if (yielding) target = Math.min(target, 1.3);

    if (target > v.speed) v.speed = Math.min(target, v.speed + spec.accel * dt);
    else v.speed = Math.max(target, v.speed - spec.decel * dt);

    const move = Math.max(0, Math.min(v.speed * dt, gap + 0.05));
    v.t += move;

    if (!isSignalOpen && v.t >= stopT && distToStop >= -0.2) {
      v.t = stopT;
      v.speed = 0;
    }

    if (v.t >= length) {
      v.t -= length;
      v.ix = nx;
      v.iz = nz;
      v.d = v.nextD;
      v.nextD = this.chooseNext(nx + DIRS[v.d][0], nz + DIRS[v.d][1], v.d);
    }

    const weave =
      spec.weaveAmp > 0 && v.speed > 1.2
        ? Math.sin(this.time * 2.8 + v.weavePhase) * spec.weaveAmp
        : 0;
    const busPull = v.busStopTimer > 0 ? 0.4 : 0;
    const targetLat = yielding ? SHOULDER : v.baseLateral + weave + swerveOffset + busPull;
    const latSpeed = yielding ? dt * 5.2 : dt * 3.6;
    v.lateral += Math.sign(targetLat - v.lateral) * Math.min(Math.abs(targetLat - v.lateral), latSpeed);

    const pose = directedRoadSample(v.ix, v.iz, v.d, v.t, v.lateral, this.roadPose);
    v.x = pose.x;
    v.z = pose.z;
    v.heading += shortestAngle(v.heading, pose.heading) * Math.min(1, dt * 12);
  }

  balancePopulation() {
    const alive = this.vehicles.filter((v) => !v.dying).length;
    if (alive < this.targetCount && this.vehicles.length < MAX_VEHICLES) {
      for (let i = 0; i < 6 && alive + i < this.targetCount; i++) this.spawnVehicle(false);
    } else if (alive > this.targetCount) {
      let excess = Math.min(6, alive - this.targetCount);
      for (let i = this.vehicles.length - 1; i >= 0 && excess > 0; i--) {
        if (!this.vehicles[i].dying) {
          this.vehicles[i].dying = true;
          excess--;
        }
      }
    }
  }

  updateAmbulance(dt) {
    const amb = this.ambulance;
    if (amb.arrived) {
      amb.arrivedTimer += dt;
      if (amb.arrivedTimer > 4) this.ambulance = null;
      return;
    }
    amb.elapsed += dt;
    // A planning hold fixes the ambulance at its current road position. Letting
    // it coast across a junction would invalidate a route planned from its next
    // node while the trainee is still deciding. Waiting time remains measured.
    if (this.ambulanceHold) {
      amb.speed = 0;
      return;
    }

    // Triage & patient stabilization while on scene
    if (amb.phase === "ON_SCENE") {
      amb.speed = 0;
      amb.onSceneTimer -= dt;
      if (amb.onSceneTimer <= 0) {
        amb.phase = "INBOUND";
        amb.hasPatient = true;
        const returnPath = adaptiveRoute(this, amb.destinationNode, HOSPITAL.node) || amb.returnRoute;
        if (returnPath && returnPath.length >= 2) {
          amb.route = expandWaypoints(returnPath);
          amb.k = 0;
          amb.t = 0;
          this.setRoute(amb.route);
          const [cx, cz] = amb.route[0];
          const d = dirBetween(amb.route[0], amb.route[1]);
          const startPose = directedRoadSample(cx, cz, d, 0, LANE, this.roadPose);
          amb.x = startPose.x;
          amb.z = startPose.z;
          amb.heading = startPose.heading;
          amb.trail = [];
          this.clearanceNodes.clear();
          this.lastPolicyEdge = "";
          this.nextPolicyReviewAt = this.time;
          this.log("wave", `🚑 Patient secured on board! AMB-07 returning to St. Aurora Hospital ER (${amb.route.length} junctions)`);
        } else {
          amb.arrived = true;
          this.log("warn", "No return corridor available; staying on scene.");
        }
      }
      return;
    }

    const corridor = this.corridorActive();
    const a = amb.route[amb.k];
    const b = amb.route[amb.k + 1];
    const d = dirBetween(a, b);
    const isLast = amb.k === amb.route.length - 2;
    const length = roadLength(a[0], a[1], d);
    const stopT = stopDistance(length);

    const targetLat = corridor ? 0.2 : LANE;
    let gap = Infinity;
    const lanes = [this.buckets[segKey(a[0], a[1], d)]];
    if (!isLast) {
      const d2 = dirBetween(b, amb.route[amb.k + 2]);
      lanes.push(this.buckets[segKey(b[0], b[1], d2)]);
    }
    lanes.forEach((bucket, li) => {
      for (const v of bucket) {
        const ahead = (li === 0 ? 0 : length) + v.t - amb.t;
        if (ahead <= 0.2) continue;
        if (Math.abs(v.lateral - amb.lateral) < 0.95) gap = Math.min(gap, ahead - (v.spec.length * 0.5 + 1.6));
      }
    });

    if (amb.t <= stopT + 0.05 && !this.canGo(b[0], b[1], axisOfDir(d))) {
      gap = Math.min(gap, stopT - amb.t);
    }
    // Never enter a closed next edge, including when no detour exists.
    if (!isLast && !this.edgeOpen(...b, dirBetween(b, amb.route[amb.k + 2]))) gap = Math.min(gap, stopT - amb.t);
    if (isLast) gap = Math.min(gap, length - 1.5 - amb.t);

    const maxSpeed = this.ambulanceMaxSpeed ?? (corridor ? AMB_SPEED_CORRIDOR : AMB_SPEED_NORMAL);
    const target = Math.max(0, Math.min(maxSpeed, gap * 2));
    if (target > amb.speed) amb.speed = Math.min(target, amb.speed + 9.5 * dt);
    else amb.speed = Math.max(target, amb.speed - 30 * dt);
    amb.t += Math.max(0, Math.min(amb.speed * dt, gap + 0.05));

    if (isLast && amb.t >= length - 1.6) {
      if (amb.phase === "OUTBOUND") {
        amb.phase = "ON_SCENE";
        amb.speed = 0;
        amb.onSceneTimer = 2.5;
        amb.outboundElapsed = amb.elapsed;
        this.log("info", `📍 AMB-07 arrived on-scene at ${amb.destinationName} · Securing patient & preparing transport`);
      } else {
        amb.phase = "COMPLETED";
        amb.arrived = true;
        amb.speed = 0;
        amb.inboundElapsed = Math.max(0, amb.elapsed - (amb.outboundElapsed || 0) - 2.5);
        const eta = etaMinutes(amb.route, Math.max(this.stats.congestion, 60));
        this.lastTrip = {
          seconds: amb.elapsed,
          outboundSeconds: amb.outboundElapsed || amb.elapsed,
          inboundSeconds: amb.inboundElapsed,
          corridor,
          eta,
          route: amb.route,
          destinationName: amb.destinationName,
        };
        this.log("success", `🏥 AMB-07 safely reached St. Aurora Medical ER · Round-trip mission complete in ${amb.elapsed.toFixed(1)}s`);
      }
    } else if (amb.t >= length) {
      amb.t -= length;
      amb.k++;
    }

    amb.lateral += Math.sign(targetLat - amb.lateral) * Math.min(Math.abs(targetLat - amb.lateral), dt * 2.8);

    const seg = Math.min(amb.k, amb.route.length - 2);
    const p = amb.route[seg];
    const dd = dirBetween(p, amb.route[seg + 1]);
    const t = Math.min(amb.t, roadLength(p[0], p[1], dd));
    const pose = directedRoadSample(p[0], p[1], dd, t, amb.lateral, this.roadPose);
    amb.x = pose.x;
    amb.z = pose.z;
    amb.heading += shortestAngle(amb.heading, pose.heading) * Math.min(1, dt * 10);

    amb.trail.push(amb.x, amb.z);
    if (amb.trail.length > 160) amb.trail.splice(0, 2);
  }

  snapshot() {
    const amb = this.ambulance;
    let ambulance = null;
    if (amb) {
      const segs = amb.route.length - 1;
      let routeLength = 0, passedLength = 0;
      for (let i = 0; i < segs; i++) {
        const a = amb.route[i], b = amb.route[i + 1];
        const length = roadLength(a[0], a[1], dirBetween(a, b));
        routeLength += length;
        if (i < amb.k) passedLength += length;
      }
      const a = amb.route[amb.k], b = amb.route[amb.k + 1];
      const length = roadLength(a[0], a[1], dirBetween(a, b));
      const progress = amb.arrived ? 1 : Math.min(1, (passedLength + Math.min(amb.t, length)) / Math.max(0.01, routeLength));
      const here = amb.route[Math.min(amb.k + (amb.t > length / 2 ? 1 : 0), amb.route.length - 1)];

      const phase = amb.phase || (amb.arrived ? "COMPLETED" : "OUTBOUND");
      let status = "RESPONDING";
      if (amb.arrived || phase === "COMPLETED") status = "ARRIVED";
      else if (phase === "ON_SCENE") status = "ON SCENE";
      else if (phase === "INBOUND") status = "RETURNING";
      else if (amb.speed < 0.8) status = "HELD";

      ambulance = {
        status,
        phase,
        destinationName: amb.destinationName || "Emergency Scene",
        destinationNode: amb.destinationNode,
        hasPatient: !!amb.hasPatient,
        onSceneTimer: Math.max(0, amb.onSceneTimer || 0),
        progress,
        cleared: amb.k,
        total: segs,
        elapsed: amb.elapsed,
        kmh: Math.round(amb.speed * SPEED_TO_KMH),
        location: intersectionName(here[0], here[1]),
        x: amb.x,
        z: amb.z,
        heading: amb.heading,
      };
    }
    return {
      stats: {
        ...this.stats,
        fleetCounts: { ...this.stats.fleetCounts },
        fleetShare: { ...this.stats.fleetShare },
      },
      ambulance,
      lastTrip: this.lastTrip,
      activeBase: this.activeBase,
      activeDestination: this.activeDestination,
      pinnedDestination: this.pinnedDestination || this.activeDestination,
      spawnPoint: { name: HOSPITAL.name, node: HOSPITAL.node },
      closures: Array.from(this.closures.values()),
      closedKeys: Array.from(this.closedSegments),
      potholes: this.potholes.filter((p) => p.active !== false).slice(0, 150),
      totalActivePotholes: this.potholes.filter((p) => p.active !== false).length,
      repairedPotholesCount: this.repairedPotholesCount,
      rushHour: this.rushHour,
      greenWaveAI: this.greenWaveAI,
      manualOverride: this.manualOverride,
      showHazards: this.showHazards,
      showTrafficFilter: this.showTrafficFilter,
      show2DMinimap: this.show2DMinimap,
      corridorActive: this.corridorActive(),
      hour: this.hour,
      formattedTime: this.getFormattedTime(),
      timePaused: this.timePaused,
      unpredictableSurge: this.unpredictableSurge,
      surgeRemaining: Math.max(0, Math.ceil(this.surgeTimer)),
      routeVersion: this.routeVersion,
      urgency: this.urgency,
      decision: { ...this.decision },
      time: this.time,
      trafficVersion: this.trafficVersion,
      route: this.route,
      events: this.events.slice(0, 7),
    };
  }
}
