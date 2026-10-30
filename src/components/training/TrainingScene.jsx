import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import CityStatic from "../warroom/CityStatic";
import { Vehicles, TrafficLights, Ambulance, Corridor, ForcedSignals } from "../warroom/SimLayer";
import { Label } from "../warroom/CityStatic";
import { compute24HourLighting } from "../warroom/CityScene";
import { ROAD_SEGMENTS, ROAD_W, nodePosition, segmentGeometry, roadHeightAt } from "../../lib/cityGrid";
import { MISSIONS } from "../../lib/training";

function roadPieces(segment, roadIndex = 0) {
  const points = segmentGeometry(segment.ix, segment.iz, segment.axis).points;
  return points.slice(1).flatMap((b, i) => {
    const a = points[i], dx = b.x - a.x, dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    return length > 0.001 ? [{ roadIndex, x: (a.x + b.x) / 2, z: (a.z + b.z) / 2,
      length, yaw: -Math.atan2(dz, dx) }] : [];
  });
}

function roadMidpoint(segment) {
  const pieces = roadPieces(segment);
  const halfway = pieces.reduce((sum, p) => sum + p.length, 0) / 2;
  let traversed = 0;
  for (const piece of pieces) {
    if (traversed + piece.length >= halfway) {
      const offset = halfway - traversed - piece.length / 2;
      return { ...piece, x: piece.x + Math.cos(piece.yaw) * offset,
        z: piece.z - Math.sin(piece.yaw) * offset };
    }
    traversed += piece.length;
  }
  return pieces[pieces.length - 1];
}

function CanvasText({ lines, width = 1, height = 0.25, color = "#d8f7ff", position = [0, 0, 0] }) {
  const { canvas, texture } = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200; canvas.height = 400;
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    return { canvas, texture };
  }, []);
  useEffect(() => {
    const g = canvas.getContext("2d");
    g.fillStyle = "#081827"; g.fillRect(0, 0, canvas.width, canvas.height);
    g.strokeStyle = "#287686"; g.lineWidth = 8; g.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
    const rows = Array.isArray(lines) ? lines : [lines];
    g.fillStyle = color; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `600 ${Math.min(90, 290 / rows.length)}px Segoe UI, sans-serif`;
    rows.forEach((line, i) => g.fillText(line, 600, 200 + (i - (rows.length - 1) / 2) * (310 / rows.length), 1130));
    texture.needsUpdate = true;
  }, [canvas, texture, lines, color]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh position={position}>
    <planeGeometry args={[width, height]} />
    <meshBasicMaterial map={texture} toneMapped={false} />
  </mesh>;
}

function SpatialButton({ label, position, onSelect, disabled = false, width = 0.36 }) {
  return <group position={position} userData={{ xrAction: disabled ? null : onSelect }}
    onClick={(e) => { e.stopPropagation(); if (!disabled) onSelect(); }}>
    <mesh><boxGeometry args={[width, 0.085, 0.02]} /><meshBasicMaterial color={disabled ? "#253342" : "#137c80"} /></mesh>
    <CanvasText lines={label} width={width - 0.01} height={0.075} color={disabled ? "#7a8999" : "#e3fffa"} position={[0, 0, 0.011]} />
  </group>;
}

