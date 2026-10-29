// 500 × 500 Sprawling City Digital Twin (Footprint: -250 to +250 world units)
// Features:
// - Meandering zig-zag river with flowing water reflections & monumental suspension bridges
// - Extreme Urban Cyber Citadel strictly isolated from informal slum settlements
// - Far peripheral outer slum badlands with heavy crater clusters
// - Physically reactive building materials that visibly blush in golden morning sun,
//   glarify at noon, blaze in sunset orange-crimson, and glow with neon at night!

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Grid } from "@react-three/drei";
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
  isBridgeSegment,
  riverCenter,
  RIVER_WIDTH,
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
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.04, 0]}>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color={isDay ? "#1e293b" : "#080e1a"} roughness={0.95} />
      </mesh>
      <Grid
        position={[0, -0.05, 0]}
        args={[10, 10]}
        cellSize={SPACING / 2}
        cellThickness={0.5}
        cellColor={isDay ? "#334155" : "#0c2836"}
        sectionSize={SPACING}
        sectionThickness={1.0}
        sectionColor={isDay ? "#0284c7" : "#0891b2"}
        fadeDistance={950}
        fadeStrength={1.4}
        infiniteGrid
      />
    </group>
  );
}

// ───────────────────── Meandering Zig-Zag River & Flowing Water ─────────────────────
function MeanderingRiver({ dayFactor }) {
  const waterRef = useRef();

  // Create river channel vertices tracing the zig-zag path from z = -HALF-20 to +HALF+20
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const steps = 70;
    const zMin = -HALF - 30;
    const zMax = HALF + 30;
    const dz = (zMax - zMin) / steps;
    const halfW = RIVER_WIDTH / 2;

    const positions = [];
    const uvs = [];
    const indices = [];

    for (let i = 0; i <= steps; i++) {
      const z = zMin + i * dz;
      const cx = riverCenter(z);
      // Left bank, center, right bank
      positions.push(cx - halfW, -0.15, z);
      positions.push(cx + halfW, -0.15, z);
      uvs.push(0, i / steps);
      uvs.push(1, i / steps);

      if (i < steps) {
        const row = i * 2;
        indices.push(row, row + 1, row + 2);
        indices.push(row + 1, row + 3, row + 2);
      }
    }

    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, []);

  useFrame(({ clock }) => {
    if (!waterRef.current) return;
    // Animate water specular shimmer
    const t = clock.elapsedTime;
    const mat = waterRef.current.material;
    mat.roughness = 0.12 + 0.05 * Math.sin(t * 1.5);
  });

  return (
    <group>
      <mesh ref={waterRef} geometry={geometry}>
        <meshStandardMaterial
          color={dayFactor > 0.35 ? "#0284c7" : "#083344"}
          roughness={0.15}
          metalness={0.88}
          emissive={dayFactor > 0.35 ? "#0e7490" : "#06b6d4"}
          emissiveIntensity={dayFactor > 0.35 ? 0.2 : 0.45}
        />
      </mesh>
    </group>
  );
}

