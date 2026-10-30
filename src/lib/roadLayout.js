// Logical intersection IDs stay stable for saved missions; world geometry is authored here.
const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const mod = (v, n) => ((v % n) + n) % n;

export function createRoadLayout({ grid, half, spacing, roadWidth, bridgeRows, bridgeBounds }) {
  const raw = (i) => i * spacing - half;
  const definitions = [
    { id: "civic-circle", name: "Civic Circle Boulevard", shape: "circle", bounds: [0, 7, 7, 15] },
    { id: "triangle", name: "Triangle Quarter", shape: "triangle", bounds: [2, 0, 10, 5] },
    { id: "hexagon", name: "Hexagon Gardens", shape: "hexagon", bounds: [21, 10, 29, 17] },
    { id: "rectangle", name: "Rectangular Market Loop", shape: "rectangle", bounds: [21, 20, 29, 24] },
    { id: "roundabout", name: "West Park Roundabout", shape: "roundabout", bounds: [2, 20, 6, 24], oneWay: true },
  ];
  const pins = [[5, 5], [5, 15], [10, 13], [15, 4], [27, 25], [23, 7]];
  const nodeKey = (x, z) => `${x},${z}`;
  const nodes = new Map();
  const rings = new Map();
  const districts = definitions.map((d) => {
    const [x0, z0, x1, z1] = d.bounds;
    const cx = (raw(x0) + raw(x1)) / 2, cz = (raw(z0) + raw(z1)) / 2;
    const rx = (x1 - x0) * spacing / 2, rz = (z1 - z0) * spacing / 2;
    const radius = Math.min(rx, rz) - 1;
    let polygon;
    if (d.shape === "triangle") polygon = [{ x: cx, z: raw(z0) + 4 }, { x: raw(x1) - 2, z: raw(z1) - 2 }, { x: raw(x0) + 2, z: raw(z1) - 2 }];
    else if (d.shape === "hexagon") polygon = Array.from({ length: 6 }, (_, i) => ({ x: cx + Math.cos(-Math.PI / 2 + i * TAU / 6) * radius, z: cz + Math.sin(-Math.PI / 2 + i * TAU / 6) * radius }));
    else if (d.shape === "rectangle") polygon = [{ x: raw(x0), z: raw(z0) }, { x: raw(x1), z: raw(z0) }, { x: raw(x1), z: raw(z1) }, { x: raw(x0), z: raw(z1) }];
    else polygon = Array.from({ length: 96 }, (_, i) => ({ x: cx + Math.cos(i * TAU / 96) * radius, z: cz + Math.sin(i * TAU / 96) * radius }));
    const perimeter = 2 * ((x1 - x0) + (z1 - z0));
    const indexAt = (ix, iz) => iz === z0 ? ix - x0 : ix === x1 ? x1 - x0 + iz - z0 : iz === z1 ? x1 - x0 + z1 - z0 + x1 - ix : ix === x0 ? 2 * (x1 - x0) + z1 - z0 + z1 - iz : null;
    const at = (u) => {
      if (d.shape === "rectangle") {
        const v = mod(u, 1) * perimeter, w = x1 - x0, h = z1 - z0;
        return v <= w ? { x: raw(x0) + v * spacing, z: raw(z0) } : v <= w + h ? { x: raw(x1), z: raw(z0) + (v - w) * spacing } : v <= 2 * w + h ? { x: raw(x1) - (v - w - h) * spacing, z: raw(z1) } : { x: raw(x0), z: raw(z1) - (v - 2 * w - h) * spacing };
      }
      const angle = -Math.PI * 3 / 4 + u * TAU, dx = Math.cos(angle), dz = Math.sin(angle);
      if (d.shape === "circle" || d.shape === "roundabout") return { x: cx + dx * radius, z: cz + dz * radius };
      let distance = Infinity;
      for (let i = 0; i < polygon.length; i++) {
        const p = polygon[i], q = polygon[(i + 1) % polygon.length];
        const ex = q.x - p.x, ez = q.z - p.z, det = dx * ez - dz * ex;
        if (Math.abs(det) < 1e-9) continue;
        const ax = p.x - cx, az = p.z - cz;
        const t = (ax * ez - az * ex) / det, s = (ax * dz - az * dx) / det;
        if (t > 0 && s >= -1e-8 && s <= 1 + 1e-8) distance = Math.min(distance, t);
      }
      return { x: cx + dx * distance, z: cz + dz * distance };
    };
    const cornerUs = d.shape === "circle" || d.shape === "roundabout" || d.shape === "rectangle" ? [] : polygon.map((p) => mod((Math.atan2(p.z - cz, p.x - cx) + Math.PI * 3 / 4) / TAU, 1));
    const portals = new Set([
      nodeKey(Math.round((x0 + x1) / 2), z0), nodeKey(x1, Math.round((z0 + z1) / 2)),
      nodeKey(Math.round((x0 + x1) / 2), z1), nodeKey(x0, Math.round((z0 + z1) / 2)),
      ...pins.filter(([x, z]) => indexAt(x, z) != null && x >= x0 && x <= x1 && z >= z0 && z <= z1).map(([x, z]) => nodeKey(x, z)),
    ]);
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const index = indexAt(x, z);
      if (index != null) {
        nodes.set(nodeKey(x, z), at(index / perimeter));
        rings.set(nodeKey(x, z), { district: d.id, index, perimeter });
      }
    }
    let island = polygon.map((p) => ({ x: lerp(cx, p.x, 0.78), z: lerp(cz, p.z, 0.78) }));
    if (d.id === "civic-circle") {
      // Clean, centered circular park island without cutting street
      island = Array.from({ length: 64 }, (_, i) => ({
        x: cx + Math.cos(i * TAU / 64) * (radius * 0.76),
        z: cz + Math.sin(i * TAU / 64) * (radius * 0.76),
      }));
    }
    return { ...d, cx, cz, radius, polygon, island, at, indexAt, perimeter, portals, cornerUs };
  });

  // Ordinary streets stay straight; curves are reserved for the named circular roads.
  const protectedNode = (ix, iz) => pins.some(([x, z]) => Math.abs(x - ix) + Math.abs(z - iz) <= 1);
  const isBridgeNode = (ix, iz) => {
    if (!bridgeRows.includes(iz)) return false;
    const bounds = bridgeBounds(iz);
    return raw(ix) >= bounds.left - spacing && raw(ix) <= bounds.right + spacing;
  };
  for (let iz = 0; iz < grid; iz++) for (let ix = 0; ix < grid; ix++) {
    const key = nodeKey(ix, iz);
    if (nodes.has(key)) continue;
    nodes.set(key, { x: raw(ix), z: raw(iz) });
  }
  const nodePosition = (ix, iz) => nodes.get(nodeKey(ix, iz)) || { x: raw(ix), z: raw(iz) };
  const districtAtIndex = (ix, iz) => districts.find((d) => ix >= d.bounds[0] && iz >= d.bounds[1] && ix <= d.bounds[2] && iz <= d.bounds[3]);
  const segmentAllowed = (ix, iz, axis) => {
    const nx = ix + (axis === 0 ? 1 : 0), nz = iz + (axis === 1 ? 1 : 0);
    const a = districtAtIndex(ix, iz), b = districtAtIndex(nx, nz);
    if (a || b) {
      if (a === b) {
        const p = rings.get(nodeKey(ix, iz)), q = rings.get(nodeKey(nx, nz));
        return !!p && !!q && (Math.abs(p.index - q.index) === 1 || Math.abs(p.index - q.index) === p.perimeter - 1);
      }
      return (!a || a.portals.has(nodeKey(ix, iz))) && (!b || b.portals.has(nodeKey(nx, nz)));
    }
    if (protectedNode(ix, iz) || protectedNode(nx, nz) || isBridgeNode(ix, iz) || isBridgeNode(nx, nz)) return true;
    if (axis === 1 && ix % 3 !== 0 && iz % 4 !== 0) return false;
    if (axis === 0 && iz % 3 === 1 && ix % 5 !== 0 && !bridgeRows.includes(iz)) return false;
    return true;
  };
  const cache = new Map();
  const segmentGeometry = (ix, iz, axis) => {
    const key = `${ix},${iz},${axis}`;
    if (cache.has(key)) return cache.get(key);
    const nx = ix + (axis === 0 ? 1 : 0), nz = iz + (axis === 1 ? 1 : 0);
    const a = nodePosition(ix, iz), b = nodePosition(nx, nz);
    const p = rings.get(nodeKey(ix, iz)), q = rings.get(nodeKey(nx, nz));
    let points, kind = "street";
    if (p && q && p.district === q.district) {
      const district = districts.find((d) => d.id === p.district);
      kind = district.shape;
      let u0 = p.index / p.perimeter, u1 = q.index / q.perimeter;
      if (u1 - u0 > 0.5) u1 -= 1;
      if (u0 - u1 > 0.5) u1 += 1;
      const us = Array.from({ length: 9 }, (_, i) => lerp(u0, u1, i / 8));
      for (const corner of district.cornerUs) for (const offset of [-1, 0, 1]) {
        const u = corner + offset;
        if (u > Math.min(u0, u1) && u < Math.max(u0, u1)) us.push(u);
      }
      us.sort((a, b) => u1 > u0 ? a - b : b - a);
      points = us.filter((u, i) => !i || Math.abs(u - us[i - 1]) > 1e-8).map((u) => district.at(u));
    } else {
      points = Array.from({ length: 9 }, (_, i) => {
        const t = i / 8;
        return { x: lerp(a.x, b.x, t), z: lerp(a.z, b.z, t) };
      });
    }
    const distances = [0];
    for (let i = 1; i < points.length; i++) distances.push(distances[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z));
    const geometry = { points, distances, kind, length: distances[distances.length - 1] };
    cache.set(key, geometry); return geometry;
  };
  const edgeFor = (ix, iz, d) => segmentGeometry(ix - (d === 1 ? 1 : 0), iz - (d === 3 ? 1 : 0), d < 2 ? 0 : 1);
  const roadLength = (ix, iz, d) => edgeFor(ix, iz, d).length;
  const directedRoadSample = (ix, iz, d, t, lateral = 0, out = {}) => {
    const geo = edgeFor(ix, iz, d), reverse = d === 1 || d === 3;
    const along = Math.max(0, Math.min(geo.length, reverse ? geo.length - t : t));
    let i = 1;
    while (i < geo.distances.length - 1 && geo.distances[i] < along) i++;
    const a = geo.points[i - 1], b = geo.points[i], piece = geo.distances[i] - geo.distances[i - 1];
    const u = piece > 0 ? (along - geo.distances[i - 1]) / piece : 0;
    const sign = reverse ? -1 : 1, dx = (b.x - a.x) / piece * sign, dz = (b.z - a.z) / piece * sign;
    out.x = lerp(a.x, b.x, u) - dz * lateral;
    out.z = lerp(a.z, b.z, u) + dx * lateral;
    out.heading = Math.atan2(-dz, dx);
    return out;
  };
  const directionAllowed = (ix, iz, d) => {
    const nx = ix + (d === 0 ? 1 : d === 1 ? -1 : 0), nz = iz + (d === 2 ? 1 : d === 3 ? -1 : 0);
    const p = rings.get(nodeKey(ix, iz)), q = rings.get(nodeKey(nx, nz));
    if (!p || !q || p.district !== q.district) return true;
    const district = districts.find((r) => r.id === p.district);
    return !district.oneWay || mod(q.index - p.index, p.perimeter) === 1;
  };
  const routePolyline = (route) => {
    const points = [];
    for (let i = 1; i < route.length; i++) {
      const [x, z] = route[i - 1], [nx, nz] = route[i];
      const d = nx > x ? 0 : nx < x ? 1 : nz > z ? 2 : 3;
      const geo = edgeFor(x, z, d);
      const path = d === 1 || d === 3 ? [...geo.points].reverse() : geo.points;
      points.push(...(points.length ? path.slice(1) : path));
    }
    return points;
  };
  return { nodePosition, segmentGeometry, segmentAllowed, directionAllowed, roadLength, directedRoadSample, routePolyline, districts };
}