function SpatialPanel({ engine, snap, panelRef, onExit }) {
  const planning = snap.phase === "planning" || snap.pendingReroute;
  const plan = snap.plans.find((p) => p.id === snap.selectedPlan);
  const b = snap.baseline.travelSeconds, c = snap.coordinated.travelSeconds;
  return <group ref={panelRef} position={[0, 1.55, -2.5]}>
    <CanvasText width={1.8} height={0.58} position={[0, 0.25, 0]} lines={[
      `GREENWAVE XR  /  ${snap.mission.title}`,
      `${snap.elapsed.toFixed(1)} s  |  ${snap.phase === "results" ? (snap.result.passed ? "MISSION COMPLETE" : "RETRY MISSION") : snap.pendingReroute ? "ROAD CLOSED - REPLAN" : snap.phase.toUpperCase()}`,
      snap.phase === "results" ? `Ordinary: ${b ?? "timeout"} s  /  Corridor: ${c ?? "timeout"} s` :
        !snap.selectedIncident ? "Point at the red incident and press trigger" : planning ? `Route: ${plan?.label || "Choose a route"}` : "Inspect roads with the controller ray",
      snap.phase === "results" ? `Other-vehicle delay: ${snap.baseline.averageVehicleDelaySeconds.toFixed(1)} s / ${snap.coordinated.averageVehicleDelaySeconds.toFixed(1)} s` :
        snap.selectedRoad ? `${snap.closedSegments.includes(snap.selectedRoad.key) ? "CLOSED" : engine.sim.getRoadStatus(snap.selectedRoad.ix, snap.selectedRoad.iz, snap.selectedRoad.axis).toUpperCase()} road ${snap.selectedRoad.key}` : "Select a road to inspect its traffic",
      `${(snap.urgency || "urgent").toUpperCase()} / ${(snap.decision?.action || "idle").toUpperCase()} / ${snap.decision?.location || "Awaiting dispatch"}`,
      snap.decision?.reason || "Reviews traffic every second and at junctions",
    ]} />
    {snap.plans.filter((p) => p.id !== "custom").map((p, i) => <SpatialButton key={p.id}
      position={[-0.69 + i * 0.46, -0.12, 0]} width={0.44} label={p.id === "fastest" ? "Suggested route" : p.label.split(" ").slice(0, 2).join(" ")}
      disabled={!planning || !p.route.length} onSelect={() => engine.choosePlan(p.id)} />)}
    <SpatialButton position={[-0.61, -0.23, 0]} label="Via selected road" disabled={!planning || !snap.selectedRoad} onSelect={() => engine.planViaSelectedRoad()} />
    <SpatialButton position={[-0.2, -0.23, 0]} label={snap.pendingReroute ? "Reactivate" : "Activate corridor"}
      disabled={!planning || !snap.selectedIncident || !plan?.route.length} onSelect={() => engine.activate()} />
    <SpatialButton position={[0.21, -0.23, 0]} label={snap.phase === "results" ? "Retry same seed" : snap.paused ? "Resume" : "Pause"}
      disabled={snap.phase === "planning"} onSelect={() => snap.phase === "results" ? engine.prepare(snap.mission.id) : engine.paused = !engine.paused} />
    <SpatialButton position={[0.62, -0.23, 0]} label="Exit XR" onSelect={onExit} />
    {MISSIONS.map((m, i) => <SpatialButton key={m.id} width={0.54} position={[-0.58 + i * 0.58, -0.34, 0]}
      label={`${i + 1}. ${m.title}`} disabled={snap.phase === "running"} onSelect={() => engine.prepare(m.id)} />)}
    {["normal", "urgent", "critical"].map((level, i) => <SpatialButton key={level} width={0.54}
      position={[-0.58 + i * 0.58, -0.45, 0]} label={`${snap.urgency === level ? "✓ " : ""}${level} urgency`}
      disabled={snap.phase === "results"} onSelect={() => engine.setUrgency(level)} />)}
  </group>;
}

