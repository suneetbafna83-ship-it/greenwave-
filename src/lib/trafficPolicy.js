import { GRID, DIRS, OPPOSITE, axisOfDir, nodeIndex, dirBetween, roadLength, segKey, ROAD_HAZARDS } from "./cityGrid";

// Values are simulation policy settings, not clinical triage recommendations.
export const URGENCY_POLICIES = {
  normal: { civilianWeight: 1.1, crossLimit: 3, maxDetourRatio: 1.5, minSaving: 3 },
  urgent: { civilianWeight: 0.55, crossLimit: 5, maxDetourRatio: 1.3, minSaving: 2.5 },
  critical: { civilianWeight: 0.12, crossLimit: 8, maxDetourRatio: 1.12, minSaving: 2 },
};

export function approachTraffic(sim, ix, iz, d) {
  const bucket = sim.buckets[segKey(ix, iz, d)] || [];
  let stopped = 0, pcu = 0, speed = 0;
  for (const vehicle of bucket) {
    stopped += Number(vehicle.speed < 0.9);
    pcu += vehicle.spec?.pcu ?? 1;
    speed += vehicle.speed;
  }
  return { vehicles: bucket.length, stopped, pcu, avgSpeed: bucket.length ? speed / bucket.length : 0 };
}

export function crossingTraffic(sim, ix, iz, incomingDir) {
  let vehicles = 0, stopped = 0, pcu = 0;
  const axis = axisOfDir(incomingDir);
  for (let d = 0; d < 4; d++) {
    if (axisOfDir(d) === axis) continue;
    const sx = ix - DIRS[d][0], sz = iz - DIRS[d][1];
    if (sx < 0 || sz < 0 || sx >= GRID || sz >= GRID) continue;
    const traffic = approachTraffic(sim, sx, sz, d);
    vehicles += traffic.vehicles; stopped += traffic.stopped; pcu += traffic.pcu;
  }
  return { vehicles, stopped, pcu };
}

export function edgeEstimate(sim, ix, iz, d) {
  const traffic = approachTraffic(sim, ix, iz, d);
  const nx = ix + DIRS[d][0], nz = iz + DIRS[d][1];
  const cross = crossingTraffic(sim, nx, nz, d);
  const policy = URGENCY_POLICIES[sim.urgency];
  const hazards = ROAD_HAZARDS.hazardsBySeg.get(segKey(ix, iz, d)) || [];
  const hazardSeconds = hazards.reduce((sum, hazard) => sum + (hazard.type === "bumper" ? 0.7 : hazard.isSlum ? 2.5 : 1), 0);
  const base = roadLength(ix, iz, d) / (sim.ambulanceMaxSpeed ?? 18);
  // Long bridge edges have proportionately more storage than short city blocks.
  const occupied = traffic.pcu * 3.4 / Math.max(5, roadLength(ix, iz, d));
  const queueSeconds = traffic.stopped * 1.1 + traffic.pcu * 0.55 + Math.max(0, occupied - 0.7) * 4;
  const canClear = cross.vehicles <= policy.crossLimit;
  const signalSeconds = canClear ? 0 : 3;
  const seconds = base + queueSeconds + hazardSeconds + signalSeconds;
  // Aggregate civilian seconds intentionally has less weight as urgency rises.
  const civilianSeconds = cross.pcu * 2.2;
  return { seconds, score: seconds + civilianSeconds * policy.civilianWeight, traffic, cross };
}

export function measureRoute(sim, route) {
  let seconds = 0, score = 0, vehicles = 0, stopped = 0;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i], d = dirBetween(a, route[i + 1]);
    if (!sim.edgeOpen(...a, d)) return { seconds: Infinity, score: Infinity, vehicles, stopped };
    const edge = edgeEstimate(sim, ...a, d);
    seconds += edge.seconds; score += edge.score;
    vehicles += edge.traffic.vehicles; stopped += edge.traffic.stopped;
  }
  return { seconds, score, vehicles, stopped };
}

// Small binary heap keeps full-network reviews cheap at a one-second cadence.
function push(heap, entry) {
  heap.push(entry);
  let i = heap.length - 1;
  while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= entry[0]) break; heap[i] = heap[p]; i = p; }
  heap[i] = entry;
}
function pop(heap) {
  const first = heap[0], last = heap.pop();
  if (!heap.length) return first;
  let i = 0;
  while (i * 2 + 1 < heap.length) {
    let j = i * 2 + 1;
    if (j + 1 < heap.length && heap[j + 1][0] < heap[j][0]) j++;
    if (heap[j][0] >= last[0]) break;
    heap[i] = heap[j]; i = j;
  }
  heap[i] = last;
  return first;
}

export function adaptiveRoute(sim, start, destination, previousNode = null) {
  const total = GRID * GRID, costs = new Float64Array(total).fill(Infinity);
  const previous = new Int32Array(total).fill(-1), heap = [];
  const first = nodeIndex(...start), target = nodeIndex(...destination);
  costs[first] = 0; push(heap, [0, first]);
  while (heap.length) {
    const [cost, id] = pop(heap);
    if (cost !== costs[id]) continue;
    if (id === target) {
      const route = [];
      for (let cursor = target; cursor !== -1; cursor = previous[cursor]) route.push([cursor % GRID, Math.floor(cursor / GRID)]);
      return route.reverse();
    }
    const ix = id % GRID, iz = Math.floor(id / GRID);
    for (let d = 0; d < 4; d++) {
      if (!sim.edgeOpen(ix, iz, d)) continue;
      const nx = ix + DIRS[d][0], nz = iz + DIRS[d][1];
      // A review cannot instruct a U-turn immediately after the committed edge.
      if (id === first && previousNode && nx === previousNode[0] && nz === previousNode[1]) continue;
      const next = nodeIndex(nx, nz), candidate = cost + edgeEstimate(sim, ix, iz, d).score;
      if (candidate >= costs[next]) continue;
      costs[next] = candidate; previous[next] = id; push(heap, [candidate, next]);
    }
  }
  return [];
}
