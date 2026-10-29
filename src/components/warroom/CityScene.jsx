import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import CityStatic from "./CityStatic";
import { SimDriver, Vehicles, TrafficLights, Ambulance, Corridor, ForcedSignals, CameraRig } from "./SimLayer";

export default function CityScene({ sim, active, follow, routeVersion }) {
  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      dpr={[1, 1.75]}
      camera={{ position: [150, 170, 190], fov: 42, near: 0.5, far: 800 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#020617"]} />
      <fog attach="fog" args={["#020617", 120, 300]} />
      <ambientLight intensity={0.45} />
      <hemisphereLight args={["#67e8f9", "#0b1120", 0.7]} />
      <directionalLight position={[40, 90, 30]} intensity={1.2} color="#e0f2fe" />
      <directionalLight position={[-60, 40, -40]} intensity={0.35} color="#22d3ee" />

      <SimDriver sim={sim} />
      <CityStatic />
      <Corridor sim={sim} routeVersion={routeVersion} />
      <ForcedSignals sim={sim} />
      <TrafficLights sim={sim} />
      <Vehicles sim={sim} />
      <Ambulance sim={sim} />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={1.35}
        minDistance={20}
        maxDistance={260}
        target={[0, 0, 0]}
      />
      <CameraRig sim={sim} follow={follow} />
    </Canvas>
  );
}
