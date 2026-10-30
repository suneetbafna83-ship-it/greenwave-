import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const grid = await server.ssrLoadModule('/src/lib/cityGrid.js');
  const { ROAD_SEGMENTS, ROAD_DISTRICTS, ROAD_HAZARDS, nodePosition, directedRoadSample,
    coord, canTravel, BRIDGE_ROWS, bridgeBounds, SPACING, HALF, roadLength } = grid;
  const area = (polygon) => Math.abs(polygon.reduce((sum, p, i) => {
    const q = polygon[(i + 1) % polygon.length]; return sum + p.x * q.z - q.x * p.z;
  }, 0)) / 2;
  assert.deepEqual(new Set(ROAD_DISTRICTS.map((d) => d.shape)), new Set(['circle', 'roundabout', 'triangle', 'rectangle', 'hexagon']));
  for (const district of ROAD_DISTRICTS) {
    assert(area(district.polygon) > 1000, `Degenerate ${district.shape} boundary`);
    assert(area(district.island) > 100, `Degenerate ${district.shape} island`);
    const [x0, z0, x1, z1] = district.bounds;
    const ring = ROAD_SEGMENTS.filter((s) => {
      const nx = s.ix + (s.axis === 0 ? 1 : 0), nz = s.iz + (s.axis === 1 ? 1 : 0);
      const onBoundary = (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1 && (x === x0 || x === x1 || z === z0 || z === z1);
      return onBoundary(s.ix, s.iz) && onBoundary(nx, nz);
    });
    const missing = [];
    for (let x = x0; x < x1; x++) for (const z of [z0, z1]) if (!grid.isRoadSegment(x, z, 0)) missing.push(`${x},${z},0`);
    for (let z = z0; z < z1; z++) for (const x of [x0, x1]) if (!grid.isRoadSegment(x, z, 1)) missing.push(`${x},${z},1`);
    assert.equal(ring.length, 2 * (x1 - x0 + z1 - z0), `${district.shape} loop has missing roads: ${missing.join('; ')}`);
    if (district.oneWay) ring.forEach((s) => {
      const d = s.axis === 0 ? 0 : 2;
      const nx = s.ix + (s.axis === 0 ? 1 : 0), nz = s.iz + (s.axis === 1 ? 1 : 0);
      assert.notEqual(canTravel(s.ix, s.iz, d), canTravel(nx, nz, d + 1), 'Roundabout must circulate one way');
    });
  }
  for (const s of ROAD_SEGMENTS) {
    const d = s.axis === 0 ? 0 : 2;
    const a = nodePosition(s.ix, s.iz), b = nodePosition(s.ix + (s.axis === 0 ? 1 : 0), s.iz + (s.axis === 1 ? 1 : 0));
    assert(s.length > 4 && Number.isFinite(s.length));
    assert(Math.hypot(a.x - s.points[0].x, a.z - s.points[0].z) < 1e-7);
    assert(Math.hypot(b.x - s.points.at(-1).x, b.z - s.points.at(-1).z) < 1e-7);
    if (s.kind === 'street') s.points.forEach((p) => {
      const cross = (p.x - a.x) * (b.z - a.z) - (p.z - a.z) * (b.x - a.x);
      assert(Math.abs(cross) < 1e-7, 'Ordinary streets must stay straight');
    });
    for (let k = 0; k <= 12; k++) {
      const pose = directedRoadSample(s.ix, s.iz, d, s.length * k / 12, 1.15);
      assert(Object.values(pose).every(Number.isFinite));
    }
    if (s.bridge) s.points.forEach((p) => assert(Math.abs(p.z - coord(s.iz)) < 1e-7, 'Bridge alignment moved'));
  }
  for (const row of BRIDGE_ROWS) {
    const bounds = bridgeBounds(row);
    for (const x of [bounds.left, bounds.right]) {
      const p = nodePosition(Math.round((x + HALF) / SPACING), row);
      assert(Math.abs(p.x - x) < 1e-7 && Math.abs(p.z - coord(row)) < 1e-7, 'Bridge approach detached');
    }
  }
  ROAD_HAZARDS.hazardsBySeg.forEach((hazards, key) => {
    const node = Math.floor(key / 4), ix = node % grid.GRID, iz = Math.floor(node / grid.GRID), d = key % 4;
    hazards.forEach((h) => assert(h.t >= 0 && h.t <= roadLength(ix, iz, d), 'Hazard lies beyond its road'));
  });
  console.log(`PASS: all five district shapes form complete loops; ${ROAD_SEGMENTS.length} sampled roads connect at endpoints; one-way roundabout, bridge alignment and hazard distances verified.`);
} finally { await server.close(); }
