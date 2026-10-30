import { TrafficSim } from "./trafficSim";
import { HALF, SPACING, HOSPITAL, ROAD_SEGMENTS, ROAD_LAYOUT_VERSION, BRIDGE_ROWS, bridgeBounds,
  dirBetween, intersectionName, roadKey, roadLength } from "./cityGrid";

export const FIXED_STEP = 1 / 30;
export const MISSIONS = [
  { id: "rush", title: "Rush-hour rescue", subtitle: "Build a corridor through the morning queues",
    origin: [5, 5], vehicles: 480, hour: 8.5, targetSeconds: 180,
    objective: "Select the incident, inspect the streets, and activate a corridor to St. Aurora within 180 simulation seconds.",
    lesson: "Compare ambulance waiting time with the delay your corridor creates for other drivers." },
  { id: "bridge", title: "Bridge out of service", subtitle: "Find an available river crossing",
    origin: [5, 13], vehicles: 360, hour: 13, targetSeconds: 180,
    closedBridge: 13,
    objective: "The Grand Suspension Bridge is closed. Select an open crossing and reach St. Aurora within 180 simulation seconds.",
    lesson: "A closed bridge is excluded from route planning and new traffic movements." },
  { id: "obstruction", title: "Unexpected obstruction", subtitle: "Adapt after the ambulance departs",
    origin: [5, 13], vehicles: 360, hour: 18.25, targetSeconds: 240,
    eventSeconds: 8,
    objective: "A road on the planned route closes 8 seconds after dispatch. Inspect the alert, choose a new route, and reactivate the corridor. Arrive within 240 simulation seconds.",
    lesson: "The ambulance waits while you decide. Your reaction time becomes part of the measured journey." },
];
export const STORAGE_KEY = "greenwave.training.v1";
const LIMIT_SECONDS = 480;
const emptyMetrics = () => ({ ambulanceStoppedSeconds: 0, vehicleDelaySeconds: 0, vehicleStoppedSeconds: 0 });
const joinPaths = (...paths) => paths.some((p) => !p.length) ? [] : paths.flatMap((p, i) => i ? p.slice(1) : p);
const nodeFromWorld = (value) => Math.round((value + HALF) / SPACING);
const round = (value) => Math.round(value * 100) / 100;
const routeDistance = (route) => route.slice(1).reduce((sum, to, i) => sum + roadLength(...route[i], dirBetween(route[i], to)), 0);
const validRoute = (sim, route) => route.length > 1 && route.slice(1).every((to, i) => {
  const from = route[i];
  return Math.abs(to[0] - from[0]) + Math.abs(to[1] - from[1]) === 1 && sim.edgeOpen(...from, dirBetween(from, to));
});

