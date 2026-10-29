// Framework-agnostic traffic simulation. The React Three Fiber scene calls `step(dt)`
// every frame and reads vehicle poses straight from this object (no React state per frame).

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
  etaMinutes,
} from "./cityGrid";

export const MAX_VEHICLES = 380;
export const NORMAL_COUNT = 165;
export const RUSH_COUNT = 330;

const STOP_T = SPACING - ROAD_W / 2 - 0.55; // stop line before the junction box
const MIN_GAP = 2.5;
const SHOULDER = LANE + 1.05; // lateral offset of a car that pulled over
const GREEN = 6.5;
const YELLOW = 1.5;
const CYCLE = 2 * (GREEN + YELLOW);
const AMB_SPEED_CORRIDOR = 15;
const AMB_SPEED_NORMAL = 10;
const PREFLUSH_AHEAD = 3;
const YIELD_ZONE = 24;
export const SPEED_TO_KMH = 5.5;

const CAR_COLORS = ["#f8fafc", "#e2e8f0", "#38bdf8", "#60a5fa", "#93c5fd", "#cbd5e1", "#3b82f6"];

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

const segKey = (ix, iz, d) => nodeIndex(ix, iz) * 4 + d;

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
    this.vehicles = [];
    this.nextId = 1;
    this.targetCount = NORMAL_COUNT;
    this.rushHour = false;
    this.greenWaveAI = true;
    this.manualOverride = false;
    this.route = DEFAULT_ROUTE;
    this.routeVersion = 1;
    this.ambulance = null;
    this.lastTrip = null;
    this.overrides = new Map(); // node index -> axis forced green
    this.forcedNodes = []; // [[ix, iz], …] for rendering
    this.events = [];
    this.eventId = 1;
    this.lightOffsets = Array.from({ length: GRID * GRID }, () => this.rand());
    this.buckets = Array.from({ length: GRID * GRID * 4 }, () => []);
    this.stats = { count: 0, avgKmh: 0, stopped: 0, congestion: 0, forced: 0 };

    for (let i = 0; i < this.targetCount; i++) this.spawnVehicle(true);
    this.log("info", "Digital twin online · 49 smart junctions synchronised");
  }

  // ───────────────────────────── events ─────────────────────────────
  log(type, msg) {
    this.events.unshift({ id: this.eventId++, type, msg, at: new Date() });
    if (this.events.length > 40) this.events.length = 40;
  }

  // ───────────────────────────── controls ───────────────────────────
  setRoute(route) {
    this.route = route;
    this.routeVersion++;
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
    this.log("alert", `${label} · unit AMB-07 rolling from ${intersectionName(sx, sz)}`);
    return this.ambulance;
  }

  setRushHour(on) {
    this.rushHour = on;
    this.targetCount = on ? RUSH_COUNT : NORMAL_COUNT;
    this.log(on ? "warn" : "info", on ? "Rush-hour surge injected · demand ×2" : "Rush-hour surge cleared · demand normalising");
  }

  setManualOverride(on) {
    this.manualOverride = on;
    this.log(on ? "wave" : "info", on ? "MANUAL GREEN WAVE OVERRIDE · full corridor forced green" : "Manual override released · adaptive timing restored");
  }

  setGreenWaveAI(on) {
    this.greenWaveAI = on;
    this.log(on ? "wave" : "warn", on ? "GreenWave AI pre-flush armed (3 junctions ahead)" : "GreenWave AI disarmed · ambulance obeys standard signals");
  }

  corridorActive() {
    return this.manualOverride || (this.greenWaveAI && !!this.ambulance && !this.ambulance.arrived);
  }

  // ───────────────────────────── vehicles ───────────────────────────
  validDirs(ix, iz) {
    const out = [];
    for (let d = 0; d < 4; d++) if (inGrid(ix + DIRS[d][0], iz + DIRS[d][1])) out.push(d);
    return out;
  }

  chooseNext(ix, iz, fromD) {
    const options = this.validDirs(ix, iz).filter((d) => d !== OPPOSITE[fromD]);
    if (!options.length) return OPPOSITE[fromD];
    if (options.includes(fromD) && this.rand() < 0.62) return fromD;
    return options[Math.floor(this.rand() * options.length)];
  }

  spawnVehicle(initial = false) {
    for (let attempt = 0; attempt < 12; attempt++) {
      const ix = Math.floor(this.rand() * GRID);
      const iz = Math.floor(this.rand() * GRID);
      const dirs = this.validDirs(ix, iz);
      const d = dirs[Math.floor(this.rand() * dirs.length)];
      const t = 0.5 + this.rand() * (STOP_T - 1.5);
      const clash = this.vehicles.some((v) => v.ix === ix && v.iz === iz && v.d === d && Math.abs(v.t - t) < MIN_GAP + 0.6);
      if (clash) continue;
      const nx = ix + DIRS[d][0];
      const nz = iz + DIRS[d][1];
      const maxSpeed = (this.rushHour ? 4.5 : 6.5) + this.rand() * 2.8;
      this.vehicles.push({
        id: this.nextId++,
        ix,
        iz,
        d,
        t,
        nextD: this.chooseNext(nx, nz, d),
        speed: initial ? maxSpeed * 0.6 : 0,
        maxSpeed,
        lateral: LANE,
        heading: Math.atan2(-DIRS[d][1], DIRS[d][0]),
        color: CAR_COLORS[Math.floor(this.rand() * CAR_COLORS.length)],
        scale: initial ? 1 : 0.01,
        dying: false,
        yielding: false,
        x: 0,
        z: 0,
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

  // ───────────────────────────── main loop ──────────────────────────
  step(rawDt) {
    const dt = Math.min(rawDt, 0.05);
    if (dt <= 0) return;
    this.time += dt;

    this.updateOverrides();
    this.fillBuckets();
    const yieldIds = this.computeYielders();

    let speedSum = 0;
    let stopped = 0;
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
      if (v.speed < 0.6) stopped++;
      survivors.push(v);
    }
    this.vehicles = survivors;

    this.balancePopulation();
    if (this.ambulance) this.updateAmbulance(dt);

    const n = Math.max(1, this.vehicles.length);
    this.stats.count = this.vehicles.length;
    this.stats.avgKmh = Math.round((speedSum / n) * SPEED_TO_KMH);
    this.stats.stopped = stopped;
    this.stats.congestion = Math.min(99, Math.round((stopped / n) * 75 + (this.vehicles.length / RUSH_COUNT) * 30));
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

    // log newly pre-flushed junctions
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
        if (ahead > -1.5 && ahead < YIELD_ZONE) ids.add(v.id);
      }
      distBase += SPACING;
    }
    return ids;
  }

  leaderGap(v) {
    const bucket = this.buckets[segKey(v.ix, v.iz, v.d)];
    const i = bucket.indexOf(v);
    if (i > 0) return bucket[i - 1].t - v.t;
    const nx = v.ix + DIRS[v.d][0];
    const nz = v.iz + DIRS[v.d][1];
    if (!inGrid(nx + DIRS[v.nextD][0], nz + DIRS[v.nextD][1])) return Infinity;
    const next = this.buckets[segKey(nx, nz, v.nextD)];
    if (!next.length) return Infinity;
    return SPACING - v.t + next[next.length - 1].t;
  }

  nextTail(v) {
    const nx = v.ix + DIRS[v.d][0];
    const nz = v.iz + DIRS[v.d][1];
    const next = this.buckets[segKey(nx, nz, v.nextD)];
    return next.length ? next[next.length - 1].t : Infinity;
  }

  updateVehicle(v, dt, yielding) {
    v.yielding = yielding;
    const nx = v.ix + DIRS[v.d][0];
    const nz = v.iz + DIRS[v.d][1];

    let gap = this.leaderGap(v) - MIN_GAP;
    if (v.t <= STOP_T + 0.05) {
      const red = !this.canGo(nx, nz, axisOfDir(v.d));
      const boxBlocked = this.nextTail(v) < MIN_GAP + 0.4;
      if (red || boxBlocked) gap = Math.min(gap, STOP_T - v.t);
    }

    let target = Math.max(0, Math.min(v.maxSpeed, gap * 1.7));
    if (yielding) target = Math.min(target, 1.4);
    if (target > v.speed) v.speed = Math.min(target, v.speed + 7 * dt);
    else v.speed = Math.max(target, v.speed - 28 * dt);

    const move = Math.max(0, Math.min(v.speed * dt, gap + 0.05));
    v.t += move;

    if (v.t >= SPACING) {
      v.t -= SPACING;
      v.ix = nx;
      v.iz = nz;
      v.d = v.nextD;
      v.nextD = this.chooseNext(nx + DIRS[v.d][0], nz + DIRS[v.d][1], v.d);
    }

    const targetLat = yielding ? SHOULDER : LANE;
    v.lateral += Math.sign(targetLat - v.lateral) * Math.min(Math.abs(targetLat - v.lateral), dt * 3.2);

    const [fx, fz] = DIRS[v.d];
    v.x = coord(v.ix) + fx * v.t - fz * v.lateral;
    v.z = coord(v.iz) + fz * v.t + fx * v.lateral;
    const targetHeading = Math.atan2(-fz, fx);
    v.heading += shortestAngle(v.heading, targetHeading) * Math.min(1, dt * 12);
  }

  balancePopulation() {
    const alive = this.vehicles.filter((v) => !v.dying).length;
    if (alive < this.targetCount && this.vehicles.length < MAX_VEHICLES) {
      for (let i = 0; i < 3 && alive + i < this.targetCount; i++) this.spawnVehicle(false);
    } else if (alive > this.targetCount) {
      let excess = Math.min(3, alive - this.targetCount);
      for (let i = this.vehicles.length - 1; i >= 0 && excess > 0; i--) {
        if (!this.vehicles[i].dying) {
          this.vehicles[i].dying = true;
          excess--;
        }
      }
    }
  }

  // ───────────────────────────── ambulance ──────────────────────────
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

    // obstacles: regular cars in the same lane-band ahead of the ambulance
    const targetLat = corridor ? 0.25 : LANE;
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
        if (Math.abs(v.lateral - amb.lateral) < 0.95) gap = Math.min(gap, ahead - 2.6);
      }
    });

    if (!corridor && amb.t <= STOP_T + 0.05 && !this.canGo(b[0], b[1], axisOfDir(d))) {
      gap = Math.min(gap, STOP_T - amb.t);
    }
    if (isLast) gap = Math.min(gap, SPACING - 1.5 - amb.t);

    const maxSpeed = corridor ? AMB_SPEED_CORRIDOR : AMB_SPEED_NORMAL;
    const target = Math.max(0, Math.min(maxSpeed, gap * 2));
    if (target > amb.speed) amb.speed = Math.min(target, amb.speed + 9 * dt);
    else amb.speed = Math.max(target, amb.speed - 30 * dt);
    amb.t += Math.max(0, Math.min(amb.speed * dt, gap + 0.05));

    if (isLast && amb.t >= SPACING - 1.6) {
      amb.arrived = true;
      amb.speed = 0;
      const eta = etaMinutes(amb.route, Math.max(this.stats.congestion, 60));
      this.lastTrip = { seconds: amb.elapsed, corridor, eta, route: amb.route };
      this.log("success", `AMB-07 arrived at St. Aurora Medical · ${amb.elapsed.toFixed(1)}s sim transit`);
    } else if (amb.t >= SPACING) {
      amb.t -= SPACING;
      amb.k++;
    }

    amb.lateral += Math.sign(targetLat - amb.lateral) * Math.min(Math.abs(targetLat - amb.lateral), dt * 2.5);

    const seg = Math.min(amb.k, amb.route.length - 2);
    const p = amb.route[seg];
    const dd = dirBetween(p, amb.route[seg + 1]);
    const [fx, fz] = DIRS[dd];
    const t = Math.min(amb.t, SPACING);
    amb.x = coord(p[0]) + fx * t - fz * amb.lateral;
    amb.z = coord(p[1]) + fz * t + fx * amb.lateral;
    amb.heading += shortestAngle(amb.heading, Math.atan2(-fz, fx)) * Math.min(1, dt * 10);

    amb.trail.push(amb.x, amb.z);
    if (amb.trail.length > 120) amb.trail.splice(0, 2);
  }

  // ───────────────────────────── snapshot for the HUD ───────────────
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
      };
    }
    return {
      stats: { ...this.stats },
      ambulance,
      lastTrip: this.lastTrip,
      rushHour: this.rushHour,
      greenWaveAI: this.greenWaveAI,
      manualOverride: this.manualOverride,
      corridorActive: this.corridorActive(),
      routeVersion: this.routeVersion,
      route: this.route,
      events: this.events.slice(0, 7),
    };
  }
}
