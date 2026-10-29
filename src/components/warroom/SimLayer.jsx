// Dynamic simulation layer: multi-modal vehicles with illuminated headlights, taillights,
// suspension bounce, active corridor clearance projection beam, yielding arrows,
// and chase-cam controls.

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GRID, SPACING, ROAD_W, LANE, coord, DIRS, dirBetween } from "../../lib/cityGrid";
import { MAX_VEHICLES } from "../../lib/trafficSim";

const C_RED = new THREE.Color("#ff2d55");
const C_YELLOW = new THREE.Color("#fbbf24");
const C_GREEN = new THREE.Color("#22c55e");
const C_WAVE = new THREE.Color("#5effc1");
const C_EMERALD = new THREE.Color("#10b981");
const C_CYAN = new THREE.Color("#22d3ee");
const C_AMBER = new THREE.Color("#f59e0b");
const C_WHITE = new THREE.Color("#ffffff");
const C_TAIL = new THREE.Color("#ef4444");

export function SimDriver({ sim }) {
  useFrame((_, delta) => sim.step(delta));
  return null;
}

// ───────────────────── Multi-Modal Vehicle Fleet with Lights ─────────────────────
export function Vehicles({ sim }) {
  const meshRefs = {
    busBody: useRef(),
    busRoof: useRef(),
    truckCab: useRef(),
    truckCargo: useRef(),
    autoBody: useRef(),
    autoTop: useRef(),
    bikeBody: useRef(),
    bikeRider: useRef(),
    suvBody: useRef(),
    suvCabin: useRef(),
    carBody: useRef(),
    carCabin: useRef(),
    // Illuminated vehicle headlights and taillights for high visibility
    headlights: useRef(),
    taillights: useRef(),
    // Yielding indicators (pulsing amber beacons above cars pulling over)
    yieldBeacons: useRef(),
  };

  const geos = useMemo(
    () => ({
      busBody: new THREE.BoxGeometry(3.6, 1.1, 1.25).translate(0, 0.72, 0),
      busRoof: new THREE.BoxGeometry(2.6, 0.28, 1.0).translate(0, 1.38, 0),
      truckCab: new THREE.BoxGeometry(1.15, 1.1, 1.25).translate(1.0, 0.72, 0),
      truckCargo: new THREE.BoxGeometry(2.4, 1.45, 1.25).translate(-0.65, 0.9, 0),
      autoBody: new THREE.BoxGeometry(1.5, 0.65, 0.92).translate(0, 0.48, 0),
      autoTop: new THREE.BoxGeometry(0.95, 0.45, 0.88).translate(-0.1, 0.95, 0),
      bikeBody: new THREE.BoxGeometry(1.2, 0.48, 0.42).translate(0, 0.38, 0),
      bikeRider: new THREE.BoxGeometry(0.48, 0.6, 0.38).translate(-0.1, 0.88, 0),
      suvBody: new THREE.BoxGeometry(2.3, 0.72, 1.15).translate(0, 0.54, 0),
      suvCabin: new THREE.BoxGeometry(1.35, 0.55, 1.05).translate(-0.1, 1.08, 0),
      carBody: new THREE.BoxGeometry(2.05, 0.62, 1.05).translate(0, 0.5, 0),
      carCabin: new THREE.BoxGeometry(1.15, 0.48, 0.95).translate(-0.1, 1.02, 0),
      headlight: new THREE.BoxGeometry(0.12, 0.16, 0.28),
      taillight: new THREE.BoxGeometry(0.12, 0.16, 0.28),
      yieldBeacon: new THREE.ConeGeometry(0.35, 0.65, 8).rotateX(Math.PI),
    }),
    []
  );

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const dummyLight = useMemo(() => new THREE.Object3D(), []);
  const colorCache = useMemo(() => new Map(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);

  useLayoutEffect(() => {
    // Explicitly allocate and initialise instanceColor on all vehicle body meshes
    const colorMeshes = [
      meshRefs.busBody.current,
      meshRefs.truckCab.current,
      meshRefs.autoBody.current,
      meshRefs.bikeBody.current,
      meshRefs.suvBody.current,
      meshRefs.carBody.current,
    ];
    colorMeshes.forEach((m) => {
      if (m) {
        for (let i = 0; i < MAX_VEHICLES; i++) {
          m.setColorAt(i, tmpColor.set("#38bdf8"));
        }
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }
    });

    return () => {
      Object.values(geos).forEach((g) => g.dispose());
    };
  }, [geos, tmpColor]);

  useFrame(({ clock }) => {
    const vs = sim.vehicles;
    const blink = Math.floor(clock.elapsedTime * 6) % 2 === 0;

    const counts = { bus: 0, truck: 0, auto: 0, bike: 0, suv: 0, car: 0 };
    let lightCount = 0;
    let yieldCount = 0;

    for (let i = 0; i < vs.length; i++) {
      const v = vs[i];
      const type = v.type;
      const idx = counts[type];
      counts[type]++;

      const halfL = (v.spec.length || 1.8) * 0.5;
      const curScale = Math.max(0.01, v.scale);

      dummy.position.set(v.x, 0.18 + (v.yOffset || 0), v.z);
      dummy.rotation.set(v.pitch || 0, v.heading, 0);
      dummy.scale.setScalar(curScale);
      dummy.updateMatrix();

      let c = colorCache.get(v.color);
      if (!c) {
        c = new THREE.Color(v.color);
        colorCache.set(v.color, c);
      }
      const activeColor = v.yielding && blink ? C_AMBER : c;

      if (type === "bus") {
        meshRefs.busBody.current.setMatrixAt(idx, dummy.matrix);
        meshRefs.busRoof.current.setMatrixAt(idx, dummy.matrix);
        meshRefs.busBody.current.setColorAt(idx, activeColor);
      } else if (type === "truck") {
        meshRefs.truckCab.current.setMatrixAt(idx, dummy.matrix);
        meshRefs.truckCargo.current.setMatrixAt(idx, dummy.matrix);
        meshRefs.truckCab.current.setColorAt(idx, activeColor);
      } else if (type === "auto") {
        meshRefs.autoBody.current.setMatrixAt(idx, dummy.matrix);
        meshRefs.autoTop.current.setMatrixAt(idx, dummy.matrix);
        meshRefs.autoBody.current.setColorAt(idx, activeColor);
      } else if (type === "bike") {
        meshRefs.bikeBody.current.setMatrixAt(idx, dummy.matrix);
        meshRefs.bikeRider.current.setMatrixAt(idx, dummy.matrix);
        meshRefs.bikeBody.current.setColorAt(idx, activeColor);
      } else if (type === "suv") {
        meshRefs.suvBody.current.setMatrixAt(idx, dummy.matrix);
        meshRefs.suvCabin.current.setMatrixAt(idx, dummy.matrix);
        meshRefs.suvBody.current.setColorAt(idx, activeColor);
      } else {
        meshRefs.carBody.current.setMatrixAt(idx, dummy.matrix);
        meshRefs.carCabin.current.setMatrixAt(idx, dummy.matrix);
        meshRefs.carBody.current.setColorAt(idx, activeColor);
      }

      // Dual headlights (front) & taillights (rear) - Zero allocation trigonometry
      if (meshRefs.headlights.current && meshRefs.taillights.current && lightCount < MAX_VEHICLES * 2) {
        const fwdX = Math.cos(v.heading) * (halfL + 0.08);
        const fwdZ = -Math.sin(v.heading) * (halfL + 0.08);

        // Front headlight
        dummyLight.position.set(v.x + fwdX, 0.55 + (v.yOffset || 0), v.z + fwdZ);
        dummyLight.rotation.set(0, v.heading, 0);
        dummyLight.scale.set(1, 1, 1);
        dummyLight.updateMatrix();
        meshRefs.headlights.current.setMatrixAt(lightCount, dummyLight.matrix);

        // Rear taillight
        dummyLight.position.set(v.x - fwdX, 0.55 + (v.yOffset || 0), v.z - fwdZ);
        dummyLight.updateMatrix();
        meshRefs.taillights.current.setMatrixAt(lightCount, dummyLight.matrix);
        lightCount++;
      }

      // Yielding Beacon (hovering pulsing indicator above cars pulling over for ambulance)
      if (v.yielding && meshRefs.yieldBeacons.current && yieldCount < 80) {
        dummyLight.position.set(v.x, 2.2 + Math.sin(clock.elapsedTime * 8) * 0.2, v.z);
        dummyLight.rotation.set(0, clock.elapsedTime * 4, 0);
        dummyLight.scale.setScalar(0.95);
        dummyLight.updateMatrix();
        meshRefs.yieldBeacons.current.setMatrixAt(yieldCount, dummyLight.matrix);
        yieldCount++;
      }
    }

    const pairs = [
      ["busBody", "busRoof", counts.bus],
      ["truckCab", "truckCargo", counts.truck],
      ["autoBody", "autoTop", counts.auto],
      ["bikeBody", "bikeRider", counts.bike],
      ["suvBody", "suvCabin", counts.suv],
      ["carBody", "carCabin", counts.car],
    ];

    pairs.forEach(([bodyKey, subKey, count]) => {
      const bMesh = meshRefs[bodyKey].current;
      const sMesh = meshRefs[subKey].current;
      if (bMesh && sMesh) {
        bMesh.count = count;
        sMesh.count = count;
        bMesh.instanceMatrix.needsUpdate = true;
        sMesh.instanceMatrix.needsUpdate = true;
        if (bMesh.instanceColor) bMesh.instanceColor.needsUpdate = true;
      }
    });

    if (meshRefs.headlights.current) {
      meshRefs.headlights.current.count = lightCount;
      meshRefs.headlights.current.instanceMatrix.needsUpdate = true;
    }
    if (meshRefs.taillights.current) {
      meshRefs.taillights.current.count = lightCount;
      meshRefs.taillights.current.instanceMatrix.needsUpdate = true;
    }
    if (meshRefs.yieldBeacons.current) {
      meshRefs.yieldBeacons.current.count = yieldCount;
      meshRefs.yieldBeacons.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* 1. City Bus */}
      <instancedMesh ref={meshRefs.busBody} args={[geos.busBody, undefined, MAX_VEHICLES]} frustumCulled={false}>
        <meshStandardMaterial roughness={0.35} metalness={0.4} />
      </instancedMesh>
      <instancedMesh ref={meshRefs.busRoof} args={[geos.busRoof, undefined, MAX_VEHICLES]} frustumCulled={false}>
        <meshStandardMaterial color="#0f172a" emissive="#0284c7" emissiveIntensity={0.3} roughness={0.5} />
      </instancedMesh>

      {/* 2. Cargo Truck */}
      <instancedMesh ref={meshRefs.truckCab} args={[geos.truckCab, undefined, MAX_VEHICLES]} frustumCulled={false}>
        <meshStandardMaterial roughness={0.4} metalness={0.5} />
      </instancedMesh>
      <instancedMesh ref={meshRefs.truckCargo} args={[geos.truckCargo, undefined, MAX_VEHICLES]} frustumCulled={false}>
        <meshStandardMaterial color="#334155" metalness={0.3} roughness={0.7} />
      </instancedMesh>

      {/* 3. Auto-Rickshaw */}
      <instancedMesh ref={meshRefs.autoBody} args={[geos.autoBody, undefined, MAX_VEHICLES]} frustumCulled={false}>
        <meshStandardMaterial roughness={0.3} metalness={0.45} />
      </instancedMesh>
      <instancedMesh ref={meshRefs.autoTop} args={[geos.autoTop, undefined, MAX_VEHICLES]} frustumCulled={false}>
        <meshStandardMaterial color="#0b0f19" roughness={0.8} />
      </instancedMesh>

      {/* 4. Two-Wheeler / Bike */}
      <instancedMesh ref={meshRefs.bikeBody} args={[geos.bikeBody, undefined, MAX_VEHICLES]} frustumCulled={false}>
        <meshStandardMaterial roughness={0.25} metalness={0.7} />
      </instancedMesh>
      <instancedMesh ref={meshRefs.bikeRider} args={[geos.bikeRider, undefined, MAX_VEHICLES]} frustumCulled={false}>
        <meshStandardMaterial color="#1e293b" emissive="#38bdf8" emissiveIntensity={0.25} roughness={0.6} />
      </instancedMesh>

      {/* 5. SUV / MUV */}
      <instancedMesh ref={meshRefs.suvBody} args={[geos.suvBody, undefined, MAX_VEHICLES]} frustumCulled={false}>
        <meshStandardMaterial roughness={0.28} metalness={0.55} />
      </instancedMesh>
      <instancedMesh ref={meshRefs.suvCabin} args={[geos.suvCabin, undefined, MAX_VEHICLES]} frustumCulled={false}>
        <meshStandardMaterial color="#090d16" emissive="#0284c7" emissiveIntensity={0.3} roughness={0.15} metalness={0.8} />
      </instancedMesh>

      {/* 6. Sedan / Hatchback */}
      <instancedMesh ref={meshRefs.carBody} args={[geos.carBody, undefined, MAX_VEHICLES]} frustumCulled={false}>
        <meshStandardMaterial roughness={0.3} metalness={0.5} />
      </instancedMesh>
      <instancedMesh ref={meshRefs.carCabin} args={[geos.carCabin, undefined, MAX_VEHICLES]} frustumCulled={false}>
        <meshStandardMaterial color="#0b1222" emissive="#0e7490" emissiveIntensity={0.38} roughness={0.1} metalness={0.8} />
      </instancedMesh>

      {/* Glowing Headlights on all civilian vehicles */}
      <instancedMesh ref={meshRefs.headlights} args={[geos.headlight, undefined, MAX_VEHICLES * 2]} frustumCulled={false}>
        <meshBasicMaterial color="#e0f2fe" toneMapped={false} />
      </instancedMesh>

      {/* Glowing Taillights on all civilian vehicles */}
      <instancedMesh ref={meshRefs.taillights} args={[geos.taillight, undefined, MAX_VEHICLES * 2]} frustumCulled={false}>
        <meshBasicMaterial color="#ef4444" toneMapped={false} />
      </instancedMesh>

      {/* Pulsing Yielding Beacons above cars pulling over for ambulance */}
      <instancedMesh ref={meshRefs.yieldBeacons} args={[geos.yieldBeacon, undefined, 80]} frustumCulled={false}>
        <meshBasicMaterial color="#f59e0b" toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

export function TrafficLights({ sim }) {
  const poles = useRef();
  const lamps = useRef();
  const count = GRID * GRID * 4;
  const r = ROAD_W / 2 + 0.42;
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
        m.position.set(x + ox, 1.25, z + oz);
        m.scale.set(1, 1, 1);
        m.updateMatrix();
        poles.current.setMatrixAt(i, m.matrix);
        m.position.set(x + ox, 2.55, z + oz);
        m.updateMatrix();
        lamps.current.setMatrixAt(i, m.matrix);
        lamps.current.setColorAt(i, C_RED);
      });
    }
    poles.current.instanceMatrix.needsUpdate = true;
    lamps.current.instanceMatrix.needsUpdate = true;
    lamps.current.instanceColor.needsUpdate = true;
  }, [corners]);

  const lastLightUpdate = useRef(0);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const active = sim.corridorActive();
    // Throttle traffic light lamp updates to 10 FPS (100ms) unless ambulance corridor is actively changing
    if (!active && t - lastLightUpdate.current < 0.1) return;
    lastLightUpdate.current = t;

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
        <cylinderGeometry args={[0.07, 0.09, 2.5, 6]} />
        <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.4} />
      </instancedMesh>
      <instancedMesh ref={lamps} args={[undefined, undefined, count]}>
        <sphereGeometry args={[0.3, 12, 10]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

// ───────────────────── Active Ambulance & Projected Clearance Beam ─────────────────────
export function Ambulance({ sim }) {
  const group = useRef();
  const barA = useRef();
  const barB = useRef();
  const light = useRef();
  const halo = useRef();
  const projectionBeam = useRef();
  const chevronRef = useRef();

  const trail = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(80 * 3), 3));
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
    light.current.intensity = amb.arrived ? 30 : 120;
    const p = (t % 0.85) / 0.85;
    halo.current.scale.set(1 + p * 1.6, 1 + p * 1.6, 1);
    halo.current.material.opacity = 0.8 * (1 - p);

    // Forward Traffic Projection Clearance Beam on road ahead
    if (projectionBeam.current) {
      const beamPhase = (t * 3.5) % 1.0;
      projectionBeam.current.material.opacity = 0.35 + 0.25 * Math.sin(t * 6);
      if (chevronRef.current) {
        chevronRef.current.position.x = 6 + beamPhase * 18;
      }
    }

    const pts = amb.trail;
    const pos = trail.geometry.attributes.position;
    const n = Math.min(80, pts.length / 2);
    for (let i = 0; i < n; i++) pos.setXYZ(i, pts[i * 2], 0.45, pts[i * 2 + 1]);
    pos.needsUpdate = true;
    trail.geometry.setDrawRange(0, n);
    trail.geometry.computeBoundingSphere();
  });

  return (
    <group>
      <primitive object={trail} />
      <group ref={group} visible={false}>
        {/* Ambulance Body */}
        <mesh position={[0, 0.72, 0]}>
          <boxGeometry args={[2.6, 1.15, 1.25]} />
          <meshStandardMaterial color="#f8fafc" emissive="#ff2d55" emissiveIntensity={0.25} roughness={0.3} metalness={0.3} />
        </mesh>
        <mesh position={[0.95, 0.58, 0]}>
          <boxGeometry args={[0.75, 0.82, 1.28]} />
          <meshStandardMaterial color="#0b1222" emissive="#22d3ee" emissiveIntensity={0.45} />
        </mesh>
        {/* Neon Side Stripe */}
        <mesh position={[0, 0.58, 0]}>
          <boxGeometry args={[2.62, 0.2, 1.3]} />
          <meshBasicMaterial color="#ff2d55" toneMapped={false} />
        </mesh>
        <mesh position={[-0.2, 1.15, 0]}>
          <boxGeometry args={[0.55, 0.08, 0.7]} />
          <meshBasicMaterial color="#ffc400" toneMapped={false} />
        </mesh>
        {/* Dual Flashing Emergency Sirens */}
        <mesh ref={barA} position={[0.42, 1.4, -0.34]}>
          <boxGeometry args={[0.36, 0.24, 0.46]} />
          <meshBasicMaterial toneMapped={false} />
        </mesh>
        <mesh ref={barB} position={[0.42, 1.4, 0.34]}>
          <boxGeometry args={[0.36, 0.24, 0.46]} />
          <meshBasicMaterial toneMapped={false} />
        </mesh>

        {/* Pulsing Ground Halo */}
        <mesh ref={halo} position={[0, 0.04, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[1.8, 2.4, 40]} />
          <meshBasicMaterial color="#ff2d55" transparent toneMapped={false} depthWrite={false} />
        </mesh>
        <pointLight ref={light} position={[0, 3.4, 0]} distance={30} decay={2} intensity={120} />

        {/* 🚨 Forward Active Clearance Projection Beam (The Traffic Projection) */}
        <group position={[14, 0.06, 0]}>
          {/* 28m forward projection trapezoid showing clearance zone */}
          <mesh ref={projectionBeam} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[26, 4.4]} />
            <meshBasicMaterial
              color="#10b981"
              transparent
              opacity={0.35}
              depthWrite={false}
              toneMapped={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          {/* Animated sweeping chevron radar line */}
          <mesh ref={chevronRef} position={[0, 0.02, 0]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[1.8, 4.2]} />
            <meshBasicMaterial
              color="#5effc1"
              transparent
              opacity={0.8}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>

        {/* Overhead 3D Callout Beacon: 🚨 AMB-07 */}
        <mesh position={[0, 3.2, 0]}>
          <boxGeometry args={[3.2, 0.8, 0.2]} />
          <meshBasicMaterial color="#ff1744" toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

export function Corridor({ sim, routeVersion }) {
  const mats = useRef([]);
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
      m.opacity = passed ? 0.05 : active ? 0.28 + 0.16 * Math.sin(t * 6 - i * 0.9) : amb ? 0.16 : 0.09;
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

const MAX_RINGS = 32;

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
        g.children[1].material.opacity = 0.2 + 0.12 * Math.sin(t * 5 + i);
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
            <ringGeometry args={[2.8, 3.3, 40]} />
            <meshBasicMaterial color="#5effc1" transparent opacity={0.9} toneMapped={false} depthWrite={false} />
          </mesh>
          <mesh position={[0, 8, 0]}>
            <cylinderGeometry args={[0.65, 1.8, 16, 20, 1, true]} />
            <meshBasicMaterial
              color="#10b981"
              transparent
              opacity={0.22}
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

function shortestAngle(from, to) {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

// ───────────────────── Camera Rig with Smooth Chase-Cam Mode ─────────────────────
const INTRO_FROM = new THREE.Vector3(120, 140, 150);
const INTRO_TO = new THREE.Vector3(55, 48, 65);

export function CameraRig({ sim, viewMode }) {
  const controls = useThree((s) => s.controls);
  const camera = useThree((s) => s.camera);
  const targetPos = useMemo(() => new THREE.Vector3(), []);
  const camPos = useMemo(() => new THREE.Vector3(), []);
  const smoothedLookAt = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const intro = useRef(0);
  const smoothedHeading = useRef(0);

  useFrame((_, delta) => {
    if (intro.current < 1) {
      intro.current = Math.min(1, intro.current + delta / 1.6);
      const e = 1 - Math.pow(1 - intro.current, 3);
      camera.position.lerpVectors(INTRO_FROM, INTRO_TO, e);
      if (intro.current >= 1 && controls) {
        controls.update();
      }
      return;
    }

    const amb = sim.ambulance;

    // View Modes: "chase" (close 3rd person behind ambulance), "drone" (elevated angle), or "orbit"
    if (viewMode === "chase" && amb && !amb.arrived) {
      const hDiff = shortestAngle(smoothedHeading.current, amb.heading);
      smoothedHeading.current += hDiff * Math.min(1, delta * 7.5);

      const backDist = 18;
      const height = 9.0;
      const h = smoothedHeading.current;

      camPos.set(amb.x - Math.cos(h) * backDist, height, amb.z + Math.sin(h) * backDist);
      targetPos.set(amb.x + Math.cos(h) * 14, 1.4, amb.z - Math.sin(h) * 14);

      const smoothFactor = 1 - Math.exp(-6 * delta);
      camera.position.lerp(camPos, smoothFactor);
      smoothedLookAt.lerp(targetPos, smoothFactor);
      camera.lookAt(smoothedLookAt);

      if (controls) {
        controls.target.copy(smoothedLookAt);
      }
    } else if (viewMode === "drone" && amb && !amb.arrived) {
      targetPos.set(amb.x, 0.5, amb.z);
      camPos.set(amb.x + 32, 42, amb.z + 36);

      const smoothFactor = 1 - Math.exp(-4.5 * delta);
      camera.position.lerp(camPos, smoothFactor);
      smoothedLookAt.lerp(targetPos, smoothFactor);
      camera.lookAt(smoothedLookAt);

      if (controls) {
        controls.target.copy(smoothedLookAt);
      }
    }
  });

  return null;
}