export function pointInPolygon(x, z, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

export function roadClearanceIndex(segments, roadWidth) {
  const cell = 20, buckets = new Map();
  for (const segment of segments) for (let i = 1; i < segment.points.length; i++) {
    const a = segment.points[i - 1], b = segment.points[i];
    const item = { a, b };
    for (let x = Math.floor((Math.min(a.x, b.x) - roadWidth) / cell); x <= Math.floor((Math.max(a.x, b.x) + roadWidth) / cell); x++)
      for (let z = Math.floor((Math.min(a.z, b.z) - roadWidth) / cell); z <= Math.floor((Math.max(a.z, b.z) + roadWidth) / cell); z++) {
        const key = `${x},${z}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(item);
      }
  }
  return (x, z, clearance = 0) => {
    const radius = roadWidth / 2 + clearance;
    for (let cx = Math.floor((x - radius) / cell); cx <= Math.floor((x + radius) / cell); cx++)
      for (let cz = Math.floor((z - radius) / cell); cz <= Math.floor((z + radius) / cell); cz++)
        for (const { a, b } of buckets.get(`${cx},${cz}`) || []) {
          const dx = b.x - a.x, dz = b.z - a.z;
          const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
          if (Math.hypot(x - a.x - t * dx, z - a.z - t * dz) < radius) return true;
        }
    return false;
  };
}
