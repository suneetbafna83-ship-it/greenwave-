// 500 × 500 Sprawling City Digital Twin (Footprint: -250 to +250 world units)
// Features:
// - Meandering zig-zag river with flowing water reflections & monumental suspension bridges
// - Extreme Urban Cyber Citadel strictly isolated from informal slum settlements
// - Far peripheral outer slum badlands with heavy crater clusters
// - Physically reactive building materials that visibly blush in golden morning sun,
//   glarify at noon, blaze in sunset orange-crimson, and glow with neon at night!

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import RiverEnvironment from "./RiverEnvironment";
import { TRAFFIC_SIGNALS, PAVEMENT_WIDTH, SIGNAL_PAD_RADIUS } from "../../lib/trafficFurniture";
import * as THREE from "three";
import {
  GRID,
  SPACING,
  HALF,
  ROAD_W,
  coord,
  HOSPITAL,
  DISPATCH_BASES,
  ROAD_HAZARDS,
  zoneOf,
  isRiverBlock,
  riverBankX,
  ROAD_SEGMENTS,
  roadHeightAt,
  nodePosition,
  directedRoadSample,
  ROAD_DISTRICTS,
  isNearRoad,
  isInsideRoadDistrict,
  canTravel,
} from "../../lib/cityGrid";

const BLOCK = SPACING - ROAD_W;
const PARK_BLOCKS = [
  [4, 4],
  [6, 12],
  [18, 5],
  [20, 10],
  [10, 20],
];
const BUS_TERMINAL_BLOCK = [8, 8];

const isParkBlock = (bx, bz) => PARK_BLOCKS.some(([px, pz]) => px === bx && pz === bz);
const isBusTerminal = (bx, bz) => bx === BUS_TERMINAL_BLOCK[0] && bz === BUS_TERMINAL_BLOCK[1];

