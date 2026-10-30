import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const grid = await server.ssrLoadModule('/src/lib/cityGrid.js');
  const { TRAFFIC_SIGNALS, SIGNAL_JUNCTIONS, UNPLACED_SIGNAL_APPROACHES,
    TRAFFIC_SIGNAL_RADIUS, TRAFFIC_SIGNAL_CLEARANCE, SIGNAL_PAD_RADIUS } = await server.ssrLoadModule('/src/lib/trafficFurniture.js');
  const covered = new Set();
  for (const signal of TRAFFIC_SIGNALS) {
    assert(!grid.isNearRoad(signal.x, signal.z, TRAFFIC_SIGNAL_CLEARANCE), `Signal on a driving surface at ${signal.x},${signal.z}`);
    assert(TRAFFIC_SIGNAL_CLEARANCE > TRAFFIC_SIGNAL_RADIUS);
    assert(TRAFFIC_SIGNAL_CLEARANCE > SIGNAL_PAD_RADIUS, 'Paving pad enters the driving surface');
    assert(signal.setback >= 3.2, 'Pole too close to the intersection center');
    const nx = signal.ix + grid.DIRS[signal.d][0], nz = signal.iz + grid.DIRS[signal.d][1];
    assert(grid.canTravel(nx, nz, grid.OPPOSITE[signal.d]), 'Signal faces a nonexistent incoming approach');
    assert.equal(signal.axis, grid.axisOfDir(signal.d));
    const { left, right } = grid.riverBankX(signal.z);
    assert(signal.x <= left - 0.8 || signal.x >= right + 0.8, 'Signal in river channel');
    covered.add(signal.idx);
  }
  assert(TRAFFIC_SIGNALS.length > 100, 'Unexpectedly missing most signals');
  assert(covered.size / SIGNAL_JUNCTIONS.length >= 0.95, 'Signalized junction coverage dropped below 95%');
  console.log(`PASS: ${TRAFFIC_SIGNALS.length} signal poles and lamp disks clear all driving lanes by ${TRAFFIC_SIGNAL_CLEARANCE} units; ${covered.size}/${SIGNAL_JUNCTIONS.length} junctions covered; ${UNPLACED_SIGNAL_APPROACHES.length} constrained approaches omitted instead of placing in a lane.`);
} finally { await server.close(); }
