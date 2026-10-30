import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const { TrainingSession, MISSIONS, FIXED_STEP, initialFingerprint } = await server.ssrLoadModule('/src/lib/training.js');
  const { TrafficSim } = await server.ssrLoadModule('/src/lib/trafficSim.js');
  const { dirBetween, roadKey, ROAD_SEGMENTS } = await server.ssrLoadModule('/src/lib/cityGrid.js');
  const run = (id, seed = 42, reactionTicks = 30) => {
    const session = new TrainingSession(id, seed);
    assert.equal(initialFingerprint(session.baseline), initialFingerprint(session.coordinated));
    assert.equal(session.activate(), false, 'Selecting an incident must be required');
    session.selectIncident();
    assert(session.activate());
    const previousRoads = { baseline: new Map(), coordinated: new Map() };
    for (const mode of ['baseline', 'coordinated']) session[mode].vehicles.forEach((v) => previousRoads[mode].set(v.id, roadKey(v.ix, v.iz, v.d)));
    for (let n = 0; n < 480 / FIXED_STEP + 2 && session.phase === 'running'; n++) {
      session.step();
      for (const mode of ['baseline', 'coordinated']) session[mode].vehicles.forEach((v) => {
        const key = roadKey(v.ix, v.iz, v.d);
        if (session[mode].closedSegments.has(key)) assert.equal(previousRoads[mode].get(v.id), key, 'New traffic entered a closed road');
        previousRoads[mode].set(v.id, key);
      });
      if (session.pendingReroute && session.tick - session.eventAtTick >= reactionTicks) {
        const plan = session.plans.find((p) => p.id === session.selectedPlan);
        assert(plan.route.length > 1);
        plan.route.slice(1).forEach((b, i) => assert(session.coordinated.edgeOpen(...plan.route[i], dirBetween(plan.route[i], b))));
        assert(session.activate());
      }
    }
    assert.equal(session.phase, 'results');
    assert(session.result.coordinated.arrived, `${id}: coordinated arrival missing`);
    assert(session.result.baseline.arrived, `${id}: baseline arrival missing`);
    assert.equal(session.result.baseline.measurementSeconds, session.result.coordinated.measurementSeconds);
    assert(session.result.baseline.ambulanceStoppedSeconds >= 0);
    assert(session.result.coordinated.averageVehicleDelaySeconds >= 0);
    if (id === 'obstruction') { assert(session.recovered); assert.equal(session.reactionSeconds, reactionTicks * FIXED_STEP); }
    return session.result;
  };
  for (const mission of MISSIONS) {
    const result = run(mission.id);
    console.log(`${mission.id}: baseline ${result.baseline.travelSeconds}s, coordinated ${result.coordinated.travelSeconds}s, civilian delay change ${result.trafficDelayChangeSeconds}s, passed=${result.passed}`);
  }
  const first = run('obstruction');
  const second = run('obstruction');
  assert.deepEqual(first.baseline, second.baseline, 'Baseline must repeat exactly for a seed');
  assert.deepEqual(first.coordinated, second.coordinated, 'Coordinated run must repeat exactly for the same actions');
  const options = { controlled: true, seed: 7, vehicleCount: 200, ambulanceMaxSpeed: 12 };
  const a = new TrafficSim(options), b = new TrafficSim(options);
  a.greenWaveAI = false; b.greenWaveAI = false;
  const path = a.findRoute([5, 5]); a.dispatch(path); b.dispatch(path);
  for (let i = 0; i < 300; i++) { a.step(FIXED_STEP); b.step(FIXED_STEP); }
  assert.equal(initialFingerprint(a), initialFingerprint(b), 'Identical policies must remain identical');
  const paused = new TrainingSession('rush'); paused.selectIncident(); paused.activate(); paused.paused = true;
  paused.advance(1); assert.equal(paused.tick, 0);
  const closed = new TrainingSession('bridge');
  assert.equal(closed.choosePlan('bridge-13'), false, 'Closed crossing cannot be selected');
  const custom = new TrainingSession('rush');
  custom.selectIncident();
  custom.selectRoad(ROAD_SEGMENTS.find((s) => s.ix === 5 && s.iz === 5 && s.axis === 0));
  assert(custom.planViaSelectedRoad());
  assert(custom.activate());
  assert.deepEqual(custom.baseline.ambulance.route, custom.coordinated.ambulance.route);
  const fingerprint = custom.fingerprint;
  custom.prepare('rush');
  assert.equal(custom.fingerprint, fingerprint, 'Reset must restore the initial state');
  const held = new TrainingSession('obstruction', 42);
  held.selectIncident(); held.activate();
  while (!held.pendingReroute) held.step();
  const pose = () => {
    const a = held.coordinated.ambulance;
    return [a.x, a.z, a.k, a.t, a.lateral];
  };
  const beforeHold = pose(), elapsedBefore = held.coordinated.ambulance.elapsed;
  for (let i = 0; i < 30; i++) held.step();
  assert.deepEqual(pose(), beforeHold, 'Planning hold must not drift across a junction');
  assert(Math.abs(held.coordinated.ambulance.elapsed - elapsedBefore - 1) < 1e-7, 'Planning time must remain measured');
  assert(held.activate(), 'A stationary hold must preserve the planned reroute origin');
  assert.deepEqual(pose().slice(0, 2), beforeHold.slice(0, 2), 'Reactivation must not teleport');
  const timeout = new TrainingSession('obstruction'); timeout.selectIncident(); timeout.activate();
  while (timeout.phase === 'running') timeout.step();
  assert(timeout.result.timedOut); assert.equal(timeout.result.secondsSaved, null);
  console.log('PASS: missions, route closures, seeded reproducibility, equal observation windows, pause, invalid selection and timeout handling.');
} finally { await server.close(); }
