import { useEffect, useRef, useState, useCallback } from "react";
import { Radar, X, Maximize2, Minimize2, MapPin, Shuffle, Crosshair, Sparkles } from "lucide-react";
import {
  HALF,
  ROAD_W,
  HOSPITAL,
  riverBankX,
  ROAD_SEGMENTS,
  ROAD_DISTRICTS,
  nodePosition,
  nearestRoadNodeFromWorld,
  intersectionName,
  routePolyline,
} from "../../lib/cityGrid";
import { drawMiddleFingerPark2D } from "../../lib/mapArt";

const SIZE = 340;
const PAD = 18;
const MAP_SCALE = (SIZE - PAD * 2) / (HALF * 2);
const mapPoint = ({ x, z }) => [PAD + (x + HALF) * MAP_SCALE, PAD + (z + HALF) * MAP_SCALE];
const trace = (context, points) => {
  points.forEach(([x, y], i) => {
    if (i === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
};

export default function ComparisonRadar2D({
  simGW,
  simGM,
  pinnedNode,
  pinnedName,
  onPinDestination,
  onClose,
}) {
  const canvasRef = useRef(null);
  const [minimized, setMinimized] = useState(false);
  const [pos, setPos] = useState({ x: 24, y: 76 });
  const [dragging, setDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const onMouseDown = useCallback(
    (e) => {
      if (e.target.closest("button") || e.target.closest("canvas")) return;
      setDragging(true);
      dragOffsetRef.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    },
    [pos]
  );

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const scale = SIZE / rect.width;
    const px = clickX * scale;
    const py = clickY * scale;

    if (px >= PAD - 4 && px <= SIZE - PAD + 4 && py >= PAD - 4 && py <= SIZE - PAD + 4) {
      const worldX = (px - PAD) / MAP_SCALE - HALF;
      const worldZ = (py - PAD) / MAP_SCALE - HALF;
      const targetNode = nearestRoadNodeFromWorld(worldX, worldZ);
      if (targetNode) {
        const name = intersectionName(targetNode[0], targetNode[1]);
        if (onPinDestination) onPinDestination(targetNode, name);
      }
    }
  };

  useEffect(() => {
    const clamp = (next) => ({
      x: Math.max(10, Math.min(Math.max(10, window.innerWidth - 374), next.x)),
      y: Math.max(10, Math.min(Math.max(10, window.innerHeight - 100), next.y)),
    });
    const onMouseMove = (e) => {
      if (dragging)
        setPos(clamp({ x: e.clientX - dragOffsetRef.current.x, y: e.clientY - dragOffsetRef.current.y }));
    };
    const onMouseUp = () => setDragging(false);
    const onResize = () => setPos((prev) => clamp(prev));
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

  // Main 2D Radar Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || minimized) return;
    const ctx = canvas.getContext("2d");
    let animId;
    let pixelSize = 0;

    const resize = () => {
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

    // Cache static background: river, districts with middle finger park, and road grid
    const background = document.createElement("canvas");
    background.width = background.height = SIZE * 2;
    const bg = background.getContext("2d");
    bg.scale(2, 2);
    bg.fillStyle = "#06121e";
    bg.fillRect(0, 0, SIZE, SIZE);
    bg.save();
    bg.beginPath();
    bg.rect(PAD, PAD, SIZE - PAD * 2, SIZE - PAD * 2);
    bg.clip();

    // District islands
    for (const district of ROAD_DISTRICTS) {
      if (district.id === "civic-circle") {
        // Draw the exact Landmark Middle Finger Park on 2D map
        drawMiddleFingerPark2D(bg, mapPoint);
      } else {
        bg.beginPath();
        trace(bg, district.island.map(mapPoint));
        bg.closePath();
        bg.fillStyle = "#12372e";
        bg.fill();
      }
    }

    // River channel
    bg.beginPath();
    const leftBank = [], rightBank = [];
    for (let i = 0; i <= 120; i++) {
      const z = -HALF + (i / 120) * HALF * 2;
      const { left, right } = riverBankX(z);
      leftBank.push(mapPoint({ x: left, z }));
      rightBank.push(mapPoint({ x: right, z }));
    }
    trace(bg, [...leftBank, ...rightBank.reverse()]);
    bg.closePath();
    bg.fillStyle = "#0c4057";
    bg.fill();
    bg.strokeStyle = "#267186";
    bg.lineWidth = 0.8;
    bg.stroke();

    // Road network
    const roads = ROAD_SEGMENTS.map((segment) => ({
      ...segment,
      key: `${segment.ix},${segment.iz},${segment.axis}`,
      mapPoints: segment.points.map(mapPoint),
    }));
    const roadOutline = new Path2D();
    for (const road of roads) trace(roadOutline, road.mapPoints);
    bg.strokeStyle = "#234352";
    bg.lineWidth = 2.2;
    bg.stroke(roadOutline);
    bg.strokeStyle = "#1b333e";
    bg.lineWidth = 1.0;
    bg.stroke(roadOutline);
    bg.restore();

    const render = () => {
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.drawImage(background, 0, 0, SIZE, SIZE);
      const time = performance.now() * 0.003;

      // 1. Draw Active Corridors / Routes
      const ambGW = simGW?.ambulance;
      const ambGM = simGM?.ambulance;

      if (ambGW?.route?.length > 1) {
        const ptsGW = routePolyline(ambGW.route).map(mapPoint);
        ctx.beginPath();
        trace(ctx, ptsGW);
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 3.0;
        ctx.stroke();
      }

      if (ambGM?.route?.length > 1) {
        const ptsGM = routePolyline(ambGM.route).map(mapPoint);
        ctx.beginPath();
        trace(ctx, ptsGM);
        ctx.strokeStyle = "#f43f5e";
        ctx.lineWidth = 2.0;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 2. Hospital ER Base Beacon [23, 7]
      const [hospPx, hospPy] = mapPoint(nodePosition(HOSPITAL.node[0], HOSPITAL.node[1]));
      ctx.fillStyle = "#10b981";
      ctx.beginPath();
      ctx.arc(hospPx, hospPy, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // 3. Pinned Emergency Destination Beacon
      if (pinnedNode) {
        const [pinPx, pinPy] = mapPoint(nodePosition(pinnedNode[0], pinnedNode[1]));
        const pulse = 6 + Math.sin(time * 3) * 3;

        // Outer pulse ring
        ctx.strokeStyle = "rgba(244, 63, 94, 0.65)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(pinPx, pinPy, pulse + 5, 0, Math.PI * 2);
        ctx.stroke();

        // Crosshairs
        ctx.strokeStyle = "#fb7185";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(pinPx - 10, pinPy);
        ctx.lineTo(pinPx + 10, pinPy);
        ctx.moveTo(pinPx, pinPy - 10);
        ctx.lineTo(pinPx, pinPy + 10);
        ctx.stroke();

        // Center dot
        ctx.fillStyle = "#f43f5e";
        ctx.beginPath();
        ctx.arc(pinPx, pinPy, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }

      // 4. Draw GreenWave Ambulance (Emerald)
      if (ambGW && !ambGW.arrived) {
        const [agwPx, agwPy] = mapPoint({ x: ambGW.x, z: ambGW.z });
        ctx.fillStyle = "#34d399";
        ctx.beginPath();
        ctx.arc(agwPx, agwPy, 5.0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.4;
        ctx.stroke();
        // Emerald siren ping
        ctx.strokeStyle = "rgba(52, 211, 153, 0.7)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(agwPx, agwPy, 8.5 + Math.sin(time * 5) * 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 5. Draw Google Maps Ambulance (Rose/Coral)
      if (ambGM && !ambGM.arrived) {
        const [agmPx, agmPy] = mapPoint({ x: ambGM.x, z: ambGM.z });
        ctx.fillStyle = "#f43f5e";
        ctx.beginPath();
        ctx.arc(agmPx, agmPy, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
    };
  }, [simGW, simGM, pinnedNode, minimized]);

  const handleRandomPin = () => {
    const rx = 3 + Math.floor(Math.random() * 25);
    const rz = 3 + Math.floor(Math.random() * 25);
    const targetNode = nearestRoadNodeFromWorld(
      (rx - 15) * 16.6667,
      (rz - 15) * 16.6667
    );
    if (targetNode && onPinDestination) {
      onPinDestination(targetNode, `Hotspot [${targetNode[0]}, ${targetNode[1]}]`);
    }
  };

  return (
    <div
      style={{ left: pos.x, top: pos.y }}
      onMouseDown={onMouseDown}
      className={`fixed z-30 select-none overflow-hidden rounded-2xl border border-white/15 bg-[#070b16]/90 shadow-2xl backdrop-blur-2xl transition-all duration-150 ${
        dragging ? "cursor-grabbing opacity-95 scale-[1.01]" : "cursor-grab"
      }`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-white/[0.08] px-3.5 py-2">
        <div className="flex items-center gap-2">
          <Radar className="h-4 w-4 text-emerald-400 animate-pulse" />
          <span className="text-xs font-bold text-white tracking-wide">
            Dual Destination Radar
          </span>
          <span className="rounded bg-rose-500/20 px-1.5 py-0.2 text-[9px] font-semibold text-rose-300 border border-rose-500/30">
            Click to Point
          </span>
        </div>

        <div className="flex items-center gap-1 text-slate-400">
          <button
            type="button"
            onClick={() => setMinimized((m) => !m)}
            title={minimized ? "Expand" : "Minimize"}
            className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-white/10 hover:text-white transition"
          >
            {minimized ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close 2D Map"
              className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-rose-500/20 hover:text-rose-300 transition"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Body */}
      {!minimized && (
        <div className="p-3 flex flex-col gap-2">
          {/* Active Target Banner */}
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 truncate">
              <MapPin className="h-3.5 w-3.5 text-rose-400 shrink-0" />
              <span className="text-[11px] font-semibold text-white truncate">
                {pinnedName || "Click radar to point destination"}
              </span>
            </div>
            {pinnedNode && (
              <span className="font-mono text-[10px] text-rose-300 font-bold shrink-0 ml-1">
                [{pinnedNode[0]}, {pinnedNode[1]}]
              </span>
            )}
          </div>

          {/* Interactive Radar Canvas */}
          <div className="relative rounded-xl border border-white/10 overflow-hidden bg-[#040812]">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="h-[280px] w-[280px] sm:h-[300px] sm:w-[300px] cursor-crosshair block"
            />

            {/* In-canvas Legend */}
            <div className="pointer-events-none absolute bottom-2 left-2 right-2 flex items-center justify-between rounded-lg bg-slate-950/80 px-2 py-1 text-[9px] font-medium text-slate-300 backdrop-blur-md border border-white/10">
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span>GreenWave</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                <span>Google Maps</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-300 border border-white" />
                <span>Hospital ER</span>
              </div>
            </div>
          </div>

          {/* Footer Controls & Random Pin */}
          <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
            <span className="text-[10px] text-slate-400">
              Point target for both twins
            </span>
            <button
              type="button"
              onClick={handleRandomPin}
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-0.8 text-[10px] font-medium text-slate-300 hover:text-white hover:bg-white/10 transition"
            >
              <Shuffle className="h-3 w-3" />
              <span>Random Target</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
