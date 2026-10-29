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
  Hospital,
  Truck,
  Bus,
  Bike,
  AlertTriangle,
  Layers,
  OctagonAlert,
  Video,
  Eye,
  Clock,
  Play,
  Pause,
  Flame,
  Shuffle,
  Route,
  Map,
} from "lucide-react";
import CityScene from "./CityScene";
import Minimap2D from "./Minimap2D";
import ErrorBoundary from "../common/ErrorBoundary";
import { etaMinutes, routeNames, ROAD_HAZARDS, DISPATCH_BASES } from "../../lib/cityGrid";

const EVENT_STYLE = {
  alert: "text-rose-400",
  warn: "text-amber-300",
  wave: "text-emerald-300",
  success: "text-cyan-300",
  info: "text-slate-400",
};

function Switch({ on, onClick, label, hint }) {
  return (
    <button onClick={onClick} className="group flex w-full items-center justify-between gap-3 py-1.5 text-left">
      <span>
        <span className="block text-[13px] text-slate-200">{label}</span>
        {hint && <span className="block text-[11px] text-slate-500">{hint}</span>}
      </span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors ${
          on ? "border-emerald-400/60 bg-emerald-500/30" : "border-slate-600 bg-slate-800"
        }`}
      >
        <span
          className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all ${
            on ? "left-[18px] bg-emerald-300 shadow-[0_0_10px_#34d399]" : "left-0.5 bg-slate-500"
          }`}
        />
      </span>
    </button>
  );
}