function SelectionLayer({ engine, snap, roadsRef, incidentRef }) {
  const pieces = useMemo(() => ROAD_SEGMENTS.flatMap((segment, i) => roadPieces(segment, i)), []);
  useLayoutEffect(() => {
    if (!roadsRef.current) return;
    const m = new THREE.Object3D();
    pieces.forEach((s, i) => {
      m.position.set(s.x, roadHeightAt(s.x, s.z) + 0.35, s.z);
      m.rotation.set(0, s.yaw, 0);
      m.scale.set(s.length + 0.15, 0.7, ROAD_W * 1.65); m.updateMatrix();
      roadsRef.current.setMatrixAt(i, m.matrix);
    });
    roadsRef.current.instanceMatrix.needsUpdate = true;
    roadsRef.current.computeBoundingSphere();
  }, [roadsRef, pieces]);
  const origin = nodePosition(...snap.mission.origin);
  return <group>
    <instancedMesh ref={roadsRef} args={[undefined, undefined, pieces.length]}
      userData={{ xrAction: (hit) => { if (hit.instanceId != null) engine.selectRoad(ROAD_SEGMENTS[pieces[hit.instanceId].roadIndex]); } }}
      onClick={(e) => { e.stopPropagation(); if (e.instanceId != null) engine.selectRoad(ROAD_SEGMENTS[pieces[e.instanceId].roadIndex]); }}>
      <boxGeometry /><meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
    </instancedMesh>
    <group position={[origin.x, 0, origin.z]}>
      <mesh ref={incidentRef} position={[0, 72, 0]} userData={{ xrAction: () => engine.selectIncident() }}
        onClick={(e) => { e.stopPropagation(); engine.selectIncident(); }}>
        <sphereGeometry args={[7, 16, 12]} /><meshBasicMaterial color={snap.selectedIncident ? "#fbbf24" : "#fb456d"} />
      </mesh>
      <mesh position={[0, 34, 0]}><cylinderGeometry args={[0.45, 0.8, 68, 8]} /><meshBasicMaterial color="#fb456d" transparent opacity={0.7} /></mesh>
      <Label text={snap.selectedIncident ? "INCIDENT SELECTED" : "SELECT INCIDENT"} color="#fda4af" position={[0, 88, 0]} width={62} />
    </group>
    {snap.selectedRoad && roadPieces(snap.selectedRoad).map((piece, i) => <mesh key={i}
      position={[piece.x, roadHeightAt(piece.x, piece.z) + 0.7, piece.z]} rotation={[0, piece.yaw, 0]}>
      <boxGeometry args={[piece.length + 0.1, 0.45, ROAD_W * 1.25]} /><meshBasicMaterial color="#fbbf24" transparent opacity={0.65} depthWrite={false} />
    </mesh>)}
    {snap.closedSegments.map((key) => {
      const [ix, iz, axis] = key.split(",").map(Number);
      const { x, z, yaw } = roadMidpoint({ ix, iz, axis });
      return <group key={key} position={[x, roadHeightAt(x, z) + 1.4, z]} rotation={[0, yaw, 0]}>
        <mesh><boxGeometry args={[0.85, 2.5, ROAD_W + 1]} /><meshBasicMaterial color="#ff5c60" /></mesh>
        <mesh position={[0, 3, 0]} rotation={[0, 0, Math.PI / 4]}><boxGeometry args={[4.4, 0.65, 0.65]} /><meshBasicMaterial color="#ff5c60" /></mesh>
        <mesh position={[0, 3, 0]} rotation={[0, 0, -Math.PI / 4]}><boxGeometry args={[4.4, 0.65, 0.65]} /><meshBasicMaterial color="#ff5c60" /></mesh>
      </group>;
    })}
  </group>;
}

function XRControllers({ targets }) {
  const { gl, scene } = useThree();
  const controllers = useRef([]);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const rotation = useMemo(() => new THREE.Matrix4(), []);
  const hits = (controller) => {
    rotation.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rotation);
    raycaster.near = 0; raycaster.far = 5;
    return raycaster.intersectObjects(targets.current.filter(Boolean), true);
  };
  useEffect(() => {
    const records = [0, 1].map((index) => {
      const controller = gl.xr.getController(index);
      const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]);
      const material = new THREE.LineBasicMaterial({ color: index ? "#fbbf24" : "#67e8f9", depthTest: false });
      const line = new THREE.Line(geometry, material); line.scale.z = 3;
      controller.add(line); scene.add(controller);
      const select = () => {
        const hit = hits(controller)[0];
        if (!hit) return;
        let at = hit.object;
        while (at && !at.userData.xrAction) at = at.parent;
        at?.userData.xrAction?.(hit);
      };
      controller.addEventListener("selectstart", select);
      return { controller, line, geometry, material, select };
    });
    controllers.current = records;
    return () => records.forEach(({ controller, line, geometry, material, select }) => {
      controller.removeEventListener("selectstart", select); controller.remove(line); scene.remove(controller);
      geometry.dispose(); material.dispose();
    });
  }, [gl, scene]);
  useFrame(() => {
    if (!gl.xr.isPresenting) return;
    controllers.current.forEach(({ controller, line }) => {
      const hit = controller.visible ? hits(controller)[0] : null;
      line.scale.z = hit ? hit.distance : 3;
      line.material.color.set(hit ? "#34d399" : "#67e8f9");
    });
  });
  return null;
}

