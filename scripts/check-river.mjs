import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const grid = await server.ssrLoadModule('/src/lib/cityGrid.js');
  const { TrafficSim } = await server.ssrLoadModule('/src/lib/trafficSim.js');
  const { GRID, ROAD_SEGMENTS, ROAD_HAZARDS, BRIDGE_ROWS, DISPATCH_BASES,
    HOSPITAL, DEFAULT_ROUTE, canTravel, dirBetween, findOptimalCorridor,
    isRoadNode, coord, riverBankX, RIVER_SETBACK, ROAD_W, segmentGeometry } = grid;
  const validRoute = (route) => {
    assert(route.length > 1);
    route.slice(1).forEach((b, i) => {
      const a = route[i];
      assert.equal(Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]), 1);
      assert(canTravel(...a, dirBetween(a, b)), `Route leaves road at ${a} → ${b}`);
    });
  };
  assert.deepEqual(ROAD_HAZARDS.bridges.map((b) => b.iz), BRIDGE_ROWS);
  validRoute(DEFAULT_ROUTE);
  const visited = new Set();
  const queue = [HOSPITAL.node];
  visited.add(queue[0].join(','));
  for (let i = 0; i < queue.length; i++) grid.DIRS.forEach(([dx, dz], d) => {
    const [x, z] = queue[i], next = [x + dx, z + dz], key = next.join(',');
    if (canTravel(x, z, d) && !visited.has(key)) { visited.add(key); queue.push(next); }
  });
  for (let iz = 0; iz < GRID; iz++) for (let ix = 0; ix < GRID; ix++) {
    if (isRoadNode(ix, iz)) assert(visited.has(`${ix},${iz}`), `Disconnected road node ${ix},${iz}`);
  }
  ROAD_SEGMENTS.filter((s) => !s.bridge).forEach(({ ix, iz, axis }) => {
    for (const { x, z } of segmentGeometry(ix, iz, axis).points) {
      const { left, right } = riverBankX(z);
      assert(x + ROAD_W / 2 <= left - RIVER_SETBACK + 0.02 ||
        x - ROAD_W / 2 >= right + RIVER_SETBACK - 0.02, `Road invades bank at ${x},${z}`);
    }
  });
  ROAD_HAZARDS.hazardsBySeg.forEach((hazards, key) => {
    const node = Math.floor(key / 4), d = key % 4;
    assert(canTravel(node % GRID, Math.floor(node / GRID), d));
  });
  const sim = new TrafficSim();
  for (const base of DISPATCH_BASES) {
    assert(isRoadNode(...base.node), `Depot is off road: ${base.name}`);
    validRoute(findOptimalCorridor(base.node));
  }
  sim.dispatchDynamic();
  for (let i = 0; i < 60 * 180; i++) {
    sim.step(1 / 60);
    if (i % 120 === 0) sim.vehicles.forEach((v) => {
      assert(canTravel(v.ix, v.iz, v.d));
      assert(Number.isFinite(v.x) && Number.isFinite(v.z));
    });
  }
  assert(sim.lastTrip, 'Ambulance did not reach hospital');
  console.log(`PASS: ${ROAD_SEGMENTS.length} road segments, ${visited.size} connected junctions, 3 bridges; all depots/routes valid, roads respect bank setback; 180 seconds of traffic and ambulance arrival verified.`);
} finally {
  await server.close();
}