// All surface layers follow the same sampled centerlines used by the traffic engine.
function roadRibbon(segments, width, elevation = 0) {
  const positions = [], indices = [];
  segments.forEach(({ points }) => {
    const first = positions.length / 3;
    points.forEach((p, i) => {
      const before = points[Math.max(0, i - 1)], after = points[Math.min(points.length - 1, i + 1)];
      const length = Math.hypot(after.x - before.x, after.z - before.z) || 1;
      const nx = -(after.z - before.z) / length, nz = (after.x - before.x) / length;
      for (const side of [-1, 1]) {
        const x = p.x + nx * width * 0.5 * side, z = p.z + nz * width * 0.5 * side;
        positions.push(x, roadHeightAt(x, z) + elevation, z);
      }
      if (i < points.length - 1) {
        const a = first + i * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    });
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices); geo.computeVertexNormals();
  return geo;
}

function footprintAvailable(x, z, w, d, districtClear = true) {
  if (districtClear && isInsideRoadDistrict(x, z)) return false;
  for (const fx of [-0.5, -0.25, 0, 0.25, 0.5]) for (const fz of [-0.5, -0.25, 0, 0.25, 0.5]) {
    if (isNearRoad(x + fx * w, z + fz * d, PAVEMENT_WIDTH)) return false;
  }
  if (TRAFFIC_SIGNALS.some((p) => Math.abs(p.x - x) < w / 2 + SIGNAL_PAD_RADIUS + 0.25 && Math.abs(p.z - z) < d / 2 + SIGNAL_PAD_RADIUS + 0.25)) return false;
  return true;
}

function sidewalkRibbons(segments) {
  const positions = [], indices = [];
  segments.forEach(({ points }) => {
    for (const side of [-1, 1]) {
      const first = positions.length / 3;
      points.forEach((p, i) => {
        const before = points[Math.max(0, i - 1)], after = points[Math.min(points.length - 1, i + 1)];
        const length = Math.hypot(after.x - before.x, after.z - before.z) || 1;
        const nx = -(after.z - before.z) / length * side, nz = (after.x - before.x) / length * side;
        const inner = ROAD_W / 2 + 0.04, outer = ROAD_W / 2 + PAVEMENT_WIDTH;
        const ix = p.x + nx * inner, iz = p.z + nz * inner, ox = p.x + nx * outer, oz = p.z + nz * outer;
        positions.push(ix, roadHeightAt(ix, iz) + 0.12, iz, ox, roadHeightAt(ox, oz) + 0.12, oz,
          ix, roadHeightAt(ix, iz) + 0.025, iz, ox, roadHeightAt(ox, oz) + 0.025, oz);
      });
      for (let i = 0; i < points.length - 1; i++) {
        const a = first + i * 4, b = a + 4;
        let clear = true;
        // A footway must stop at the junction mouth, not form a raised stripe
        // across a perpendicular or diagonal driving lane.
        for (const u of [0, 0.5, 1]) for (const v of [0, 0.5, 1]) {
          const ax = positions[a * 3] * (1 - v) + positions[(a + 1) * 3] * v;
          const az = positions[a * 3 + 2] * (1 - v) + positions[(a + 1) * 3 + 2] * v;
          const bx = positions[b * 3] * (1 - v) + positions[(b + 1) * 3] * v;
          const bz = positions[b * 3 + 2] * (1 - v) + positions[(b + 1) * 3 + 2] * v;
          if (isNearRoad(ax * (1 - u) + bx * u, az * (1 - u) + bz * u, 0.015)) clear = false;
        }
        if (clear) indices.push(a, b, a + 1, a + 1, b, b + 1, a, a + 2, b, b, a + 2, b + 2,
          a + 1, b + 1, a + 3, a + 3, b + 1, b + 3);
      }
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

function SignalPavements({ dayFactor }) {
  const ref = useRef();
  useLayoutEffect(() => {
    const m = new THREE.Object3D();
    TRAFFIC_SIGNALS.forEach((p, i) => {
      m.position.set(p.x, roadHeightAt(p.x, p.z) + 0.065, p.z); m.updateMatrix(); ref.current.setMatrixAt(i, m.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, []);
  return <instancedMesh ref={ref} args={[undefined, undefined, TRAFFIC_SIGNALS.length]}>
    <cylinderGeometry args={[SIGNAL_PAD_RADIUS, SIGNAL_PAD_RADIUS, 0.13, 12]} />
    <meshStandardMaterial color={dayFactor > 0.35 ? "#a9b5b7" : "#536b7c"} roughness={0.95} />
  </instancedMesh>;
}

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

function makeWindowTexture(repeatY, seed, cyber = false) {
  const rand = mulberry32(seed);
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#000";
  g.fillRect(0, 0, 64, 128);

  for (let y = 8; y < 120; y += 14) {
    for (let x = 6; x < 60; x += 10) {
      const r = rand();
      if (cyber) {
        if (r < 0.65) {
          g.fillStyle = r < 0.15 ? "#38bdf8" : r < 0.45 ? "#22d3ee" : "#0284c7";
          g.fillRect(x, y, 7, 5);
        }
      } else {
        if (r < 0.45) {
          g.fillStyle = r < 0.08 ? "#facc15" : r < 0.3 ? "#e2e8f0" : "#64748b";
          g.fillRect(x, y, 6, 5);
        }
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, repeatY);
  return tex;
}

function makeBumperTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 32;
  const g = c.getContext("2d");
  g.fillStyle = "#111827";
  g.fillRect(0, 0, 128, 32);
  g.fillStyle = "#facc15";
  for (let x = -32; x < 160; x += 24) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + 12, 0);
    g.lineTo(x + 24, 32);
    g.lineTo(x + 12, 32);
    g.closePath();
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function drawLabel(canvas, text, color) {
  const g = canvas.getContext("2d");
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = "rgba(2, 6, 23, 0.92)";
  g.strokeStyle = color;
  g.lineWidth = 4;
  g.beginPath();
  g.roundRect(4, 4, canvas.width - 8, canvas.height - 8, 18);
  g.fill();
  g.stroke();

  g.font = '600 42px "Chakra Petch", "Segoe UI", sans-serif';
  g.fillStyle = color;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
}

export function Label({ text, color = "#22d3ee", position, width = 24 }) {
  const { texture, canvas } = useMemo(() => {
    const cv = document.createElement("canvas");
    cv.width = 720;
    cv.height = 116;
    drawLabel(cv, text, color);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return { texture: tex, canvas: cv };
  }, [text, color]);

  useEffect(() => {
    document.fonts?.ready.then(() => {
      drawLabel(canvas, text, color);
      texture.needsUpdate = true;
    });
    return () => texture.dispose();
  }, [canvas, texture, text, color]);

  return (
    <sprite position={position} scale={[width, width * 0.165, 1]} renderOrder={10}>
      <spriteMaterial map={texture} transparent depthTest={false} toneMapped={false} />
    </sprite>
  );
}

function Ground({ dayFactor }) {
  const size = HALF * 2 + ROAD_W + 50;
  const isDay = dayFactor > 0.35;
  const land = useMemo(() => {
    const positions = [], indices = [];
    for (let i = 0; i <= 360; i++) {
      const z = -size / 2 + (i / 360) * size;
      const { left, right } = riverBankX(z);
      positions.push(-size / 2, -0.04, z, left, -0.04, z,
        right, -0.04, z, size / 2, -0.04, z);
      if (i < 360) {
        const a = i * 4;
        indices.push(a, a + 4, a + 1, a + 1, a + 4, a + 5,
          a + 2, a + 6, a + 3, a + 3, a + 6, a + 7);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices); geo.computeVertexNormals();
    return geo;
  }, [size]);
  useEffect(() => () => land.dispose(), [land]);
  return (
    <group>
      <mesh geometry={land}>
        <meshStandardMaterial color={isDay ? "#1e293b" : "#080e1a"} roughness={0.95} />
      </mesh>
    </group>
  );
}

// ───────────────────── Architectural Bridge Components ─────────────────────

// Helper: generate 3D curved tube / line points for Catenary Suspension Cables
function createCatenaryPoints(span, pylonDist, pylonH, sagY) {
  const pts = [];
  const count = 36;
  const pylonX = pylonDist;
  const anchorX = span * 0.49;

  for (let i = 0; i <= count; i++) {
    const x = -anchorX + (i / count) * (anchorX * 2);
    let y = 0.6;
    if (Math.abs(x) <= pylonX) {
      // Main span sag curve between pylons
      const u = x / pylonX;
      y = sagY + (pylonH - sagY) * (u * u);
    } else {
      // Backstay anchor cable dropping from pylon saddle down to shore anchor block
      const side = Math.sign(x);
      const frac = (Math.abs(x) - pylonX) / (anchorX - pylonX);
      y = pylonH - frac * (pylonH - 0.6);
    }
    pts.push(new THREE.Vector3(x, y, 0));
  }
  return pts;
}

// 1. Monumental Grand Suspension Bridge (Main Artery - Grand Suspension Way)
function GrandSuspensionBridge({ b, isDay }) {
  const span = b.span;
  const pylonDist = span * 0.28;
  const pylonH = 32.0;
  const deckW = ROAD_W + 1.8;
  const halfRoad = deckW / 2;

  // Generate North and South catenary main cables
  const { cableGeoNorth, cableGeoSouth, hangers } = useMemo(() => {
    const curveNorth = new THREE.CatmullRomCurve3(createCatenaryPoints(span, pylonDist, pylonH, 1.8));
    const curveSouth = new THREE.CatmullRomCurve3(createCatenaryPoints(span, pylonDist, pylonH, 1.8));
    const geoN = new THREE.TubeGeometry(curveNorth, 40, 0.22, 8, false);
    const geoS = new THREE.TubeGeometry(curveSouth, 40, 0.22, 8, false);

    // Vertical suspender wire rods every 3 units along the span
    const hList = [];
    const hCount = 14;
    for (let i = -hCount; i <= hCount; i++) {
      const x = (i / hCount) * (pylonDist * 0.92);
      const u = x / pylonDist;
      const topY = 1.8 + (pylonH - 1.8) * (u * u);
      const hHeight = Math.max(0.5, topY - 0.6);
      hList.push({ x, y: 0.6 + hHeight / 2, h: hHeight });
    }

    return { cableGeoNorth: geoN, cableGeoSouth: geoS, hangers: hList };
  }, [span, pylonDist, pylonH]);

  const pylonColor = isDay ? "#cbd5e1" : "#1e293b";
  const steelAccent = isDay ? "#0284c7" : "#38bdf8";

  return (
    <group position={[b.x, 0, b.z]}>
      {/* Heavy Concrete Shoreline Abutments (West & East) */}
      {[-span * 0.48, span * 0.48].map((ax, ai) => (
        <mesh key={ai} position={[ax, -0.4, 0]}>
          <boxGeometry args={[4.5, 2.2, deckW + 1.8]} />
          <meshStandardMaterial color={isDay ? "#475569" : "#1e293b"} roughness={0.7} />
        </mesh>
      ))}

      {/* Elevated Bridge Deck */}
      <mesh position={[0, 0.48, 0]}>
        <boxGeometry args={[span, 0.65, deckW]} />
        <meshStandardMaterial color={isDay ? "#334155" : "#0f172a"} roughness={0.4} metalness={0.6} />
      </mesh>

      {/* Continuous Glowing Neon Edge Fairings / Guardrails */}
      <mesh position={[0, 0.96, halfRoad]}>
        <boxGeometry args={[span, 0.38, 0.16]} />
        <meshBasicMaterial color="#5effc1" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.96, -halfRoad]}>
        <boxGeometry args={[span, 0.38, 0.16]} />
        <meshBasicMaterial color="#5effc1" toneMapped={false} />
      </mesh>

      {/* Main Suspension Cables (North & South) */}
      <mesh geometry={cableGeoNorth} position={[0, 0, halfRoad]}>
        <meshStandardMaterial color={steelAccent} roughness={0.25} metalness={0.8} />
      </mesh>
      <mesh geometry={cableGeoSouth} position={[0, 0, -halfRoad]}>
        <meshStandardMaterial color={steelAccent} roughness={0.25} metalness={0.8} />
      </mesh>

      {/* Vertical Cable Suspenders (Wire Hangers) */}
      {hangers.map((h, hi) => (
        <group key={hi}>
          <mesh position={[h.x, h.y, halfRoad]}>
            <cylinderGeometry args={[0.045, 0.045, h.h, 6]} />
            <meshBasicMaterial color={steelAccent} />
          </mesh>
          <mesh position={[h.x, h.y, -halfRoad]}>
            <cylinderGeometry args={[0.045, 0.045, h.h, 6]} />
            <meshBasicMaterial color={steelAccent} />
          </mesh>
        </group>
      ))}

      {/* Twin Soaring Gothic-Cyber Suspension Towers (West & East Pylons) */}
      {[-pylonDist, pylonDist].map((tx, ti) => (
        <group key={ti} position={[tx, 0, 0]}>
          {/* Concrete Water Pier Foundation extending into riverbed */}
          <mesh position={[0, -1.2, 0]}>
            <cylinderGeometry args={[2.2, 2.6, 2.6, 16]} />
            <meshStandardMaterial color={isDay ? "#475569" : "#1e293b"} roughness={0.8} />
          </mesh>

          {/* North Column */}
          <mesh position={[0, pylonH / 2, halfRoad + 0.3]}>
            <boxGeometry args={[1.6, pylonH, 1.4]} />
            <meshStandardMaterial color={pylonColor} roughness={0.3} metalness={0.7} />
          </mesh>
          {/* South Column */}
          <mesh position={[0, pylonH / 2, -halfRoad - 0.3]}>
            <boxGeometry args={[1.6, pylonH, 1.4]} />
            <meshStandardMaterial color={pylonColor} roughness={0.3} metalness={0.7} />
          </mesh>

          {/* Architectural Cross Bracing at 3 elevations */}
          {[10, 20, pylonH - 0.6].map((by, bi) => (
            <mesh key={bi} position={[0, by, 0]}>
              <boxGeometry args={[1.8, bi === 2 ? 1.2 : 0.8, deckW + 2.0]} />
              <meshStandardMaterial color={pylonColor} metalness={0.8} />
            </mesh>
          ))}

          {/* Glowing Cyber Pylon Accents */}
          <mesh position={[0, pylonH / 2, halfRoad + 1.05]}>
            <boxGeometry args={[0.2, pylonH * 0.9, 0.1]} />
            <meshBasicMaterial color="#5effc1" toneMapped={false} />
          </mesh>
          <mesh position={[0, pylonH / 2, -halfRoad - 1.05]}>
            <boxGeometry args={[0.2, pylonH * 0.9, 0.1]} />
            <meshBasicMaterial color="#5effc1" toneMapped={false} />
          </mesh>

          {/* Aircraft Warning Strobe atop Tower Pinnacle */}
          <mesh position={[0, pylonH + 0.8, halfRoad + 0.3]}>
            <sphereGeometry args={[0.38, 8, 8]} />
            <meshBasicMaterial color="#ff2d55" toneMapped={false} />
          </mesh>
          <mesh position={[0, pylonH + 0.8, -halfRoad - 0.3]}>
            <sphereGeometry args={[0.38, 8, 8]} />
            <meshBasicMaterial color="#ff2d55" toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* 3D Overhead Landmark Label */}
      <Label
        text="🌉 GRAND SUSPENSION BRIDGE (CENTRAL ARTERY)"
        color="#5effc1"
        position={[0, 20, 0]}
        width={32}
      />
    </group>
  );
}

// 2. North Tied-Arch Bridge (Through-Arch with illuminated steel ribs)
function NorthArchBridge({ b, isDay }) {
  const span = b.span;
  const archRise = 15.0;
  const deckW = ROAD_W + 1.4;
  const halfRoad = deckW / 2;

  // Parabolic Arch Rib Points
  const { archGeoN, archGeoS, archHangers } = useMemo(() => {
    const ptsN = [];
    const ptsS = [];
    const count = 30;
    const archSpan = span * 0.88;

    for (let i = 0; i <= count; i++) {
      const u = (i / count) * 2 - 1; // -1 to +1
      const x = u * (archSpan / 2);
      const y = 0.6 + archRise * (1 - u * u);
      ptsN.push(new THREE.Vector3(x, y, halfRoad));
      ptsS.push(new THREE.Vector3(x, y, -halfRoad));
    }

    const cN = new THREE.CatmullRomCurve3(ptsN);
    const cS = new THREE.CatmullRomCurve3(ptsS);
    const gN = new THREE.TubeGeometry(cN, 32, 0.28, 8, false);
    const gS = new THREE.TubeGeometry(cS, 32, 0.28, 8, false);

    // Hangers
    const hList = [];
    for (let i = 1; i < 11; i++) {
      const u = (i / 11) * 2 - 1;
      const x = u * (archSpan / 2);
      const topY = 0.6 + archRise * (1 - u * u);
      hList.push({ x, y: 0.6 + (topY - 0.6) / 2, h: topY - 0.6 });
    }

    return { archGeoN: gN, archGeoS: gS, archHangers: hList };
  }, [span, archRise, halfRoad]);

  return (
    <group position={[b.x, 0, b.z]}>
      {/* Elevated Deck */}
      <mesh position={[0, 0.48, 0]}>
        <boxGeometry args={[span, 0.6, deckW]} />
        <meshStandardMaterial color={isDay ? "#334155" : "#0f172a"} roughness={0.4} metalness={0.6} />
      </mesh>

      {/* Guardrails */}
      <mesh position={[0, 0.95, halfRoad]}>
        <boxGeometry args={[span, 0.35, 0.15]} />
        <meshBasicMaterial color="#38bdf8" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.95, -halfRoad]}>
        <boxGeometry args={[span, 0.35, 0.15]} />
        <meshBasicMaterial color="#38bdf8" toneMapped={false} />
      </mesh>

      {/* Sweeping Structural Arch Ribs */}
      <mesh geometry={archGeoN}>
        <meshStandardMaterial color="#0284c7" metalness={0.8} roughness={0.25} emissive="#0369a1" emissiveIntensity={0.3} />
      </mesh>
      <mesh geometry={archGeoS}>
        <meshStandardMaterial color="#0284c7" metalness={0.8} roughness={0.25} emissive="#0369a1" emissiveIntensity={0.3} />
      </mesh>

      {/* Vertical Arch Hanger Cables */}
      {archHangers.map((h, hi) => (
        <group key={hi}>
          <mesh position={[h.x, h.y, halfRoad]}>
            <cylinderGeometry args={[0.045, 0.045, h.h, 6]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
          <mesh position={[h.x, h.y, -halfRoad]}>
            <cylinderGeometry args={[0.045, 0.045, h.h, 6]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
        </group>
      ))}

      {/* Substructure Riverbed Piers */}
      {[-span * 0.38, span * 0.38].map((px, pi) => (
        <mesh key={pi} position={[px, -1.0, 0]}>
          <cylinderGeometry args={[1.5, 1.8, 2.5, 12]} />
          <meshStandardMaterial color={isDay ? "#475569" : "#1e293b"} roughness={0.8} />
        </mesh>
      ))}

      <Label text="🌉 NORTH ARCH RIVER CROSSING" color="#38bdf8" position={[0, 18, 0]} width={26} />
    </group>
  );
}

// 3. South Cable-Stayed Bridge (Inverted-Y Central Needle Pylon)
function SouthCableStayBridge({ b, isDay }) {
  const span = b.span;
  const pylonH = 26.0;
  const deckW = ROAD_W + 1.4;
  const halfRoad = deckW / 2;

  // Fan stay cables
  const stayCables = useMemo(() => {
    const list = [];
    const count = 7;
    for (let i = 1; i <= count; i++) {
      const dist = (i / count) * (span * 0.42);
      const topY = pylonH - 2 - i * 1.0;
      // West stays and East stays
      list.push({ from: [0, topY, 0], to: [-dist, 0.6, halfRoad] });
      list.push({ from: [0, topY, 0], to: [dist, 0.6, halfRoad] });
      list.push({ from: [0, topY, 0], to: [-dist, 0.6, -halfRoad] });
      list.push({ from: [0, topY, 0], to: [dist, 0.6, -halfRoad] });
    }
    return list;
  }, [span, pylonH, halfRoad]);

  return (
    <group position={[b.x, 0, b.z]}>
      {/* Elevated Deck */}
      <mesh position={[0, 0.48, 0]}>
        <boxGeometry args={[span, 0.6, deckW]} />
        <meshStandardMaterial color={isDay ? "#334155" : "#0f172a"} roughness={0.4} metalness={0.6} />
      </mesh>

      {/* Guardrails */}
      <mesh position={[0, 0.95, halfRoad]}>
        <boxGeometry args={[span, 0.35, 0.15]} />
        <meshBasicMaterial color="#e879f9" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.95, -halfRoad]}>
        <boxGeometry args={[span, 0.35, 0.15]} />
        <meshBasicMaterial color="#e879f9" toneMapped={false} />
      </mesh>

      {/* Central Inverted-Y Needle Pylon */}
      <group position={[0, 0, 0]}>
        {/* Riverbed Pier */}
        <mesh position={[0, -1.2, 0]}>
          <cylinderGeometry args={[2.0, 2.4, 2.6, 16]} />
          <meshStandardMaterial color={isDay ? "#475569" : "#1e293b"} roughness={0.8} />
        </mesh>

        {/* Lower V-legs spreading around roadway */}
        <mesh position={[0, 5.0, halfRoad + 0.4]} rotation-x={-0.12}>
          <boxGeometry args={[1.4, 10, 1.2]} />
          <meshStandardMaterial color={isDay ? "#cbd5e1" : "#1e293b"} metalness={0.8} />
        </mesh>
        <mesh position={[0, 5.0, -halfRoad - 0.4]} rotation-x={0.12}>
          <boxGeometry args={[1.4, 10, 1.2]} />
          <meshStandardMaterial color={isDay ? "#cbd5e1" : "#1e293b"} metalness={0.8} />
        </mesh>

        {/* Upper Needle Mast */}
        <mesh position={[0, pylonH / 2 + 5, 0]}>
          <boxGeometry args={[1.6, pylonH - 5, 1.6]} />
          <meshStandardMaterial color={isDay ? "#cbd5e1" : "#1e293b"} metalness={0.8} />
        </mesh>

        {/* Pinnacle Warning Beacon */}
        <mesh position={[0, pylonH + 5.5, 0]}>
          <sphereGeometry args={[0.35, 8, 8]} />
          <meshBasicMaterial color="#ff2d55" toneMapped={false} />
        </mesh>
      </group>

      {/* Radiant Fan Stay Cables */}
      {stayCables.map((c, ci) => {
        const dx = c.to[0] - c.from[0];
        const dy = c.to[1] - c.from[1];
        const dz = c.to[2] - c.from[2];
        const len = Math.hypot(dx, dy, dz);
        const mx = (c.from[0] + c.to[0]) / 2;
        const my = (c.from[1] + c.to[1]) / 2;
        const mz = (c.from[2] + c.to[2]) / 2;

        return (
          <mesh
            key={ci}
            position={[mx, my, mz]}
            quaternion={new THREE.Quaternion().setFromUnitVectors(
              new THREE.Vector3(0, 1, 0),
              new THREE.Vector3(dx, dy, dz).normalize()
            )}
          >
            <cylinderGeometry args={[0.04, 0.04, len, 6]} />
            <meshBasicMaterial color="#f0abfc" toneMapped={false} />
          </mesh>
        );
      })}

      <Label text="🌉 SOUTH CABLE-STAYED CROSSING" color="#e879f9" position={[0, 20, 0]} width={28} />
    </group>
  );
}

// 4. Standard Continuous Girder Expressway River Viaducts (All other crossings)
function StandardRiverBridge({ b, isDay }) {
  const span = b.span;
  const deckW = ROAD_W + 0.8;
  const halfRoad = deckW / 2;

  return (
    <group position={[b.x, 0, b.z]}>
      {/* Concrete Abutments on Banks */}
      {[-span * 0.48, span * 0.48].map((ax, ai) => (
        <mesh key={ai} position={[ax, -0.4, 0]}>
          <boxGeometry args={[3.5, 2.0, deckW + 1.2]} />
          <meshStandardMaterial color={isDay ? "#475569" : "#1e293b"} roughness={0.8} />
        </mesh>
      ))}

      {/* Elevated Viaduct Deck */}
      <mesh position={[0, 0.48, 0]}>
        <boxGeometry args={[span, 0.6, deckW]} />
        <meshStandardMaterial color={isDay ? "#334155" : "#1e293b"} roughness={0.4} metalness={0.5} />
      </mesh>

      {/* Luminous Guardrails */}
      <mesh position={[0, 0.95, halfRoad]}>
        <boxGeometry args={[span, 0.35, 0.14]} />
        <meshBasicMaterial color="#38bdf8" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.95, -halfRoad]}>
        <boxGeometry args={[span, 0.35, 0.14]} />
        <meshBasicMaterial color="#38bdf8" toneMapped={false} />
      </mesh>

      {/* Heavy Cylindrical Riverbed Piers with navigation clearance */}
      {[-span * 0.28, span * 0.28].map((px, pi) => (
        <group key={pi} position={[px, 0, 0]}>
          <mesh position={[0, -1.0, 0]}>
            <cylinderGeometry args={[1.1, 1.4, 2.8, 14]} />
            <meshStandardMaterial color={isDay ? "#475569" : "#1e293b"} roughness={0.8} metalness={0.3} />
          </mesh>
          {/* Pier Cap Beam */}
          <mesh position={[0, 0.12, 0]}>
            <boxGeometry args={[2.6, 0.4, deckW + 0.6]} />
            <meshStandardMaterial color={isDay ? "#475569" : "#1e293b"} metalness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ───────────────────── Architectural River Bridges Master Layer ─────────────────────
function RiverBridges({ bridges, dayFactor }) {
  const isDay = dayFactor > 0.35;

  return (
    <group>
      {bridges.map((b) => {
        if (b.isGrand) {
          return <GrandSuspensionBridge key={b.iz} b={b} isDay={isDay} />;
        }
        if (b.isArch) {
          return <NorthArchBridge key={b.iz} b={b} isDay={isDay} />;
        }
        if (b.isCableStay) {
          return <SouthCableStayBridge key={b.iz} b={b} isDay={isDay} />;
        }
        return <StandardRiverBridge key={b.iz} b={b} isDay={isDay} />;
      })}
    </group>
  );
}
function Sidewalks({ dayFactor }) {
  const ref = useRef();
  const blocks = useMemo(() => {
    const out = [];
    for (let bz = 0; bz < GRID - 1; bz++) {
      for (let bx = 0; bx < GRID - 1; bx++) {
        if (isRiverBlock(bx, bz)) continue; // No sidewalks inside the river
        const x = coord(bx) + SPACING / 2, z = coord(bz) + SPACING / 2;
        if (!footprintAvailable(x, z, BLOCK - 1.2, BLOCK - 1.2)) continue;
        out.push([x, z, bx, bz]);
      }
    }
    return out;
  }, []);

  useLayoutEffect(() => {
    const m = new THREE.Object3D();
    const c = new THREE.Color();
    blocks.forEach(([x, z, bx, bz], i) => {
      m.position.set(x, 0.08, z);
      m.scale.set(BLOCK - 0.8, 0.16, BLOCK - 0.8);
      m.updateMatrix();
      ref.current.setMatrixAt(i, m.matrix);
      const zone = zoneOf(bx, bz);
      const park = isParkBlock(bx, bz);
      const terminal = isBusTerminal(bx, bz);

      let color = dayFactor > 0.35 ? "#334155" : "#111827";
      if (park) color = "#064e3b";
      else if (terminal) color = "#1e293b";
      else if (zone === "underdeveloped_slum") color = "#292524";
      else if (zone === "cyber_district") color = dayFactor > 0.35 ? "#1e293b" : "#091224";

      ref.current.setColorAt(i, c.set(color));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [blocks, dayFactor]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, blocks.length]}>
      <boxGeometry />
      <meshStandardMaterial roughness={0.9} />
    </instancedMesh>
  );
}

function RoadSurfaces({ dayFactor }) {
  const joins = useRef();
  const { surface, curb, pavement, junctions } = useMemo(() => {
    const roads = ROAD_SEGMENTS.filter((s) => !s.bridge);
    const nodes = new Map();
    roads.forEach((s) => {
      for (const p of [s.points[0], s.points[s.points.length - 1]]) nodes.set(`${p.x.toFixed(4)},${p.z.toFixed(4)}`, p);
    });
    return { surface: roadRibbon(roads, ROAD_W, 0.025), curb: roadRibbon(roads, ROAD_W + PAVEMENT_WIDTH * 2, 0.012), pavement: sidewalkRibbons(roads), junctions: [...nodes.values()] };
  }, []);
  useEffect(() => () => { surface.dispose(); curb.dispose(); pavement.dispose(); }, [surface, curb, pavement]);
  useLayoutEffect(() => {
    const m = new THREE.Object3D();
    junctions.forEach((p, i) => {
      m.position.set(p.x, roadHeightAt(p.x, p.z) + 0.021, p.z);
      m.updateMatrix(); joins.current.setMatrixAt(i, m.matrix);
    });
    joins.current.instanceMatrix.needsUpdate = true;
  }, [junctions]);
  const asphalt = dayFactor > 0.35 ? "#15232d" : "#0b1421";
  return <group>
    <mesh geometry={curb}><meshStandardMaterial color={dayFactor > 0.35 ? "#8b9b9f" : "#405a66"} roughness={0.95} side={THREE.DoubleSide} /></mesh>
    <mesh geometry={surface}><meshStandardMaterial color={asphalt} roughness={0.95} side={THREE.DoubleSide} /></mesh>
    <mesh geometry={pavement}><meshStandardMaterial color={dayFactor > 0.35 ? "#a9b5b7" : "#536b7c"} roughness={0.95} side={THREE.DoubleSide} /></mesh>
    <instancedMesh ref={joins} args={[undefined, undefined, junctions.length]}>
      <cylinderGeometry args={[ROAD_W / 2, ROAD_W / 2, 0.015, 16]} />
      <meshStandardMaterial color={asphalt} roughness={0.95} />
    </instancedMesh>
  </group>;
}

function RoadMarkings() {
  const ref = useRef();
  const dashes = useMemo(() => {
    const out = [];
    ROAD_SEGMENTS.forEach((s) => {
      for (let t = 3.7; t < s.length - 2.4; t += 7) {
        const p = directedRoadSample(s.ix, s.iz, s.axis === 0 ? 0 : 2, t);
        out.push([p.x, p.z, p.heading]);
      }
    });
    return out;
  }, []);

  useLayoutEffect(() => {
    const m = new THREE.Object3D();
    dashes.forEach(([x, z, heading], i) => {
      m.position.set(x, 0.045 + roadHeightAt(x, z), z);
      m.rotation.set(-Math.PI / 2, 0, heading);
      m.scale.set(2.4, 0.16, 1);
      m.updateMatrix();
      ref.current.setMatrixAt(i, m.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [dashes]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, dashes.length]}>
      <planeGeometry />
      <meshBasicMaterial color="#c3d1ca" transparent opacity={0.65} />
    </instancedMesh>
  );
}

function RoundaboutArrows() {
  const ref = useRef();
  const { geometry, arrows } = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(1.6, 0); shape.lineTo(0.25, 0.8); shape.lineTo(0.25, 0.28);
    shape.lineTo(-1.35, 0.28); shape.lineTo(-1.35, -0.28); shape.lineTo(0.25, -0.28);
    shape.lineTo(0.25, -0.8); shape.closePath();
    const arrows = [];
    ROAD_DISTRICTS.filter((district) => district.oneWay).forEach((district) => {
      const [x0, z0, x1, z1] = district.bounds;
      ROAD_SEGMENTS.forEach((s) => {
        const nx = s.ix + (s.axis === 0 ? 1 : 0), nz = s.iz + (s.axis === 1 ? 1 : 0);
        if (s.ix < x0 || s.ix > x1 || s.iz < z0 || s.iz > z1 || nx > x1 || nz > z1) return;
        const forward = s.axis === 0 ? 0 : 2;
        arrows.push(canTravel(s.ix, s.iz, forward)
          ? directedRoadSample(s.ix, s.iz, forward, s.length * 0.5)
          : directedRoadSample(nx, nz, s.axis === 0 ? 1 : 3, s.length * 0.5));
      });
    });
    return { geometry: new THREE.ShapeGeometry(shape), arrows };
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const m = new THREE.Object3D();
    arrows.forEach((p, i) => {
      m.position.set(p.x, roadHeightAt(p.x, p.z) + 0.09, p.z);
      m.rotation.set(-Math.PI / 2, 0, p.heading); m.updateMatrix();
      ref.current.setMatrixAt(i, m.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [arrows]);
  return arrows.length > 0 && <instancedMesh ref={ref} args={[geometry, undefined, arrows.length]}>
    <meshBasicMaterial color="#f4edcf" side={THREE.DoubleSide} />
  </instancedMesh>;
}

function SpeedBumpers({ showHazards }) {
  const meshRef = useRef();
  const glowRef = useRef();
  const bumpers = ROAD_HAZARDS.bumpers;
  const stripeTex = useMemo(() => makeBumperTexture(), []);

  useLayoutEffect(() => {
    if (!meshRef.current) return undefined;
    const m = new THREE.Object3D();
    bumpers.forEach((b, i) => {
      m.position.set(b.x, roadHeightAt(b.x, b.z) + 0.1, b.z);
      m.rotation.set(0, b.heading ?? (b.axis === 0 ? 0 : Math.PI / 2), 0);
      m.scale.set(0.75, 0.18, ROAD_W - 0.4);
      m.updateMatrix();
      meshRef.current.setMatrixAt(i, m.matrix);

      if (glowRef.current) {
        m.position.set(b.x, roadHeightAt(b.x, b.z) + 0.05, b.z);
        m.rotation.set(-Math.PI / 2, 0, b.heading ?? (b.axis === 0 ? 0 : Math.PI / 2));
        m.scale.set(1.2, ROAD_W - 0.2, 1);
        m.updateMatrix();
        glowRef.current.setMatrixAt(i, m.matrix);
      }
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (glowRef.current) glowRef.current.instanceMatrix.needsUpdate = true;
    return () => stripeTex.dispose();
  }, [bumpers, stripeTex]);

  useFrame(({ clock }) => {
    if (!glowRef.current) return;
    glowRef.current.visible = showHazards;
    if (showHazards) {
      glowRef.current.material.opacity = 0.25 + 0.2 * Math.sin(clock.elapsedTime * 4);
    }
  });

  if (!bumpers.length) return null;
  return (
    <group>
      <instancedMesh ref={meshRef} args={[undefined, undefined, bumpers.length]}>
        <boxGeometry />
        <meshStandardMaterial
          map={stripeTex}
          emissive="#f59e0b"
          emissiveMap={stripeTex}
          emissiveIntensity={0.45}
          roughness={0.6}
        />
      </instancedMesh>
      <instancedMesh ref={glowRef} args={[undefined, undefined, bumpers.length]}>
        <planeGeometry />
        <meshBasicMaterial color="#facc15" transparent opacity={0.3} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

function Potholes({ showHazards }) {
  const rimRef = useRef();
  const pitRef = useRef();
  const ringRef = useRef();
  const potholes = ROAD_HAZARDS.potholes;

  useLayoutEffect(() => {
    if (!rimRef.current || !pitRef.current) return;
    const m = new THREE.Object3D();
    const c = new THREE.Color();
    potholes.forEach((p, i) => {
      m.position.set(p.x, 0.016, p.z);
      m.rotation.set(-Math.PI / 2, 0, (i * 1.3) % Math.PI);
      m.scale.set(p.radius * 1.4, p.radius * 1.15, 1);
      m.updateMatrix();
      rimRef.current.setMatrixAt(i, m.matrix);

      m.position.set(p.x, 0.02, p.z);
      m.scale.set(p.radius * 0.95, p.radius * 0.8, 1);
      m.updateMatrix();
      pitRef.current.setMatrixAt(i, m.matrix);

      if (ringRef.current) {
        m.position.set(p.x, 0.03, p.z);
        m.rotation.set(-Math.PI / 2, 0, 0);
        m.scale.setScalar(p.radius * 1.9);
        m.updateMatrix();
        ringRef.current.setMatrixAt(i, m.matrix);
        ringRef.current.setColorAt(i, c.set(p.isSlum ? "#f43f5e" : "#fb923c"));
      }
    });
    rimRef.current.instanceMatrix.needsUpdate = true;
    pitRef.current.instanceMatrix.needsUpdate = true;
    if (ringRef.current) {
      ringRef.current.instanceMatrix.needsUpdate = true;
      if (ringRef.current.instanceColor) ringRef.current.instanceColor.needsUpdate = true;
    }
  }, [potholes]);

  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    ringRef.current.visible = showHazards;
    if (showHazards) {
      ringRef.current.material.opacity = 0.4 + 0.35 * Math.sin(clock.elapsedTime * 5 + 1);
    }
  });

  if (!potholes.length) return null;
  return (
    <group>
      <instancedMesh ref={rimRef} args={[undefined, undefined, potholes.length]}>
        <circleGeometry args={[1, 10]} />
        <meshStandardMaterial color="#292524" roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={pitRef} args={[undefined, undefined, potholes.length]}>
        <circleGeometry args={[1, 10]} />
        <meshStandardMaterial color="#020617" metalness={0.9} roughness={0.2} />
      </instancedMesh>
      <instancedMesh ref={ringRef} args={[undefined, undefined, potholes.length]}>
        <ringGeometry args={[0.78, 1.0, 18]} />
        <meshBasicMaterial transparent opacity={0.5} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

// ───────────────────── Diverse Buildings with Strict Separation ─────────────────────
function useDiverseBuildings() {
  return useMemo(() => {
    const rand = mulberry32(7331);
    const cyberTowers = [];
    const commercialBldgs = [];
    const slumShacks = [];
    const beacons = [];

    const cyberTints = ["#0f172a", "#1e293b", "#0284c7", "#0e7490", "#172554"];
    const commTints = ["#334155", "#475569", "#64748b", "#3f3f46", "#52525b"];
    const slumTints = ["#78350f", "#92400e", "#b45309", "#1e3a8a", "#57534e", "#713f12", "#451a03"];

    for (let bz = 0; bz < GRID - 1; bz++) {
      for (let bx = 0; bx < GRID - 1; bx++) {
        if (bx === HOSPITAL.block[0] && bz === HOSPITAL.block[1]) continue;
        if (isParkBlock(bx, bz) || isBusTerminal(bx, bz)) continue;
        if (isRiverBlock(bx, bz)) continue; // SKIP river blocks completely!

        const zone = zoneOf(bx, bz);
        const cx = coord(bx) + SPACING / 2;
        const cz = coord(bz) + SPACING / 2;

        if (zone === "underdeveloped_slum") {
          // PERIPHERAL SLUMS (Outer Badlands across the river, strictly > 210m from cyber core)
          const shackCount = 8 + Math.floor(rand() * 5);
          for (let s = 0; s < shackCount; s++) {
            const ox = (rand() - 0.5) * (BLOCK - 2.0);
            const oz = (rand() - 0.5) * (BLOCK - 2.0);
            const w = 1.8 + rand() * 1.4;
            const d = 1.8 + rand() * 1.4;
            const h = 1.6 + rand() * 2.2;
            const rotY = (rand() - 0.5) * 0.45;
            slumShacks.push({
              x: cx + ox,
              z: cz + oz,
              w,
              d,
              h,
              rotY,
              color: slumTints[Math.floor(rand() * slumTints.length)],
            });
          }
        } else if (zone === "cyber_district") {
          // EXTREME URBAN CYBER CITADEL (Tall skyscrapers up to 58m tall!)
          const isMegaTower = rand() < 0.45;
          if (isMegaTower) {
            const w = BLOCK - 4.5;
            const d = BLOCK - 4.5;
            const h = 32 + rand() * 26; // Soaring 58m skyscraper!
            cyberTowers.push({
              x: cx,
              z: cz,
              w,
              d,
              h,
              color: cyberTints[Math.floor(rand() * cyberTints.length)],
            });
            beacons.push([cx, h + 0.5, cz]);
          } else {
            // Twin setback towers
            const offsets = [[-1.9, -1.9], [1.9, 1.9]];
            offsets.forEach(([ox, oz]) => {
              const w = 3.2 + rand() * 0.5;
              const d = 3.2 + rand() * 0.5;
              const h = 22 + rand() * 18;
              cyberTowers.push({
                x: cx + ox,
                z: cz + oz,
                w,
                d,
                h,
                color: cyberTints[Math.floor(rand() * cyberTints.length)],
              });
              if (h > 25) beacons.push([cx + ox, h + 0.5, cz + oz]);
            });
          }
        } else {
          // COMMERCIAL & MEDICAL DISTRICTS (Mid-rises 8m to 20m)
          const lots = [[-2, -2], [2, -2], [-2, 2], [2, 2]];
          lots.forEach(([ox, oz]) => {
            if (rand() < 0.15) return;
            const w = 2.9 + rand() * 0.4;
            const d = 2.9 + rand() * 0.4;
            const h = 6.5 + rand() * 14.0;
            commercialBldgs.push({
              x: cx + ox,
              z: cz + oz,
              w,
              d,
              h,
              color: commTints[Math.floor(rand() * commTints.length)],
            });
          });
        }
      }
    }

    const clear = (b) => footprintAvailable(b.x, b.z, b.w + 0.7, b.d + 0.7);
    const keptTowers = cyberTowers.filter(clear);
    const towerLocations = new Set(keptTowers.map((b) => `${b.x},${b.z}`));
    return {
      cyberTowers: keptTowers,
      commercialBldgs: commercialBldgs.filter(clear),
      slumShacks: slumShacks.filter(clear),
      beacons: beacons.filter(([x, , z]) => towerLocations.has(`${x},${z}`)),
    };
  }, []);
}

// ───────────────────── Physically Reactive Building Materials ─────────────────────
// Buildings dynamically reflect morning golden hour, noon glare, and sunset crimson!
function CyberSkyscrapers({ items, lighting }) {
  const ref = useRef();
  const matRef = useRef();
  const texture = useMemo(() => makeWindowTexture(3, 442, true), []);
  const dayFactor = lighting?.dayFactor ?? 0.5;

  useLayoutEffect(() => {
    if (!ref.current) return;
    const m = new THREE.Object3D();
    const c = new THREE.Color();
    items.forEach((b, i) => {
      m.position.set(b.x, b.h / 2 + 0.16, b.z);
      m.scale.set(b.w, b.h, b.d);
      m.updateMatrix();
      ref.current.setMatrixAt(i, m.matrix);
      ref.current.setColorAt(i, c.set(b.color));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    return () => texture.dispose();
  }, [items, texture]);

  // Dynamically update building material emissive and specular response to sunlight
  useFrame(() => {
    if (!matRef.current) return;
    // Dim window emission during day so directional sunlight hits the walls; flare at night!
    matRef.current.emissiveIntensity = Math.max(0.12, (1 - dayFactor * 0.88) * 1.2);
    // Subtle facade tint reflecting the sun color (golden in morning, white at noon, orange at sunset)
    if (lighting?.buildingTint) {
      matRef.current.color.lerp(lighting.buildingTint, 0.08);
    }
  });

  if (!items.length) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]}>
      <boxGeometry />
      <meshStandardMaterial
        ref={matRef}
        roughness={0.28}
        metalness={0.42}
        emissive="#06b6d4"
        emissiveMap={texture}
        emissiveIntensity={0.8}
      />
    </instancedMesh>
  );
}

function CommercialBuildings({ items, lighting }) {
  const ref = useRef();
  const matRef = useRef();
  const texture = useMemo(() => makeWindowTexture(1, 108, false), []);
  const dayFactor = lighting?.dayFactor ?? 0.5;

  useLayoutEffect(() => {
    if (!ref.current) return;
    const m = new THREE.Object3D();
    const c = new THREE.Color();
    items.forEach((b, i) => {
      m.position.set(b.x, b.h / 2 + 0.16, b.z);
      m.scale.set(b.w, b.h, b.d);
      m.updateMatrix();
      ref.current.setMatrixAt(i, m.matrix);
      ref.current.setColorAt(i, c.set(b.color));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    return () => texture.dispose();
  }, [items, texture]);

  useFrame(() => {
    if (!matRef.current) return;
    matRef.current.emissiveIntensity = Math.max(0.08, (1 - dayFactor * 0.9) * 0.7);
    if (lighting?.buildingTint) {
      matRef.current.color.lerp(lighting.buildingTint, 0.08);
    }
  });

  if (!items.length) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]}>
      <boxGeometry />
      <meshStandardMaterial
        ref={matRef}
        roughness={0.45}
        metalness={0.25}
        emissive="#fbbf24"
        emissiveMap={texture}
        emissiveIntensity={0.5}
      />
    </instancedMesh>
  );
}

function SlumShacks({ items, lighting }) {
  const ref = useRef();
  const matRef = useRef();

  useLayoutEffect(() => {
    if (!ref.current) return;
    const m = new THREE.Object3D();
    const c = new THREE.Color();
    items.forEach((b, i) => {
      m.position.set(b.x, b.h / 2 + 0.16, b.z);
      m.rotation.set(0, b.rotY || 0, 0);
      m.scale.set(b.w, b.h, b.d);
      m.updateMatrix();
      ref.current.setMatrixAt(i, m.matrix);
      ref.current.setColorAt(i, c.set(b.color));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [items]);

  useFrame(() => {
    if (!matRef.current) return;
    if (lighting?.buildingTint) {
      matRef.current.color.lerp(lighting.buildingTint, 0.08);
    }
  });

  if (!items.length) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]}>
      <boxGeometry />
      <meshStandardMaterial ref={matRef} roughness={0.92} metalness={0.15} />
    </instancedMesh>
  );
}

function Beacons({ points }) {
  const ref = useRef();
  useLayoutEffect(() => {
    if (!ref.current) return;
    const m = new THREE.Object3D();
    points.forEach((p, i) => {
      m.position.set(...p);
      m.updateMatrix();
      ref.current.setMatrixAt(i, m.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [points]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.material.opacity = 0.35 + 0.65 * (Math.sin(clock.elapsedTime * 3) * 0.5 + 0.5);
  });

  if (!points.length) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, points.length]}>
      <sphereGeometry args={[0.38, 10, 8]} />
      <meshBasicMaterial color="#ff2d55" transparent toneMapped={false} />
    </instancedMesh>
  );
}

function Parks() {
  const ref = useRef();
  const trees = useMemo(() => {
    const rand = mulberry32(99);
    const out = [];
    for (const [bx, bz] of PARK_BLOCKS) {
      const cx = coord(bx) + SPACING / 2;
      const cz = coord(bz) + SPACING / 2;
      for (let i = 0; i < 22; i++) {
        const x = cx + (rand() - 0.5) * (BLOCK - 2.5), z = cz + (rand() - 0.5) * (BLOCK - 2.5);
        if (!isNearRoad(x, z, PAVEMENT_WIDTH + 0.8) && !isInsideRoadDistrict(x, z)
          && !TRAFFIC_SIGNALS.some((p) => Math.hypot(x - p.x, z - p.z) < 1.5)) out.push([x, z, 1.2 + rand() * 1.4]);
      }
    }
    return out;
  }, []);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const m = new THREE.Object3D();
    trees.forEach(([x, z, s], i) => {
      m.position.set(x, 0.18 + s * 0.9, z);
      m.scale.set(s, s * 1.9, s);
      m.updateMatrix();
      ref.current.setMatrixAt(i, m.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [trees]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, trees.length]}>
      <coneGeometry args={[0.75, 1, 7]} />
      <meshStandardMaterial color="#10b981" emissive="#065f46" emissiveIntensity={0.6} roughness={0.8} />
    </instancedMesh>
  );
}

function Hospital({ lightScale = 1 }) {
  const beacon = useRef();
  const cx = coord(HOSPITAL.block[0]) + SPACING / 2;
  const cz = coord(HOSPITAL.block[1]) + SPACING / 2;

  useFrame(({ clock }) => {
    const s = 1 + (clock.elapsedTime % 1.6) * 1.25;
    beacon.current.scale.set(s, s, 1);
    beacon.current.material.opacity = Math.max(0, 0.7 - (clock.elapsedTime % 1.6) * 0.45);
  });

  return (
    <group position={[cx, 0.18, cz]}>
      <mesh position={[0, 4.5, 0]}>
        <boxGeometry args={[11.5, 9.0, 10.0]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.35} metalness={0.25} emissive="#0f766e" emissiveIntensity={0.18} />
      </mesh>
      <mesh position={[2.2, 7.8, 0]}>
        <boxGeometry args={[5.2, 15.6, 5.8]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.35} metalness={0.3} />
      </mesh>
      <mesh position={[2.2, 15.7, 0]}>
        <boxGeometry args={[3.8, 0.22, 1.1]} />
        <meshBasicMaterial color="#ff2d55" toneMapped={false} />
      </mesh>
      <mesh position={[2.2, 15.7, 0]}>
        <boxGeometry args={[1.1, 0.22, 3.8]} />
        <meshBasicMaterial color="#ff2d55" toneMapped={false} />
      </mesh>
      <mesh ref={beacon} position={[0, 0.05, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[5.0, 5.8, 48]} />
        <meshBasicMaterial color="#34d399" transparent toneMapped={false} depthWrite={false} />
      </mesh>
      <pointLight position={[0, 18, 0]} color="#34d399" intensity={90 * lightScale * lightScale} distance={48 * lightScale} decay={2} />
      <Label text="✚ ST. AURORA RIVERFRONT MEDICAL" color="#34d399" position={[0, 22, 0]} width={28} />
    </group>
  );
}

function DispatchDepots() {
  return (
    <group>
      {DISPATCH_BASES.map((base) => (
        <group key={base.id} position={[nodePosition(...base.node).x, 0.05, nodePosition(...base.node).z]}>
          <mesh rotation-x={-Math.PI / 2}>
            <ringGeometry args={[2.5, 3.2, 36]} />
            <meshBasicMaterial color="#ff2d55" transparent opacity={0.7} toneMapped={false} depthWrite={false} />
          </mesh>
          <Label text={`🚨 ${base.name.toUpperCase()}`} color="#fb7185" position={[0, 8.5, 0]} width={20} />
        </group>
      ))}
    </group>
  );
}

function DistrictLabels() {
  return (
    <group>
      {/* Extreme Urban Cyber Citadel Marker */}
      <Label text="🏢 EXTREME URBAN CYBER CITADEL" color="#38bdf8" position={[-150, 54, -150]} width={38} />
      {/* Peripheral Slums Marker */}
      <Label text="🏚️ PERIPHERAL SLUMS (OUTER BADLANDS)" color="#f43f5e" position={[180, 16, 170]} width={38} />
    </group>
  );
}

function StreetDistrictIslands({ dayFactor }) {
  const treeRef = useRef();
  const { islands, trees } = useMemo(() => {
    const trees = [];
    const islands = ROAD_DISTRICTS.map((district) => {
      const raw = district.island || district.polygon.map((p) => ({
        x: district.cx + (p.x - district.cx) * 0.78,
        z: district.cz + (p.z - district.cz) * 0.78,
      }));
      const outline = raw.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.z));
      if (outline.length < 3) return null;
      const centerX = outline.reduce((sum, p) => sum + p.x, 0) / outline.length;
      const centerZ = outline.reduce((sum, p) => sum + p.z, 0) / outline.length;
      const shape = (scale) => new THREE.Shape(outline.map((p) => new THREE.Vector2(
        centerX + (p.x - centerX) * scale, -(centerZ + (p.z - centerZ) * scale))));
      const curb = new THREE.ExtrudeGeometry(shape(1), { depth: 0.16, bevelEnabled: false });
      const grass = new THREE.ShapeGeometry(shape(0.96));
      for (let i = 0; i < outline.length; i += Math.max(1, Math.floor(outline.length / 14))) {
        const p = outline[i];
        const x = centerX + (p.x - centerX) * 0.72, z = centerZ + (p.z - centerZ) * 0.72;
        if (!isNearRoad(x, z, 3.5)) trees.push([x, z, 1.7 + (i % 3) * 0.4]);
      }
      return { ...district, centerX, centerZ, curb, grass };
    }).filter(Boolean);
    return { islands, trees };
  }, []);
  useEffect(() => () => islands.forEach((island) => { island.curb.dispose(); island.grass.dispose(); }), [islands]);
  useLayoutEffect(() => {
    if (!treeRef.current) return;
    const m = new THREE.Object3D();
    trees.forEach(([x, z, size], i) => {
      m.position.set(x, size * 1.1 + 0.2, z); m.scale.set(size, size * 2.2, size);
      m.updateMatrix(); treeRef.current.setMatrixAt(i, m.matrix);
    });
    treeRef.current.instanceMatrix.needsUpdate = true;
  }, [trees]);
  return <group>
    {islands.map((island) => <group key={island.id}>
      <mesh geometry={island.curb} rotation-x={-Math.PI / 2} position-y={0.02}>
        <meshStandardMaterial color={dayFactor > 0.35 ? "#b2bdb1" : "#617977"} roughness={0.9} />
      </mesh>
      <mesh geometry={island.grass} rotation-x={-Math.PI / 2} position-y={0.19}>
        <meshStandardMaterial color={dayFactor > 0.35 ? "#275d48" : "#163d35"} roughness={0.95} />
      </mesh>
      <Label text={island.name.toUpperCase()} position={[island.centerX, 8, island.centerZ]} color="#a7f3d0" width={Math.min(48, (island.radius || 28) * 1.2)} />
    </group>)}
    {trees.length > 0 && <instancedMesh ref={treeRef} args={[undefined, undefined, trees.length]}>
      <coneGeometry args={[0.85, 1, 7]} /><meshStandardMaterial color="#2f8965" roughness={0.9} />
    </instancedMesh>}
  </group>;
}

// ───────────────────── 3D Road Congestion Heatmap Filter ─────────────────────
function RoadCongestionFilter({ sim, show }) {
  const meshRef = useRef();

  const segments = ROAD_SEGMENTS;
  const { pieces, bySegment } = useMemo(() => {
    const pieces = [], bySegment = [];
    segments.forEach((seg, si) => {
      bySegment[si] = [];
      for (let j = 1; j < seg.points.length; j++) {
        const a = seg.points[j - 1], b = seg.points[j];
        const length = Math.hypot(b.x - a.x, b.z - a.z);
        if (length < 0.001) continue;
        bySegment[si].push(pieces.length);
        pieces.push({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, length,
          heading: Math.atan2(-(b.z - a.z), b.x - a.x) });
      }
    });
    return { pieces, bySegment };
  }, [segments]);

  useLayoutEffect(() => {
    if (!meshRef.current) return;
    const m = new THREE.Object3D();
    const c = new THREE.Color("#10b981");

    pieces.forEach((seg, i) => {
      m.position.set(seg.x, 0.065 + roadHeightAt(seg.x, seg.z), seg.z);
      m.rotation.set(-Math.PI / 2, 0, seg.heading);
      m.scale.set(seg.length + 0.08, ROAD_W * 0.72, 1);
      m.updateMatrix();
      meshRef.current.setMatrixAt(i, m.matrix);
      meshRef.current.setColorAt(i, c);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [pieces]);

  const trafficVersionRef = useRef(-1);
  const colorGreen = useMemo(() => new THREE.Color("#10b981"), []);
  const colorYellow = useMemo(() => new THREE.Color("#facc15"), []);
  const colorRed = useMemo(() => new THREE.Color("#ef4444"), []);
  const lastStatuses = useRef(new Array(segments.length).fill("green"));

  useFrame(() => {
    if (!meshRef.current) return;
    meshRef.current.visible = !!show;
    if (!show || !sim) return;

    // Both map views consume the same simulation snapshot on the next rendered frame.
    if (trafficVersionRef.current !== sim.trafficVersion) {
      trafficVersionRef.current = sim.trafficVersion;
      let hasChanges = false;
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const status = sim.getRoadStatus(seg.ix, seg.iz, seg.axis);
        if (status !== lastStatuses.current[i]) {
          lastStatuses.current[i] = status;
          const color = status === "red" ? colorRed : status === "yellow" ? colorYellow : colorGreen;
          bySegment[i].forEach((piece) => meshRef.current.setColorAt(piece, color));
          hasChanges = true;
        }
      }
      if (hasChanges && meshRef.current.instanceColor) {
        meshRef.current.instanceColor.needsUpdate = true;
      }
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, pieces.length]}>
      <planeGeometry />
      <meshBasicMaterial transparent opacity={0.6} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  );
}

export default function CityStatic({
  sim,
  showHazards = true,
  showTrafficFilter = false,
  lighting,
  dayFactor = 0.5,
  lightScale = 1,
}) {
  const { cyberTowers, commercialBldgs, slumShacks, beacons } = useDiverseBuildings();
  const bridges = ROAD_HAZARDS.bridges;

  return (
    <group>
      <Ground dayFactor={dayFactor} />
      <RiverEnvironment dayFactor={dayFactor} />
      <RoadSurfaces dayFactor={dayFactor} />
      <SignalPavements dayFactor={dayFactor} />
      <StreetDistrictIslands dayFactor={dayFactor} />
      <RiverBridges bridges={bridges} dayFactor={dayFactor} />
      <Sidewalks dayFactor={dayFactor} />
      <RoadMarkings />
      <RoundaboutArrows />
      <SpeedBumpers showHazards={showHazards} />
      <Potholes showHazards={showHazards} />
      <RoadCongestionFilter sim={sim} show={showTrafficFilter} />
      <CyberSkyscrapers items={cyberTowers} lighting={lighting} />
      <CommercialBuildings items={commercialBldgs} lighting={lighting} />
      <SlumShacks items={slumShacks} lighting={lighting} />
      <Beacons points={beacons} />
      <Parks />
      <Hospital lightScale={lightScale} />
      <DispatchDepots />
      <DistrictLabels />
    </group>
  );
}