function World({ engine, snap, active, onReady, onXRChange }) {
  const { gl, camera, controls } = useThree();
  const [immersive, setImmersive] = useState(false);
  const roadsRef = useRef(), incidentRef = useRef(), panelRef = useRef(), targets = useRef([]);
  const savedCamera = useRef(null);
  const sim = engine.sim;
  const lighting = useMemo(() => compute24HourLighting(snap.mission.hour), [snap.mission.hour]);
  useEffect(() => {
    const start = () => {
      savedCamera.current = { position: camera.position.clone(), quaternion: camera.quaternion.clone(), near: camera.near, far: camera.far };
      camera.position.set(0, 0, 0); camera.quaternion.identity(); camera.near = 0.01; camera.far = 20;
      camera.updateProjectionMatrix(); setImmersive(true); onXRChange(true);
    };
    const end = () => {
      const saved = savedCamera.current;
      if (saved) { camera.position.copy(saved.position); camera.quaternion.copy(saved.quaternion); camera.near = saved.near; camera.far = saved.far; }
      camera.updateProjectionMatrix(); controls?.target.set(0, 0, 0); controls?.update();
      setImmersive(false); onXRChange(false);
    };
    gl.xr.addEventListener("sessionstart", start); gl.xr.addEventListener("sessionend", end);
    gl.xr.setReferenceSpaceType("local-floor");
    onReady(gl);
    return () => {
      gl.xr.removeEventListener("sessionstart", start); gl.xr.removeEventListener("sessionend", end);
      gl.xr.getSession()?.end().catch(() => {}); onReady(null);
    };
  }, [gl, camera, controls, onReady, onXRChange]);
  useFrame((_, delta) => {
    if (active) engine.advance(delta);
    targets.current = [roadsRef.current, incidentRef.current, panelRef.current];
  }, -1);
  return <>
    <color attach="background" args={[immersive ? "#07131e" : lighting.bg]} />
    {!immersive && <fog attach="fog" args={[lighting.fog, 550, 1600]} />}
    <ambientLight intensity={0.75} /><hemisphereLight args={["#bae6fd", "#1e293b", 0.8]} />
    <directionalLight position={[200, 300, 120]} intensity={2.4} color={lighting.sunColor} />
    <group scale={immersive ? 0.0032 : 1} position={immersive ? [0, 0.85, -1.35] : [0, 0, 0]}>
      <CityStatic sim={sim} dayFactor={lighting.dayFactor} lighting={lighting} showHazards={false} showTrafficFilter lightScale={immersive ? 0.0032 : 1} />
      <Corridor sim={sim} routeVersion={sim.routeVersion} />
      <TrafficLights sim={sim} /><Vehicles sim={sim} /><Ambulance sim={sim} lightScale={immersive ? 0.0032 : 1} /><ForcedSignals sim={sim} />
      <SelectionLayer engine={engine} snap={snap} roadsRef={roadsRef} incidentRef={incidentRef} />
    </group>
    {immersive && <>
      <mesh position={[0, 0.81, -1.35]}><boxGeometry args={[1.86, 0.05, 1.86]} /><meshStandardMaterial color="#183644" /></mesh>
      <mesh position={[0, 0.39, -1.35]}><boxGeometry args={[0.8, 0.78, 0.8]} /><meshStandardMaterial color="#102431" /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, -1]}><planeGeometry args={[16, 16]} /><meshStandardMaterial color="#0b1d2a" /></mesh>
      <SpatialPanel engine={engine} snap={snap} panelRef={panelRef} onExit={() => gl.xr.getSession()?.end()} />
    </>}
    <XRControllers targets={targets} />
    <OrbitControls makeDefault enabled={!immersive} enableDamping dampingFactor={0.16} target={[0, 0, 0]}
      minDistance={65} maxDistance={1200} maxPolarAngle={1.38} />
  </>;
}

export default function TrainingScene(props) {
  return <Canvas frameloop={props.active ? "always" : "never"} dpr={[1, 1.25]}
    camera={{ position: [220, 490, 300], fov: 47, near: 0.8, far: 2400 }}
    gl={{ antialias: true, powerPreference: "high-performance" }}>
    <World {...props} />
  </Canvas>;
}
