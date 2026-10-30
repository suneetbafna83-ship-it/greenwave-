import { useEffect, useState } from "react";
import {
  Siren,
  CarFront,
  Waves,
  Radar,
  Gauge,
  TrafficCone,
  Activity,
  Crosshair,
  MapPin,
  Timer,
  Zap,
  Terminal,
  Video,
  Eye,
  Clock,
  Play,
  Pause,
  Flame,
  Shuffle,
  Route,
  Map,
  ChevronDown,
  Layers,
  ShieldCheck,
} from "lucide-react";
import CityScene from "./CityScene";
import Minimap2D from "./Minimap2D";
import ErrorBoundary from "../common/ErrorBoundary";
import TrafficDecision from "./TrafficDecision";
import { etaMinutes, routeNames, ROAD_HAZARDS, DISPATCH_BASES, ROAD_NODE_COUNT } from "../../lib/cityGrid";

const EVENT_STYLE = {
  alert: "text-rose-400",
  warn: "text-amber-400",
  wave: "text-emerald-400",
  success: "text-teal-400",
  info: "text-slate-400",
};

function Switch({ on, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between py-1 text-left text-xs transition text-slate-300 hover:text-white"
    >
      <span>{label}</span>
      <span
        className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
          on ? "bg-emerald-500" : "bg-white/10"
        }`}
      >
        <span
          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
            on ? "translate-x-3.5" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function StatTile({ icon: Icon, label, value, unit, tone = "text-white" }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
        <Icon className="h-3.5 w-3.5 text-slate-500" />
        <span>{label}</span>
      </div>
      <div className={`mt-1 font-mono text-lg font-semibold tracking-tight ${tone}`}>
        {value}
        {unit && <span className="ml-1 text-[11px] font-normal text-slate-500">{unit}</span>}
      </div>
    </div>
  );
}

function AmbulanceStatusCard({ snap, viewMode, setViewMode }) {
  const amb = snap.ambulance;
  const sev = Math.max(5, snap.stats.congestion);
  const eta = etaMinutes(snap.route, sev);

  if (!amb) {
    return (
      <div className="panel p-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-slate-500" />
            <span className="text-xs font-semibold text-white">Ambulance AMB-07</span>
          </div>
          <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-400">
            Standby
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-400 leading-relaxed">
          Ready at {snap.activeBase?.name || "Sector 4 Depot"}. Select an origin and dispatch to clear signals.
        </p>
      </div>
    );
  }

  const isArrived = amb.status === "ARRIVED";
  const isHeld = amb.status === "HELD";

  return (
    <div className="panel p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold text-white">Unit AMB-07</span>
        </div>
        <span
          className={`rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
            isArrived
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : isHeld
              ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
              : "border-rose-500/40 bg-rose-500/10 text-rose-300"
          }`}
        >
          {amb.status}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-300">
        <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0" />
        <span className="truncate">{amb.location}</span>
      </div>

      {/* Progress line */}
      <div className="mt-3">
        <div className="flex justify-between text-[11px] text-slate-400 font-mono">
          <span>Junctions {amb.cleared}/{amb.total}</span>
          <span>{Math.round(amb.progress * 100)}%</span>
        </div>
        <div className="mt-1 h-1 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-emerald-400 rounded-full transition-all duration-300"
            style={{ width: `${amb.progress * 100}%` }}
          />
        </div>
      </div>

      {/* 3 Key Metrics */}
      <div className="mt-3 grid grid-cols-3 gap-1.5 text-center font-mono">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-1.5">
          <div className="text-[10px] text-slate-500">Speed</div>
          <div className="text-xs font-semibold text-white">{amb.kmh} km/h</div>
        </div>
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-1.5">
          <div className="text-[10px] text-emerald-400">GreenWave</div>
          <div className="text-xs font-semibold text-emerald-300">{eta.greenwave}m</div>
        </div>
        <div className="rounded-lg border border-teal-500/30 bg-teal-500/5 p-1.5">
          <div className="text-[10px] text-teal-400">Saved</div>
          <div className="text-xs font-semibold text-teal-300">{eta.saved}m</div>
        </div>
      </div>
    </div>
  );
}

export default function WarRoom({ sim, active, onDispatch }) {
  const [, setTick] = useState(0);
  const [viewMode, setViewMode] = useState("orbit");
  const [selectedBaseId, setSelectedBaseId] = useState(DISPATCH_BASES[0].id);
  const [showLog, setShowLog] = useState(false);

  const refresh = () => setTick((t) => t + 1);

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(refresh, 100);
    return () => clearInterval(interval);
  }, [active]);

  const snap = sim.snapshot();

  const handleBaseChange = (baseId) => {
    setSelectedBaseId(baseId);
    const b = DISPATCH_BASES.find((item) => item.id === baseId);
    if (b) sim.setActiveBase(b);
    refresh();
  };

  const dispatchDynamic = () => {
    const amb = sim.dispatchDynamic();
    setViewMode("chase");
    const sev = Math.max(5, sim.stats.congestion);
    const eta = etaMinutes(amb.route, sev);
    onDispatch({
      incident_type: "Adaptive Emergency Corridor",
      sector: snap.activeBase?.sector || "Sector 1",
      congestion_severity: sev,
      optimal_corridor_path: routeNames(amb.route),
      estimated_time_saved_minutes: eta.saved,
      standard_eta_minutes: eta.standard,
      greenwave_eta_minutes: eta.greenwave,
      ai_dispatch_note: `Dynamic routing initiated from ${snap.activeBase?.name || "Depot"}.`,
      source: "dynamic-ai-router",
    });
    refresh();
  };

  const dispatchRandomEmergency = () => {
    const rx = 1 + Math.floor(Math.random() * 13);
    const rz = 1 + Math.floor(Math.random() * 13);
    const amb = sim.dispatchDynamic([rx, rz], `Emergency (${rx},${rz})`);
    setViewMode("chase");
    const sev = Math.max(5, sim.stats.congestion);
    const eta = etaMinutes(amb.route, sev);
    onDispatch({
      incident_type: `Emergency (${rx},${rz})`,
      sector: "Dynamic Hotspot",
      congestion_severity: sev,
      optimal_corridor_path: routeNames(amb.route),
      estimated_time_saved_minutes: eta.saved,
      standard_eta_minutes: eta.standard,
      greenwave_eta_minutes: eta.greenwave,
      ai_dispatch_note: `Incident generated at node (${rx}, ${rz}).`,
      source: "dynamic-ai-router",
    });
    refresh();
  };

  const s = snap.stats;
  const waveBanner = snap.corridorActive;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#070a12]">
      {/* 3D City Visualization */}
      <div className="absolute inset-0">
        <CityScene
          sim={sim}
          active={active}
          viewMode={viewMode}
          routeVersion={snap.routeVersion}
          showHazards={snap.showHazards}
          showTrafficFilter={snap.showTrafficFilter}
          hour={snap.hour ?? 8.5}
        />
      </div>

      {/* Floating 2D Radar Minimap */}
      {snap.show2DMinimap && (
        <ErrorBoundary title="2D Tactical Radar">
          <Minimap2D
            sim={sim}
            snap={snap}
            onClose={() => {
              sim.setShow2DMinimap(false);
              refresh();
            }}
          />
        </ErrorBoundary>
      )}

      {/* Clean Active Corridor Banner */}
      <div
        className={`pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 transition-all duration-300 z-20 ${
          waveBanner ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"
        }`}
      >
        <div className="flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-950/80 px-4 py-1.5 text-xs font-medium text-emerald-200 shadow-xl backdrop-blur-xl">
          <Waves className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
          <span>
            {snap.manualOverride
              ? "Manual Override: Corridor Forced Green"
              : `Green Wave Active: Pre-flushing ${s.forced} Signals`}
          </span>
        </div>
      </div>

      {/* TOP FLOATING DOCK: Time, Camera, and Filter Controls */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 hidden md:flex items-center gap-2 z-20">
        {/* Time Controller Pill */}
        <div className="flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-[#0c101c]/85 px-3 py-1.5 shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-1.5 font-mono text-xs text-white">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span>{snap.formattedTime?.display || "08:30 AM"}</span>
          </div>

          <button
            type="button"
            onClick={() => {
              sim.setTimePaused(!snap.timePaused);
              refresh();
            }}
            title={snap.timePaused ? "Resume clock" : "Pause clock"}
            className="rounded p-1 text-slate-400 hover:text-white transition"
          >
            {snap.timePaused ? <Play className="h-3 w-3 text-emerald-400" /> : <Pause className="h-3 w-3" />}
          </button>

          <input
            type="range"
            min="0"
            max="23.9"
            step="0.1"
            value={snap.hour ?? 8.5}
            onChange={(e) => {
              sim.setHour(parseFloat(e.target.value));
              refresh();
            }}
            className="h-1 w-20 lg:w-24 accent-emerald-400 cursor-pointer bg-white/10 rounded-lg"
            title="Scrub time"
          />

          {/* Random Rush Hour Surge */}
          <button
            type="button"
            onClick={() => {
              sim.triggerRandomSurge();
              refresh();
            }}
            title="Inject traffic surge"
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition ${
              snap.unpredictableSurge
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Flame className="h-3 w-3 text-amber-400" />
            <span>{snap.unpredictableSurge ? `${snap.surgeRemaining}s` : "Surge"}</span>
          </button>
        </div>

        {/* Camera Segmented Pill */}
        <div className="flex items-center rounded-full border border-white/[0.08] bg-[#0c101c]/85 p-1 shadow-xl backdrop-blur-xl">
          {[
            { id: "chase", label: "Chase", icon: Video },
            { id: "drone", label: "Drone", icon: Eye },
            { id: "orbit", label: "Orbit", icon: Crosshair },
          ].map((mode) => {
            const Icon = mode.icon;
            const active = viewMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setViewMode(mode.id)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                  active
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Icon className="h-3 w-3" />
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>

        {/* Overlays Pill */}
        <div className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-[#0c101c]/85 p-1 shadow-xl backdrop-blur-xl">
          <button
            type="button"
            onClick={() => {
              sim.setShowTrafficFilter(!sim.showTrafficFilter);
              refresh();
            }}
            title="Toggle Traffic Congestion Colors"
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
              snap.showTrafficFilter
                ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="h-3 w-3" />
            <span>Traffic</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sim.setShow2DMinimap(!sim.show2DMinimap);
              refresh();
            }}
            title="Toggle 2D Radar"
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
              snap.show2DMinimap
                ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Map className="h-3 w-3" />
            <span>Radar</span>
          </button>
        </div>
      </div>

      {/* LEFT PANEL: Dispatch & Controls */}
      <div className="pointer-events-none absolute bottom-4 left-4 top-4 flex w-[300px] flex-col gap-3 z-10">
        <div className="panel pointer-events-auto p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white">Signal Command</span>
            <span className="text-[11px] font-mono text-slate-500">{ROAD_NODE_COUNT} Junctions</span>
          </div>

          {/* Origin selector */}
          <div>
            <label className="text-[11px] font-medium text-slate-400">Dispatch Origin</label>
            <select
              value={selectedBaseId}
              onChange={(e) => handleBaseChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50"
            >
              {DISPATCH_BASES.map((b) => (
                <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                  {b.name} ({b.sector})
                </option>
              ))}
            </select>
          </div>

          {/* Urgency selector */}
          <div>
            <label className="text-[11px] font-medium text-slate-400">Urgency Level</label>
            <div className="mt-1 grid grid-cols-3 gap-1 rounded-lg border border-white/10 bg-white/[0.025] p-1 text-center text-xs">
              {["normal", "urgent", "critical"].map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => {
                    sim.setUrgency(u);
                    refresh();
                  }}
                  className={`rounded-md py-1 capitalize transition ${
                    snap.urgency === u
                      ? "bg-white/10 font-medium text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* Primary Action Button */}
          <button
            type="button"
            onClick={dispatchDynamic}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-2.5 text-xs transition shadow-sm active:scale-[0.99]"
          >
            <Route className="h-4 w-4" />
            <span>Dispatch Emergency Corridor</span>
          </button>

          {/* Secondary Quick Actions */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => {
                sim.setRushHour(!sim.rushHour);
                refresh();
              }}
              className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                snap.rushHour
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                  : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
              }`}
            >
              <CarFront className="h-3.5 w-3.5" />
              <span>{snap.rushHour ? "Rush Hour (On)" : "Rush Hour"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sim.setManualOverride(!sim.manualOverride);
                refresh();
              }}
              className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                snap.manualOverride
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
              }`}
            >
              <Waves className="h-3.5 w-3.5" />
              <span>{snap.manualOverride ? "Override (On)" : "Force Green"}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={dispatchRandomEmergency}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-white/[0.06] transition"
          >
            <Shuffle className="h-3.5 w-3.5" />
            <span>Random Hotspot Incident</span>
          </button>

          {/* Clean Toggles */}
          <div className="border-t border-white/[0.06] pt-2 flex flex-col gap-1.5">
            <Switch
              on={snap.greenWaveAI}
              label="Adaptive Pre-flushing"
              onClick={() => {
                sim.setGreenWaveAI(!sim.greenWaveAI);
                refresh();
              }}
            />
            <Switch
              on={snap.showHazards}
              label="Highlight Road Hazards"
              onClick={() => {
                sim.setShowHazards(!sim.showHazards);
                refresh();
              }}
            />
            <Switch
              on={snap.showTrafficFilter}
              label="Traffic Congestion Map"
              onClick={() => {
                sim.setShowTrafficFilter(!sim.showTrafficFilter);
                refresh();
              }}
            />
          </div>
        </div>

        {/* Collapsible Event Log */}
        <div className="panel pointer-events-auto flex flex-col p-3 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowLog(!showLog)}
            className="flex items-center justify-between text-xs font-medium text-slate-400 hover:text-white transition"
          >
            <span className="flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5" />
              <span>Corridor Log</span>
            </span>
            <span className="text-[10px] text-slate-500">{snap.events.length} events</span>
          </button>

          {showLog && (
            <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto font-mono text-[11px] border-t border-white/[0.06] pt-2">
              {snap.events.slice(-5).map((e) => (
                <li key={e.id} className={EVENT_STYLE[e.type] || "text-slate-400"}>
                  <span className="text-slate-500">{e.at.toLocaleTimeString([], { hour12: false })} </span>
                  {e.msg}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Live Telemetry & Tracking */}
      <div className="pointer-events-none absolute bottom-4 right-4 top-4 flex w-[290px] flex-col gap-2.5 overflow-y-auto z-10">
        <div className="pointer-events-auto">
          <AmbulanceStatusCard snap={snap} viewMode={viewMode} setViewMode={setViewMode} />
        </div>

        {/* 4 Clean Metric Tiles */}
        <div className="panel pointer-events-auto p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-white">Live Telemetry</span>
            <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Realtime
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatTile icon={CarFront} label="Vehicles" value={s.count} />
            <StatTile icon={Gauge} label="Avg Speed" value={s.avgKmh} unit="km/h" />
            <StatTile
              icon={TrafficCone}
              label="Congestion"
              value={`${s.congestion}%`}
              tone={s.congestion > 70 ? "text-rose-400" : s.congestion > 45 ? "text-amber-400" : "text-emerald-400"}
            />
            <StatTile icon={Zap} label="Cleared" value={s.forced} unit="signals" tone="text-emerald-400" />
          </div>
        </div>

        {/* Compact AI Decision */}
        <div className="pointer-events-auto">
          <TrafficDecision decision={snap.decision} simTime={sim.time} compact />
        </div>
      </div>

      {/* Minimal Floating Footer Key */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 hidden xl:flex items-center gap-3 rounded-full border border-white/[0.08] bg-[#0c101c]/80 px-4 py-1.5 text-xs text-slate-400 shadow-xl backdrop-blur-xl z-10">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-400" /> Priority Signals
        </span>
        <span className="text-white/20">|</span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-rose-500" /> Ambulance AMB-07
        </span>
        <span className="text-white/20">|</span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500/80" /> Free
          <span className="h-2 w-2 rounded-full bg-amber-400/80" /> Busy
          <span className="h-2 w-2 rounded-full bg-rose-500/80" /> Queued
        </span>
        <span className="text-white/20">|</span>
        <span className="text-[11px] text-slate-500">Drag to orbit · Scroll to zoom</span>
      </div>
    </div>
  );
}
