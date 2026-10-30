import { useEffect, useRef, useState, useCallback } from "react";
import { Radar, X, Maximize2, Minimize2, Layers, Siren } from "lucide-react";
import {
  HALF, ROAD_W, HOSPITAL, DISPATCH_BASES, riverBankX, ROAD_NODE_COUNT,
  ROAD_SEGMENTS, ROAD_DISTRICTS, nodePosition, routePolyline,
} from "../../lib/cityGrid";

const SIZE = 340;
const PAD = 18;
const MAP_SCALE = (SIZE - PAD * 2) / (HALF * 2);
const mapPoint = ({ x, z }) => [PAD + (x + HALF) * MAP_SCALE, PAD + (z + HALF) * MAP_SCALE];
const COLORS = { green: "#34d399", yellow: "#facc15", red: "#fb7185" };
const trace = (context, points) => points.forEach(([x, y], i) => {
  if (i === 0) context.moveTo(x, y); else context.lineTo(x, y);
});

// Keep the current edge's curve when removing the part already travelled.
function trimEdge(points, distance) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    if (distance <= length) {
      const t = length ? Math.max(0, distance / length) : 0;
      return [{ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, ...points.slice(i)];
    }
    distance -= length;
  }
  return points.slice(-1);
}

export default function Minimap2D({ sim, snap, onClose }) {
  const canvasRef = useRef(null);
  const [filterActive, setFilterActive] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const [pos, setPos] = useState({ x: 380, y: 70 });
  const [dragging, setDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const onMouseDown = useCallback((e) => {
    if (e.target.closest("button")) return;
    setDragging(true);
    dragOffsetRef.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  }, [pos]);

  useEffect(() => {
    const clamp = (next) => ({
      x: Math.max(10, Math.min(Math.max(10, window.innerWidth - 374), next.x)),
      y: Math.max(10, Math.min(Math.max(10, window.innerHeight - 100), next.y)),
    });
    const onMouseMove = (e) => {
      if (dragging) setPos(clamp({ x: e.clientX - dragOffsetRef.current.x, y: e.clientY - dragOffsetRef.current.y }));
    };
    const onMouseUp = () => setDragging(false);
    const onResize = () => setPos((previous) => clamp(previous));
    onResize();
    window.addEventListener("resize", onResize);
    if (dragging) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    }
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragging]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || minimized) return;
    const ctx = canvas.getContext("2d");
    let animId;
    let pixelSize = 0;
    const resize = () => {
      // CSS and backing-store dimensions stay square, including on narrow screens.
      const nextSize = Math.max(1, Math.round(canvas.getBoundingClientRect().width * (window.devicePixelRatio || 1)));
      if (nextSize === pixelSize) return;
      pixelSize = nextSize;
      canvas.width = nextSize;
      canvas.height = nextSize;
      ctx.setTransform(nextSize / SIZE, 0, 0, nextSize / SIZE, 0, 0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const background = document.createElement("canvas");
    background.width = background.height = SIZE * 2;
    const bg = background.getContext("2d");
    bg.scale(2, 2);
    bg.fillStyle = "#06121e";
    bg.fillRect(0, 0, SIZE, SIZE);
    bg.save();
    bg.beginPath(); bg.rect(PAD, PAD, SIZE - PAD * 2, SIZE - PAD * 2); bg.clip();
    // District islands use the same polygons as the 3D scene.
    for (const district of ROAD_DISTRICTS) {
      bg.beginPath(); trace(bg, district.island.map(mapPoint)); bg.closePath();
      bg.fillStyle = "#12372e"; bg.fill();
    }
    bg.beginPath();
    const leftBank = [], rightBank = [];
    for (let i = 0; i <= 120; i++) {
      const z = -HALF + i / 120 * HALF * 2;
      const { left, right } = riverBankX(z);
      leftBank.push(mapPoint({ x: left, z })); rightBank.push(mapPoint({ x: right, z }));
    }
    trace(bg, [...leftBank, ...rightBank.reverse()]); bg.closePath();
    bg.fillStyle = "#0c4057"; bg.fill();
    bg.strokeStyle = "#267186"; bg.lineWidth = 0.8; bg.stroke();

    const roads = ROAD_SEGMENTS.map((segment) => ({
      ...segment, key: `${segment.ix},${segment.iz},${segment.axis}`,
      mapPoints: segment.points.map(mapPoint),
    }));
    const roadOutline = new Path2D();
    for (const road of roads) trace(roadOutline, road.mapPoints);
    bg.strokeStyle = "#234352";
    bg.lineWidth = ROAD_W * MAP_SCALE + 1.5;
    bg.lineCap = "round"; bg.lineJoin = "round";
    bg.stroke(roadOutline);
    bg.restore();

    let trafficVersion = -1;
    let statusPaths = {};
    let routeVersion = -1;
    let routeEdges = [];
    const rebuildRoadColors = () => {
      statusPaths = { green: new Path2D(), yellow: new Path2D(), red: new Path2D() };
      for (const road of roads) trace(statusPaths[sim?.getRoadStatus(road.ix, road.iz, road.axis) || "green"], road.mapPoints);
      trafficVersion = sim?.trafficVersion;
    };

    const render = () => {
      resize();
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.drawImage(background, 0, 0, SIZE, SIZE);
      ctx.save();
      ctx.beginPath(); ctx.rect(PAD - 2, PAD - 2, SIZE - PAD * 2 + 4, SIZE - PAD * 2 + 4); ctx.clip();
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      // No view-specific timer: 2D and 3D show the same live traffic snapshot.
      if (trafficVersion !== sim?.trafficVersion || !statusPaths.green) rebuildRoadColors();
      ctx.lineWidth = Math.max(1.8, ROAD_W * MAP_SCALE);
      if (filterActive) {
        for (const status of ["green", "yellow", "red"]) {
          ctx.strokeStyle = COLORS[status]; ctx.stroke(statusPaths[status]);
        }
      } else {
        ctx.strokeStyle = "#7894a4"; ctx.stroke(roadOutline);
      }
      if (sim?.closedSegments?.size) {
        ctx.beginPath();
        for (const road of roads) if (sim.closedSegments.has(road.key)) trace(ctx, road.mapPoints);
        ctx.strokeStyle = "#ff4865"; ctx.lineWidth = 3; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
      }

      const amb = sim?.ambulance;
      const route = amb?.route || sim?.route || [];
      if (routeVersion !== sim?.routeVersion) {
        routeEdges = route.slice(1).map((node, i) => routePolyline([route[i], node]));
        routeVersion = sim?.routeVersion;
      }
      if (routeEdges.length) {
        const first = amb ? Math.min(amb.k, routeEdges.length - 1) : 0;
        const remaining = [
          ...(amb ? trimEdge(routeEdges[first], amb.t) : routeEdges[first]),
          ...routeEdges.slice(first + 1).flatMap((edge) => edge.slice(1)),
        ].map(mapPoint);
        if (!amb?.arrived) {
          ctx.beginPath(); trace(ctx, remaining);
          ctx.strokeStyle = "#071826"; ctx.lineWidth = 5.7; ctx.stroke();
          ctx.strokeStyle = "#72d8ff"; ctx.lineWidth = 3.1; ctx.stroke();
        }
      }

      // Mark only junctions actually being pre-empted, rather than an assumed prefix.
      ctx.strokeStyle = "#c2ffe1"; ctx.lineWidth = 1.5;
      for (const node of sim?.forcedNodes || []) {
        const [x, y] = mapPoint(nodePosition(node.ix, node.iz));
        ctx.beginPath(); ctx.arc(x, y, 3.8, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = "rgba(226, 239, 247, 0.75)";
      for (const vehicle of sim?.vehicles || []) {
        if (vehicle.dying) continue;
        const [x, y] = mapPoint(vehicle);
        ctx.fillRect(x - 0.7, y - 0.7, 1.4, 1.4);
      }
      for (const base of DISPATCH_BASES) {
        const [x, y] = mapPoint(nodePosition(...base.node));
        ctx.fillStyle = "#fbbf24"; ctx.fillRect(x - 2.3, y - 2.3, 4.6, 4.6);
      }
      const [hx, hy] = mapPoint(nodePosition(...HOSPITAL.node));
      ctx.fillStyle = "#06251d"; ctx.fillRect(hx - 5, hy - 5, 10, 10);
      ctx.fillStyle = "#a7f3d0";
      ctx.fillRect(hx - 1.2, hy - 4, 2.4, 8); ctx.fillRect(hx - 4, hy - 1.2, 8, 2.4);
      if (amb) {
        const [x, y] = mapPoint(amb);
        ctx.save(); ctx.translate(x, y); ctx.rotate(-amb.heading);
        ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-4, -4.2); ctx.lineTo(-2.3, 0); ctx.lineTo(-4, 4.2); ctx.closePath();
        ctx.fillStyle = "#fb365b"; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.3; ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      ctx.strokeStyle = "#2d5366"; ctx.lineWidth = 1;
      ctx.strokeRect(PAD - 3, PAD - 3, SIZE - PAD * 2 + 6, SIZE - PAD * 2 + 6);
      ctx.fillStyle = "#94b7c9"; ctx.font = "9px monospace";
      ctx.fillText("N ↑", PAD, 11);
      ctx.textAlign = "right"; ctx.fillText("LIVE · 100 ms traffic", SIZE - PAD, 11); ctx.textAlign = "left";
      animId = requestAnimationFrame(render);
    };
    render();
    return () => { cancelAnimationFrame(animId); observer.disconnect(); };
  }, [filterActive, minimized, sim]);

  return (
    <div style={{ left: pos.x, top: pos.y }} className="fixed z-50 select-none shadow-[0_0_35px_rgba(2,6,23,0.85)]">
      <div className="w-[364px] max-w-[calc(100vw-20px)] overflow-hidden rounded-xl border border-cyan-500/50 bg-slate-950/95 backdrop-blur-md">
        <div onMouseDown={onMouseDown} className="flex cursor-move items-center justify-between border-b border-slate-800 bg-slate-900/90 px-3 py-2">
          <span className="flex items-center gap-1.5 font-display text-xs font-semibold tracking-wider text-slate-100"><Radar className="h-3.5 w-3.5 text-cyan-400" /> LIVE ROAD MAP</span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setMinimized(!minimized)} title={minimized ? "Expand" : "Minimize"} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200">
              {minimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
            </button>
            <button type="button" onClick={onClose} title="Close 2D Map" className="rounded p-1 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
        {!minimized && <div className="p-3">
          <div className="mb-2 flex items-center justify-between gap-2 font-mono text-[10px]">
            <button type="button" onClick={() => setFilterActive(!filterActive)} className={`flex items-center gap-1 rounded border px-2 py-1 ${filterActive ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300" : "border-slate-700 text-slate-400"}`}><Layers className="h-3 w-3" /> Traffic {filterActive ? "ON" : "OFF"}</button>
            <div className="flex gap-2 text-slate-400"><span className="text-emerald-300">● Free</span><span className="text-yellow-300">● Busy</span><span className="text-rose-400">● Queued</span></div>
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950"><canvas ref={canvasRef} aria-label="Live road map with traffic colors and the ambulance's remaining route" style={{ width: "100%", height: "auto", aspectRatio: "1", display: "block" }} /></div>
          <div className="mt-1.5 flex justify-between font-mono text-[9px] text-slate-400"><span className="text-sky-300">━ Remaining route</span><span className="text-emerald-200">○ Priority signal</span><span className="text-amber-300">■ Depot</span><span className="text-emerald-200">✚ Hospital</span></div>
          <div className="mt-2 rounded border border-slate-800 bg-slate-900/60 p-2 font-mono text-[10px]">
            <div className="flex items-center justify-between gap-2 text-slate-300"><span className="flex items-center gap-1.5"><Siren className="h-3.5 w-3.5 text-rose-400" />{snap.ambulance ? `AMB-07: ${snap.ambulance.kmh} km/h · ${snap.ambulance.status}` : "AMB-07 on standby"}</span><span className="text-emerald-300">{snap.stats.forced} priority signals</span></div>
            <div className="mt-1 flex justify-between text-[9px] text-slate-500"><span>{snap.formattedTime?.display || "08:30 AM"}</span><span>{snap.stats.count} vehicles · {ROAD_NODE_COUNT} junctions</span></div>
          </div>
        </div>}
      </div>
    </div>
  );
}
