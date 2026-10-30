import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { HALF, ROAD_W, RIVER_SETBACK, WATER_LEVEL, RIVERBED_LEVEL,
  BRIDGE_ROWS, coord, riverBankX, riverTangent } from "../../lib/cityGrid";

const EXTENT = HALF + 30;
const STEPS = 360;
const underBridge = (z) => BRIDGE_ROWS.some((iz) => Math.abs(z - coord(iz)) < ROAD_W / 2 + 1.8);
const wallTop = (z) => underBridge(z) ? 0.25 : 1.5;

// Closed, curved solid strips: top, bottom, and both faces share the bank samples.
function bankSolid(side, inner, outer, top, bottom) {
  const positions = [], indices = [];
  for (let i = 0; i <= STEPS; i++) {
    const z = -EXTENT + (i / STEPS) * EXTENT * 2;
    const edge = riverBankX(z)[side < 0 ? "left" : "right"];
    const y = typeof top === "function" ? top(z) : top;
    positions.push(edge + side * inner, y, z, edge + side * outer, y, z,
      edge + side * inner, bottom, z, edge + side * outer, bottom, z);
    if (i < STEPS) {
      const a = i * 4, b = a + 4;
      for (const [p, q] of [[0, 1], [1, 3], [3, 2], [2, 0]]) {
        indices.push(a + p, b + p, a + q, a + q, b + p, b + q);
      }
    }
  }
  indices.push(0, 1, 2, 1, 3, 2);
  const end = STEPS * 4;
  indices.push(end, end + 2, end + 1, end + 1, end + 2, end + 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function waterSurface(level) {
  const positions = [], uvs = [], indices = [];
  for (let i = 0; i <= STEPS; i++) {
    const z = -EXTENT + (i / STEPS) * EXTENT * 2;
    const { left, right } = riverBankX(z);
    positions.push(left, level, z, right, level, z);
    uvs.push(0, z, 1, z);
    if (i < STEPS) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export default function RiverEnvironment({ dayFactor }) {
  const isDay = dayFactor > 0.35;
  const streaks = useRef();
  const posts = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const time = useMemo(() => ({ value: 0 }), []);
  const geometry = useMemo(() => ({
    water: waterSurface(WATER_LEVEL), bed: waterSurface(RIVERBED_LEVEL),
    banks: [-1, 1].map((side) => ({
      wall: bankSolid(side, 0, 1.4, wallTop, RIVERBED_LEVEL),
      cap: bankSolid(side, -0.12, 1.65, (z) => wallTop(z) + 0.16, 0),
      path: bankSolid(side, 1.65, 5.8, 0.14, -0.12),
      green: bankSolid(side, 5.8, RIVER_SETBACK, 0.08, -0.12),
    })),
  }), []);

  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: "#087e91",
      roughness: 0.68,
      metalness: 0.04,
      side: THREE.DoubleSide,
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uFlowTime = time;
      shader.vertexShader = `uniform float uFlowTime; varying vec2 vRiver;\n${shader.vertexShader}`
        .replace("#include <begin_vertex>", `#include <begin_vertex>
          vRiver = uv;
          transformed.y += sin(uv.y * 0.25 - uFlowTime * 1.2) * 0.035
            + sin(uv.x * 3.14) * 0.015;`);
      shader.fragmentShader = `uniform float uFlowTime; varying vec2 vRiver;\n${shader.fragmentShader}`
        .replace("#include <color_fragment>", `#include <color_fragment>
          float flow = vRiver.y * 0.4 - uFlowTime * 1.5;
          float gentleRipple = 0.5 + 0.5 * sin(flow + sin(vRiver.x * 4.0) * 0.8);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.08, 0.42, 0.52), gentleRipple * 0.15);`)
        .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
          normal = normalize(normal + vec3(sin(vRiver.x * 4.0 + uFlowTime * 0.8) * 0.03,
            0.0, cos(vRiver.y * 0.4 - uFlowTime * 1.5) * 0.03));`);
    };
    return mat;
  }, [time]);

  useEffect(() => {
    material.color.set(isDay ? "#087e91" : "#07516a");
    material.emissive.set(isDay ? "#063b46" : "#08748c");
    material.emissiveIntensity = isDay ? 0.12 : 0.3;
  }, [material, isDay]);
  useEffect(() => () => {
    geometry.water.dispose(); geometry.bed.dispose();
    geometry.banks.forEach((bank) => Object.values(bank).forEach((geo) => geo.dispose()));
    material.dispose();
  }, [geometry, material]);

  useLayoutEffect(() => {
    let index = 0;
    for (let z = -HALF; z <= HALF; z += 10) {
      for (const side of [-1, 1]) {
        const edge = riverBankX(z)[side < 0 ? "left" : "right"];
        dummy.position.set(edge + side * 1.8, underBridge(z) ? -5 : 0.75, z);
        dummy.rotation.set(0, Math.atan(riverTangent(z)), 0);
        dummy.scale.set(0.65, 1.5, 0.75);
        dummy.updateMatrix(); posts.current.setMatrixAt(index++, dummy.matrix);
      }
    }
    posts.current.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    time.value = t;
    for (let i = 0; i < 110; i++) {
      const z = -EXTENT + ((i * 19.37 + t * 3.2) % (EXTENT * 2));
      const { left, right } = riverBankX(z);
      const u = 0.08 + ((i * 0.6180339) % 1) * 0.84;
      dummy.position.set(THREE.MathUtils.lerp(left, right, u), WATER_LEVEL + 0.11, z);
      dummy.rotation.set(0, Math.atan(riverTangent(z)), 0);
      dummy.scale.set(0.06 + (i % 3) * 0.025, 0.025, 0.8 + (i % 5) * 0.45);
      dummy.updateMatrix(); streaks.current.setMatrixAt(i, dummy.matrix);
    }
    streaks.current.instanceMatrix.needsUpdate = true;
  });

  return <group name="Recessed river with flood protection">
    <mesh geometry={geometry.bed}><meshStandardMaterial color="#082f36" side={THREE.DoubleSide} /></mesh>
    <mesh geometry={geometry.water} material={material} />
    {geometry.banks.map((bank, i) => <group key={i}>
      <mesh geometry={bank.wall}><meshStandardMaterial color={isDay ? "#8c9ca4" : "#3a5364"} roughness={0.87} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={bank.cap}><meshStandardMaterial color={isDay ? "#c5cbd0" : "#688291"} roughness={0.7} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={bank.path}><meshStandardMaterial color={isDay ? "#64717b" : "#263d4b"} roughness={0.95} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={bank.green}><meshStandardMaterial color={isDay ? "#38634f" : "#153c32"} roughness={1} side={THREE.DoubleSide} /></mesh>
    </group>)}
    <instancedMesh ref={posts} args={[undefined, undefined, 102]}>
      <boxGeometry /><meshStandardMaterial color={isDay ? "#657a85" : "#344f61"} roughness={0.85} />
    </instancedMesh>
    <instancedMesh ref={streaks} args={[undefined, undefined, 110]} frustumCulled={false}>
      <boxGeometry /><meshBasicMaterial color="#a6ece8" transparent opacity={0.05} depthWrite={false} />
    </instancedMesh>
  </group>;
}
