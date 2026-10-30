import { useEffect, useRef, useState, useCallback } from "react";
import {
  Construction,
  Waves,
  CircleDot,
  Wrench,
  RotateCcw,
  AlertTriangle,
  MapPin,
  Check,
  Layers,
  Sparkles,
} from "lucide-react";
import {
  HALF,
  ROAD_W,
  HOSPITAL,
  riverBankX,
  ROAD_SEGMENTS,
  ROAD_DISTRICTS,
  nodePosition,
  nearestRoadSegment,
  roadSegmentName,
  roadKey,
} from "../../lib/cityGrid";

const SIZE = 480;
const PAD = 24;
const MAP_SCALE = (SIZE - PAD * 2) / (HALF * 2);
const mapPoint = ({ x, z }) => [PAD + (x + HALF) * MAP_SCALE, PAD + (z + HALF) * MAP_SCALE];
const worldPoint = (px, py) => ({
  x: (px - PAD) / MAP_SCALE - HALF,
  z: (py - PAD) / MAP_SCALE - HALF,
});

const trace = (context, points) => {
  points.forEach(([x, y], i) => {
    if (i === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
};

export default function HazardMap2D({ sim, snap, activeTool, setActiveTool }) {
  const canvasRef = useRef(null);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [lastActionTime, setLastActionTime] = useState(0);

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !sim) return;
    const rect = canvas.getBoundingClientRect();
    const scale = SIZE / rect.width;
    const px = (e.clientX - rect.left) * scale;
    const py = (e.clientY - rect.top) * scale;

    if (px < PAD || px > SIZE - PAD || py < PAD || py > SIZE - PAD) return;
    const { x, z } = worldPoint(px, py);

    if (activeTool === "construction" || activeTool === "water_logging") {
      const seg = nearestRoadSegment(x, z);
      if (seg) {
        const key = `${seg.ix},${seg.iz},${seg.axis}`;
        const name = roadSegmentName(seg.ix, seg.iz, seg.axis);
        sim.toggleRoadClosure(key, activeTool, name, x, z);
        setLastActionTime(Date.now());
      }
    } else if (activeTool === "pothole") {
      sim.addPothole(x, z, 0.7 + Math.random() * 0.5, Math.abs(x) > 150 || Math.abs(z) > 150);
      setLastActionTime(Date.now());
    } else if (activeTool === "repair") {
      // Check if nearest is a pothole within 12 units
      const repaired = sim.repairNearestPothole(x, z, 12);
      if (!repaired) {
        // If no pothole, check if there's a closed road nearby to reopen
        const seg = nearestRoadSegment(x, z);
        if (seg) {
          const key = `${seg.ix},${seg.iz},${seg.axis}`;
          if (sim.closedSegments?.has(key)) {
            sim.openRoad(key);
            setLastActionTime(Date.now());
          }
        }
      } else {
        setLastActionTime(Date.now());
      }
    }
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = SIZE / rect.width;
    const px = (e.clientX - rect.left) * scale;
    const py = (e.clientY - rect.top) * scale;

    if (px < PAD || px > SIZE - PAD || py < PAD || py > SIZE - PAD) {
      setHoverInfo(null);
      return;
    }
    const { x, z } = worldPoint(px, py);
    const seg = nearestRoadSegment(x, z);
    if (!seg) {
      setHoverInfo(null);
      return;
    }
    const key = `${seg.ix},${seg.iz},${seg.axis}`;
    const name = roadSegmentName(seg.ix, seg.iz, seg.axis);
    const isClosed = sim?.closedSegments?.has(key);
    const closureData = sim?.closures?.get(key);

    // Check nearest pothole distance
    let nearestPotholeDist = Infinity;
    for (const p of sim?.potholes || []) {
      if (p.active === false) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < nearestPotholeDist) nearestPotholeDist = d;
    }

    setHoverInfo({
      name,
      key,
      x: Math.round(x),
      z: Math.round(z),
      isClosed,
      reason: closureData?.reason || (isClosed ? "construction" : null),
      hasNearbyPothole: nearestPotholeDist <= 6,
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;

    const render = () => {
      ctx.clearRect(0, 0, SIZE, SIZE);

      // Blueprint tactical background
      ctx.fillStyle = "#070e1a";
      ctx.fillRect(0, 0, SIZE, SIZE);

      // Grid coordinate lines (Blueprint style)
      ctx.strokeStyle = "rgba(30, 58, 95, 0.35)";
      ctx.lineWidth = 0.5;
      for (let i = PAD; i <= SIZE - PAD; i += 28) {
        ctx.beginPath(); ctx.moveTo(i, PAD); ctx.lineTo(i, SIZE - PAD); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(PAD, i); ctx.lineTo(SIZE - PAD, i); ctx.stroke();
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(PAD - 2, PAD - 2, SIZE - PAD * 2 + 4, SIZE - PAD * 2 + 4);
      ctx.clip();

      // Draw District islands
      for (const district of ROAD_DISTRICTS) {
        ctx.beginPath();
        trace(ctx, district.island.map(mapPoint));
        ctx.closePath();
        ctx.fillStyle = "#0e2033";
        ctx.fill();
        ctx.strokeStyle = "#1b3854";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      // Draw Meandering River channel
      const leftBank = [], rightBank = [];
      for (let i = 0; i <= 100; i++) {
        const z = -HALF + (i / 100) * HALF * 2;
        const { left, right } = riverBankX(z);
        leftBank.push(mapPoint({ x: left, z }));
        rightBank.push(mapPoint({ x: right, z }));
      }
      ctx.beginPath();
      trace(ctx, [...leftBank, ...rightBank.reverse()]);
      ctx.closePath();
      ctx.fillStyle = "#082a3d";
      ctx.fill();
      ctx.strokeStyle = "#125a7a";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw Base Road Network
      const roads = ROAD_SEGMENTS.map((segment) => ({
        ...segment,
        key: `${segment.ix},${segment.iz},${segment.axis}`,
        mapPoints: segment.points.map(mapPoint),
      }));

      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Normal open roads
      ctx.strokeStyle = "#1a3a4f";
      ctx.lineWidth = ROAD_W * MAP_SCALE + 1.2;
      for (const road of roads) {
        ctx.beginPath();
        trace(ctx, road.mapPoints);
        ctx.stroke();
      }

      ctx.strokeStyle = "#25536e";
      ctx.lineWidth = Math.max(1.4, ROAD_W * MAP_SCALE * 0.7);
      for (const road of roads) {
        ctx.beginPath();
        trace(ctx, road.mapPoints);
        ctx.stroke();
      }

      // ───────────────────── Active Road Blockages ─────────────────────
      const now = performance.now();
      const wavePulse = (Math.sin(now * 0.005) + 1) * 0.5;

      for (const road of roads) {
        const isClosed = sim?.closedSegments?.has(road.key);
        if (!isClosed) continue;
        const closure = sim?.closures?.get(road.key);
        const reason = closure?.reason || "construction";

        ctx.beginPath();
        trace(ctx, road.mapPoints);

        if (reason === "construction") {
          // Yellow & Black diagonal caution hazard border
          ctx.strokeStyle = "#f59e0b";
          ctx.lineWidth = ROAD_W * MAP_SCALE + 4;
          ctx.stroke();

          ctx.strokeStyle = "#18181b";
          ctx.lineWidth = ROAD_W * MAP_SCALE + 1;
          ctx.setLineDash([5, 5]);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          // Water Logging Cyan/Blue Flood ripple
          ctx.strokeStyle = `rgba(6, 182, 212, ${0.4 + wavePulse * 0.45})`;
          ctx.lineWidth = ROAD_W * MAP_SCALE + 6;
          ctx.stroke();

          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = ROAD_W * MAP_SCALE + 1.5;
          ctx.setLineDash([8, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Draw center icon badge on blocked segment
        if (road.mapPoints.length >= 2) {
          const mid = road.mapPoints[Math.floor(road.mapPoints.length / 2)];
          ctx.fillStyle = reason === "construction" ? "#d97706" : "#0284c7";
          ctx.beginPath();
          ctx.arc(mid[0], mid[1], 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // ───────────────────── Road Potholes ─────────────────────
      const potholes = sim?.potholes || [];
      for (const p of potholes) {
        if (p.active === false) continue;
        const [px, py] = mapPoint(p);

        // Outer danger ring
        ctx.strokeStyle = p.isSlum ? "rgba(239, 68, 68, 0.85)" : "rgba(249, 115, 22, 0.8)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.stroke();

        // Dark crater center
        ctx.fillStyle = "#09090b";
        ctx.beginPath();
        ctx.arc(px, py, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw Hospital Reference Marker
      const [hx, hy] = mapPoint(nodePosition(...HOSPITAL.node));
      ctx.fillStyle = "#064e3b";
      ctx.fillRect(hx - 5, hy - 5, 10, 10);
      ctx.fillStyle = "#34d399";
      ctx.fillRect(hx - 1.2, hy - 4, 2.4, 8);
      ctx.fillRect(hx - 4, hy - 1.2, 8, 2.4);

      ctx.restore();

      // Outer Frame
      ctx.strokeStyle = "#1e3a5f";
      ctx.lineWidth = 1.2;
      ctx.strokeRect(PAD - 3, PAD - 3, SIZE - PAD * 2 + 6, SIZE - PAD * 2 + 6);

      // Blueprint corner brackets
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.8;
      const bLen = 10;
      // Top Left
      ctx.beginPath(); ctx.moveTo(PAD - 3, PAD - 3 + bLen); ctx.lineTo(PAD - 3, PAD - 3); ctx.lineTo(PAD - 3 + bLen, PAD - 3); ctx.stroke();
      // Top Right
      ctx.beginPath(); ctx.moveTo(SIZE - PAD + 3 - bLen, PAD - 3); ctx.lineTo(SIZE - PAD + 3, PAD - 3); ctx.lineTo(SIZE - PAD + 3, PAD - 3 + bLen); ctx.stroke();
      // Bottom Left
      ctx.beginPath(); ctx.moveTo(PAD - 3, SIZE - PAD + 3 - bLen); ctx.lineTo(PAD - 3, SIZE - PAD + 3); ctx.lineTo(PAD - 3 + bLen, SIZE - PAD + 3); ctx.stroke();
      // Bottom Right
      ctx.beginPath(); ctx.moveTo(SIZE - PAD + 3 - bLen, SIZE - PAD + 3); ctx.lineTo(SIZE - PAD + 3, SIZE - PAD + 3); ctx.lineTo(SIZE - PAD + 3, SIZE - PAD + 3 - bLen); ctx.stroke();

      // Legend in corners
      ctx.fillStyle = "#64748b";
      ctx.font = "9px monospace";
      ctx.fillText("INFRASTRUCTURE TACTICAL 2D MAP", PAD, 14);
      ctx.textAlign = "right";
      ctx.fillText("500m × 500m GRID", SIZE - PAD, 14);
      ctx.textAlign = "left";

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [sim, lastActionTime]);

  return (
    <div className="flex flex-col gap-3">
      {/* Tool Selector Bar */}
      <div className="grid grid-cols-4 gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-1.5 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => setActiveTool("construction")}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 px-2 text-xs font-semibold transition ${
            activeTool === "construction"
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
          }`}
        >
          <Construction className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span className="truncate">🚧 Construction</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTool("water_logging")}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 px-2 text-xs font-semibold transition ${
            activeTool === "water_logging"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
          }`}
        >
          <Waves className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
          <span className="truncate">🌊 Water Logging</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTool("pothole")}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 px-2 text-xs font-semibold transition ${
            activeTool === "pothole"
              ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
          }`}
        >
          <CircleDot className="h-3.5 w-3.5 text-rose-400 shrink-0" />
          <span className="truncate">🕳️ Add Pothole</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTool("repair")}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 px-2 text-xs font-semibold transition ${
            activeTool === "repair"
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
          }`}
        >
          <Wrench className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          <span className="truncate">🛠️ Repair / Reopen</span>
        </button>
      </div>

      {/* 2D Canvas Container */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#070e1a] shadow-2xl">
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverInfo(null)}
          className="w-full h-auto aspect-square block cursor-crosshair"
          title="Click to apply selected road action"
        />

        {/* Live Hover Inspection Badge */}
        {hoverInfo && (
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/85 px-3 py-2 text-xs shadow-lg backdrop-blur-xl">
            <div className="flex items-center gap-2 min-w-0">
              {hoverInfo.isClosed ? (
                hoverInfo.reason === "water_logging" ? (
                  <Waves className="h-4 w-4 text-cyan-400 shrink-0 animate-pulse" />
                ) : (
                  <Construction className="h-4 w-4 text-amber-400 shrink-0 animate-pulse" />
                )
              ) : hoverInfo.hasNearbyPothole ? (
                <CircleDot className="h-4 w-4 text-rose-400 shrink-0" />
              ) : (
                <Check className="h-4 w-4 text-emerald-400 shrink-0" />
              )}
              <span className="truncate font-medium text-white">{hoverInfo.name}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase tracking-wider ${
                  hoverInfo.isClosed
                    ? hoverInfo.reason === "water_logging"
                      ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300 font-semibold"
                      : "border-amber-500/40 bg-amber-500/10 text-amber-300 font-semibold"
                    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                }`}
              >
                {hoverInfo.isClosed ? `BLOCKED (${hoverInfo.reason})` : "OPEN"}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                [{hoverInfo.x}, {hoverInfo.z}]
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Guide Note */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-emerald-400 shrink-0" />
          Click anywhere on this map to drop barriers or potholes.
        </span>
        <span className="font-mono text-slate-500">
          Selected: <strong className="text-white capitalize">{activeTool.replace("_", " ")}</strong>
        </span>
      </div>
    </div>
  );
}