// ───────────────────── Architectural River Suspension Bridges ─────────────────────
function RiverBridges({ bridges, dayFactor }) {
  const isDay = dayFactor > 0.35;
  return (
    <group>
      {bridges.map((b, idx) => {
        const isGrandBridge = b.iz === 13; // Grand Central Bridge
        const pylonH = isGrandBridge ? 24 : 14;
        const pylonColor = isDay ? "#cbd5e1" : "#38bdf8";

        return (
          <group key={idx} position={[b.x, 0, b.z]}>
            {/* Elevated Bridge Deck */}
            <mesh position={[0, 0.45, 0]}>
              <boxGeometry args={[b.length + 2, 0.6, ROAD_W + 0.8]} />
              <meshStandardMaterial color={isDay ? "#334155" : "#1e293b"} roughness={0.4} metalness={0.5} />
            </mesh>

            {/* Glowing Bridge Guardrails */}
            <mesh position={[0, 0.95, (ROAD_W + 0.8) / 2]}>
              <boxGeometry args={[b.length + 2, 0.4, 0.15]} />
              <meshBasicMaterial color={isGrandBridge ? "#5effc1" : "#38bdf8"} toneMapped={false} />
            </mesh>
            <mesh position={[0, 0.95, -(ROAD_W + 0.8) / 2]}>
              <boxGeometry args={[b.length + 2, 0.4, 0.15]} />
              <meshBasicMaterial color={isGrandBridge ? "#5effc1" : "#38bdf8"} toneMapped={false} />
            </mesh>

            {/* Twin Cable-Stay Suspension Towers / Pylons */}
            {[-b.length * 0.28, b.length * 0.28].map((px, pi) => (
              <group key={pi} position={[px, 0, 0]}>
                {/* North & South Pylon legs */}
                <mesh position={[0, pylonH / 2, (ROAD_W + 1.2) / 2]}>
                  <boxGeometry args={[1.2, pylonH, 1.0]} />
                  <meshStandardMaterial color={pylonColor} roughness={0.3} metalness={0.7} />
                </mesh>
                <mesh position={[0, pylonH / 2, -(ROAD_W + 1.2) / 2]}>
                  <boxGeometry args={[1.2, pylonH, 1.0]} />
                  <meshStandardMaterial color={pylonColor} roughness={0.3} metalness={0.7} />
                </mesh>
                {/* Cross beam atop pylon */}
                <mesh position={[0, pylonH - 0.5, 0]}>
                  <boxGeometry args={[1.4, 0.8, ROAD_W + 2.2]} />
                  <meshStandardMaterial color={pylonColor} metalness={0.8} />
                </mesh>
                {/* Aircraft warning light atop pylon */}
                <mesh position={[0, pylonH + 0.6, 0]}>
                  <sphereGeometry args={[0.35, 8, 8]} />
                  <meshBasicMaterial color="#ff2d55" toneMapped={false} />
                </mesh>
              </group>
            ))}

            {isGrandBridge && (
              <Label text="🌉 GRAND SUSPENSION BRIDGE" color="#5effc1" position={[0, 16.5, 0]} width={22} />
            )}
          </group>
        );
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
        out.push([coord(bx) + SPACING / 2, coord(bz) + SPACING / 2, bx, bz]);
      }
    }
    return out;
  }, []);

  useLayoutEffect(() => {
    const m = new THREE.Object3D();
    const c = new THREE.Color();
    blocks.forEach(([x, z, bx, bz], i) => {
      m.position.set(x, 0.08, z);
      m.scale.set(BLOCK, 0.16, BLOCK);
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

function RoadMarkings() {
  const ref = useRef();
  const dashes = useMemo(() => {
    const out = [];
    for (let line = 0; line < GRID; line++) {
      for (let s = 0; s < GRID - 1; s++) {
        for (const off of [4.2, 12.4]) {
          out.push([coord(s) + off, coord(line), 0]);
          out.push([coord(line), coord(s) + off, 1]);
        }
      }
    }
    return out;
  }, []);

  useLayoutEffect(() => {
    const m = new THREE.Object3D();
    dashes.forEach(([x, z, axis], i) => {
      m.position.set(x, 0.015, z);
      m.rotation.set(-Math.PI / 2, 0, axis ? Math.PI / 2 : 0);
      m.scale.set(2.4, 0.16, 1);
      m.updateMatrix();
      ref.current.setMatrixAt(i, m.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [dashes]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, dashes.length]}>
      <planeGeometry />
      <meshBasicMaterial color="#475569" transparent opacity={0.65} />
    </instancedMesh>
  );
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
      m.position.set(b.x, 0.08, b.z);
      m.rotation.set(0, b.axis === 0 ? 0 : Math.PI / 2, 0);
      m.scale.set(0.75, 0.18, ROAD_W - 0.4);
      m.updateMatrix();
      meshRef.current.setMatrixAt(i, m.matrix);

      if (glowRef.current) {
        m.position.set(b.x, 0.025, b.z);
        m.rotation.set(-Math.PI / 2, 0, b.axis === 0 ? 0 : Math.PI / 2);
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
            const w = BLOCK - 2.5;
            const d = BLOCK - 2.5;
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
            const offsets = [[-2.2, -2.2], [2.2, 2.2]];
            offsets.forEach(([ox, oz]) => {
              const w = 3.6 + rand() * 1.2;
              const d = 3.6 + rand() * 1.2;
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
          const lots = [[-2.8, -2.8], [2.8, -2.8], [-2.8, 2.8], [2.8, 2.8]];
          lots.forEach(([ox, oz]) => {
            if (rand() < 0.15) return;
            const w = 3.4 + rand() * 1.2;
            const d = 3.4 + rand() * 1.2;
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

    return { cyberTowers, commercialBldgs, slumShacks, beacons };
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
        out.push([
          cx + (rand() - 0.5) * (BLOCK - 2.5),
          cz + (rand() - 0.5) * (BLOCK - 2.5),
          1.2 + rand() * 1.4,
        ]);
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

function Hospital() {
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
      <pointLight position={[0, 18, 0]} color="#34d399" intensity={90} distance={48} decay={2} />
      <Label text="✚ ST. AURORA RIVERFRONT MEDICAL" color="#34d399" position={[0, 22, 0]} width={28} />
    </group>
  );
}

function DispatchDepots() {
  return (
    <group>
      {DISPATCH_BASES.map((base) => (
        <group key={base.id} position={[coord(base.node[0]), 0.05, coord(base.node[1])]}>
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

// ───────────────────── 3D Road Congestion Heatmap Filter ─────────────────────
function RoadCongestionFilter({ sim, show }) {
  const meshRef = useRef();

  const segments = useMemo(() => {
    const list = [];
    // East-West segments (axis 0)
    for (let iz = 0; iz < GRID; iz++) {
      for (let ix = 0; ix < GRID - 1; ix++) {
        const x = (coord(ix) + coord(ix + 1)) / 2;
        const z = coord(iz);
        list.push({ ix, iz, axis: 0, x, z });
      }
    }
    // North-South segments (axis 1)
    for (let iz = 0; iz < GRID - 1; iz++) {
      for (let ix = 0; ix < GRID; ix++) {
        const x = coord(ix);
        const z = (coord(iz) + coord(iz + 1)) / 2;
        list.push({ ix, iz, axis: 1, x, z });
      }
    }
    return list;
  }, []);

  useLayoutEffect(() => {
    if (!meshRef.current) return;
    const m = new THREE.Object3D();
    const c = new THREE.Color("#10b981");

    segments.forEach((seg, i) => {
      m.position.set(seg.x, 0.052, seg.z);
      m.rotation.set(-Math.PI / 2, 0, seg.axis === 0 ? 0 : Math.PI / 2);
      m.scale.set(SPACING - 1.2, ROAD_W * 0.72, 1);
      m.updateMatrix();
      meshRef.current.setMatrixAt(i, m.matrix);
      meshRef.current.setColorAt(i, c);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [segments]);

  const lastUpdateRef = useRef(0);
  const colorGreen = useMemo(() => new THREE.Color("#10b981"), []);
  const colorYellow = useMemo(() => new THREE.Color("#facc15"), []);
  const colorRed = useMemo(() => new THREE.Color("#ef4444"), []);
  const lastStatuses = useRef(new Array(segments.length).fill("green"));

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    meshRef.current.visible = !!show;
    if (!show || !sim) return;

    // Throttle to every 350ms and only flag GPU buffer update if a segment changed color
    if (clock.elapsedTime - lastUpdateRef.current > 0.35) {
      lastUpdateRef.current = clock.elapsedTime;
      let hasChanges = false;
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const status = sim.getRoadStatus(seg.ix, seg.iz, seg.axis);
        if (status !== lastStatuses.current[i]) {
          lastStatuses.current[i] = status;
          const color = status === "red" ? colorRed : status === "yellow" ? colorYellow : colorGreen;
          meshRef.current.setColorAt(i, color);
          hasChanges = true;
        }
      }
      if (hasChanges && meshRef.current.instanceColor) {
        meshRef.current.instanceColor.needsUpdate = true;
      }
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, segments.length]}>
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
}) {
  const { cyberTowers, commercialBldgs, slumShacks, beacons } = useDiverseBuildings();
  const bridges = ROAD_HAZARDS.bridges;

  return (
    <group>
      <Ground dayFactor={dayFactor} />
      <MeanderingRiver dayFactor={dayFactor} />
      <RiverBridges bridges={bridges} dayFactor={dayFactor} />
      <Sidewalks dayFactor={dayFactor} />
      <RoadMarkings />
      <SpeedBumpers showHazards={showHazards} />
      <Potholes showHazards={showHazards} />
      <RoadCongestionFilter sim={sim} show={showTrafficFilter} />
      <CyberSkyscrapers items={cyberTowers} lighting={lighting} />
      <CommercialBuildings items={commercialBldgs} lighting={lighting} />
      <SlumShacks items={slumShacks} lighting={lighting} />
      <Beacons points={beacons} />
      <Parks />
      <Hospital />
      <DispatchDepots />
      <DistrictLabels />
    </group>
  );
}
