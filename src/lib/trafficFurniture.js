import { GRID, ROAD_W, DIRS, OPPOSITE, nodePosition, nodeIndex,
  roadLength, directedRoadSample, canTravel, isNearRoad, riverBankX,
  roadHeightAt } from "./cityGrid";

export const TRAFFIC_SIGNAL_RADIUS = 0.23;
export const PAVEMENT_WIDTH = 1.8;
export const SIGNAL_PAD_RADIUS = 0.6;
// Clearance is measured against every driving surface, including crossing roads.
export const TRAFFIC_SIGNAL_CLEARANCE = 0.8;

function buildTrafficSignals() {
  const signals = [];
  const junctions = [];
  const missingApproaches = [];
  for (let iz = 0; iz < GRID; iz++) for (let ix = 0; ix < GRID; ix++) {
    const origin = nodePosition(ix, iz);
    const degree = DIRS.reduce((sum, _, d) => sum + Number(canTravel(ix, iz, d)), 0);
    if (degree < 3 || roadHeightAt(origin.x, origin.z) >= 0.1) continue;
    const idx = nodeIndex(ix, iz);
    junctions.push({ ix, iz, idx });
    for (let d = 0; d < DIRS.length; d++) {
      const nx = ix + DIRS[d][0], nz = iz + DIRS[d][1];
      // Install a head for an approach that can actually enter this junction.
      if (!canTravel(nx, nz, OPPOSITE[d])) continue;
      const length = roadLength(ix, iz, d);
      const setbacks = [4.4, 5.2, 6.2, 7.4, 8.8, 10.2, length * 0.5]
        .filter((t) => t > 0 && t <= length - 3.2);
      let placement = null;
      for (const setback of setbacks) {
        for (const offset of [ROAD_W / 2 + 1.05, ROAD_W / 2 + 1.35, ROAD_W / 2 + 1.65]) {
          for (const side of [-1, 1]) {
            const pose = directedRoadSample(ix, iz, d, setback, side * offset);
            const { left, right } = riverBankX(pose.z);
            if (pose.x > left - 0.8 && pose.x < right + 0.8) continue;
            if (roadHeightAt(pose.x, pose.z) >= 0.1) continue;
            if (isNearRoad(pose.x, pose.z, TRAFFIC_SIGNAL_CLEARANCE)) continue;
            if (signals.some((other) => Math.hypot(other.x - pose.x, other.z - pose.z) < 1.2)) continue;
            placement = { ix, iz, idx, d, axis: d < 2 ? 0 : 1,
              x: pose.x, z: pose.z, y: roadHeightAt(pose.x, pose.z) + 0.14,
              heading: pose.heading, setback, lateral: side * offset };
            break;
          }
          if (placement) break;
        }
        if (placement) break;
      }
      if (placement) signals.push(placement);
      else missingApproaches.push({ ix, iz, idx, d });
    }
  }
  return { signals, junctions, missingApproaches };
}

const furniture = buildTrafficSignals();
export const TRAFFIC_SIGNALS = furniture.signals;
export const SIGNAL_JUNCTIONS = furniture.junctions;
export const UNPLACED_SIGNAL_APPROACHES = furniture.missingApproaches;
