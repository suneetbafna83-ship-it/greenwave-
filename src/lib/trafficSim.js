// Multi-modal urban traffic simulation engine for the 100 × 100 cross grid (25 × 25 intersections)
// with live segment congestion categorization, strict red-light enforcement, and dynamic routing.

import {
  GRID,
  SPACING,
  ROAD_W,
  LANE,
  coord,
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
} from "./cityGrid";

export const MAX_VEHICLES = 800;
export const NORMAL_COUNT = 380;
export const RUSH_COUNT = 680;

const STOP_T = SPACING - ROAD_W / 2 - 0.45;
const SHOULDER = LANE + 1.25;
const GREEN = 6.5;
const YELLOW = 1.5;
const CYCLE = 2 * (GREEN + YELLOW);
const AMB_SPEED_CORRIDOR = 18.0;
const AMB_SPEED_NORMAL = 10.5;
const PREFLUSH_AHEAD = 3;
const YIELD_ZONE = 32;
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
  constructor() {
    this.rand = mulberry32(20261029);
    this.time = 0;

    // 24-Hour Continuous Dynamic Time System
    this.hour = 8.5; // Start at 8:30 AM (morning rush hour)
    this.timeSpeed = 0.04; // ~1 hour per 25s real-time, can be scrubbed
    this.timePaused = false;

    // Unpredictable random traffic surges (flash gridlock)
    this.unpredictableSurge = false;
    this.surgeTimer = 0;
    this.nextSurgeIn = 55 + this.rand() * 90; // First random surge in 55-145s

    this.vehicles = [];
    this.nextId = 1;
    this.targetCount = this.getNaturalDemand(this.hour);
    this.rushHour = false;
    this.greenWaveAI = true;
    this.manualOverride = false;
    this.showHazards = true;
    this.showTrafficFilter = true; // Optional Road Congestion Heatmap Filter
    this.show2DMinimap = true; // Optional Floating 2D Radar Map
    this.route = DEFAULT_ROUTE;
    this.routeVersion = 1;
    this.ambulance = null;
    this.lastTrip = null;
    this.activeBase = DISPATCH_BASES[0];
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
    this.log(
      "info",
      `500×500 Cross Digital Twin online · 961 junctions, meandering river, suspension bridges & 24-hr solar engine active`
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

  // Refined Bidirectional & Speed-Aware Road Congestion Status
  // Returns 'green' (free), 'yellow' (busy), or 'red' (gridlocked / broken slum road)
  getRoadStatus(ix, iz, axis) {
    let k1, k2;
    if (axis === 0) {
      // East-West physical road between (ix, iz) and (ix+1, iz)
      k1 = segKey(ix, iz, 0);       // Eastbound
      k2 = segKey(ix + 1, iz, 1);   // Westbound
    } else {
      // North-South physical road between (ix, iz) and (ix, iz+1)
      k1 = segKey(ix, iz, 2);       // Southbound
      k2 = segKey(ix, iz + 1, 3);   // Northbound
    }

    const b1 = this.buckets[k1] || [];
    const b2 = this.buckets[k2] || [];
    const totalVehicles = b1.length + b2.length;

    // Check hazards on both directions
    const h1 = ROAD_HAZARDS.hazardsBySeg.get(k1) || [];
    const h2 = ROAD_HAZARDS.hazardsBySeg.get(k2) || [];
    const hasSlumPotholes = h1.some((h) => h.isSlum) || h2.some((h) => h.isSlum);

    // Calculate vehicle movement state
    let stoppedCount = 0;
    let slowCount = 0;
    for (let i = 0; i < b1.length; i++) {
      if (b1[i].speed < 0.9) stoppedCount++;
      else if (b1[i].speed < 3.2) slowCount++;
    }
    for (let i = 0; i < b2.length; i++) {
      if (b2[i].speed < 0.9) stoppedCount++;
      else if (b2[i].speed < 3.2) slowCount++;
    }

    // Congestion determination:
    // RED (Gridlock / Jam):
    // - 2+ stopped/crawling vehicles
    // - or 4+ vehicles packed on the segment
    // - or 2+ vehicles crawling over severe slum pothole craters
    if (stoppedCount >= 2 || totalVehicles >= 4 || (totalVehicles >= 2 && hasSlumPotholes)) {
      return "red";
    }

    // YELLOW (Busy / Slowing):
    // - 2-3 moving vehicles
    // - or at least 1 stopped/slow vehicle
    // - or 1 vehicle encountering broken road hazards
    if (totalVehicles >= 2 || stoppedCount >= 1 || slowCount >= 1 || (totalVehicles >= 1 && hasSlumPotholes)) {
      return "yellow";
    }

    // GREEN (Free Flowing):
    // - 0 or 1 vehicle moving smoothly with clear road ahead
    return "green";
  }

  // Backwards compatible segment lookup
  getSegmentStatus(ix, iz, d) {
    const axis = axisOfDir(d);
    return this.getRoadStatus(ix, iz, axis);
  }

  dispatchDynamic(originNode = this.activeBase.node, label = "Dynamic AI Corridor Dispatch") {
    const optimalRoute = findOptimalCorridor(originNode, HOSPITAL.node, this.buckets);
    return this.dispatch(optimalRoute, label);
  }

  dispatch(route = this.route, label = "Critical Ambulance Dispatch") {
    this.setRoute(route);
    const [sx, sz] = route[0];
    this.ambulance = {
      route,
      k: 0,
      t: 0,
      speed: 4,
      lateral: LANE,
      heading: Math.atan2(-DIRS[dirBetween(route[0], route[1])][1], DIRS[dirBetween(route[0], route[1])][0]),
      x: coord(sx),
      z: coord(sz),
      elapsed: 0,
      arrived: false,
      arrivedTimer: 0,
      label,
      trail: [],
    };
    this.prevForced = new Set();
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
    this.log(on ? "wave" : "info", on ? "MANUAL GREEN WAVE OVERRIDE · full corridor forced green" : "Manual override released · adaptive timing restored");
  }

  setGreenWaveAI(on) {
    this.greenWaveAI = on;
    this.log(on ? "wave" : "warn", on ? "GreenWave AI pre-flush armed (3 junctions ahead)" : "GreenWave AI disarmed · ambulance obeys standard signals");
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
    return this.manualOverride || (this.greenWaveAI && !!this.ambulance && !this.ambulance.arrived);
  }

  validDirs(ix, iz) {
    const out = [];
    for (let d = 0; d < 4; d++) if (inGrid(ix + DIRS[d][0], iz + DIRS[d][1])) out.push(d);
    return out;
  }

  chooseNext(ix, iz, fromD) {
    const options = this.validDirs(ix, iz).filter((d) => d !== OPPOSITE[fromD]);
    if (!options.length) return OPPOSITE[fromD];
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
    for (let attempt = 0; attempt < 14; attempt++) {
      const ix = Math.floor(this.rand() * GRID);
      const iz = Math.floor(this.rand() * GRID);
      const dirs = this.validDirs(ix, iz);
      const d = dirs[Math.floor(this.rand() * dirs.length)];
      const t = 0.6 + this.rand() * (STOP_T - 1.5);
      const minClearance = spec.length + 0.8;
      const clash = this.vehicles.some(
        (v) => v.ix === ix && v.iz === iz && v.d === d && Math.abs(v.t - t) < minClearance
      );
      if (clash) continue;
      const nx = ix + DIRS[d][0];
      const nz = iz + DIRS[d][1];
      const [minS, maxS] = spec.speedRange;
      const baseSpeed = minS + this.rand() * (maxS - minS);
      const maxSpeed = this.rushHour ? baseSpeed * 0.82 : baseSpeed;
      const baseLateral = LANE + spec.laneBias + (this.rand() - 0.5) * 0.12;
      const [fx, fz] = DIRS[d];
      const x = coord(ix) + fx * t - fz * baseLateral;
      const z = coord(iz) + fz * t + fx * baseLateral;
      this.vehicles.push({
        id: this.nextId++,
        type,
        spec,
        ix,
        iz,
        d,
        t,
        nextD: this.chooseNext(nx, nz, d),
        speed: initial ? maxSpeed * 0.65 : 0,
        maxSpeed,
        baseLateral,
        lateral: baseLateral,
        yOffset: 0,
        pitch: 0,
        heading: Math.atan2(-DIRS[d][1], DIRS[d][0]),
        color: spec.colors[Math.floor(this.rand() * spec.colors.length)],
        scale: initial ? 1 : 0.01,
        dying: false,
        yielding: false,
        hazardSlowed: false,
        busStopTimer: 0,
        weavePhase: this.rand() * Math.PI * 2,
        x,
        z,
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
    const s = this.lightState(nodeIndex(ix, iz));
    return s.axis === axis && !s.yellow;
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
    if (this.unpredictableSurge) {
      this.surgeTimer -= dt;
      if (this.surgeTimer <= 0) {
        this.unpredictableSurge = false;
        this.log("info", "Unpredicted flash surge cleared · traffic returning to normal diurnal flow");
      }
    } else {
      this.nextSurgeIn -= dt;
      if (this.nextSurgeIn <= 0) {
        this.triggerRandomSurge();
      }
    }

    // Dynamically adjust vehicle target count to natural diurnal cycle
    this.targetCount = this.getNaturalDemand(this.hour);

    this.updateOverrides();
    this.fillBuckets();
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
    if (this.manualOverride) {
      from = amb ? amb.k + 1 : 1;
      to = route.length - 1;
    } else if (amb && this.greenWaveAI) {
      from = amb.k + 1;
      to = Math.min(route.length - 1, amb.k + PREFLUSH_AHEAD);
    }
    for (let j = Math.max(1, from); j <= to && from > 0; j++) {
      const axis = axisOfDir(dirBetween(route[j - 1], route[j]));
      this.overrides.set(nodeIndex(route[j][0], route[j][1]), axis);
      forced.push(route[j]);
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
      distBase += SPACING;
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
    if (!inGrid(nx + DIRS[v.nextD][0], nz + DIRS[v.nextD][1])) return Infinity;
    const next = this.buckets[segKey(nx, nz, v.nextD)];
    if (!next.length) return Infinity;
    const tail = next[next.length - 1];
    const combinedHalf = (tail.spec.length + v.spec.length) * 0.5 + 0.45;
    return SPACING - v.t + tail.t - combinedHalf;
  }

  nextTail(v) {
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

    if (v.type === "bus" && !yielding) {
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
    const isSignalOpen = this.canGo(nx, nz, axisOfDir(v.d));
    const distToStop = STOP_T - v.t;

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
        v.t = STOP_T; // Clamp hard behind stop line
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

    if (!isSignalOpen && v.t >= STOP_T && distToStop >= -0.2) {
      v.t = STOP_T;
      v.speed = 0;
    }

    if (v.t >= SPACING) {
      v.t -= SPACING;
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

    const [fx, fz] = DIRS[v.d];
    v.x = coord(v.ix) + fx * v.t - fz * v.lateral;
    v.z = coord(v.iz) + fz * v.t + fx * v.lateral;
    const targetHeading = Math.atan2(-fz, fx);
    v.heading += shortestAngle(v.heading, targetHeading) * Math.min(1, dt * 12);
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

    const corridor = this.corridorActive();
    const a = amb.route[amb.k];
    const b = amb.route[amb.k + 1];
    const d = dirBetween(a, b);
    const isLast = amb.k === amb.route.length - 2;

    const targetLat = corridor ? 0.2 : LANE;
    let gap = Infinity;
    const lanes = [this.buckets[segKey(a[0], a[1], d)]];
    if (!isLast) {
      const d2 = dirBetween(b, amb.route[amb.k + 2]);
      lanes.push(this.buckets[segKey(b[0], b[1], d2)]);
    }
    lanes.forEach((bucket, li) => {
      for (const v of bucket) {
        const ahead = li * SPACING + v.t - amb.t;
        if (ahead <= 0.2) continue;
        if (Math.abs(v.lateral - amb.lateral) < 0.95) gap = Math.min(gap, ahead - (v.spec.length * 0.5 + 1.6));
      }
    });

    if (!corridor && amb.t <= STOP_T + 0.05 && !this.canGo(b[0], b[1], axisOfDir(d))) {
      gap = Math.min(gap, STOP_T - amb.t);
    }
    if (isLast) gap = Math.min(gap, SPACING - 1.5 - amb.t);

    const maxSpeed = corridor ? AMB_SPEED_CORRIDOR : AMB_SPEED_NORMAL;
    const target = Math.max(0, Math.min(maxSpeed, gap * 2));
    if (target > amb.speed) amb.speed = Math.min(target, amb.speed + 9.5 * dt);
    else amb.speed = Math.max(target, amb.speed - 30 * dt);
    amb.t += Math.max(0, Math.min(amb.speed * dt, gap + 0.05));

    if (isLast && amb.t >= SPACING - 1.6) {
      amb.arrived = true;
      amb.speed = 0;
      const eta = etaMinutes(amb.route, Math.max(this.stats.congestion, 60));
      this.lastTrip = { seconds: amb.elapsed, corridor, eta, route: amb.route };
      this.log("success", `AMB-07 reached St. Aurora Medical · ${amb.elapsed.toFixed(1)}s transit · saved ${eta.saved}m`);
    } else if (amb.t >= SPACING) {
      amb.t -= SPACING;
      amb.k++;
    }

    amb.lateral += Math.sign(targetLat - amb.lateral) * Math.min(Math.abs(targetLat - amb.lateral), dt * 2.8);

    const seg = Math.min(amb.k, amb.route.length - 2);
    const p = amb.route[seg];
    const dd = dirBetween(p, amb.route[seg + 1]);
    const [fx, fz] = DIRS[dd];
    const t = Math.min(amb.t, SPACING);
    amb.x = coord(p[0]) + fx * t - fz * amb.lateral;
    amb.z = coord(p[1]) + fz * t + fx * amb.lateral;
    amb.heading += shortestAngle(amb.heading, Math.atan2(-fz, fx)) * Math.min(1, dt * 10);

    amb.trail.push(amb.x, amb.z);
    if (amb.trail.length > 160) amb.trail.splice(0, 2);
  }

  snapshot() {
    const amb = this.ambulance;
    let ambulance = null;
    if (amb) {
      const segs = amb.route.length - 1;
      const progress = Math.min(1, (amb.k + Math.min(amb.t, SPACING) / SPACING) / segs);
      const here = amb.route[Math.min(amb.k + (amb.t > SPACING / 2 ? 1 : 0), amb.route.length - 1)];
      ambulance = {
        status: amb.arrived ? "ARRIVED" : amb.speed < 0.8 ? "HELD" : "EN ROUTE",
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
      route: this.route,
      events: this.events.slice(0, 7),
    };
  }
}
