// Dynamic simulation layer: vehicles, ambulance, traffic lights, green-wave corridor and camera rig.

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GRID, SPACING, ROAD_W, coord } from "../../lib/cityGrid";
import { MAX_VEHICLES } from "../../lib/trafficSim";

const C_RED = new THREE.Color("#ff2d55");
const C_YELLOW = new THREE.Color("#fbbf24");
const C_GREEN = new THREE.Color("#22c55e");
const C_WAVE = new THREE.Color("#5effc1");
const C_EMERALD = new THREE.Color("#10b981");
const C_CYAN = new THREE.Color("#22d3ee");
const C_AMBER = new THREE.Color("#f59e0b");

export function SimDriver({ sim }) {
  useFrame((_, delta) => sim.step(delta));
  return null;
}

export function Vehicles({ sim }) {
  const body = useRef();
  const cabin = useRef();
  const geos = useMemo(
    () => ({
      body: new THREE.BoxGeometry(1.75, 0.55, 0.92).translate(0, 0.45, 0),
      cabin: new THREE.BoxGeometry(0.95, 0.4, 0.8).translate(-0.12, 0.92, 0),
    }),
    []
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorCache = useMemo(() => new Map(), []);
  const tmp = useMemo(() => new THREE.Color(), []);

  useLayoutEffect(() => {
    // initialise instance colors before first render so the shader compiles with instancing color
    for (let i = 0; i < MAX_VEHICLES; i++) body.current.setColorAt(i, tmp.set("#e2e8f0"));
    body.current.instanceColor.needsUpdate = true;
    return () => {
      geos.body.dispose();
      geos.cabin.dispose();
    };
  }, [geos, tmp]);

  useFrame(({ clock }) => {
    const vs = sim.vehicles;
    const n = Math.min(vs.length, MAX_VEHICLES);
    const blink = Math.floor(clock.elapsedTime * 4) % 2 === 0;
    for (let i = 0; i < n; i++) {
      const v = vs[i];
      dummy.position.set(v.x, 0.18, v.z);
      dummy.rotation.set(0, v.heading, 0);
      dummy.scale.setScalar(Math.max(0.01, v.scale));
      dummy.updateMatrix();
      body.current.setMatrixAt(i, dummy.matrix);
      cabin.current.setMatrixAt(i, dummy.matrix);
      let c = colorCache.get(v.color);
      if (!c) {
        c = new THREE.Color(v.color);
        colorCache.set(v.color, c);
      }
      body.current.setColorAt(i, v.yielding && blink ? C_AMBER : c);
    }
    body.current.count = n;
    cabin.current.count = n;
    body.current.instanceMatrix.needsUpdate = true;
    cabin.current.instanceMatrix.needsUpdate = true;
    body.current.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={body} args={[geos.body, undefined, MAX_VEHICLES]} frustumCulled={false}>
        <meshStandardMaterial roughness={0.3} metalness={0.5} />
      </instancedMesh>
      <instancedMesh ref={cabin} args={[geos.cabin, undefined, MAX_VEHICLES]} frustumCulled={false}>
        <meshStandardMaterial color="#0b1222" emissive="#0e7490" emissiveIntensity={0.35} roughness={0.1} metalness={0.8} />
      </instancedMesh>
    </group>
  );
}

export function TrafficLights({ sim }) {
  const poles = useRef();
  const lamps = useRef();
  const count = GRID * GRID * 4;
  const r = ROAD_W / 2 + 0.4;
  const corners = useMemo(
    () => [
      [-r, r, 0],
      [r, -r, 0],
      [r, r, 1],
      [-r, -r, 1],
    ],
    [r]
  );

  useLayoutEffect(() => {
    const m = new THREE.Object3D();
    for (let idx = 0; idx < GRID * GRID; idx++) {
      const x = coord(idx % GRID);
      const z = coord(Math.floor(idx / GRID));
      corners.forEach(([ox, oz], c) => {
        const i = idx * 4 + c;
        m.position.set(x + ox, 1.2, z + oz);
        m.scale.set(1, 1, 1);
        m.updateMatrix();
        poles.current.setMatrixAt(i, m.matrix);
        m.position.set(x + ox, 2.5, z + oz);
        m.updateMatrix();
        lamps.current.setMatrixAt(i, m.matrix);
        lamps.current.setColorAt(i, C_RED);
      });
    }
    poles.current.instanceMatrix.needsUpdate = true;
    lamps.current.instanceMatrix.needsUpdate = true;
    lamps.current.instanceColor.needsUpdate = true;
  }, [corners]);

  useFrame(() => {
    for (let idx = 0; idx < GRID * GRID; idx++) {
      const s = sim.lightState(idx);
      for (let c = 0; c < 4; c++) {
        const axis = c < 2 ? 0 : 1;
        let col = C_RED;
        if (s.axis === axis) col = s.yellow ? C_YELLOW : s.forced ? C_WAVE : C_GREEN;
        lamps.current.setColorAt(idx * 4 + c, col);
      }
    }
    lamps.current.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={poles} args={[undefined, undefined, count]}>
        <cylinderGeometry args={[0.07, 0.09, 2.4, 6]} />
        <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.4} />
      </instancedMesh>
      <instancedMesh ref={lamps} args={[undefined, undefined, count]}>
        <sphereGeometry args={[0.3, 12, 10]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

export function Ambulance({ sim }) {
  const group = useRef();
  const barA = useRef();
  const barB = useRef();
  const light = useRef();
  const halo = useRef();
  const trail = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(60 * 3), 3));
    g.setDrawRange(0, 0);
    const m = new THREE.LineBasicMaterial({ color: "#ff2d55", transparent: true, opacity: 0.85, toneMapped: false });
    return new THREE.Line(g, m);
  }, []);

  useLayoutEffect(
    () => () => {
      trail.geometry.dispose();
      trail.material.dispose();
    },
    [trail]
  );

  useFrame(({ clock }) => {
    const amb = sim.ambulance;
    if (!amb) {
      group.current.visible = false;
      trail.visible = false;
      return;
    }
    group.current.visible = true;
    trail.visible = true;
    group.current.position.set(amb.x, 0.18, amb.z);
    group.current.rotation.y = amb.heading;

    const t = clock.elapsedTime;
    const on = Math.floor(t * 8) % 2 === 0;
    barA.current.material.color.set(on ? "#ff1744" : "#2a0710");
    barB.current.material.color.set(on ? "#2a1d05" : "#ffc400");
    light.current.color.set(on ? "#ff2d55" : "#ffb300");
    light.current.intensity = amb.arrived ? 20 : 90;
    const p = (t % 0.9) / 0.9;
    halo.current.scale.set(1 + p * 1.4, 1 + p * 1.4, 1);
    halo.current.material.opacity = 0.75 * (1 - p);

    const pts = amb.trail;
    const pos = trail.geometry.attributes.position;
    const n = Math.min(60, pts.length / 2);
    for (let i = 0; i < n; i++) pos.setXYZ(i, pts[i * 2], 0.4, pts[i * 2 + 1]);
    pos.needsUpdate = true;
    trail.geometry.setDrawRange(0, n);
    trail.geometry.computeBoundingSphere();
  });

  return (
    <group>
      <primitive object={trail} />
      <group ref={group} visible={false}>
        <mesh position={[0, 0.7, 0]}>
          <boxGeometry args={[2.4, 1.05, 1.15]} />
          <meshStandardMaterial color="#f8fafc" emissive="#ff2d55" emissiveIntensity={0.25} roughness={0.3} metalness={0.3} />
        </mesh>
        <mesh position={[0.85, 0.55, 0]}>
          <boxGeometry args={[0.7, 0.75, 1.17]} />
          <meshStandardMaterial color="#0b1222" emissive="#22d3ee" emissiveIntensity={0.4} />
        </mesh>
        {/* neon side stripe */}
        <mesh position={[0, 0.55, 0]}>
          <boxGeometry args={[2.42, 0.16, 1.18]} />
          <meshBasicMaterial color="#ff2d55" toneMapped={false} />
        </mesh>
        <mesh position={[-0.2, 1.08, 0]}>
          <boxGeometry args={[0.5, 0.06, 0.6]} />
          <meshBasicMaterial color="#ffc400" toneMapped={false} />
        </mesh>
        <mesh ref={barA} position={[0.35, 1.32, -0.3]}>
          <boxGeometry args={[0.32, 0.2, 0.42]} />
          <meshBasicMaterial toneMapped={false} />
        </mesh>
        <mesh ref={barB} position={[0.35, 1.32, 0.3]}>
          <boxGeometry args={[0.32, 0.2, 0.42]} />
          <meshBasicMaterial toneMapped={false} />
        </mesh>
        <mesh ref={halo} position={[0, 0.03, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[1.6, 2.0, 40]} />
          <meshBasicMaterial color="#ff2d55" transparent toneMapped={false} depthWrite={false} />
        </mesh>
        <pointLight ref={light} position={[0, 3, 0]} distance={22} decay={2} intensity={90} />
      </group>
    </group>
  );
}

export function Corridor({ sim, routeVersion }) {
  const mats = useRef([]);
  // the route only changes on dispatch / deploy; routeVersion signals it
  const route = useMemo(() => sim.route, [sim, routeVersion]);
  const segs = useMemo(
    () =>
      route.slice(1).map((b, i) => {
        const a = route[i];
        const horizontal = a[1] === b[1];
        return {
          pos: [(coord(a[0]) + coord(b[0])) / 2, 0.04, (coord(a[1]) + coord(b[1])) / 2],
          size: horizontal ? [SPACING + ROAD_W * 0.9, ROAD_W * 0.9] : [ROAD_W * 0.9, SPACING + ROAD_W * 0.9],
        };
      }),
    [route]
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const active = sim.corridorActive();
    const amb = sim.ambulance && !sim.ambulance.arrived ? sim.ambulance : null;
    mats.current.forEach((m, i) => {
      if (!m) return;
      const passed = amb && i < amb.k;
      m.color.copy(active ? C_EMERALD : C_CYAN);
      m.opacity = passed ? 0.05 : active ? 0.26 + 0.16 * Math.sin(t * 6 - i * 0.9) : amb ? 0.16 : 0.09;
    });
  });

  return (
    <group>
      {segs.map((s, i) => (
        <mesh key={`${routeVersion}-${i}`} position={s.pos} rotation-x={-Math.PI / 2} renderOrder={2}>
          <planeGeometry args={s.size} />
          <meshBasicMaterial
            ref={(el) => {
              mats.current[i] = el;
            }}
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

const MAX_RINGS = 24;

export function ForcedSignals({ sim }) {
  const groups = useRef([]);
  useFrame(({ clock }) => {
    const nodes = sim.forcedNodes;
    const t = clock.elapsedTime;
    for (let i = 0; i < MAX_RINGS; i++) {
      const g = groups.current[i];
      if (!g) continue;
      if (i < nodes.length) {
        g.visible = true;
        g.position.set(coord(nodes[i][0]), 0.06, coord(nodes[i][1]));
        const s = 1 + 0.12 * Math.sin(t * 7 + i);
        g.children[0].scale.set(s, s, 1);
        g.children[1].material.opacity = 0.18 + 0.1 * Math.sin(t * 5 + i);
      } else {
        g.visible = false;
      }
    }
  });
  return (
    <group>
      {Array.from({ length: MAX_RINGS }, (_, i) => (
        <group
          key={i}
          visible={false}
          ref={(el) => {
            groups.current[i] = el;
          }}
        >
          <mesh rotation-x={-Math.PI / 2}>
            <ringGeometry args={[2.7, 3.15, 40]} />
            <meshBasicMaterial color="#5effc1" transparent opacity={0.9} toneMapped={false} depthWrite={false} />
          </mesh>
          <mesh position={[0, 7, 0]}>
            <cylinderGeometry args={[0.55, 1.6, 14, 20, 1, true]} />
            <meshBasicMaterial
              color="#10b981"
              transparent
              opacity={0.2}
              side={THREE.DoubleSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

const INTRO_FROM = new THREE.Vector3(150, 170, 190);
const INTRO_TO = new THREE.Vector3(62, 66, 82);

export function CameraRig({ sim, follow }) {
  const controls = useThree((s) => s.controls);
  const camera = useThree((s) => s.camera);
  const step = useMemo(() => new THREE.Vector3(), []);
  const intro = useRef(0);

  useFrame((_, delta) => {
    if (intro.current < 1) {
      intro.current = Math.min(1, intro.current + delta / 2.6);
      const e = 1 - Math.pow(1 - intro.current, 3);
      camera.position.lerpVectors(INTRO_FROM, INTRO_TO, e);
      return;
    }
    if (!controls || !follow) return;
    const amb = sim.ambulance;
    step.set(amb ? amb.x : 0, 0, amb ? amb.z : 0).sub(controls.target).multiplyScalar(Math.min(1, delta * 3));
    controls.target.add(step);
    camera.position.add(step);
  });
  return null;
}
