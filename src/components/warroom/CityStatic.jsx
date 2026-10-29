// Static city geometry: ground, roads, sidewalks, buildings, park, hospital and labels.

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Grid } from "@react-three/drei";
import * as THREE from "three";
import { GRID, SPACING, HALF, ROAD_W, coord, HOSPITAL, DISPATCH_BASE } from "../../lib/cityGrid";

const BLOCK = SPACING - ROAD_W;
const PARK_BLOCK = [1, 1];

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

function makeWindowTexture(repeatY, seed) {
  const rand = mulberry32(seed);
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#000";
  g.fillRect(0, 0, 64, 128);
  for (let y = 8; y < 120; y += 16) {
    for (let x = 6; x < 60; x += 11) {
      const r = rand();
      if (r < 0.55) {
        g.fillStyle = r < 0.07 ? "#fbbf24" : r < 0.32 ? "#22d3ee" : "#155e75";
        g.fillRect(x, y, 7, 6);
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

function drawLabel(canvas, text, color) {
  const g = canvas.getContext("2d");
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = "rgba(2, 6, 23, 0.88)";
  g.strokeStyle = color;
  g.lineWidth = 4;
  g.beginPath();
  g.roundRect(4, 4, canvas.width - 8, canvas.height - 8, 18);
  g.fill();
  g.stroke();
  g.font = '600 46px "Chakra Petch", "Segoe UI", sans-serif';
  g.fillStyle = color;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
}

export function Label({ text, color = "#22d3ee", position, width = 14 }) {
  const { texture, canvas } = useMemo(() => {
    const cv = document.createElement("canvas");
    cv.width = 640;
    cv.height = 112;
    drawLabel(cv, text, color);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return { texture: tex, canvas: cv };
  }, [text, color]);

  useEffect(() => {
    // redraw once web fonts are ready so the label uses Chakra Petch
    document.fonts?.ready.then(() => {
      drawLabel(canvas, text, color);
      texture.needsUpdate = true;
    });
    return () => texture.dispose();
  }, [canvas, texture, text, color]);

  return (
    <sprite position={position} scale={[width, width * 0.175, 1]} renderOrder={10}>
      <spriteMaterial map={texture} transparent depthTest={false} toneMapped={false} />
    </sprite>
  );
}

function Ground() {
  const size = HALF * 2 + ROAD_W + 6;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]}>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#0a101d" roughness={0.95} />
      </mesh>
      <Grid
        position={[0, -0.05, 0]}
        args={[10, 10]}
        cellSize={3}
        cellThickness={0.6}
        cellColor="#0e3a4a"
        sectionSize={SPACING}
        sectionThickness={1.1}
        sectionColor="#0e7490"
        fadeDistance={230}
        fadeStrength={1.4}
        infiniteGrid
      />
    </group>
  );
}

function Sidewalks() {
  const ref = useRef();
  const blocks = useMemo(() => {
    const out = [];
    for (let bz = 0; bz < GRID - 1; bz++)
      for (let bx = 0; bx < GRID - 1; bx++) out.push([coord(bx) + SPACING / 2, coord(bz) + SPACING / 2, bx, bz]);
    return out;
  }, []);

  useLayoutEffect(() => {
    const m = new THREE.Object3D();
    const c = new THREE.Color();
    blocks.forEach(([x, z, bx, bz], i) => {
      m.position.set(x, 0.09, z);
      m.scale.set(BLOCK, 0.18, BLOCK);
      m.updateMatrix();
      ref.current.setMatrixAt(i, m.matrix);
      const park = bx === PARK_BLOCK[0] && bz === PARK_BLOCK[1];
      ref.current.setColorAt(i, c.set(park ? "#064e3b" : "#131c2e"));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.instanceColor.needsUpdate = true;
  }, [blocks]);

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
        for (const off of [3.6, 8.4]) {
          out.push([coord(s) + off, coord(line), 0]); // east–west roads
          out.push([coord(line), coord(s) + off, 1]); // north–south roads
        }
      }
    }
    return out;
  }, []);

  useLayoutEffect(() => {
    const m = new THREE.Object3D();
    dashes.forEach(([x, z, axis], i) => {
      m.position.set(x, 0.012, z);
      m.rotation.set(-Math.PI / 2, 0, axis ? Math.PI / 2 : 0);
      m.scale.set(1.6, 0.14, 1);
      m.updateMatrix();
      ref.current.setMatrixAt(i, m.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [dashes]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, dashes.length]}>
      <planeGeometry />
      <meshBasicMaterial color="#475569" transparent opacity={0.7} />
    </instancedMesh>
  );
}

function useBuildings() {
  return useMemo(() => {
    const rand = mulberry32(7331);
    const classes = [[], [], []];
    const beacons = [];
    const tints = ["#1e293b", "#1a2436", "#172133", "#222d42", "#1b2b3f"];
    for (let bz = 0; bz < GRID - 1; bz++) {
      for (let bx = 0; bx < GRID - 1; bx++) {
        if (bx === HOSPITAL.block[0] && bz === HOSPITAL.block[1]) continue;
        if (bx === PARK_BLOCK[0] && bz === PARK_BLOCK[1]) continue;
        const cx = coord(bx) + SPACING / 2;
        const cz = coord(bz) + SPACING / 2;
        const centrality = 1 - Math.min(1, Math.hypot(cx, cz) / (HALF * 1.35));
        const tower = rand() < 0.22;
        const lots = tower ? [[0, 0, BLOCK - 1.6]] : [[-1.75, -1.75], [1.75, -1.75], [-1.75, 1.75], [1.75, 1.75]];
        for (const [ox, oz, big] of lots) {
          if (!tower && rand() < 0.12) continue;
          const w = big ?? 2.5 + rand() * 0.7;
          const d = big ?? 2.5 + rand() * 0.7;
          const h = tower ? 10 + centrality * 16 + rand() * 8 : 2.5 + rand() * (4 + centrality * 10);
          const cls = h < 6 ? 0 : h < 13 ? 1 : 2;
          classes[cls].push({ x: cx + ox, z: cz + oz, w, d, h, color: tints[Math.floor(rand() * tints.length)] });
          if (h > 14) beacons.push([cx + ox, h + 0.45, cz + oz]);
        }
      }
    }
    return { classes, beacons };
  }, []);
}

function BuildingClass({ items, repeatY, seed }) {
  const ref = useRef();
  const texture = useMemo(() => makeWindowTexture(repeatY, seed), [repeatY, seed]);

  useLayoutEffect(() => {
    const m = new THREE.Object3D();
    const c = new THREE.Color();
    items.forEach((b, i) => {
      m.position.set(b.x, b.h / 2 + 0.18, b.z);
      m.scale.set(b.w, b.h, b.d);
      m.updateMatrix();
      ref.current.setMatrixAt(i, m.matrix);
      ref.current.setColorAt(i, c.set(b.color));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    return () => texture.dispose();
  }, [items, texture]);

  if (!items.length) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]}>
      <boxGeometry />
      <meshStandardMaterial
        roughness={0.55}
        metalness={0.35}
        emissive="#ffffff"
        emissiveMap={texture}
        emissiveIntensity={0.9}
      />
    </instancedMesh>
  );
}

