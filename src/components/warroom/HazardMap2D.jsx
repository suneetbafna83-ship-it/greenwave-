import { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
  ZoomIn,
  ZoomOut,
  Maximize2,
  Hand,
  Crosshair,
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
import { drawMiddleFingerPark2D } from "../../lib/mapArt";

const SIZE = 960;
const PAD = 48;
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

export default function HazardMap2D({
  sim,
  snap,
  activeTool,
  setActiveTool,
  stagedActions = [],
  onStageAction,
}) {
  const canvasRef = useRef(null);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Compute effective state (live sim + staged draft edits)
  const effectiveClosures = useMemo(() => {
    const map = new Map(sim?.closures || []);
    for (const act of stagedActions) {
      if (act.type === "close") {
        map.set(act.key, { key: act.key, reason: act.reason, name: act.name, x: act.x, z: act.z, isStaged: true });
      } else if (act.type === "reopen") {
        map.delete(act.key);
      }
    }
    return map;
  }, [sim?.closures, stagedActions]);

  const effectivePotholes = useMemo(() => {
    const list = [...(sim?.potholes || [])];
    for (const act of stagedActions) {
      if (act.type === "add_pothole") {
        list.push({ id: act.id, x: act.x, z: act.z, radius: act.radius, isSlum: act.isSlum, isStaged: true });
      } else if (act.type === "repair_pothole") {
        if (act.potholeId) {
          const idx = list.findIndex((p) => p.id === act.potholeId);
          if (idx !== -1) list[idx] = { ...list[idx], active: false, isStagedRepaired: true };
        } else {
          // repair nearest
          let bestIdx = -1, bestDist = 14;
          for (let i = 0; i < list.length; i++) {
            if (list[i].active === false) continue;
            const d = Math.hypot(list[i].x - act.x, list[i].z - act.z);
            if (d < bestDist) { bestDist = d; bestIdx = i; }
          }
          if (bestIdx !== -1) {
            list[bestIdx] = { ...list[bestIdx], active: false, isStagedRepaired: true };
          }
        }
      }
    }
    return list;
  }, [sim?.potholes, stagedActions]);

  // Screen coordinate to World coordinate with Zoom & Pan inversion
  const screenToWorld = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, z: 0 };
    const rect = canvas.getBoundingClientRect();
    const scale = SIZE / rect.width;
    const px = (clientX - rect.left) * scale;
    const py = (clientY - rect.top) * scale;

    const unscaledX = (px - pan.x - SIZE / 2) / zoom + SIZE / 2;
    const unscaledY = (py - pan.y - SIZE / 2) / zoom + SIZE / 2;

    return worldPoint(unscaledX, unscaledY);
  }, [zoom, pan]);

  // Zoom handlers
  const handleZoomIn = () => setZoom((z) => Math.min(4.0, Number((z + 0.35).toFixed(2))));
  const handleZoomOut = () => setZoom((z) => {
    const next = Math.max(1.0, Number((z - 0.35).toFixed(2)));
    if (next === 1.0) setPan({ x: 0, y: 0 });
    return next;
  });
  const handleResetZoom = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    setZoom((prev) => {
      const next = Math.max(1.0, Math.min(4.0, Number((prev + delta).toFixed(2))));
      if (next === 1.0) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleMouseDown = (e) => {
    if (activeTool === "pan" || e.button === 1 || e.button === 2 || e.shiftKey) {
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleCanvasClick = (e) => {
    if (isDragging || activeTool === "pan") return;
    const { x, z } = screenToWorld(e.clientX, e.clientY);
    if (Math.abs(x) > HALF || Math.abs(z) > HALF) return;

    if (activeTool === "construction" || activeTool === "water_logging") {
      const seg = nearestRoadSegment(x, z);
      if (seg) {
        const key = `${seg.ix},${seg.iz},${seg.axis}`;
        const name = roadSegmentName(seg.ix, seg.iz, seg.axis);
        const isCurrentlyClosed = effectiveClosures.has(key);
        if (isCurrentlyClosed) {
          onStageAction?.({
            id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            type: "reopen",
            key,
            name,
            x,
            z,
          });
        } else {
          onStageAction?.({
            id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            type: "close",
            reason: activeTool,
            key,
            name,
            x,
            z,
          });
        }
      }
    } else if (activeTool === "pothole") {
      onStageAction?.({
        id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        type: "add_pothole",
        x,
        z,
        radius: 0.7 + Math.random() * 0.5,
        isSlum: Math.abs(x) > 150 || Math.abs(z) > 150,
      });
    } else if (activeTool === "repair") {
      // Check nearest active pothole within 14 units
      let nearestP = null, minDist = 14;
      for (const p of effectivePotholes) {
        if (p.active === false) continue;
        const d = Math.hypot(p.x - x, p.z - z);
        if (d < minDist) { minDist = d; nearestP = p; }
      }
      if (nearestP) {
        onStageAction?.({
          id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          type: "repair_pothole",
          potholeId: nearestP.id,
          x: nearestP.x,
          z: nearestP.z,
        });
      } else {
        // If no pothole, check if there's a closed road nearby to reopen
        const seg = nearestRoadSegment(x, z);
        if (seg) {
          const key = `${seg.ix},${seg.iz},${seg.axis}`;
          if (effectiveClosures.has(key)) {
            onStageAction?.({
              id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
              type: "reopen",
              key,
              name: roadSegmentName(seg.ix, seg.iz, seg.axis),
              x,
              z,
            });
          }
        }
      }
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      const rect = canvasRef.current.getBoundingClientRect();
      const scale = SIZE / rect.width;
      const dx = (e.clientX - dragStart.current.x) * scale;
      const dy = (e.clientY - dragStart.current.y) * scale;
      const maxPan = (SIZE * (zoom - 1)) / 1.7 + 120;
      setPan({
        x: Math.max(-maxPan, Math.min(maxPan, dragStart.current.panX + dx)),
        y: Math.max(-maxPan, Math.min(maxPan, dragStart.current.panY + dy)),
      });
      return;
    }

    const { x, z } = screenToWorld(e.clientX, e.clientY);
    if (Math.abs(x) > HALF + 10 || Math.abs(z) > HALF + 10) {
      setHoverInfo(null);
      return;
    }

    const seg = nearestRoadSegment(x, z);
    if (!seg) {
      setHoverInfo(null);
      return;
    }
    const key = `${seg.ix},${seg.iz},${seg.axis}`;
    const name = roadSegmentName(seg.ix, seg.iz, seg.axis);
    const closureData = effectiveClosures.get(key);
    const isClosed = !!closureData;

    let nearestPotholeDist = Infinity;
    for (const p of effectivePotholes) {
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
      isStaged: closureData?.isStaged,
      reason: closureData?.reason || (isClosed ? "construction" : null),
      hasNearbyPothole: nearestPotholeDist <= 6,
    });
  };

  // High-DPI Canvas Rendering Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;

    const render = () => {
      ctx.clearRect(0, 0, SIZE, SIZE);

      // Blueprint deep background
      ctx.fillStyle = "#070e1a";
      ctx.fillRect(0, 0, SIZE, SIZE);

      // Grid background lines
      ctx.strokeStyle = "rgba(30, 58, 95, 0.28)";
      ctx.lineWidth = 1;
      for (let i = PAD; i <= SIZE - PAD; i += 48) {
        ctx.beginPath(); ctx.moveTo(i, PAD); ctx.lineTo(i, SIZE - PAD); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(PAD, i); ctx.lineTo(SIZE - PAD, i); ctx.stroke();
      }

      ctx.save();
      // Apply Camera Zoom & Pan Viewport Transform
      ctx.translate(SIZE / 2 + pan.x, SIZE / 2 + pan.y);
      ctx.scale(zoom, zoom);
      ctx.translate(-SIZE / 2, -SIZE / 2);

      // Clip to Map Bounds
      ctx.beginPath();
      ctx.rect(PAD - 4, PAD - 4, SIZE - PAD * 2 + 8, SIZE - PAD * 2 + 8);
      ctx.clip();

      // Draw District Islands
      for (const district of ROAD_DISTRICTS) {
        ctx.beginPath();
        trace(ctx, district.island.map(mapPoint));
        ctx.closePath();
        ctx.fillStyle = district.id === "civic-circle" ? "#0f2e2b" : "#0e2033";
        ctx.fill();
        ctx.strokeStyle = district.id === "civic-circle" ? "#10b981" : "#1b3854";
        ctx.lineWidth = district.id === "civic-circle" ? 2.0 : 1.2;
        ctx.stroke();

        // If civic circle, draw Landmark Middle Finger Park matching reference art
        if (district.id === "civic-circle") {
          drawMiddleFingerPark2D(ctx, mapPoint);
        }
      }

      // Draw Meandering River Channel
      const leftBank = [], rightBank = [];
      for (let i = 0; i <= 120; i++) {
        const z = -HALF + (i / 120) * HALF * 2;
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
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Draw Base Road Network
      const roads = ROAD_SEGMENTS.map((segment) => ({
        ...segment,
        key: `${segment.ix},${segment.iz},${segment.axis}`,
        mapPoints: segment.points.map(mapPoint),
      }));

      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Asphalt base
      ctx.strokeStyle = "#163244";
      ctx.lineWidth = (ROAD_W * MAP_SCALE + 2.2);
      for (const road of roads) {
        ctx.beginPath();
        trace(ctx, road.mapPoints);
        ctx.stroke();
      }

      // Road Centerline
      ctx.strokeStyle = "#25536e";
      ctx.lineWidth = Math.max(2.0, ROAD_W * MAP_SCALE * 0.75);
      for (const road of roads) {
        ctx.beginPath();
        trace(ctx, road.mapPoints);
        ctx.stroke();
      }

      // ───────────────────── Active Closures (Live + Staged) ─────────────────────
      const now = performance.now();
      const wavePulse = (Math.sin(now * 0.005) + 1) * 0.5;

      for (const road of roads) {
        const closure = effectiveClosures.get(road.key);
        if (!closure) continue;
        const reason = closure.reason || "construction";
        const isStaged = closure.isStaged;

        ctx.beginPath();
        trace(ctx, road.mapPoints);

        if (reason === "construction") {
          // Yellow & Black diagonal caution hazard border
          ctx.strokeStyle = isStaged ? "#fde047" : "#f59e0b";
          ctx.lineWidth = ROAD_W * MAP_SCALE + 6;
          ctx.stroke();

          ctx.strokeStyle = "#18181b";
          ctx.lineWidth = ROAD_W * MAP_SCALE + 1.8;
          ctx.setLineDash([8, 8]);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          // Water Logging Cyan/Blue Flood Ripple
          ctx.strokeStyle = `rgba(6, 182, 212, ${0.45 + wavePulse * 0.45})`;
          ctx.lineWidth = ROAD_W * MAP_SCALE + 8;
          ctx.stroke();

          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = ROAD_W * MAP_SCALE + 2.2;
          ctx.setLineDash([12, 6]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Draw center badge icon
        if (road.mapPoints.length >= 2) {
          const mid = road.mapPoints[Math.floor(road.mapPoints.length / 2)];
          ctx.fillStyle = reason === "construction" ? "#d97706" : "#0284c7";
          ctx.beginPath();
          ctx.arc(mid[0], mid[1], isStaged ? 7 : 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = isStaged ? "#fef08a" : "#ffffff";
          ctx.lineWidth = isStaged ? 2 : 1.2;
          ctx.stroke();

          if (isStaged) {
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 9px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("DRAFT", mid[0], mid[1] - 12);
          }
        }
      }

      // ───────────────────── Road Potholes ─────────────────────
      for (const p of effectivePotholes) {
        if (p.active === false && !p.isStagedRepaired) continue;
        const [px, py] = mapPoint(p);

        if (p.isStagedRepaired) {
          // Green repair cross preview
          ctx.strokeStyle = "#34d399";
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.moveTo(px - 4, py - 4); ctx.lineTo(px + 4, py + 4);
          ctx.moveTo(px + 4, py - 4); ctx.lineTo(px - 4, py + 4);
          ctx.stroke();
        } else {
          // Outer Danger Ring
          ctx.strokeStyle = p.isStaged
            ? "#facc15"
            : p.isSlum ? "rgba(239, 68, 68, 0.9)" : "rgba(249, 115, 22, 0.85)";
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.arc(px, py, 4.5, 0, Math.PI * 2);
          ctx.stroke();

          // Dark Crater Core
          ctx.fillStyle = "#09090b";
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw Hospital Permanent Base Icon
      const [hx, hy] = mapPoint(nodePosition(...HOSPITAL.node));
      ctx.fillStyle = "#064e3b";
      ctx.fillRect(hx - 8, hy - 8, 16, 16);
      ctx.fillStyle = "#34d399";
      ctx.fillRect(hx - 2, hy - 6.5, 4, 13);
      ctx.fillRect(hx - 6.5, hy - 2, 13, 4);

      ctx.restore();

      // Outer Blueprint Frame
      ctx.strokeStyle = "#1e3a5f";
      ctx.lineWidth = 2;
      ctx.strokeRect(PAD - 4, PAD - 4, SIZE - PAD * 2 + 8, SIZE - PAD * 2 + 8);

      // Corner Brackets
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2.5;
      const bLen = 16;
      ctx.beginPath(); ctx.moveTo(PAD - 4, PAD - 4 + bLen); ctx.lineTo(PAD - 4, PAD - 4); ctx.lineTo(PAD - 4 + bLen, PAD - 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(SIZE - PAD + 4 - bLen, PAD - 4); ctx.lineTo(SIZE - PAD + 4, PAD - 4); ctx.lineTo(SIZE - PAD + 4, PAD - 4 + bLen); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(PAD - 4, SIZE - PAD + 4 - bLen); ctx.lineTo(PAD - 4, SIZE - PAD + 4); ctx.lineTo(PAD - 4 + bLen, SIZE - PAD + 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(SIZE - PAD + 4 - bLen, SIZE - PAD + 4); ctx.lineTo(SIZE - PAD + 4, SIZE - PAD + 4); ctx.lineTo(SIZE - PAD + 4, SIZE - PAD + 4 - bLen); ctx.stroke();

      // Top Header text
      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 13px monospace";
      ctx.fillText("TACTICAL CIVIL INFRASTRUCTURE 2D RADAR", PAD, 28);
      ctx.textAlign = "right";
      ctx.fillText(`ZOOM: ${(zoom * 100).toFixed(0)}% · 500m × 500m METROPOLIS`, SIZE - PAD, 28);
      ctx.textAlign = "left";

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [sim, effectiveClosures, effectivePotholes, zoom, pan]);

  return (
    <div className="flex flex-col gap-3">
      {/* Tool Selector Bar */}
      <div className="grid grid-cols-5 gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-1.5 backdrop-blur-xl">
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

        <button
          type="button"
          onClick={() => setActiveTool("pan")}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 px-2 text-xs font-semibold transition ${
            activeTool === "pan"
              ? "bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
          }`}
        >
          <Hand className="h-3.5 w-3.5 text-sky-400 shrink-0" />
          <span className="truncate">🖐️ Pan Map</span>
        </button>
      </div>

      {/* 2D Canvas Container with Zoom & Pan Floating Controls */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#070e1a] shadow-2xl">
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            setIsDragging(false);
            setHoverInfo(null);
          }}
          onClick={handleCanvasClick}
          className={`w-full h-auto aspect-square block ${
            activeTool === "pan" || isDragging ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair"
          }`}
          title="Click to place or repair · Scroll wheel to zoom · Drag to pan"
        />

        {/* Floating Zoom & Pan HUD Buttons */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-950/80 p-1 backdrop-blur-xl shadow-lg">
          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom In (+)"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <span className="font-mono text-[10px] text-slate-400 px-1 font-semibold">
            {(zoom * 100).toFixed(0)}%
          </span>
          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom Out (-)"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            title="Reset Zoom & Center View"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition border-l border-white/10 pl-1"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Live Hover Inspection Badge */}
        {hoverInfo && (
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-xs shadow-lg backdrop-blur-xl">
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
                {hoverInfo.isClosed
                  ? `BLOCKED (${hoverInfo.reason})${hoverInfo.isStaged ? " [STAGED]" : ""}`
                  : "OPEN"}
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
          Click to draft updates · Wheel to zoom · Drag to pan · Press Confirm to apply.
        </span>
        <span className="font-mono text-slate-400">
          Selected: <strong className="text-white capitalize">{activeTool.replace("_", " ")}</strong>
        </span>
      </div>
    </div>
  );
}
