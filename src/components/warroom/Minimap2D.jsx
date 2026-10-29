// 2D Tactical Radar Digital Twin Minimap
// Floating, draggable window tracking live ambulance position, 625 junctions,
// underdeveloped slum zone, and real-time road congestion statuses (Green / Yellow / Red).

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Radar,
  X,
  Maximize2,
  Minimize2,
  Layers,
  Crosshair,
  Siren,
  Hospital,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";
import {
  GRID,
  HALF,
  coord,
  HOSPITAL,
  DISPATCH_BASES,
  zoneOf,
  isSlumArea,
  segKey,
  riverCenter,
  RIVER_WIDTH,
  isBridgeSegment,
} from "../../lib/cityGrid";

export default function Minimap2D({ sim, snap, onClose }) {
  const canvasRef = useRef(null);
  const [filterActive, setFilterActive] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const [followAmbulance, setFollowAmbulance] = useState(false);

  // Dragging state
  const [pos, setPos] = useState({ x: 380, y: 70 });
  const [dragging, setDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const onMouseDown = useCallback(
    (e) => {
      // Don't drag if clicking buttons
      if (e.target.closest("button")) return;
      setDragging(true);
      dragOffsetRef.current = {
        x: e.clientX - pos.x,
        y: e.clientY - pos.y,
      };
    },
    [pos]
  );

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragging) return;
      const nextX = Math.max(10, Math.min(window.innerWidth - 380, e.clientX - dragOffsetRef.current.x));
      const nextY = Math.max(10, Math.min(window.innerHeight - 100, e.clientY - dragOffsetRef.current.y));
      setPos({ x: nextX, y: nextY });
    };
    const onMouseUp = () => setDragging(false);

    if (dragging) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragging]);

  // Canvas drawing loop with ultra-fast cached static layer & batched path strokes
  useEffect(() => {
    let animId;
    const canvas = canvasRef.current;
    if (!canvas || minimized) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const size = 340;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const pad = 24;
    const mapSpan = size - pad * 2;

    // Coordinate conversion (-HALF to +HALF -> pad to size-pad)
    const toCanvasX = (wx) => pad + ((wx + HALF) / (HALF * 2)) * mapSpan;
    const toCanvasY = (wz) => pad + ((wz + HALF) / (HALF * 2)) * mapSpan;

    // 1. Pre-render static background (grid glow, river, cyber citadel, slum districts, border) once!
    const staticCanvas = document.createElement("canvas");
    staticCanvas.width = size * dpr;
    staticCanvas.height = size * dpr;
    const sctx = staticCanvas.getContext("2d");
    sctx.scale(dpr, dpr);

    // Radar background & radial glow
    sctx.fillStyle = "#020617";
    sctx.fillRect(0, 0, size, size);
    const grad = sctx.createRadialGradient(size / 2, size / 2, 20, size / 2, size / 2, size / 1.4);
    grad.addColorStop(0, "rgba(8, 51, 68, 0.25)");
    grad.addColorStop(1, "rgba(2, 6, 23, 0.95)");
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, size, size);

    // Draw Meandering Zig-Zag River
    sctx.beginPath();
    const riverSteps = 40;
    const halfW = RIVER_WIDTH / 2;
    for (let s = 0; s <= riverSteps; s++) {
      const wz = -HALF + (s / riverSteps) * (HALF * 2);
      const wx = riverCenter(wz) - halfW;
      const cx = toCanvasX(wx);
      const cy = toCanvasY(wz);
      if (s === 0) sctx.moveTo(cx, cy);
      else sctx.lineTo(cx, cy);
    }
    for (let s = riverSteps; s >= 0; s--) {
      const wz = -HALF + (s / riverSteps) * (HALF * 2);
      const wx = riverCenter(wz) + halfW;
      const cx = toCanvasX(wx);
      const cy = toCanvasY(wz);
      sctx.lineTo(cx, cy);
    }
    sctx.closePath();
    sctx.fillStyle = "rgba(2, 132, 199, 0.4)";
    sctx.fill();
    sctx.strokeStyle = "rgba(56, 189, 248, 0.65)";
    sctx.lineWidth = 1.2;
    sctx.stroke();

    // Extreme Cyber Citadel highlight: North-West quadrant
    const cyberX1 = toCanvasX(coord(0));
    const cyberZ1 = toCanvasY(coord(0));
    const cyberX2 = toCanvasX(coord(9));
    const cyberZ2 = toCanvasY(coord(9));
    sctx.fillStyle = "rgba(14, 116, 144, 0.18)";
    sctx.fillRect(cyberX1, cyberZ1, cyberX2 - cyberX1, cyberZ2 - cyberZ1);
    sctx.fillStyle = "#38bdf8";
    sctx.font = "bold 9px monospace";
    sctx.fillText("🏢 CYBER CITADEL (PRISTINE)", cyberX1 + 4, cyberZ1 + 12);

    // Peripheral Slum Badlands
    sctx.fillStyle = "rgba(159, 18, 57, 0.22)";
    for (let bz = 0; bz < GRID - 1; bz++) {
      for (let bx = 0; bx < GRID - 1; bx++) {
        if (isSlumArea(bx, bz)) {
          const bx1 = toCanvasX(coord(bx));
          const bz1 = toCanvasY(coord(bz));
          const bx2 = toCanvasX(coord(bx + 1));
          const bz2 = toCanvasY(coord(bz + 1));
          sctx.fillRect(bx1, bz1, bx2 - bx1, bz2 - bz1);
        }
      }
    }
    sctx.fillStyle = "#f43f5e";
    sctx.font = "bold 8.5px monospace";
    sctx.fillText("🏚️ PERIPHERAL SLUMS", toCanvasX(120), toCanvasY(180));

    // Outer radar border
    sctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
    sctx.lineWidth = 1.5;
    sctx.strokeRect(pad, pad, mapSpan, mapSpan);

    // 2. Precompute road segment coordinates once
    const roadSegments = [];
    for (let iz = 0; iz < GRID; iz++) {
      for (let ix = 0; ix < GRID - 1; ix++) {
        roadSegments.push({
          ix,
          iz,
          axis: 0,
          x1: toCanvasX(coord(ix)),
          y1: toCanvasY(coord(iz)),
          x2: toCanvasX(coord(ix + 1)),
          y2: toCanvasY(coord(iz)),
        });
      }
    }
    for (let iz = 0; iz < GRID - 1; iz++) {
      for (let ix = 0; ix < GRID; ix++) {
        roadSegments.push({
          ix,
          iz,
          axis: 1,
          x1: toCanvasX(coord(ix)),
          y1: toCanvasY(coord(iz)),
          x2: toCanvasX(coord(ix)),
          y2: toCanvasY(coord(iz + 1)),
        });
      }
    }

    const roadStatusCache = new Array(roadSegments.length).fill("green");
    let lastStatusCheck = 0;

    const render = () => {
      // Blit static background in 1 call (replaces 900+ calculations)
      ctx.drawImage(staticCanvas, 0, 0, size, size);

      // Throttle road status calculation to 4.5 Hz (every 220ms) instead of 60 Hz
      const now = performance.now();
      if (filterActive && sim && now - lastStatusCheck > 220) {
        lastStatusCheck = now;
        for (let i = 0; i < roadSegments.length; i++) {
          const seg = roadSegments[i];
          roadStatusCache[i] = sim.getRoadStatus(seg.ix, seg.iz, seg.axis);
        }
      }

      // ───────────────────── Batched Road Segments ─────────────────────
      if (!filterActive) {
        ctx.beginPath();
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 1.2;
        for (let i = 0; i < roadSegments.length; i++) {
          const s = roadSegments[i];
          ctx.moveTo(s.x1, s.y1);
          ctx.lineTo(s.x2, s.y2);
        }
        ctx.stroke();
      } else {
        // Batch 1: Free Flowing (Green)
        ctx.beginPath();
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 1.4;
        for (let i = 0; i < roadSegments.length; i++) {
          if (roadStatusCache[i] === "green") {
            const s = roadSegments[i];
            ctx.moveTo(s.x1, s.y1);
            ctx.lineTo(s.x2, s.y2);
          }
        }
        ctx.stroke();

        // Batch 2: Busy / Moderately Congested (Yellow)
        ctx.beginPath();
        ctx.strokeStyle = "#facc15";
        ctx.lineWidth = 1.8;
        for (let i = 0; i < roadSegments.length; i++) {
          if (roadStatusCache[i] === "yellow") {
            const s = roadSegments[i];
            ctx.moveTo(s.x1, s.y1);
            ctx.lineTo(s.x2, s.y2);
          }
        }
        ctx.stroke();

        // Batch 3: Gridlocked / Pothole Craters (Red)
        ctx.beginPath();
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2.4;
        for (let i = 0; i < roadSegments.length; i++) {
          if (roadStatusCache[i] === "red") {
            const s = roadSegments[i];
            ctx.moveTo(s.x1, s.y1);
            ctx.lineTo(s.x2, s.y2);
          }
        }
        ctx.stroke();
      }

      // ───────────────────── Active Corridor Polyline ─────────────────────
      const amb = sim?.ambulance;
      const corridor = sim?.route || [];
      if (corridor.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 3.5;
        corridor.forEach(([ix, iz], idx) => {
          const cx = toCanvasX(coord(ix));
          const cy = toCanvasY(coord(iz));
          if (idx === 0) ctx.moveTo(cx, cy);
          else ctx.lineTo(cx, cy);
        });
        ctx.stroke();

        // Pulsing green glow line for pre-flushed zone
        if (amb && !amb.arrived) {
          ctx.beginPath();
          ctx.strokeStyle = "#5effc1";
          ctx.lineWidth = 2.2;
          const preEnd = Math.min(amb.k + 3, corridor.length - 1);
          for (let pi = amb.k; pi <= preEnd; pi++) {
            const [ix, iz] = corridor[pi];
            const cx = toCanvasX(coord(ix));
            const cy = toCanvasY(coord(iz));
            if (pi === amb.k) ctx.moveTo(cx, cy);
            else ctx.lineTo(cx, cy);
          }
          ctx.stroke();
        }
      }

      // ───────────────────── Hospital & Depots ─────────────────────
      // Hospital St. Aurora
      const hx = toCanvasX(coord(HOSPITAL.node[0]));
      const hy = toCanvasY(coord(HOSPITAL.node[1]));
      ctx.fillStyle = "#10b981";
      ctx.beginPath();
      ctx.arc(hx, hy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "#34d399";
      ctx.font = "bold 9px monospace";
      ctx.fillText("✚ HOSPITAL", hx + 7, hy + 3);

      // Dispatch bases
      DISPATCH_BASES.forEach((b) => {
        const bx = toCanvasX(coord(b.node[0]));
        const by = toCanvasY(coord(b.node[1]));
        ctx.fillStyle = "#f59e0b";
        ctx.beginPath();
        ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // ───────────────────── Live Vehicles & Ambulance ─────────────────────
      if (sim?.vehicles) {
        ctx.fillStyle = "rgba(148, 163, 184, 0.75)";
        sim.vehicles.forEach((v) => {
          if (v.dying) return;
          const vx = toCanvasX(v.x);
          const vy = toCanvasY(v.z);
          ctx.fillRect(vx - 1, vy - 1, 2, 2);
        });
      }

      // AMB-07 Emergency Unit
      if (amb) {
        const ax = toCanvasX(amb.x);
        const ay = toCanvasY(amb.z);

        // Ping wave
        const now = performance.now() / 1000;
        const waveR = 6 + (now % 1.2) * 10;
        ctx.beginPath();
        ctx.arc(ax, ay, waveR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(244, 63, 94, ${Math.max(0, 0.8 - (now % 1.2))})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Ambulance Core Dot
        ctx.fillStyle = "#ff2d55";
        ctx.beginPath();
        ctx.arc(ax, ay, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Heading arrow
        const hlen = 10;
        const hx = ax + Math.cos(amb.heading) * hlen;
        const hy = ay - Math.sin(amb.heading) * hlen;
        ctx.beginPath();
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 2.5;
        ctx.moveTo(ax, ay);
        ctx.lineTo(hx, hy);
        ctx.stroke();

        // Label
        ctx.fillStyle = "#ff2d55";
        ctx.font = "bold 9.5px monospace";
        ctx.fillText(`AMB-07 (${Math.round(amb.speed * 5.5)} km/h)`, ax + 8, ay - 4);
      }

      // Outer radar border
      ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(pad, pad, mapSpan, mapSpan);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [filterActive, minimized, sim]);

  return (
    <div
      style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
      className="fixed z-50 select-none shadow-[0_0_35px_rgba(2,6,23,0.85)]"
    >
      <div className="w-[364px] rounded-xl border border-cyan-500/50 bg-slate-950/95 backdrop-blur-md overflow-hidden">
        {/* Header (Draggable Handle) */}
        <div
          onMouseDown={onMouseDown}
          className="flex cursor-move items-center justify-between border-b border-slate-800 bg-slate-900/90 px-3 py-2"
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
            </span>
            <span className="font-display text-xs font-semibold tracking-wider text-slate-100 flex items-center gap-1.5">
              <Radar className="h-3.5 w-3.5 text-cyan-400" /> 2D TACTICAL DIGITAL TWIN
            </span>
            <span className="rounded bg-cyan-500/20 px-1.5 py-0.2 font-mono text-[9px] text-cyan-300">
              500×500 CROSS
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMinimized(!minimized)}
              title={minimized ? "Expand" : "Minimize"}
              className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            >
              {minimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close 2D Map"
              className="rounded p-1 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Body */}
        {!minimized && (
          <div className="p-3">
            {/* Quick Action Bar on 2D map */}
            <div className="mb-2 flex items-center justify-between text-[11px] font-mono">
              <button
                type="button"
                onClick={() => setFilterActive(!filterActive)}
                className={`flex items-center gap-1.5 rounded border px-2.5 py-1 transition ${
                  filterActive
                    ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                    : "border-slate-700 bg-slate-900 text-slate-400"
                }`}
              >
                <Layers className="h-3 w-3" />
                Traffic Filter: <strong className={filterActive ? "text-emerald-400" : "text-slate-500"}>{filterActive ? "ON" : "OFF"}</strong>
              </button>

              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Free
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" /> Busy
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Gridlock/Slum
                </span>
              </div>
            </div>

            {/* Radar Canvas */}
            <div className="relative flex justify-center rounded-lg border border-slate-800/80 bg-slate-950 p-1">
              <canvas ref={canvasRef} style={{ width: "340px", height: "340px" }} />

              {/* District overlay tags */}
              <div className="pointer-events-none absolute bottom-3 left-3 text-[9px] font-mono text-cyan-400/80">
                CYBER EXPRESSWAYS (0 POTHOLES)
              </div>
              <div className="pointer-events-none absolute top-3 right-3 text-[9px] font-mono text-rose-400/80">
                INFORMAL SLUM POCKETS
              </div>
            </div>

            {/* Real-time telemetry strip */}
            <div className="mt-2.5 rounded border border-slate-800/90 bg-slate-900/60 p-2 font-mono text-[10.5px]">
              <div className="flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-1.5 text-cyan-300">
                  <Siren className="h-3.5 w-3.5 text-rose-400" />
                  {snap.ambulance ? (
                    <span>AMB-07: {snap.ambulance.kmh} km/h · {snap.ambulance.status}</span>
                  ) : (
                    <span className="text-slate-400">AMB-07 on Standby</span>
                  )}
                </span>
                <span className="text-[10px] text-emerald-400">
                  {snap.stats.forced} signals pre-flushed
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between truncate text-[10px] text-slate-400">
                <span>TIME: {snap.formattedTime?.display || "08:30 AM"} ({snap.formattedTime?.phase})</span>
                <span className="text-slate-500">{snap.stats.count} vehicles / 625 junctions</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
