import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { segmentGeometry, roadHeightAt, ROAD_W } from "../../lib/cityGrid";

function makeHazardStripesCanvas(type = "construction") {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = type === "construction" ? "#f59e0b" : "#0284c7";
  ctx.fillRect(0, 0, 256, 64);

  // Diagonal Hazard Stripes
  ctx.fillStyle = type === "construction" ? "#09090b" : "#ffffff";
  const stripeW = 24;
  for (let x = -64; x < 320; x += stripeW * 2) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 28, 0);
    ctx.lineTo(x + 28 - 36, 64);
    ctx.lineTo(x - 36, 64);
    ctx.closePath();
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// Single 3D Barricade Assembly spanning across a road mouth
function SingleBarricade({ x, y, z, angle, reason, clockTime }) {
  const isConstruction = reason === "construction";
  const stripeTex = useMemo(() => makeHazardStripesCanvas(reason), [reason]);
  const blink = (Math.sin(clockTime * 8) + 1) * 0.5 > 0.4;

  return (
    <group position={[x, y, z]} rotation={[0, angle, 0]}>
      {/* Heavy Concrete Base Block */}
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[ROAD_W * 0.95, 0.44, 0.55]} />
        <meshStandardMaterial
          color={isConstruction ? "#475569" : "#1e293b"}
          roughness={0.9}
        />
      </mesh>

      {/* Vertical Support Posts */}
      {[-ROAD_W * 0.4, ROAD_W * 0.4].map((px, i) => (
        <mesh key={i} position={[px, 0.9, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 1.2, 8]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}

      {/* Top Striped Barrier Plank */}
      <mesh position={[0, 1.25, 0]}>
        <boxGeometry args={[ROAD_W * 0.96, 0.38, 0.08]} />
        <meshStandardMaterial
          map={stripeTex}
          roughness={0.5}
          emissive={isConstruction ? "#b45309" : "#0284c7"}
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* Middle Striped Barrier Plank */}
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[ROAD_W * 0.96, 0.34, 0.08]} />
        <meshStandardMaterial
          map={stripeTex}
          roughness={0.5}
          emissive={isConstruction ? "#b45309" : "#0284c7"}
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* Twin Blinking Warning Beacon Lights on Top */}
      {[-ROAD_W * 0.38, ROAD_W * 0.38].map((lx, i) => (
        <group key={i} position={[lx, 1.62, 0]}>
          <mesh>
            <cylinderGeometry args={[0.09, 0.12, 0.18, 12]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          <mesh position={[0, 0.16, 0]}>
            <sphereGeometry args={[0.13, 12, 12]} />
            <meshBasicMaterial
              color={blink ? (isConstruction ? "#f59e0b" : "#38bdf8") : "#713f12"}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}

      {/* Side Traffic Cones */}
      {[-ROAD_W * 0.52, ROAD_W * 0.52].map((cx, i) => (
        <group key={i} position={[cx, 0.02, 0]}>
          {/* Cone Base */}
          <mesh position={[0, 0.04, 0]}>
            <boxGeometry args={[0.55, 0.08, 0.55]} />
            <meshStandardMaterial color="#ea580c" roughness={0.8} />
          </mesh>
          {/* Orange Cone */}
          <mesh position={[0, 0.45, 0]}>
            <coneGeometry args={[0.22, 0.8, 14]} />
            <meshStandardMaterial color="#f97316" roughness={0.6} />
          </mesh>
          {/* White Reflective Cone Collar */}
          <mesh position={[0, 0.45, 0]}>
            <cylinderGeometry args={[0.13, 0.16, 0.22, 14]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// 3D Flood Sheet rendered along the road surface when waterlogged
function WaterloggedPuddle({ points }) {
  const shape = useMemo(() => {
    if (points.length < 2) return null;
    const p1 = points[0], p2 = points[points.length - 1];
    const dx = p2.x - p1.x, dz = p2.z - p1.z;
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len * (ROAD_W * 0.52), nz = dx / len * (ROAD_W * 0.52);
    const midX = (p1.x + p2.x) / 2, midZ = (p1.z + p2.z) / 2;
    const y = roadHeightAt(midX, midZ) + 0.12;

    return {
      midX,
      midZ,
      y,
      len,
      angle: Math.atan2(dz, dx),
    };
  }, [points]);

  if (!shape) return null;

  return (
    <mesh
      position={[shape.midX, shape.y, shape.midZ]}
      rotation={[-Math.PI / 2, 0, shape.angle]}
    >
      <planeGeometry args={[shape.len * 0.9, ROAD_W * 0.94]} />
      <meshStandardMaterial
        color="#0891b2"
        roughness={0.1}
        metalness={0.65}
        transparent
        opacity={0.72}
        emissive="#06b6d4"
        emissiveIntensity={0.25}
      />
    </mesh>
  );
}

export default function RoadBarricades({ sim }) {
  const clockRef = useRef(0);

  useFrame(({ clock }) => {
    clockRef.current = clock.elapsedTime;
  });

  const closures = Array.from(sim?.closures?.values() || []);
  if (!closures.length) return null;

  return (
    <group name="Road Barriers and Blockades">
      {closures.map((c) => {
        const [ixStr, izStr, axisStr] = c.key.split(",");
        const ix = parseInt(ixStr, 10), iz = parseInt(izStr, 10), axis = parseInt(axisStr, 10);
        const geo = segmentGeometry(ix, iz, axis);
        if (!geo || !geo.points || geo.points.length < 2) return null;

        const pts = geo.points;
        const p1 = pts[0];
        const p2 = pts[pts.length - 1];

        const dx = p2.x - p1.x, dz = p2.z - p1.z;
        const roadAngle = Math.atan2(dz, dx);
        const barrierAngle = roadAngle + Math.PI / 2;

        // Position 1: 18% along segment (Entry A)
        const a1x = THREE.MathUtils.lerp(p1.x, p2.x, 0.18);
        const a1z = THREE.MathUtils.lerp(p1.z, p2.z, 0.18);
        const a1y = roadHeightAt(a1x, a1z);

        // Position 2: 82% along segment (Entry B)
        const a2x = THREE.MathUtils.lerp(p1.x, p2.x, 0.82);
        const a2z = THREE.MathUtils.lerp(p1.z, p2.z, 0.82);
        const a2y = roadHeightAt(a2x, a2z);

        return (
          <group key={c.key}>
            {/* Entry Barricade A */}
            <SingleBarricade
              x={a1x}
              y={a1y}
              z={a1z}
              angle={barrierAngle}
              reason={c.reason}
              clockTime={clockRef.current}
            />

            {/* Entry Barricade B */}
            <SingleBarricade
              x={a2x}
              y={a2y}
              z={a2z}
              angle={barrierAngle}
              reason={c.reason}
              clockTime={clockRef.current}
            />

            {/* If Waterlogged, render realistic water sheet on asphalt */}
            {c.reason === "water_logging" && (
              <WaterloggedPuddle points={pts} />
            )}
          </group>
        );
      })}
    </group>
  );
}
