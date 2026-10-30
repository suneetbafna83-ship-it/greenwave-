import { useState, useEffect, useRef, useCallback } from "react";
import {
  Columns2,
  Route,
  Zap,
  Gauge,
  Clock,
  CarFront,
  Hospital as HospitalIcon,
  Ban,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  Flame,
  Layers,
  MapPin,
  ChevronRight,
  ShieldCheck,
  Video,
  Eye,
  Crosshair,
} from "lucide-react";
import CityScene from "../warroom/CityScene";
import { TrafficSim } from "../../lib/trafficSim";
import { HOSPITAL, DISPATCH_BASES, intersectionName, etaMinutes } from "../../lib/cityGrid";
import { adaptiveRoute } from "../../lib/trafficPolicy";

const COMPARISON_PRESETS = [
  { id: "citadel", name: "Sector 4 Cyber Citadel", node: [5, 5], desc: "Dense skyscraper core with high intersection density" },
  { id: "metro", name: "Sector 5 Metro Central", node: [15, 16], desc: "Heavy commercial boulevard with multiple signalized junctions" },
  { id: "bridge", name: "Sector 7 Grand Bridge", node: [14, 13], desc: "Express river crossing corridor" },
  { id: "waterfront", name: "Sector 1 North Waterfront", node: [2, 2], desc: "Long cross-town route along northern riverbank" },
  { id: "slums", name: "Sector 9 Slum Badlands", node: [27, 24], desc: "Outer district with road craters & narrow streets" },
];

