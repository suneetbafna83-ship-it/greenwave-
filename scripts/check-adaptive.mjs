import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const { TrafficSim } = await server.ssrLoadModule('/src/lib/trafficSim.js');
  const { DIRS, dirBetween, roadKey, segKey, nodeIndex, roadLength } = await server.ssrLoadModule('/src/lib/cityGrid.js');
  const { crossingTraffic } = await server.ssrLoadModule('/src/lib/trafficPolicy.js');
  const make = () => new TrafficSim({ seed: 42, controlled: true, vehicleCount: 0, ambulanceMaxSpeed: 12 });
  const sim = make(), path = sim.findRoute([5, 5]);
  sim.dispatch(path); sim.reviewAmbulancePolicy(true); sim.updateOverrides();
  assert.equal(sim.decision.action, 'clear', 'Empty roads should permit local clearance');
  assert(sim.overrides.size > 0);
  assert.equal(sim.snapshot().urgency, 'urgent');
  assert.equal(sim.snapshot().decision.action, 'clear');
  const vehicle = (ix, iz, d, i) => ({ ix, iz, d, t: i, speed: 0, spec: { pcu: 1, length: 1.8 }, lateral: 1.15 });
  // Build a real directional queue on the planned future route.
  for (let j = 2; j < Math.min(12, path.length - 1); j++) {
    const [ix, iz] = path[j], d = dirBetween(path[j], path[j + 1]);
    for (let i = 0; i < 8; i++) sim.buckets[segKey(ix, iz, d)].push(vehicle(ix, iz, d, i));
  }
  const amb = sim.ambulance;
  amb.t = 2; amb.elapsed = 7;
  const before = [amb.x, amb.z, amb.t, amb.elapsed, amb.heading];
  sim.reviewAmbulancePolicy(true);
  assert.equal(sim.decision.action, 'reroute', 'Heavy queues should produce a viable detour');
  assert.equal(sim.rerouteCount, 1);
  assert.deepEqual([amb.x, amb.z, amb.t, amb.elapsed, amb.heading], before, 'Replan must preserve pose and journey time');
  const version = sim.routeVersion;
  sim.reviewAmbulancePolicy(true);
  assert.equal(sim.routeVersion, version, 'Repeated samples must not oscillate the route');
  let blocked;
  for (let j = 2; j < amb.route.length - 1; j++) {
    const key = roadKey(...amb.route[j], dirBetween(amb.route[j], amb.route[j + 1]));
    sim.closedSegments.add(key);
    if (sim.findRoute(amb.route[1]).length) { blocked = key; break; }
    sim.closedSegments.delete(key);
  }
  assert(blocked, 'Fixture needs a closure with a viable detour');
  sim.reviewAmbulancePolicy();
  assert(amb.route.slice(2).every((to, i) => sim.edgeOpen(...amb.route[i + 1], dirBetween(amb.route[i + 1], to))), 'Closure must bypass reroute cooldown');
  const busy = make(); busy.dispatch(path); busy.setUrgency('normal');
  let junction;
  for (let j = 0; j < path.length - 1 && !junction; j++) {
    const to = path[j + 1], d = dirBetween(path[j], to);
    for (let crossD = 0; crossD < 4; crossD++) {
      if ((crossD < 2) === (d < 2)) continue;
      const sx = to[0] - DIRS[crossD][0], sz = to[1] - DIRS[crossD][1];
      if (!busy.edgeOpen(sx, sz, crossD)) continue;
      for (let i = 0; i < 9; i++) busy.buckets[segKey(sx, sz, crossD)].push(vehicle(sx, sz, crossD, i));
      junction = { to, d }; break;
    }
  }
  assert(crossingTraffic(busy, ...junction.to, junction.d).vehicles >= 9);
  // Freeze the route to isolate the signal decision from routing improvements.
  busy.lastRouteChangeAt = busy.time;
  busy.reviewAmbulancePolicy(true); busy.updateOverrides();
  assert(!busy.overrides.has(nodeIndex(...junction.to)), 'Busy crossing must not be preempted at normal urgency');
  busy.setUrgency('critical'); busy.reviewAmbulancePolicy(true); busy.updateOverrides();
  assert(busy.overrides.has(nodeIndex(...junction.to)), 'Critical urgency can clear when no timely reroute is selected');
  busy.ambulanceHold = true; busy.reviewAmbulancePolicy(true); busy.updateOverrides();
  assert.equal(busy.overrides.size, 0, 'Planning hold must release all signals');
  const cache = make(), [ix, iz] = path[0], d = dirBetween(path[0], path[1]);
  for (let i = 0; i < 3; i++) cache.buckets[segKey(ix, iz, d)].push(vehicle(ix, iz, d, i));
  const initialVersion = cache.trafficVersion;
  cache.time = 0.1; cache.refreshTrafficState();
  assert.equal(cache.getSegmentStatus(ix, iz, d), 'red');
  assert.equal(cache.trafficVersion, initialVersion + 1);
  assert.equal(cache.refreshTrafficState(), false, 'Consumers share one sample, without duplicate resampling');
  const reference = make(); reference.greenWaveAI = false; reference.dispatch(path); reference.reviewAmbulancePolicy(true); reference.updateOverrides();
  assert.equal(reference.decision.action, 'standard'); assert.equal(reference.overrides.size, 0);
  console.log('PASS: live detours, pose preservation, cooldown, immediate closure response, urgency, selective signals, hold, shared 100ms traffic sample and reference policy.');
} finally { await server.close(); }
