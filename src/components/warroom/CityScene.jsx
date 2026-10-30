// 500 × 500 City Scene Canvas & 24-Hour Continuous Directional Sunlight Engine
// Features realistic solar movement, dramatic directional building shading,
// and smooth camera tracking across the 500-unit metropolis.

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import CityStatic from "./CityStatic";
import RoadBarricades from "./RoadBarricades";
import { SimDriver, Vehicles, TrafficLights, Ambulance, Corridor, ForcedSignals, CameraRig } from "./SimLayer";

// Continuous mathematical 24-hour solar & ambient lighting model
export function compute24HourLighting(hour) {
  const h = ((hour % 24) + 24) % 24;

  // Solar angle: 0 at sunrise (6:00), PI/2 at noon (12:00), PI at sunset (18:00), -PI/2 at midnight (0:00)
  const sunAngle = ((h - 6) / 12) * Math.PI;
  const sunElevation = Math.sin(sunAngle); // > 0 is day, < 0 is night

  // Day factor: 0.0 at deep night, 1.0 at peak noon
  const dayFactor = Math.max(0, Math.min(1, (sunElevation + 0.12) / 1.08));

  // Sun coordinate sweeping across celestial dome for 500 × 500 world
  const sunDist = 380;
  const sunY = Math.max(22, Math.sin(Math.max(0.06, sunElevation)) * sunDist);
  const sunX = Math.cos(sunAngle) * sunDist * 0.9;
  const sunZ = Math.sin(sunAngle * 0.65) * 160;

  const isMorning = h >= 5.0 && h < 9.5;
  const isEvening = h >= 16.5 && h < 20.2;
  const twilightIntensity = Math.max(0, 1 - Math.abs(sunElevation - 0.1) / 0.28);

  let bg, fog, ambientColor, ambientIntensity, sunColor, sunIntensity, hemiSky, hemiGround, buildingTint;

  if (dayFactor < 0.1) {
    // Cyberpunk Night (20:30 - 05:00)
    bg = "#020617";
    fog = "#020617";
    ambientColor = "#0e3a5a";
    ambientIntensity = 0.38;
    hemiSky = "#0284c7";
    hemiGround = "#020617";
    sunColor = "#93c5fd";
    sunIntensity = 0.35; // Pale blue moonlight
    buildingTint = new THREE.Color("#1e293b");
  } else if (isEvening && twilightIntensity > 0.2) {
    // Fiery Evening Sunset (17:00 - 19:30) - Rich amber/crimson directional light on west facades
    bg = "#180d22";
    fog = "#1c0d28";
    ambientColor = "#c2410c";
    ambientIntensity = 0.52;
    hemiSky = "#ea580c";
    hemiGround = "#3b0764";
    sunColor = "#f97316";
    sunIntensity = 1.55;
    buildingTint = new THREE.Color("#fb923c");
  } else if (isMorning && twilightIntensity > 0.2) {
    // Warm Dawn Sunrise (05:30 - 08:30) - Golden sunlight on east facades
    bg = "#111c2e";
    fog = "#132135";
    ambientColor = "#ca8a04";
    ambientIntensity = 0.56;
    hemiSky = "#f59e0b";
    hemiGround = "#1e293b";
    sunColor = "#fde047";
    sunIntensity = 1.5;
    buildingTint = new THREE.Color("#fef08a");
  } else {
    // Crisp Full Daylight (09:00 - 16:30) - Balanced soft sunlight without specular glare
    bg = "#0c1a2e";
    fog = "#0c1a2e";
    ambientColor = "#94a3b8";
    ambientIntensity = 0.62;
    hemiSky = "#bae6fd";
    hemiGround = "#1e293b";
    sunColor = "#fffbeb";
    sunIntensity = 1.6;
    buildingTint = new THREE.Color("#ffffff");
  }

  return {
    bg,
    fog,
    fogNear: 280,
    fogFar: 1050,
    ambientColor,
    ambientIntensity,
    hemiSky,
    hemiGround,
    hemiIntensity: 0.55,
    sunColor,
    sunIntensity,
    sunPos: [sunX, sunY, sunZ],
    fillColor: "#38bdf8",
    fillIntensity: 0.35,
    dayFactor,
    buildingTint,
    isNight: dayFactor < 0.15,
  };
}

// Directional sunlight component with target
function DynamicSunlight({ lighting }) {
  const dirLightRef = useRef();

  useFrame(() => {
    if (dirLightRef.current) {
      dirLightRef.current.position.set(...lighting.sunPos);
      dirLightRef.current.color.set(lighting.sunColor);
      dirLightRef.current.intensity = lighting.sunIntensity;
    }
  });

  return (
    <directionalLight
      ref={dirLightRef}
      position={lighting.sunPos}
      intensity={lighting.sunIntensity}
      color={lighting.sunColor}
      castShadow={false}
    />
  );
}

export default function CityScene({
  sim,
  active,
  viewMode,
  routeVersion,
  showHazards = true,
  showTrafficFilter = true,
  hour = 8.5,
}) {
  const lighting = useMemo(() => compute24HourLighting(hour), [hour]);

  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      dpr={[1, 1.35]}
      camera={{ position: [110, 95, 130], fov: 44, near: 0.8, far: 2400 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <color attach="background" args={[lighting.bg]} />
      <fog attach="fog" args={[lighting.fog, lighting.fogNear, lighting.fogFar]} />

      {/* Balanced ambient & hemisphere lighting so directional sunlight creates dramatic contrast */}
      <ambientLight color={lighting.ambientColor} intensity={lighting.ambientIntensity} />
      <hemisphereLight args={[lighting.hemiSky, lighting.hemiGround, lighting.hemiIntensity]} />
      <DynamicSunlight lighting={lighting} />
      <directionalLight position={[-160, 90, -140]} intensity={lighting.fillIntensity} color={lighting.fillColor} />

      <SimDriver sim={sim} />
      <CityStatic
        sim={sim}
        showHazards={showHazards}
        showTrafficFilter={showTrafficFilter}
        lighting={lighting}
        dayFactor={lighting.dayFactor}
        isNight={lighting.isNight}
      />
      <Corridor sim={sim} routeVersion={routeVersion} />
      <ForcedSignals sim={sim} />
      <TrafficLights sim={sim} />
      <RoadBarricades sim={sim} />
      <Vehicles sim={sim} />
      <Ambulance sim={sim} />

      {/* OrbitControls tuned for snappy, responsive camera rotation & smooth deceleration without lag */}
      <OrbitControls
        makeDefault
        enabled={viewMode === "orbit"}
        enableDamping
        dampingFactor={0.18}
        rotateSpeed={1.2}
        panSpeed={1.2}
        maxPolarAngle={1.38}
        minDistance={15}
        maxDistance={900}
        target={[0, 0, 0]}
      />
      <CameraRig sim={sim} viewMode={viewMode} />
    </Canvas>
  );
}