export default function SideBySideComparison({ active }) {
  const [, setTick] = useState(0);
  const [selectedPreset, setSelectedPreset] = useState(COMPARISON_PRESETS[0]);
  const [viewMode, setViewMode] = useState("orbit");
  const [isPaused, setIsPaused] = useState(false);
  const [rushHour, setRushHour] = useState(false);
  const [syncCamera, setSyncCamera] = useState(true);

  // Initialize both twins with the exact same seed & settings
  const seedRef = useRef(20261031);
  const simGreenWaveRef = useRef(null);
  const simGoogleMapsRef = useRef(null);

  if (!simGreenWaveRef.current) {
    const seed = seedRef.current;
    // Twin 1: Autonomous GreenWave AI with signal preemption
    simGreenWaveRef.current = new TrafficSim({
      seed,
      hour: 8.5,
      vehicleCount: 380,
      controlled: false,
    });
    simGreenWaveRef.current.greenWaveAI = true;

    // Twin 2: Standard Google Maps Baseline without signal preemption
    simGoogleMapsRef.current = new TrafficSim({
      seed,
      hour: 8.5,
      vehicleCount: 380,
      controlled: false,
    });
    simGoogleMapsRef.current.greenWaveAI = false;
  }

  const simGW = simGreenWaveRef.current;
  const simGM = simGoogleMapsRef.current;

  const refresh = () => setTick((t) => t + 1);

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(refresh, 100);
    return () => clearInterval(interval);
  }, [active]);

  // Dual Dispatch: Dispatches both ambulances simultaneously to the exact same target
  const handleDualDispatch = useCallback(() => {
    if (!simGW || !simGM) return;
    const targetNode = selectedPreset.node;
    const targetName = selectedPreset.name;

    // GreenWave uses adaptive corridor with signal preemption
    const gwOutbound = simGW.findRoute(HOSPITAL.node, targetNode);
    simGW.dispatchRoundTrip(gwOutbound, null, `GreenWave Response to ${targetName}`, targetNode);

    // Google Maps uses standard shortest-path routing with standard traffic light cycles
    const gmOutbound = simGM.findRoute(HOSPITAL.node, targetNode);
    simGM.dispatchRoundTrip(gmOutbound, null, `Google Maps Navigation to ${targetName}`, targetNode);

    refresh();
  }, [simGW, simGM, selectedPreset]);

  // Dual Cancel: Aborts both missions simultaneously
  const handleDualCancel = useCallback(() => {
    if (!simGW || !simGM) return;
    simGW.cancelDispatch();
    simGM.cancelDispatch();
    refresh();
  }, [simGW, simGM]);

  // Dual Reset: Reinitializes both twins to fresh starting states with same seed
  const handleDualReset = useCallback(() => {
    const seed = seedRef.current;
    simGreenWaveRef.current = new TrafficSim({
      seed,
      hour: 8.5,
      vehicleCount: rushHour ? 680 : 380,
      controlled: false,
    });
    simGreenWaveRef.current.greenWaveAI = true;

    simGoogleMapsRef.current = new TrafficSim({
      seed,
      hour: 8.5,
      vehicleCount: rushHour ? 680 : 380,
      controlled: false,
    });
    simGoogleMapsRef.current.greenWaveAI = false;
    refresh();
  }, [rushHour]);

  // Toggle Rush Hour on both simulations simultaneously
  const handleToggleRushHour = () => {
    const next = !rushHour;
    setRushHour(next);
    simGW.setRushHour(next);
    simGM.setRushHour(next);
    refresh();
  };

  const snapGW = simGW.snapshot();
  const snapGM = simGM.snapshot();
  const ambGW = snapGW.ambulance;
  const ambGM = snapGM.ambulance;

  const isDispatched = (ambGW && !ambGW.arrived) || (ambGM && !ambGM.arrived);
  const timeSaved = Math.max(0, (ambGM?.elapsed || 0) - (ambGW?.elapsed || 0));
  const speedAdvantage = Math.max(0, (ambGW?.kmh || 0) - (ambGM?.kmh || 0));

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#070b14] text-slate-100 select-none">
      {/* Top Synchronized Control & Live Comparison HUD */}
      <div className="z-20 border-b border-white/[0.08] bg-[#070b16]/75 px-4 py-2.5 backdrop-blur-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg">
        {/* Left: Title & Incident Selector */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10">
            <Columns2 className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white tracking-wide">
                Digital Twin vs Google Maps
              </h1>
              <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-mono text-slate-300">
                Paired Seed: {seedRef.current}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Same traffic, vehicles & road congestion · Autonomous corridor vs uncoordinated lights
            </p>
          </div>
        </div>

        {/* Center: Realtime Comparative Scoreboard */}
        <div className="flex flex-wrap items-center gap-2 font-mono">
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs shadow-sm">
            <Zap className="h-4 w-4 text-emerald-400 animate-pulse" />
            <div>
              <div className="text-[9px] text-emerald-400 uppercase tracking-wider font-semibold">GreenWave Saved</div>
              <div className="text-xs font-bold text-emerald-300">
                {timeSaved > 0 ? `+${timeSaved.toFixed(1)}s ahead` : "Synchronized"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs">
            <Gauge className="h-4 w-4 text-cyan-400" />
            <div>
              <div className="text-[9px] text-slate-400 uppercase tracking-wider">Speed Delta</div>
              <div className="text-xs font-bold text-white">
                {ambGW ? `${ambGW.kmh} vs ${ambGM?.kmh ?? 0} km/h` : "0 vs 0 km/h"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs">
            <ShieldCheck className="h-4 w-4 text-amber-400" />
            <div>
              <div className="text-[9px] text-amber-400 uppercase tracking-wider">Signals Cleared</div>
              <div className="text-xs font-bold text-amber-300">
                {snapGW.stats.forced} priority vs 0
              </div>
            </div>
          </div>
        </div>

        {/* Right: Dual Actions */}
        <div className="flex items-center gap-2">
          {/* Preset Destination Dropdown */}
          <select
            value={selectedPreset.id}
            onChange={(e) => {
              const p = COMPARISON_PRESETS.find((x) => x.id === e.target.value);
              if (p) setSelectedPreset(p);
            }}
            disabled={isDispatched}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            {COMPARISON_PRESETS.map((p) => (
              <option key={p.id} value={p.id} className="bg-slate-900 text-slate-200">
                {p.name}
              </option>
            ))}
          </select>

          {/* Dual Dispatch / Dual Cancel Button */}
          {isDispatched ? (
            <button
              type="button"
              onClick={handleDualCancel}
              className="flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/20 px-3.5 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/30 transition shadow-sm active:scale-[0.98]"
            >
              <Ban className="h-3.5 w-3.5 text-rose-400" />
              <span>Cancel Both Missions</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDualDispatch}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition shadow-sm active:scale-[0.98]"
            >
              <Route className="h-3.5 w-3.5" />
              <span>Launch Dual Dispatch</span>
            </button>
          )}

          {/* Rush Hour Toggle */}
          <button
            type="button"
            onClick={handleToggleRushHour}
            title="Toggle Rush Hour on both simulations"
            className={`flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition ${
              rushHour
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white"
            }`}
          >
            <Flame className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Surge</span>
          </button>

          {/* Reset Twins */}
          <button
            type="button"
            onClick={handleDualReset}
            title="Reset both simulations to identical starting state"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-400 hover:text-white hover:bg-white/[0.08] transition"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main Dual Viewport Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 flex-1 relative overflow-hidden">
        {/* ───────────────────── LEFT VIEWPORT: GreenWave Autonomous Twin ───────────────────── */}
        <div className="relative h-full w-full border-b lg:border-b-0 lg:border-r border-white/10 overflow-hidden bg-slate-950">
          {/* Viewport Header Pill */}
          <div className="pointer-events-none absolute top-3 left-3 right-3 z-10 flex items-center justify-between">
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-slate-950/80 px-3 py-1.5 shadow-xl backdrop-blur-xl">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white tracking-wide">GreenWave AI Twin</span>
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[9px] font-semibold text-emerald-300 border border-emerald-500/30">
                  Autonomous Preemption
                </span>
              </div>
            </div>

            {/* In-viewport Live Telemetry Badge */}
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-1.5 text-xs font-mono shadow-xl backdrop-blur-xl">
              <div className="flex items-center gap-1 text-emerald-300">
                <Gauge className="h-3 w-3 text-emerald-400" />
                <span>{ambGW ? `${ambGW.kmh} km/h` : "Standby"}</span>
              </div>
              <span className="text-white/20">|</span>
              <div className="text-slate-300">
                {ambGW ? ambGW.status : "At Hospital ER"}
              </div>
            </div>
          </div>

          {/* 3D Canvas */}
          <CityScene
            sim={simGW}
            active={active}
            viewMode={viewMode}
            routeVersion={simGW.routeVersion}
            showHazards={true}
            showTrafficFilter={true}
            hour={8.5}
          />

          {/* Bottom Corridor HUD Tile */}
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between rounded-xl border border-emerald-500/20 bg-slate-950/80 px-3 py-2 text-xs shadow-xl backdrop-blur-xl">
            <div className="flex items-center gap-2 min-w-0">
              <Zap className="h-4 w-4 text-emerald-400 shrink-0" />
              <div className="truncate">
                <span className="font-semibold text-white">Priority Corridor Active: </span>
                <span className="text-emerald-300">
                  {ambGW ? `${ambGW.cleared}/${ambGW.total} junctions cleared` : "Ready for mission"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
              <span className="text-slate-400">Elapsed:</span>
              <span className="font-bold text-white">{ambGW ? `${ambGW.elapsed.toFixed(1)}s` : "0.0s"}</span>
            </div>
          </div>
        </div>

        {/* ───────────────────── RIGHT VIEWPORT: Google Maps Baseline ───────────────────── */}
        <div className="relative h-full w-full overflow-hidden bg-slate-950">
          {/* Viewport Header Pill */}
          <div className="pointer-events-none absolute top-3 left-3 right-3 z-10 flex items-center justify-between">
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-slate-950/80 px-3 py-1.5 shadow-xl backdrop-blur-xl">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white tracking-wide">Google Maps Baseline</span>
                <span className="rounded bg-rose-500/20 px-1.5 py-0.2 text-[9px] font-semibold text-rose-300 border border-rose-500/30">
                  Standard Lights (No Control)
                </span>
              </div>
            </div>

            {/* In-viewport Live Telemetry Badge */}
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-1.5 text-xs font-mono shadow-xl backdrop-blur-xl">
              <div className="flex items-center gap-1 text-rose-300">
                <Gauge className="h-3 w-3 text-rose-400" />
                <span>{ambGM ? `${ambGM.kmh} km/h` : "Standby"}</span>
              </div>
              <span className="text-white/20">|</span>
              <div className="text-slate-300">
                {ambGM ? (ambGM.kmh < 2 ? "HELD AT RED LIGHT" : ambGM.status) : "At Hospital ER"}
              </div>
            </div>
          </div>

          {/* 3D Canvas */}
          <CityScene
            sim={simGM}
            active={active}
            viewMode={viewMode}
            routeVersion={simGM.routeVersion}
            showHazards={true}
            showTrafficFilter={true}
            hour={8.5}
          />

          {/* Bottom Traffic Light Delays HUD Tile */}
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between rounded-xl border border-rose-500/20 bg-slate-950/80 px-3 py-2 text-xs shadow-xl backdrop-blur-xl">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
              <div className="truncate">
                <span className="font-semibold text-white">Standard Navigation: </span>
                <span className="text-rose-300">
                  {ambGM
                    ? ambGM.kmh < 2
                      ? "Ambulance stopped waiting for green traffic light"
                      : "Navigating in normal traffic queue"
                    : "Ready for mission"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
              <span className="text-slate-400">Elapsed:</span>
              <span className="font-bold text-white">{ambGM ? `${ambGM.elapsed.toFixed(1)}s` : "0.0s"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
