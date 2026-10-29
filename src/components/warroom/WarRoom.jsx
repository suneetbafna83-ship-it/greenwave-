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
  Cpu,
  MapPin,
  Timer,
  Zap,
  Terminal,
  Hospital,
} from "lucide-react";
import CityScene from "./CityScene";
import { DEFAULT_ROUTE, etaMinutes, routeNames } from "../../lib/cityGrid";

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
  };
  const activeTones = {
    rose: "bg-rose-500/15 border-rose-400",
    amber: "bg-amber-500/15 border-amber-400",
    emerald: "bg-emerald-500/15 border-emerald-400",
  };
  return (
    <button
      onClick={onClick}
      className={`group relative flex w-full items-start gap-3 rounded-lg border bg-slate-900/60 px-3 py-2.5 text-left transition-all active:scale-[0.98] ${tones[tone]} ${
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

function AmbulanceCard({ snap }) {
  const amb = snap.ambulance;
  const sev = Math.max(5, snap.stats.congestion);
  const eta = etaMinutes(snap.route, sev);

  if (!amb) {
    return (
      <div className="panel p-4">
        <div className="hud-label flex items-center gap-2">
          <Siren className="h-3.5 w-3.5" /> Unit AMB-07
        </div>
        <div className="mt-2 font-display text-lg text-slate-300">Standby at Sector 4</div>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Trigger a critical dispatch to watch GreenWave pre-flush signals three junctions ahead of the ambulance.
        </p>
        {snap.lastTrip && (
          <div className="mt-3 rounded-md border border-cyan-500/30 bg-cyan-500/5 p-2.5 font-mono text-[11px] text-cyan-200">
            LAST RUN · {snap.lastTrip.seconds.toFixed(1)}s sim transit · {snap.lastTrip.corridor ? "GreenWave corridor" : "standard signals"}
          </div>
        )}
      </div>
    );
  }

  const statusTone =
    amb.status === "ARRIVED" ? "bg-cyan-500/20 text-cyan-200 border-cyan-400/50" : amb.status === "HELD" ? "bg-amber-500/20 text-amber-200 border-amber-400/50" : "bg-rose-500/20 text-rose-200 border-rose-400/50";

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <div className="hud-label flex items-center gap-2">
          <Siren className="h-3.5 w-3.5 text-rose-400" /> Unit AMB-07
        </div>
        <span className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold tracking-widest ${statusTone}`}>{amb.status}</span>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-sm text-slate-200">
        <MapPin className="h-3.5 w-3.5 text-cyan-400" />
        <span className="truncate">{amb.location}</span>
      </div>
      <div className="mt-3">
        <div className="flex justify-between font-mono text-[10.5px] text-slate-400">
          <span>
            JUNCTIONS {amb.cleared}/{amb.total}
          </span>
          <span>{Math.round(amb.progress * 100)}%</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 transition-all duration-300"
            style={{ width: `${amb.progress * 100}%` }}
          />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded border border-slate-700/60 bg-slate-900/60 p-1.5">
          <div className="text-[9.5px] uppercase tracking-wider text-slate-500">Std GPS</div>
          <div className="font-mono text-sm font-bold text-slate-300">{eta.standard}m</div>
        </div>
        <div className="rounded border border-emerald-500/40 bg-emerald-500/10 p-1.5">
          <div className="text-[9.5px] uppercase tracking-wider text-emerald-400">GreenWave</div>
          <div className="font-mono text-sm font-bold text-emerald-300">{eta.greenwave}m</div>
        </div>
        <div className="rounded border border-cyan-500/40 bg-cyan-500/10 p-1.5">
          <div className="text-[9.5px] uppercase tracking-wider text-cyan-400">Saved</div>
          <div className="font-mono text-sm font-bold text-cyan-300">{eta.saved}m</div>
        </div>
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10.5px] text-slate-500">
        <span className="flex items-center gap-1">
          <Timer className="h-3 w-3" /> {amb.elapsed.toFixed(1)}s sim
        </span>
        <span className="flex items-center gap-1">
          <Gauge className="h-3 w-3" /> {amb.kmh} km/h
        </span>
      </div>
    </div>
  );
}