function Beacons({ points }) {
  const ref = useRef();
  useLayoutEffect(() => {
    const m = new THREE.Object3D();
    points.forEach((p, i) => {
      m.position.set(...p);
      m.updateMatrix();
      ref.current.setMatrixAt(i, m.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [points]);
  useFrame(({ clock }) => {
    ref.current.material.opacity = 0.35 + 0.65 * (Math.sin(clock.elapsedTime * 3) * 0.5 + 0.5);
  });
  if (!points.length) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, points.length]}>
      <sphereGeometry args={[0.22, 10, 8]} />
      <meshBasicMaterial color="#ff3355" transparent toneMapped={false} />
    </instancedMesh>
  );
}

function Park() {
  const ref = useRef();
  const trees = useMemo(() => {
    const rand = mulberry32(99);
    const cx = coord(PARK_BLOCK[0]) + SPACING / 2;
    const cz = coord(PARK_BLOCK[1]) + SPACING / 2;
    return Array.from({ length: 14 }, () => [cx + (rand() - 0.5) * (BLOCK - 1.4), cz + (rand() - 0.5) * (BLOCK - 1.4), 0.8 + rand() * 0.8]);
  }, []);
  useLayoutEffect(() => {
    const m = new THREE.Object3D();
    trees.forEach(([x, z, s], i) => {
      m.position.set(x, 0.18 + s * 0.9, z);
      m.scale.set(s, s * 1.8, s);
      m.updateMatrix();
      ref.current.setMatrixAt(i, m.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [trees]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, trees.length]}>
      <coneGeometry args={[0.6, 1, 7]} />
      <meshStandardMaterial color="#10b981" emissive="#065f46" emissiveIntensity={0.6} roughness={0.8} />
    </instancedMesh>
  );
}

function Hospital() {
  const beacon = useRef();
  const cx = coord(HOSPITAL.block[0]) + SPACING / 2;
  const cz = coord(HOSPITAL.block[1]) + SPACING / 2;
  useFrame(({ clock }) => {
    const s = 1 + (clock.elapsedTime % 1.6) * 1.2;
    beacon.current.scale.set(s, s, 1);
    beacon.current.material.opacity = Math.max(0, 0.7 - (clock.elapsedTime % 1.6) * 0.45);
  });
  return (
    <group position={[cx, 0.18, cz]}>
      <mesh position={[0, 3.2, 0]}>
        <boxGeometry args={[6.4, 6.4, 5.6]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.4} metalness={0.2} emissive="#0f766e" emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[1.2, 5.2, 0]}>
        <boxGeometry args={[3.2, 10.4, 3.6]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.4} metalness={0.25} />
      </mesh>
      {/* rooftop red cross */}
      <mesh position={[1.2, 10.45, 0]}>
        <boxGeometry args={[2.4, 0.15, 0.7]} />
        <meshBasicMaterial color="#ff2d55" toneMapped={false} />
      </mesh>
      <mesh position={[1.2, 10.45, 0]}>
        <boxGeometry args={[0.7, 0.15, 2.4]} />
        <meshBasicMaterial color="#ff2d55" toneMapped={false} />
      </mesh>
      {/* helipad ring */}
      <mesh position={[-1.6, 6.45, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.9, 1.2, 32]} />
        <meshBasicMaterial color="#34d399" toneMapped={false} />
      </mesh>
      <mesh ref={beacon} position={[0, 0.05, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[3.6, 4.0, 48]} />
        <meshBasicMaterial color="#34d399" transparent toneMapped={false} depthWrite={false} />
      </mesh>
      <pointLight position={[0, 12, 0]} color="#34d399" intensity={60} distance={30} decay={2} />
      <Label text="✚ ST. AURORA MEDICAL" color="#34d399" position={[0, 15, 0]} width={15} />
    </group>
  );
}

function DispatchBase() {
  const ring = useRef();
  const [ix, iz] = DISPATCH_BASE.node;
  useFrame(({ clock }) => {
    const p = (clock.elapsedTime % 1.2) / 1.2;
    ring.current.scale.set(1 + p * 1.6, 1 + p * 1.6, 1);
    ring.current.material.opacity = 0.8 * (1 - p);
  });
  return (
    <group position={[coord(ix), 0.05, coord(iz)]}>
      <mesh ref={ring} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[2.2, 2.6, 40]} />
        <meshBasicMaterial color="#ff2d55" transparent toneMapped={false} depthWrite={false} />
      </mesh>
      <Label text="SECTOR 4 · DISPATCH" color="#fb7185" position={[0, 6.5, 0]} width={13} />
    </group>
  );
}

export default function CityStatic() {
  const { classes, beacons } = useBuildings();
  return (
    <group>
      <Ground />
      <Sidewalks />
      <RoadMarkings />
      <BuildingClass items={classes[0]} repeatY={1} seed={11} />
      <BuildingClass items={classes[1]} repeatY={2} seed={23} />
      <BuildingClass items={classes[2]} repeatY={4} seed={37} />
      <Beacons points={beacons} />
      <Park />
      <Hospital />
      <DispatchBase />
    </group>
  );
}