function CommandButton({ icon: Icon, title, subtitle, tone, active, onClick }) {
  const tones = {
    rose: "border-rose-500/40 hover:border-rose-400 text-rose-300 hover:shadow-[0_0_24px_-4px_rgba(244,63,94,0.6)]",
    amber: "border-amber-500/40 hover:border-amber-400 text-amber-300 hover:shadow-[0_0_24px_-4px_rgba(245,158,11,0.55)]",
    emerald: "border-emerald-500/40 hover:border-emerald-400 text-emerald-300 hover:shadow-[0_0_24px_-4px_rgba(16,185,129,0.6)]",
    cyan: "border-cyan-500/40 hover:border-cyan-400 text-cyan-300 hover:shadow-[0_0_24px_-4px_rgba(34,211,238,0.6)]",
  };
  const activeTones = {
    rose: "bg-rose-500/15 border-rose-400",
    amber: "bg-amber-500/15 border-amber-400",
    emerald: "bg-emerald-500/15 border-emerald-400",
    cyan: "bg-cyan-500/15 border-cyan-400",
  };
  return (
    <button
      onClick={onClick}
      className={`group relative flex w-full items-start gap-3 rounded-lg border bg-slate-900/60 px-3 py-2 text-left transition-all active:scale-[0.98] ${tones[tone]} ${
        active ? activeTones[tone] : ""
      }`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${active ? "animate-pulse" : ""}`} />
      <span className="min-w-0">
        <span className="block font-display text-[13.5px] font-semibold leading-tight tracking-wide text-slate-100">{title}</span>
        <span className="mt-0.5 block font-mono text-[10.5px] uppercase tracking-wider opacity-80">{subtitle}</span>
      </span>
    </button>
  );
}

function Stat({ icon: Icon, label, value, unit, tone = "text-cyan-300", bar }) {
  return (
    <div className="rounded-md border border-slate-700/60 bg-slate-900/50 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className={`mt-0.5 font-mono text-xl font-bold ${tone}`}>
        {value}
        <span className="ml-1 text-xs font-normal text-slate-500">{unit}</span>
      </div>
      {bar !== undefined && (
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500 transition-all duration-500"
            style={{ width: `${bar}%` }}
          />
        </div>
      )}
    </div>
  );
}

function AmbulanceCard({ snap, viewMode, setViewMode }) {
  const amb = snap.ambulance;
  const sev = Math.max(5, snap.stats.congestion);
  const eta = etaMinutes(snap.route, sev);

  if (!amb) {
    return (
      <div className="panel p-3.5">
        <div className="hud-label flex items-center gap-2">
          <Siren className="h-3.5 w-3.5" /> Unit AMB-07
        </div>
        <div className="mt-1 font-display text-base text-slate-300">Standby at {snap.activeBase?.name || "Sector 4 Depot"}</div>
        <div className="mt-1 flex items-center gap-1.5 font-mono text-[10.5px] text-amber-300">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          Active Ambulances: 0 on road
        </div>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          Dispatch via Dynamic AI Router to compute the fastest route avoiding live congestion and potholes!
        </p>
      </div>
    );
  }

  const statusTone =
    amb.status === "ARRIVED"
      ? "bg-cyan-500/20 text-cyan-200 border-cyan-400/50"
      : amb.status === "HELD"
      ? "bg-amber-500/20 text-amber-200 border-amber-400/50"
      : "bg-rose-500/20 text-rose-200 border-rose-400/50";

  return (
    <div className="panel p-3.5">
      <div className="flex items-center justify-between">
        <div className="hud-label flex items-center gap-2">
          <Siren className="h-3.5 w-3.5 text-rose-400" /> Unit AMB-07
        </div>
        <span className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold tracking-widest ${statusTone}`}>{amb.status}</span>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-200">
        <MapPin className="h-3.5 w-3.5 text-cyan-400" />
        <span className="truncate">{amb.location}</span>
      </div>

      {/* Camera angle quick-selector */}
      <div className="mt-2.5 flex items-center gap-1 rounded bg-slate-900/90 p-1 font-mono text-[10px]">
        <span className="px-1 text-slate-500">CAM:</span>
        <button
          type="button"
          onClick={() => setViewMode("chase")}
          className={`flex-1 rounded py-0.5 transition ${
            viewMode === "chase" ? "bg-cyan-500/30 text-cyan-200 font-bold" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Chase (Street)
        </button>
        <button
          type="button"
          onClick={() => setViewMode("drone")}
          className={`flex-1 rounded py-0.5 transition ${
            viewMode === "drone" ? "bg-cyan-500/30 text-cyan-200 font-bold" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Drone
        </button>
        <button
          type="button"
          onClick={() => setViewMode("orbit")}
          className={`flex-1 rounded py-0.5 transition ${
            viewMode === "orbit" ? "bg-cyan-500/30 text-cyan-200 font-bold" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Free Orbit
        </button>
      </div>

      <div className="mt-2.5">
        <div className="flex justify-between font-mono text-[10px] text-slate-400">
          <span>
            JUNCTIONS {amb.cleared}/{amb.total}
          </span>
          <span>{Math.round(amb.progress * 100)}%</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 transition-all duration-300"
            style={{ width: `${amb.progress * 100}%` }}
          />
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-2 text-center font-mono">
        <div className="rounded border border-slate-700/60 bg-slate-900/60 p-1">
          <div className="text-[9px] uppercase tracking-wider text-slate-500">Std GPS</div>
          <div className="text-xs font-bold text-slate-300">{eta.standard}m</div>
        </div>
        <div className="rounded border border-emerald-500/40 bg-emerald-500/10 p-1">
          <div className="text-[9px] uppercase tracking-wider text-emerald-400">GreenWave</div>
          <div className="text-xs font-bold text-emerald-300">{eta.greenwave}m</div>
        </div>
        <div className="rounded border border-cyan-500/40 bg-cyan-500/10 p-1">
          <div className="text-[9px] uppercase tracking-wider text-cyan-400">Saved</div>
          <div className="text-xs font-bold text-cyan-300">{eta.saved}m</div>
        </div>
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <Timer className="h-3 w-3" /> {amb.elapsed.toFixed(1)}s sim
        </span>
        <span className="flex items-center gap-1 text-emerald-300 font-bold">
          <Gauge className="h-3 w-3" /> {amb.kmh} km/h
        </span>
      </div>
    </div>
  );
}

function FleetBreakdownCard({ stats, snap }) {
  const fc = stats.fleetCounts || {};
  const fs = stats.fleetShare || {};
  const amb = snap.ambulance;
  const sev = Math.max(5, stats.congestion);
  const eta = etaMinutes(snap.route, sev);

  const items = [
    { type: "bus", label: "Buses", icon: Bus, count: fc.bus || 0, share: fs.bus || 0, color: "text-emerald-400" },
    { type: "truck", label: "Trucks", icon: Truck, count: fc.truck || 0, share: fs.truck || 0, color: "text-amber-400" },
    { type: "auto", label: "Autos", icon: CarFront, count: fc.auto || 0, share: fs.auto || 0, color: "text-yellow-300" },
    { type: "bike", label: "Bikes", icon: Bike, count: fc.bike || 0, share: fs.bike || 0, color: "text-sky-400" },
    { type: "suv", label: "SUVs", icon: CarFront, count: fc.suv || 0, share: fs.suv || 0, color: "text-slate-300" },
    { type: "car", label: "Sedans", icon: CarFront, count: fc.car || 0, share: fs.car || 0, color: "text-cyan-300" },
  ];

  return (
    <div className="panel p-3.5">
      <div className="hud-label mb-2 flex items-center justify-between text-cyan-400">
        <span className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5" /> Fleet &amp; Congestion Breakdown
        </span>
        <span className="font-mono text-[9.5px] text-slate-500">PCU WEIGHTED</span>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <div key={it.type} className="rounded border border-slate-800 bg-slate-900/70 p-1.5 text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400">
                <Icon className={`h-3 w-3 ${it.color}`} />
                <span>{it.label}</span>
              </div>
              <div className="mt-0.5 font-mono text-sm font-bold text-slate-100">{it.count}</div>
              <div className="font-mono text-[9px] text-slate-500">{it.share}% load</div>
            </div>
          );
        })}
      </div>

      {/* Pothole & Road Hazard Delay Contribution Metrics */}
      <div className="mt-2 rounded border border-rose-500/30 bg-rose-500/10 p-2 font-mono text-[10.5px]">
        <div className="flex items-center justify-between text-rose-300 font-bold">
          <span className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Pothole &amp; Bumper Delay Penalty
          </span>
          <span>+{eta.hazardDelayMins}m GPS Delay</span>
        </div>
        <div className="mt-1 text-[9.5px] text-rose-200/80">
          Corridor crosses {eta.potholes} potholes &amp; {eta.bumpers} speed bumpers. Dynamic AI router chooses smoother roads to save {eta.saved} mins!
        </div>
      </div>

      {/* Traffic projection indicator */}
      {amb && (
        <div className="mt-2 rounded border border-emerald-500/40 bg-emerald-500/10 p-2 font-mono text-[11px] text-emerald-300">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-bold">
              <Radar className="h-3.5 w-3.5 animate-pulse" /> Traffic Projection Active
            </span>
            <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[9.5px]">36M BEAM</span>
          </div>
          <div className="mt-1 text-[10px] text-emerald-300/80">
            Ahead vehicles yielding to sidewalk curb and blinking amber hazards.
          </div>
        </div>
      )}
    </div>
  );
}

export default function WarRoom({ sim, active, onDispatch }) {
  const [snap, setSnap] = useState(() => sim.snapshot());
  const [viewMode, setViewMode] = useState("orbit");
  const [selectedBaseId, setSelectedBaseId] = useState(DISPATCH_BASES[0].id);

  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setSnap(sim.snapshot()), 250);
    return () => clearInterval(id);
  }, [active, sim]);

  const refresh = () => setSnap(sim.snapshot());

  const handleBaseChange = (baseId) => {
    setSelectedBaseId(baseId);
    const base = DISPATCH_BASES.find((b) => b.id === baseId) || DISPATCH_BASES[0];
    sim.activeBase = base;
    refresh();
  };

  const dispatchDynamic = () => {
    const base = DISPATCH_BASES.find((b) => b.id === selectedBaseId) || DISPATCH_BASES[0];
    const amb = sim.dispatchDynamic(base.node, `Dynamic AI Corridor (${base.name})`);
    setViewMode("chase"); // Automatically transition to chase-cam at street level
    const sev = Math.max(5, sim.stats.congestion);
    const eta = etaMinutes(amb.route, sev);
    onDispatch({
      incident_type: `Emergency Dispatch · ${base.name}`,
      sector: base.sector,
      congestion_severity: sev,
      optimal_corridor_path: routeNames(amb.route),
      estimated_time_saved_minutes: eta.saved,
      standard_eta_minutes: eta.standard,
      greenwave_eta_minutes: eta.greenwave,
      ai_dispatch_note: `A* Dynamic Router computed optimal ${amb.route.length}-junction corridor from ${base.street} avoiding pothole clusters and pre-flushing 3 signals ahead.`,
      source: "dynamic-ai-router",
    });
    refresh();
  };

  const dispatchRandomEmergency = () => {
    // Pick random congested node across the 15x15 grid
    const rx = 1 + Math.floor(Math.random() * 13);
    const rz = 1 + Math.floor(Math.random() * 13);
    const amb = sim.dispatchDynamic([rx, rz], `Unpredictable Emergency (${rx},${rz})`);
    setViewMode("chase");
    const sev = Math.max(5, sim.stats.congestion);
    const eta = etaMinutes(amb.route, sev);
    onDispatch({
      incident_type: `Emergency Hotspot (${rx},${rz})`,
      sector: "Sector Dynamic",
      congestion_severity: sev,
      optimal_corridor_path: routeNames(amb.route),
      estimated_time_saved_minutes: eta.saved,
      standard_eta_minutes: eta.standard,
      greenwave_eta_minutes: eta.greenwave,
      ai_dispatch_note: `Dynamic re-routing executed for incident at ${amb.route[0]}. Corridors vary in real time with traffic flow.`,
      source: "dynamic-ai-router",
    });
    refresh();
  };

  const s = snap.stats;
  const waveBanner = snap.corridorActive;

  return (
    <div className="relative h-full w-full overflow-hidden">
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
        <Minimap2D
          sim={sim}
          snap={snap}
          onClose={() => {
            sim.setShow2DMinimap(false);
            refresh();
          }}
        />
      )}

      {/* Atmospheric vignette */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(2,6,23,0.85))]" />
      <div className="scanlines pointer-events-none absolute inset-0 opacity-40" />

      {/* Green Wave active banner */}
      <div
        className={`pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 transition-all duration-500 ${
          waveBanner ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"
        }`}
      >
        <div className="flex items-center gap-2.5 rounded-full border border-emerald-400/60 bg-emerald-500/15 px-5 py-2 font-display text-sm font-semibold tracking-[0.18em] text-emerald-200 shadow-[0_0_40px_-6px_rgba(16,185,129,0.8)] backdrop-blur">
          <Waves className="h-4 w-4 animate-pulse" />
          {snap.manualOverride ? "MANUAL OVERRIDE · FULL CORRIDOR GREEN" : `GREEN WAVE ACTIVE · PRE-FLUSHING ${s.forced} JUNCTIONS AHEAD`}
        </div>
      </div>

      {/* Top Floating Controls: 24-Hour Time Controller + Camera Mode + Filters */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 hidden md:flex items-center gap-2.5 z-20">
        {/* 24-Hour Continuous Dynamic Time Controller */}
        <div className="flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/95 px-3 py-1.5 shadow-xl backdrop-blur">
          {/* Digital Clock Display */}
          <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-100">
            <Clock className="h-3.5 w-3.5 text-cyan-400" />
            <span>{snap.formattedTime?.display || "08:30 AM"}</span>
            <span className="hidden lg:inline text-[10px] font-normal text-slate-400 border-l border-slate-700 pl-1.5">
              {snap.formattedTime?.phase || "Morning Rush"}
            </span>
          </div>

          {/* Play / Pause Time Advancement */}
          <button
            type="button"
            onClick={() => {
              sim.setTimePaused(!snap.timePaused);
              refresh();
            }}
            title={snap.timePaused ? "Resume 24h clock" : "Pause 24h clock"}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
          >
            {snap.timePaused ? <Play className="h-3 w-3 text-emerald-400" /> : <Pause className="h-3 w-3 text-amber-400" />}
          </button>

          {/* 24-Hour Interactive Timeline Scrub Bar */}
          <div className="flex items-center gap-1.5 px-1">
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
              className="h-1.5 w-20 lg:w-28 accent-cyan-400 cursor-pointer bg-slate-700 rounded-lg"
              title="Scrub time across 24 hours"
            />
          </div>

          {/* Quick Preset Buttons */}
          <div className="hidden xl:flex items-center gap-1 border-l border-slate-800 pl-1.5">
            <button
              type="button"
              onClick={() => { sim.setHour(8.5); refresh(); }}
              className={`rounded px-1.5 py-0.5 font-mono text-[9.5px] transition ${
                Math.abs((snap.hour ?? 8.5) - 8.5) < 0.6 ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              08:30 Rush
            </button>
            <button
              type="button"
              onClick={() => { sim.setHour(13.0); refresh(); }}
              className={`rounded px-1.5 py-0.5 font-mono text-[9.5px] transition ${
                Math.abs((snap.hour ?? 8.5) - 13.0) < 0.6 ? "bg-sky-500/20 text-sky-300 font-bold border border-sky-500/40" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              13:00 Noon
            </button>
            <button
              type="button"
              onClick={() => { sim.setHour(18.2); refresh(); }}
              className={`rounded px-1.5 py-0.5 font-mono text-[9.5px] transition ${
                Math.abs((snap.hour ?? 8.5) - 18.2) < 0.6 ? "bg-orange-500/20 text-orange-300 font-bold border border-orange-500/40" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              18:15 Rush
            </button>
            <button
              type="button"
              onClick={() => { sim.setHour(1.5); refresh(); }}
              className={`rounded px-1.5 py-0.5 font-mono text-[9.5px] transition ${
                Math.abs((snap.hour ?? 8.5) - 1.5) < 1.0 ? "bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/40" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              01:30 Night
            </button>
          </div>

          {/* Random Unpredictable Surge Trigger */}
          <button
            type="button"
            onClick={() => {
              sim.triggerRandomSurge();
              refresh();
            }}
            title="Inject an unpredictable flash traffic jam (+220 vehicles)"
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] transition ${
              snap.unpredictableSurge
                ? "bg-rose-500/30 text-rose-300 border border-rose-500/50 animate-pulse shadow-[0_0_12px_rgba(244,63,94,0.6)]"
                : "border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
            }`}
          >
            <Flame className="h-3 w-3 text-amber-400" />
            {snap.unpredictableSurge ? `SURGE (${snap.surgeRemaining}s)` : "Surge"}
          </button>
        </div>

        {/* Camera angle toggle */}
        <div className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/90 p-1 shadow-lg backdrop-blur">
          <button
            type="button"
            onClick={() => setViewMode("chase")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs transition ${
              viewMode === "chase"
                ? "bg-cyan-500/25 border border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.5)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Video className="h-3.5 w-3.5" /> Chase Cam
          </button>
          <button
            type="button"
            onClick={() => setViewMode("drone")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs transition ${
              viewMode === "drone"
                ? "bg-cyan-500/25 border border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.5)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Eye className="h-3.5 w-3.5" /> Drone
          </button>
          <button
            type="button"
            onClick={() => setViewMode("orbit")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs transition ${
              viewMode === "orbit"
                ? "bg-cyan-500/25 border border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.5)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Crosshair className="h-3.5 w-3.5" /> Orbit
          </button>
        </div>

        {/* Dynamic Road Congestion Heatmap & 2D Radar Toggles */}
        <div className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/90 p-1 shadow-lg backdrop-blur">
          <button
            type="button"
            onClick={() => {
              sim.setShowTrafficFilter(!sim.showTrafficFilter);
              refresh();
            }}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs transition ${
              snap.showTrafficFilter
                ? "bg-emerald-500/25 border border-emerald-400 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="h-3.5 w-3.5 text-emerald-400" />
            Traffic Filter (Red/Yellow/Green)
          </button>
          <button
            type="button"
            onClick={() => {
              sim.setShow2DMinimap(!sim.show2DMinimap);
              refresh();
            }}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs transition ${
              snap.show2DMinimap
                ? "bg-cyan-500/25 border border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.5)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Map className="h-3.5 w-3.5 text-cyan-400" />
            2D Radar Map
          </button>
        </div>
      </div>

      {/* LEFT: control panel + dynamic routing origin */}
      <div className="pointer-events-none absolute bottom-4 left-4 top-4 flex w-[340px] flex-col gap-3">
        <div className="panel pointer-events-auto p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="hud-label flex items-center gap-2">
              <Radar className="h-3.5 w-3.5 text-cyan-400" /> 500×500 Signal Command
            </div>
            <span className="font-mono text-[10px] text-slate-500">961 JUNCTIONS · 900 BLOCKS</span>
          </div>

          {/* Dynamic Origin Selector */}
          <div className="mb-2.5 rounded-lg border border-slate-700/80 bg-slate-900/80 p-2">
            <label className="block font-mono text-[9.5px] uppercase tracking-wider text-slate-400">
              Emergency Origin Depot
            </label>
            <select
              value={selectedBaseId}
              onChange={(e) => handleBaseChange(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 focus:border-cyan-400 focus:outline-none"
            >
              {DISPATCH_BASES.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.sector}) · {b.street}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <CommandButton
              icon={Route}
              tone="rose"
              title="Dispatch Dynamic AI Route"
              subtitle="A* solves fastest path avoiding potholes"
              active={!!snap.ambulance && snap.ambulance.status !== "ARRIVED"}
              onClick={dispatchDynamic}
            />

            <CommandButton
              icon={Shuffle}
              tone="cyan"
              title="Spawn Random Emergency Scene"
              subtitle="Generates new path across unpredictable grid"
              onClick={dispatchRandomEmergency}
            />

            <CommandButton
              icon={CarFront}
              tone="amber"
              title="Simulate Rush Hour Gridlock"
              subtitle={snap.rushHour ? "Surge active · tap to clear" : "Inject 650 multi-modal vehicles"}
              active={snap.rushHour}
              onClick={() => {
                sim.setRushHour(!sim.rushHour);
                refresh();
              }}
            />

            <CommandButton
              icon={Waves}
              tone="emerald"
              title="Manual Green Wave Override"
              subtitle={snap.manualOverride ? "Corridor locked green · tap to release" : "Force entire corridor green"}
              active={snap.manualOverride}
              onClick={() => {
                sim.setManualOverride(!sim.manualOverride);
                refresh();
              }}
            />
          </div>

          <div className="mt-3 border-t border-slate-700/60 pt-2">
            <Switch
              on={snap.greenWaveAI}
              label="GreenWave AI pre-flush"
              hint="Turn green 3 junctions ahead of the ambulance"
              onClick={() => {
                sim.setGreenWaveAI(!sim.greenWaveAI);
                refresh();
              }}
            />
            <Switch
              on={snap.showHazards}
              label="Highlight Road Hazards"
              hint={`${ROAD_HAZARDS.bumpers.length} bumpers & ${ROAD_HAZARDS.potholes.length} potholes`}
              onClick={() => {
                sim.setShowHazards(!sim.showHazards);
                refresh();
              }}
            />
            <Switch
              on={snap.showTrafficFilter}
              label="Road Congestion Filter"
              hint="Color-code roads in Green (free), Yellow (busy), Red (gridlock)"
              onClick={() => {
                sim.setShowTrafficFilter(!sim.showTrafficFilter);
                refresh();
              }}
            />
            <Switch
              on={snap.show2DMinimap}
              label="Floating 2D Radar Minimap"
              hint="Tactical live radar tracking ambulance & road states"
              onClick={() => {
                sim.setShow2DMinimap(!sim.show2DMinimap);
                refresh();
              }}
            />
          </div>
        </div>

        <div className="panel pointer-events-auto hidden min-h-0 flex-1 flex-col p-4 md:flex">
          <div className="hud-label mb-2 flex items-center gap-2">
            <Terminal className="h-3.5 w-3.5 text-emerald-400" /> Corridor Event Log
          </div>
          <ul className="min-h-0 flex-1 space-y-1.5 overflow-hidden font-mono text-[11px] leading-snug">
            {snap.events.map((e) => (
              <li key={e.id} className={`animate-fade-in ${EVENT_STYLE[e.type] || "text-slate-400"}`}>
                <span className="text-slate-600">{e.at.toLocaleTimeString([], { hour12: false })} </span>
                {e.msg}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* RIGHT: telemetry + fleet breakdown + ambulance */}
      <div className="pointer-events-none absolute right-4 top-4 flex w-[325px] flex-col gap-2.5">
        <div className="panel pointer-events-auto p-3.5">
          <div className="hud-label mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-cyan-400" /> Live Telemetry
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> REALTIME
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat icon={CarFront} label="Vehicles" value={s.count} unit="fleet" />
            <Stat icon={Gauge} label="Avg speed" value={s.avgKmh} unit="km/h" tone="text-sky-300" />
            <Stat
              icon={TrafficCone}
              label="Congestion"
              value={s.congestion}
              unit="%"
              tone={s.congestion > 70 ? "text-rose-400" : s.congestion > 45 ? "text-amber-300" : "text-emerald-300"}
              bar={s.congestion}
            />
            <Stat icon={Zap} label="Forced green" value={s.forced} unit="signals" tone="text-emerald-300" />
          </div>
        </div>

        <div className="pointer-events-auto">
          <FleetBreakdownCard stats={s} snap={snap} />
        </div>

        <div className="pointer-events-auto">
          <AmbulanceCard snap={snap} viewMode={viewMode} setViewMode={setViewMode} />
        </div>
      </div>

      {/* BOTTOM: expanded legend */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 hidden -translate-x-1/2 2xl:block">
        <div className="panel flex items-center gap-3.5 px-4 py-2 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_6px_#f43f5e]" />
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
            <span>Traffic Signals (Strict Red / Green)</span>
          </span>
          <span className="flex items-center gap-1 border-l border-slate-700 pl-3">
            <Siren className="h-3.5 w-3.5 text-rose-400 animate-pulse" />
            <strong className="text-rose-300">Ambulance AMB-07</strong> (Active: {snap.ambulance ? "1" : "0"})
          </span>
          <span className="flex items-center gap-1 border-l border-slate-700 pl-3">
            <Bus className="h-3 w-3 text-emerald-400" /> Bus
          </span>
          <span className="flex items-center gap-1">
            <Truck className="h-3 w-3 text-amber-400" /> Truck
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-yellow-400" /> Auto
          </span>
          <span className="flex items-center gap-1">
            <Bike className="h-3 w-3 text-sky-400" /> Bike
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-slate-300" /> Sedan/SUV
          </span>
          <span className="flex items-center gap-1">
            <OctagonAlert className="h-3 w-3 text-yellow-400" /> Bumper
          </span>
          <span className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-rose-400" /> Pothole
          </span>
          <span className="flex items-center gap-1">
            <Hospital className="h-3 w-3 text-emerald-400" /> Hospital
          </span>
          <span className="flex items-center gap-1.5 border-l border-slate-700 pl-3">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="h-2 w-2 rounded-full bg-yellow-400" />
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <span className="text-slate-300">Congestion Heatmap (Free / Busy / Gridlock)</span>
          </span>
          <span className="flex items-center gap-1.5 border-l border-slate-700 pl-3 text-slate-500">
            <Crosshair className="h-3 w-3" /> Drag orbit · scroll zoom
          </span>
        </div>
      </div>
    </div>
  );
}