export default function WarRoom({ sim, active, onDispatch }) {
  const [snap, setSnap] = useState(() => sim.snapshot());
  const [follow, setFollow] = useState(false);

  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setSnap(sim.snapshot()), 250);
    return () => clearInterval(id);
  }, [active, sim]);

  const refresh = () => setSnap(sim.snapshot());

  const dispatch = () => {
    sim.dispatch(DEFAULT_ROUTE, "Critical Ambulance Dispatch");
    const sev = Math.max(5, sim.stats.congestion);
    const eta = etaMinutes(DEFAULT_ROUTE, sev);
    onDispatch({
      incident_type: "Critical Ambulance Dispatch",
      sector: "Sector 4",
      congestion_severity: sev,
      optimal_corridor_path: routeNames(DEFAULT_ROUTE),
      estimated_time_saved_minutes: eta.saved,
      standard_eta_minutes: eta.standard,
      greenwave_eta_minutes: eta.greenwave,
      ai_dispatch_note: `GreenWave AI pre-flushing 3 junctions ahead of AMB-07 via Ring Rd → Central Ave → Hospital Ave${
        sim.rushHour ? " under rush-hour gridlock" : ""
      }.`,
      source: "war-room",
    });
    refresh();
  };

  const s = snap.stats;
  const waveBanner = snap.corridorActive;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0">
        <CityScene sim={sim} active={active} follow={follow} routeVersion={snap.routeVersion} />
      </div>

      {/* vignette + scanline atmosphere */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(2,6,23,0.85))]" />
      <div className="scanlines pointer-events-none absolute inset-0 opacity-40" />

      {/* green wave banner */}
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

      {/* LEFT: control panel + event feed */}
      <div className="pointer-events-none absolute bottom-4 left-4 top-4 flex w-[330px] flex-col gap-3">
        <div className="panel pointer-events-auto p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="hud-label flex items-center gap-2">
              <Radar className="h-3.5 w-3.5 text-cyan-400" /> Signal Command
            </div>
            <span className="font-mono text-[10px] text-slate-500">49 JUNCTIONS</span>
          </div>
          <div className="space-y-2">
            <CommandButton
              icon={Siren}
              tone="rose"
              title="Trigger Critical Ambulance Dispatch (Sector 4)"
              subtitle="Sector 4 → St. Aurora Medical"
              active={!!snap.ambulance && snap.ambulance.status !== "ARRIVED"}
              onClick={dispatch}
            />
            <CommandButton
              icon={CarFront}
              tone="amber"
              title="Simulate Heavy Rush Hour Gridlock"
              subtitle={snap.rushHour ? "Surge active · tap to clear" : "Inject ×2 vehicle demand"}
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
            <Switch on={follow} label="Track ambulance camera" hint="Chase-cam follows AMB-07" onClick={() => setFollow((f) => !f)} />
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

      {/* RIGHT: telemetry + ambulance */}
      <div className="pointer-events-none absolute right-4 top-4 flex w-[300px] flex-col gap-3">
        <div className="panel pointer-events-auto p-4">
          <div className="hud-label mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-cyan-400" /> Live Telemetry
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> REALTIME
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat icon={CarFront} label="Vehicles" value={s.count} unit="active" />
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
          <AmbulanceCard snap={snap} />
        </div>
      </div>

      {/* BOTTOM: legend */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 hidden -translate-x-1/2 lg:block">
        <div className="panel flex items-center gap-4 px-4 py-2 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-slate-100" />
            <span className="-ml-1 h-2.5 w-2.5 rounded-sm bg-sky-400" /> Civilian
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-rose-500 shadow-[0_0_8px_#f43f5e]" /> Ambulance
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> Yielding
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm bg-emerald-400/60" /> Green corridor
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-emerald-300" /> Pre-flushed signal
          </span>
          <span className="flex items-center gap-1.5">
            <Hospital className="h-3 w-3 text-emerald-400" /> Hospital
          </span>
          <span className="flex items-center gap-1.5 border-l border-slate-700 pl-4 text-slate-500">
            <Crosshair className="h-3 w-3" /> Drag to orbit · scroll to zoom
          </span>
          <span className="flex items-center gap-1.5 text-slate-500">
            <Cpu className="h-3 w-3" /> R3F digital twin
          </span>
        </div>
      </div>
    </div>
  );
}