export function initialFingerprint(sim) {
  let hash = 2166136261;
  const input = JSON.stringify({ layout: ROAD_LAYOUT_VERSION, lights: sim.lightOffsets,
    vehicles: sim.vehicles.map(({ id, type, ix, iz, d, t, nextD, speed, maxSpeed, lateral }) =>
      [id, type, ix, iz, d, t, nextD, speed, maxSpeed, lateral]), closed: [...sim.closedSegments] });
  for (let i = 0; i < input.length; i++) hash = Math.imul(hash ^ input.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export class TrainingSession {
  constructor(missionId = "rush", seed = 20261030) {
    this.speed = 4;
    this.view = "coordinated";
    this.urgency = "urgent";
    this.prepare(missionId, seed);
  }

  prepare(missionId, seed = this.seed) {
    this.mission = MISSIONS.find((m) => m.id === missionId) || MISSIONS[0];
    this.seed = Number(seed) >>> 0;
    this.phase = "planning";
    this.paused = false;
    this.tick = 0;
    this.accumulator = 0;
    this.version = (this.version || 0) + 1;
    this.selectedIncident = false;
    this.selectedRoad = null;
    this.selectedPlan = "fastest";
    this.pendingReroute = false;
    this.eventTriggered = false;
    this.recovered = false;
    this.eventAtTick = null;
    this.reactionSeconds = null;
    this.result = null;
    this.actions = [];
    this.message = "Select the red incident marker to begin planning.";
    const closed = this.mission.closedBridge == null ? [] : ROAD_SEGMENTS
      .filter((s) => s.bridge && s.iz === this.mission.closedBridge).map((s) => `${s.ix},${s.iz},${s.axis}`);
    const options = { seed: this.seed, hour: this.mission.hour,
      vehicleCount: this.mission.vehicles, controlled: true, ambulanceMaxSpeed: 12, closedSegments: closed };
    this.coordinated = new TrafficSim(options);
    this.baseline = new TrafficSim(options);
    this.baseline.greenWaveAI = false;
    this.coordinated.setUrgency(this.urgency);
    this.baseline.setUrgency(this.urgency);
    this.coordinated.show2DMinimap = false;
    this.metrics = { baseline: emptyMetrics(), coordinated: emptyMetrics() };
    this.fingerprint = initialFingerprint(this.coordinated);
    if (this.fingerprint !== initialFingerprint(this.baseline)) throw new Error("Starting states do not match.");
    this.refreshPlans();
    this.initialRoute = null;
  }

  get sim() { return this[this.view]; }
  get elapsed() { return this.tick * FIXED_STEP; }
  record(type, detail) { this.actions.push({ tick: this.tick, seconds: round(this.elapsed), type, detail }); }
  setUrgency(level) {
    if (!["normal", "urgent", "critical"].includes(level) || this.phase === "results") return false;
    this.urgency = level;
    this.coordinated.setUrgency(level);
    this.baseline.setUrgency(level);
    this.record("set-urgency", level);
    this.version++;
    return true;
  }
  selectIncident() {
    if (this.phase !== "planning" || this.selectedIncident) return;
    this.selectedIncident = true;
    this.message = "Incident selected. Choose a route, then activate the corridor.";
    this.record("inspect-incident", intersectionName(...this.mission.origin));
    this.version++;
  }
  selectRoad(segment) {
    this.selectedRoad = { ...segment, key: `${segment.ix},${segment.iz},${segment.axis}` };
    this.record("inspect-road", this.selectedRoad.key);
    this.version++;
  }
  planningOrigin() {
    const amb = this.coordinated.ambulance;
    return this.pendingReroute && amb ? amb.route[amb.k + 1] : this.mission.origin;
  }
  refreshPlans() {
    const sim = this.coordinated;
    const start = this.planningOrigin();
    const proposed = sim.findRoute(start);
    const direct = validRoute(sim, proposed) ? proposed : [];
    this.plans = [{ id: "fastest", label: "Suggested open route", route: direct }];
    BRIDGE_ROWS.forEach((row) => {
      const { left, right } = bridgeBounds(row);
      const a = [nodeFromWorld(left), row], b = [nodeFromWorld(right), row];
      const crossing = [];
      for (let x = a[0]; x <= b[0]; x++) crossing.push([x, row]);
      const blocked = crossing.slice(1).some((node, i) => !sim.edgeOpen(...crossing[i], dirBetween(crossing[i], node)));
      const candidate = blocked ? [] : joinPaths(sim.findRoute(start, a), crossing, sim.findRoute(b, HOSPITAL.node));
      const route = validRoute(sim, candidate) ? candidate : [];
      this.plans.push({ id: `bridge-${row}`, label: row === 9 ? "North arch crossing" : row === 13 ? "Grand suspension crossing" : "South cable-stayed crossing", route });
    });
    if (!this.plans.find((p) => p.id === this.selectedPlan)?.route.length) this.selectedPlan = "fastest";
    this.updatePreview();
  }
  choosePlan(id) {
    const plan = this.plans.find((p) => p.id === id);
    if (!plan || !validRoute(this.coordinated, plan.route) || (this.phase !== "planning" && !this.pendingReroute)) return false;
    this.selectedPlan = id;
    this.record("choose-route", plan.label);
    this.updatePreview();
    this.message = `${plan.label} selected. ${this.pendingReroute ? "Reactivate" : "Activate"} when ready.`;
    this.version++;
    return true;
  }
  planViaSelectedRoad() {
    const s = this.selectedRoad;
    if (!s || (this.phase !== "planning" && !this.pendingReroute) || this.coordinated.closedSegments.has(s.key)) return false;
    const a = [s.ix, s.iz], b = [s.ix + (s.axis === 0 ? 1 : 0), s.iz + (s.axis === 1 ? 1 : 0)];
    const sim = this.coordinated, start = this.planningOrigin();
    const candidates = [[a, b], [b, a]]
      .filter(([from, to]) => sim.edgeOpen(...from, dirBetween(from, to)))
      .map(([from, to]) => joinPaths(sim.findRoute(start, from), [from, to], sim.findRoute(to)))
      .filter((route) => validRoute(sim, route)).sort((p, q) => routeDistance(p) - routeDistance(q));
    if (!candidates.length) return false;
    this.plans = this.plans.filter((p) => p.id !== "custom");
    this.plans.push({ id: "custom", label: "Via inspected road", route: candidates[0] });
    return this.choosePlan("custom");
  }
  updatePreview() {
    const plan = this.plans.find((p) => p.id === this.selectedPlan);
    if (!plan || !validRoute(this.coordinated, plan.route)) return;
    if (this.phase === "planning" || this.pendingReroute) this.coordinated.setRoute(plan.route);
    if (this.phase === "planning") this.baseline.setRoute(plan.route);
  }
  activate() {
    const plan = this.plans.find((p) => p.id === this.selectedPlan);
    if (!this.selectedIncident || !plan || !validRoute(this.coordinated, plan.route)) return false;
    if (this.phase === "planning") {
      this.initialRoute = plan.route.map((p) => [...p]);
      this.coordinated.dispatch(this.initialRoute, this.mission.title);
      this.baseline.dispatch(this.initialRoute, "Ordinary signals reference");
      this.record("activate-corridor", plan.label);
      this.phase = "running";
      this.message = "Both runs started from identical traffic and signal states. The adaptive run now reviews traffic and urgency at every junction and each second.";
    } else if (this.pendingReroute) {
      if (!this.coordinated.redirectAmbulance(plan.route)) return false;
      this.coordinated.ambulanceHold = false;
      this.coordinated.greenWaveAI = true;
      this.pendingReroute = false;
      this.recovered = true;
      this.reactionSeconds = round((this.tick - this.eventAtTick) * FIXED_STEP);
      this.record("reactivate-corridor", plan.label);
      this.message = "Revised corridor active. The ordinary-signals reference also reroutes around the closure.";
    } else return false;
    this.version++;
    return true;
  }
  triggerObstruction() {
    this.eventTriggered = true;
    this.eventAtTick = this.tick;
    // Adaptive routing can replace the original route and reset its edge index.
    // Close a future edge of the current route, never an edge either vehicle occupies.
    const a = this.coordinated.ambulance;
    const ref = this.baseline.ambulance;
    const occupied = new Set([a, ref].filter((amb) => amb && !amb.arrived)
      .map((amb) => roadKey(...amb.route[amb.k], dirBetween(amb.route[amb.k], amb.route[amb.k + 1]))));
    const candidates = a.route.slice(a.k + 2, -1).map((from, offset) => {
      const to = a.route[a.k + 3 + offset];
      return { from, to, key: roadKey(...from, dirBetween(from, to)) };
    }).filter(({ key }) => !occupied.has(key));
    const pivot = Math.floor(candidates.length * 0.65);
    const ordered = [...candidates.slice(pivot), ...candidates.slice(0, pivot)];
    const selected = ordered.find(({ key }) => {
      this.coordinated.closedSegments.add(key); this.baseline.closedSegments.add(key);
      const viable = this.coordinated.findRoute(a.route[a.k + 1]).length > 1 &&
        this.baseline.findRoute(ref.route[ref.k + 1]).length > 1;
      this.coordinated.closedSegments.delete(key); this.baseline.closedSegments.delete(key);
      return viable;
    });
    if (!selected) {
      this.record("closure-skipped", "No future road available beyond occupied edges.");
      return;
    }
    const { from, to } = selected;
    const key = roadKey(...from, dirBetween(from, to));
    this.coordinated.closeRoads([key]); this.baseline.closeRoads([key]);
    this.pendingReroute = true;
    this.coordinated.ambulanceHold = true;
    this.coordinated.greenWaveAI = false;
    const referencePath = this.baseline.findRoute(ref.route[ref.k + 1]);
    if (!this.baseline.redirectAmbulance(referencePath)) throw new Error("Reference reroute unavailable.");
    this.refreshPlans();
    this.record("road-closure", key);
    this.message = `Road closed at ${intersectionName(...from)}. Choose a revised route and reactivate the corridor. The ambulance is waiting.`;
    this.version++;
  }
  step() {
    if (this.phase !== "running" || this.paused) return;
    if (this.mission.eventSeconds && !this.eventTriggered && this.tick >= Math.round(this.mission.eventSeconds / FIXED_STEP)) this.triggerObstruction();
    for (const mode of ["baseline", "coordinated"]) {
      const sim = this[mode], metrics = this.metrics[mode];
      const active = sim.ambulance && !sim.ambulance.arrived;
      sim.step(FIXED_STEP);
      if (active && sim.ambulance?.speed < 0.7) metrics.ambulanceStoppedSeconds += FIXED_STEP;
      for (const v of sim.vehicles) {
        metrics.vehicleDelaySeconds += Math.max(0, 1 - v.speed / v.maxSpeed) * FIXED_STEP;
        if (v.speed < 0.7) metrics.vehicleStoppedSeconds += FIXED_STEP;
      }
    }
    this.tick++;
    if ((this.baseline.lastTrip && this.coordinated.lastTrip) || this.elapsed >= LIMIT_SECONDS) this.finish();
  }
  advance(delta) {
    if (this.phase !== "running" || this.paused) return;
    this.accumulator += Math.min(delta, 0.25) * this.speed;
    let count = 0;
    while (this.accumulator >= FIXED_STEP && count++ < 60 && this.phase === "running") {
      this.step(); this.accumulator -= FIXED_STEP;
    }
  }
  measurements(mode) {
    const sim = this[mode], metrics = this.metrics[mode];
    return {
      arrived: !!sim.lastTrip,
      travelSeconds: sim.lastTrip ? round(sim.lastTrip.seconds) : null,
      ambulanceStoppedSeconds: round(metrics.ambulanceStoppedSeconds),
      averageVehicleDelaySeconds: round(metrics.vehicleDelaySeconds / this.mission.vehicles),
      averageVehicleStoppedSeconds: round(metrics.vehicleStoppedSeconds / this.mission.vehicles),
      measurementSeconds: round(this.elapsed),
    };
  }
  finish() {
    this.phase = "results";
    const baseline = this.measurements("baseline"), coordinated = this.measurements("coordinated");
    const passed = coordinated.arrived && coordinated.travelSeconds <= this.mission.targetSeconds &&
      (!this.mission.eventSeconds || this.recovered);
    this.result = {
      id: globalThis.crypto?.randomUUID?.() || `training-${Date.now()}-${this.seed}`,
      createdAt: new Date().toISOString(), missionId: this.mission.id, missionTitle: this.mission.title,
      seed: this.seed, initialFingerprint: this.fingerprint, fleetSize: this.mission.vehicles,
      layoutVersion: ROAD_LAYOUT_VERSION,
      policyVersion: "adaptive-traffic-v1", urgency: this.urgency,
      adaptiveDecisions: this.coordinated.decisionHistory.map((entry) => ({ ...entry })),
      rerouteCount: this.coordinated.rerouteCount,
      fixedStep: FIXED_STEP, horizonSeconds: round(this.elapsed), targetSeconds: this.mission.targetSeconds,
      baseline, coordinated, passed, timedOut: this.elapsed >= LIMIT_SECONDS,
      reactionSeconds: this.reactionSeconds, actions: this.actions.map((a) => ({ ...a })),
      secondsSaved: baseline.arrived && coordinated.arrived ? round(baseline.travelSeconds - coordinated.travelSeconds) : null,
      trafficDelayChangeSeconds: round(coordinated.averageVehicleDelaySeconds - baseline.averageVehicleDelaySeconds),
      method: "Paired seeded runs; identical initial traffic, signals, route and closures; equal ambulance speed limit; fixed 1/30 s steps; common observation window. Adaptive run reviews live queues, civilian impact and selected urgency every second and at junctions; reference uses ordinary signals and reroutes for closures. Bus dwell and random surges disabled. Delay integrates each civilian vehicle's speed shortfall relative to its own free-flow speed. Trainee closure response time is included in the adaptive run. Route ETAs are model estimates; journey and delay results are measured simulation seconds.",
    };
    this.message = passed ? "Mission completed. Review your measured results." : "Mission ended. Review the objective and retry with the same seed.";
    this.version++;
  }
  snapshot() {
    return { mission: this.mission, seed: this.seed, phase: this.phase, paused: this.paused,
      selectedIncident: this.selectedIncident, selectedRoad: this.selectedRoad, selectedPlan: this.selectedPlan,
      pendingReroute: this.pendingReroute, eventTriggered: this.eventTriggered, recovered: this.recovered,
      elapsed: round(this.elapsed), message: this.message, plans: this.plans, result: this.result,
      baseline: this.measurements("baseline"), coordinated: this.measurements("coordinated"),
      speed: this.speed, view: this.view, closedSegments: [...this.coordinated.closedSegments],
      urgency: this.urgency, decision: { ...this.coordinated.decision },
      actions: this.actions.slice(-5).reverse(), version: this.version, fingerprint: this.fingerprint };
  }
}

export function readTrainingResults() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((r) => r?.baseline && r?.coordinated).slice(0, 50) : [];
  } catch { return []; }
}
export function saveTrainingResult(result) {
  const rows = [result, ...readTrainingResults().filter((r) => r.id !== result.id)].slice(0, 50);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rows)); } catch { /* In-memory results remain available. */ }
  return rows;
}
