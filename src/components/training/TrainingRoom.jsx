import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Download, Glasses, MapPin, Pause, Play, RotateCcw, Route, ShieldAlert, Timer, X } from "lucide-react";
import TrainingScene from "./TrainingScene";
import TrafficDecision, { UrgencyControl } from "../warroom/TrafficDecision";
import ComparisonTable, { seconds, downloadReport } from "./ComparisonTable";
import { MISSIONS, TrainingSession } from "../../lib/training";
import { ROAD_SEGMENTS, dirBetween, intersectionName, roadKey } from "../../lib/cityGrid";

const button = "inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-40";

export default function TrainingRoom({ active, onComplete }) {
  const [engine] = useState(() => new TrainingSession());
  const [snap, setSnap] = useState(() => engine.snapshot());
  const [seedInput, setSeedInput] = useState(String(engine.seed));
  const [xrSupport, setXRSupport] = useState("checking");
  const [xrError, setXRError] = useState("");
  const [xrBusy, setXRBusy] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [rendererReady, setRendererReady] = useState(false);
  const [showResults, setShowResults] = useState(true);
  const renderer = useRef(null), delivered = useRef(null);
  const onReady = useCallback((gl) => { renderer.current = gl; setRendererReady(!!gl); }, []);
  const onXRChange = useCallback((value) => { setImmersive(value); setXRBusy(false); }, []);
  const refresh = () => setSnap(engine.snapshot());
  const act = (fn) => { fn(); refresh(); };

  useEffect(() => {
    let cancelled = false;
    if (!window.isSecureContext) { setXRSupport("insecure"); return; }
    if (!navigator.xr) { setXRSupport("unavailable"); return; }
    navigator.xr.isSessionSupported("immersive-vr").then((supported) => {
      if (!cancelled) setXRSupport(supported ? "supported" : "unavailable");
    }).catch(() => { if (!cancelled) setXRSupport("unavailable"); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!active) {
      if (engine.phase === "running") engine.paused = true;
      renderer.current?.xr.getSession()?.end().catch(() => {});
      return;
    }
    const tick = () => {
      setSnap(engine.snapshot());
      if (engine.result && delivered.current !== engine.result.id) {
        delivered.current = engine.result.id;
        setShowResults(true);
        onComplete(engine.result);
      }
    };
    tick();
    const id = setInterval(tick, 160);
    return () => clearInterval(id);
  }, [active, engine, onComplete]);

  const enterXR = async () => {
    const gl = renderer.current;
    if (!gl || xrBusy) return;
    if (gl.xr.isPresenting) { await gl.xr.getSession()?.end(); return; }
    setXRBusy(true); setXRError("");
    let session;
    try {
      session = await navigator.xr.requestSession("immersive-vr", { requiredFeatures: ["local-floor"] });
      gl.xr.enabled = true;
      await gl.xr.setSession(session);
    } catch (error) {
      await session?.end().catch(() => {});
      if (!gl.xr.isPresenting) gl.xr.enabled = false;
      setXRError(`XR session could not start: ${error.message || "Check your headset connection and browser permissions."}`);
      setXRBusy(false);
    }
  };

  const reset = (missionId = snap.mission.id, seed = engine.seed) => {
    engine.prepare(missionId, seed); setSeedInput(String(engine.seed)); setShowResults(true); refresh();
  };
  const planning = snap.phase === "planning" || snap.pendingReroute;
  const selectedPlan = snap.plans.find((p) => p.id === snap.selectedPlan);
  const selectedRoad = snap.selectedRoad;
  const inspectedClosed = selectedRoad && snap.closedSegments.includes(selectedRoad.key);
  const routeKeys = new Set((selectedPlan?.route || []).slice(1).map((b, i) => roadKey(...selectedPlan.route[i], dirBetween(selectedPlan.route[i], b))));
  const inspectableRoads = ROAD_SEGMENTS.filter((s) => routeKeys.has(`${s.ix},${s.iz},${s.axis}`) || `${s.ix},${s.iz},${s.axis}` === selectedRoad?.key);
  const result = snap.result;

  return <div className="flex h-full flex-col bg-[#07111e]">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/80 px-5 py-3">
      <div><div className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-300">Emergency response training</div>
        <h1 className="mt-0.5 font-display text-xl font-semibold text-white">Your decisions. Measured impact.</h1>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden text-[11px] text-slate-400 sm:block">{immersive ? "XR tabletop active" : xrSupport === "supported" ? "Headset ready" : "Desktop mode ready"}</span>
        <button type="button" onClick={enterXR} disabled={!rendererReady || xrBusy || (xrSupport !== "supported" && !immersive)}
          className={`${button} border-cyan-400/50 bg-cyan-500/15 text-cyan-100`}>
          <Glasses className="h-4 w-4" />{xrBusy ? "Connecting…" : immersive ? "Exit XR" : "Enter XR"}
        </button>
      </div>
    </header>
    {xrError && <p role="alert" className="border-b border-amber-600/40 bg-amber-950/40 px-5 py-2 text-xs text-amber-200">{xrError}</p>}
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
      <aside aria-label="Mission planning" className="order-2 flex w-full shrink-0 flex-col border-t border-slate-800 bg-slate-950/60 md:order-1 md:min-h-0 md:w-[310px] md:border-r md:border-t-0 lg:w-[330px]">
        <div className="space-y-4 p-4 md:min-h-0 md:flex-1 md:overflow-y-auto">
        <section><div className="mb-2 flex items-center justify-between"><h2 className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Choose a mission</h2><span className="font-mono text-[10px] text-slate-500">01—03</span></div>
          <div className="space-y-1.5">{MISSIONS.map((mission, i) => <button type="button" key={mission.id}
            aria-pressed={snap.mission.id === mission.id} disabled={snap.phase === "running"} onClick={() => reset(mission.id)}
            className={`flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition disabled:cursor-not-allowed ${snap.mission.id === mission.id ? "border-cyan-400/60 bg-cyan-500/10" : "border-slate-800 bg-slate-900/50 hover:border-slate-600"}`}>
            <span className={`font-mono text-sm ${snap.mission.id === mission.id ? "text-cyan-300" : "text-slate-600"}`}>0{i + 1}</span>
            <span><span className="block text-xs font-semibold text-slate-100">{mission.title}</span><span className="mt-0.5 block text-[10px] text-slate-400">{mission.subtitle}</span></span>
          </button>)}</div>
        </section>
        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
          <h2 className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-emerald-200"><ShieldAlert className="h-3.5 w-3.5" /> Mission objective</h2>
          <p className="text-[11px] leading-relaxed text-slate-300">{snap.mission.objective}</p>
          <div className="mt-2 flex items-center justify-between border-t border-slate-800 pt-2 text-[10px] text-slate-400"><span>{snap.mission.vehicles} seeded vehicles</span><span>Target {snap.mission.targetSeconds} s</span></div>
        </section>
        <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
          <UrgencyControl value={snap.urgency} onChange={(value) => act(() => engine.setUrgency(value))} disabled={snap.phase === "results"} />
        </section>
        <TrafficDecision decision={snap.decision} simTime={engine.coordinated.time} compact />
        <section>
          <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">1. Inspect the incident</h2>
          <button type="button" onClick={() => act(() => engine.selectIncident())} disabled={snap.phase !== "planning"}
            className={`${button} w-full ${snap.selectedIncident ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200" : "border-rose-400/50 bg-rose-500/10 text-rose-200"}`}>
            {snap.selectedIncident ? <Check className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}{snap.selectedIncident ? "Incident selected" : "Select incident"}
          </button><p className="mt-1.5 text-[10px] text-slate-500">{intersectionName(...snap.mission.origin)} → St. Aurora</p>
        </section>
        <section>
          <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">2. Choose your corridor</h2>
          <div className="space-y-1.5">{snap.plans.map((p) => <button type="button" key={p.id} aria-pressed={p.id === snap.selectedPlan}
            disabled={!planning || !p.route.length} onClick={() => act(() => engine.choosePlan(p.id))}
            className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-[11px] transition disabled:cursor-not-allowed disabled:opacity-40 ${p.id === snap.selectedPlan ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-200" : "border-slate-800 text-slate-300 hover:border-slate-500"}`}>
            <span>{p.label}</span><span className="shrink-0 font-mono text-[10px]">{p.route.length ? `${p.route.length - 1} roads` : "CLOSED"}</span>
          </button>)}</div>
        </section>
        <section className="rounded-lg border border-slate-800 p-3">
          <label htmlFor="inspect-road" className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Road inspector</label>
          <select id="inspect-road" value={selectedRoad?.key || ""} onChange={(e) => { const s = ROAD_SEGMENTS.find((s) => `${s.ix},${s.iz},${s.axis}` === e.target.value); if (s) act(() => engine.selectRoad(s)); }}
            className="mt-2 w-full rounded border border-slate-700 bg-slate-950 p-2 text-[11px] text-slate-200">
            <option value="" disabled>Click a road or inspect one here</option>
            {inspectableRoads.map((s) => <option key={`${s.ix},${s.iz},${s.axis}`} value={`${s.ix},${s.iz},${s.axis}`}>{intersectionName(s.ix, s.iz)} · {s.axis === 0 ? "east" : "south"}</option>)}
          </select>
          {selectedRoad && <><p className={`mt-2 text-[11px] ${inspectedClosed ? "text-rose-300" : "text-amber-200"}`}>{inspectedClosed ? "Closed to new traffic" : `${engine.sim.getRoadStatus(selectedRoad.ix, selectedRoad.iz, selectedRoad.axis).toUpperCase()} traffic · ${selectedRoad.bridge ? "river crossing" : "city street"}`}</p>
            <button type="button" disabled={!planning || inspectedClosed} onClick={() => act(() => engine.planViaSelectedRoad())} className={`${button} mt-2 w-full border-amber-500/30 text-amber-200`}>Route via inspected road</button></>}
        </section>
        <div className="flex items-end gap-2 border-t border-slate-800 pt-3">
          <label className="min-w-0 flex-1 text-[10px] text-slate-400">Scenario seed<input aria-label="Scenario seed" type="number" min="0" max="4294967295" step="1" value={seedInput}
            disabled={snap.phase === "running"} onChange={(e) => setSeedInput(e.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 font-mono text-xs text-slate-200" /></label>
          <button type="button" disabled={snap.phase === "running" || seedInput === "" || !Number.isInteger(Number(seedInput)) || Number(seedInput) < 0 || Number(seedInput) > 4294967295}
            onClick={() => reset(snap.mission.id, Number(seedInput))} className={`${button} border-slate-700 text-slate-300`}>Load seed</button>
        </div>
        <details className="text-[11px] text-slate-400"><summary className="cursor-pointer text-cyan-200">XR setup & desktop controls</summary>
          <p className="mt-2 leading-relaxed">Open this app over HTTPS in a WebXR headset browser, or use a connected headset on this computer. Choose Enter XR, then point and press the controller trigger to select incidents, roads, routes, and corridor controls.</p>
          <p className="mt-2 leading-relaxed">Desktop: drag to orbit, scroll to zoom, right-drag to pan. Every mission also works with the controls in this panel. {xrSupport === "insecure" ? "This HTTP address cannot start XR; use HTTPS." : xrSupport === "unavailable" ? "No immersive XR device is available in this browser." : ""}</p>
        </details>
        </div>
        <section className="shrink-0 border-t border-slate-800 bg-slate-950 p-4">
          <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">3. Activate and compare</h2>
          <button type="button" disabled={!planning || !snap.selectedIncident || !selectedPlan?.route.length}
            onClick={() => act(() => engine.activate())} className={`${button} w-full border-emerald-300/70 bg-emerald-400 px-3 py-3 text-slate-950 hover:bg-emerald-300`}>
            <Play className="h-4 w-4" />{snap.pendingReroute ? "Reactivate revised corridor" : "Activate corridor & start"}
          </button>
        </section>
      </aside>
      <div className="order-1 flex min-h-[360px] min-w-0 flex-1 flex-col md:order-2 md:min-h-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/40 px-4 py-2">
          <div role="group" aria-label="View simulation" className="flex rounded-lg border border-slate-700 p-0.5">{[["coordinated", "Your corridor"], ["baseline", "Ordinary signals"]].map(([id, label]) => <button type="button" key={id} aria-pressed={snap.view === id}
            onClick={() => act(() => engine.view = id)} className={`rounded-md px-3 py-1.5 text-[11px] ${snap.view === id ? "bg-cyan-500/20 text-cyan-200" : "text-slate-400 hover:text-white"}`}>{label}</button>)}</div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 font-mono text-xs text-slate-200"><Timer className="h-3.5 w-3.5 text-cyan-300" />{snap.elapsed.toFixed(1)} s</span>
            <select aria-label="Simulation speed" value={snap.speed} onChange={(e) => act(() => engine.speed = Number(e.target.value))} className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200">{[1, 2, 4, 8].map((speed) => <option key={speed} value={speed}>{speed}× speed</option>)}</select>
            <button type="button" aria-label={snap.paused ? "Resume mission" : "Pause mission"} disabled={snap.phase !== "running"} onClick={() => act(() => engine.paused = !engine.paused)} className={`${button} border-slate-700 p-1.5 text-slate-200`}>{snap.paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}</button>
            <button type="button" aria-label="Reset mission with same seed" onClick={() => reset()} className={`${button} border-slate-700 p-1.5 text-slate-200`}><RotateCcw className="h-3.5 w-3.5" /></button>
          </div>
        </div>
        <div className="relative min-h-[300px] flex-1">
          <TrainingScene engine={engine} snap={snap} active={active} onReady={onReady} onXRChange={onXRChange} />
          <div className={`pointer-events-none absolute left-3 right-3 top-3 flex items-start gap-2 rounded-lg border p-3 backdrop-blur-md ${snap.pendingReroute ? "border-rose-400/60 bg-rose-950/90 text-rose-100" : "border-slate-600/40 bg-slate-950/80 text-slate-200"}`} role="status">
            <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${snap.pendingReroute ? "animate-pulse bg-rose-400" : "bg-emerald-400"}`} />
            <p className="text-xs leading-relaxed">{snap.paused && snap.phase === "running" ? `Paused. ${snap.message}` : snap.message}</p>
          </div>
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-slate-700/50 bg-slate-950/80 px-3 py-2 font-mono text-[10px] text-slate-400">SEED {snap.seed} <span className="mx-2 text-slate-600">/</span> STATE {snap.fingerprint}</div>
          {result && showResults && <div className="absolute inset-0 flex items-center justify-center overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-sm">
            <section aria-label="Mission results" className="my-auto w-full max-w-lg rounded-2xl border border-cyan-500/30 bg-[#0b1929] p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-3"><div><div className="text-[10px] uppercase tracking-widest text-cyan-300">Measured results · seed {result.seed}</div><h2 className="mt-1 font-display text-xl font-semibold text-white">{result.passed ? "Mission accomplished" : "Review and try again"}</h2></div><button type="button" aria-label="Close results overlay" onClick={() => setShowResults(false)} className="rounded p-1 text-slate-400 hover:text-white"><X className="h-4 w-4" /></button></div>
              <p className="my-3 text-xs leading-relaxed text-slate-400">{result.secondsSaved == null ? "One or both ambulances did not arrive within the 480 s simulation limit." : `${Math.abs(result.secondsSaved).toFixed(1)} simulation seconds ${result.secondsSaved >= 0 ? "saved" : "longer"} for the ambulance. Other drivers had ${Math.abs(result.trafficDelayChangeSeconds).toFixed(2)} s ${result.trafficDelayChangeSeconds >= 0 ? "more" : "less"} delay per vehicle.`}</p>
              <ComparisonTable baseline={result.baseline} coordinated={result.coordinated} finished />
              <p className="mt-3 text-[10px] leading-relaxed text-slate-500">Both measured over {seconds(result.horizonSeconds)}. Same starting traffic, signals, route, closures, and speed limit. {result.reactionSeconds != null && `Your response took ${seconds(result.reactionSeconds)}.`}</p>
              <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => reset()} className={`${button} border-emerald-400/50 bg-emerald-500/15 text-emerald-200`}><RotateCcw className="h-3.5 w-3.5" />Retry same seed</button><button type="button" onClick={() => downloadReport(result)} className={`${button} border-slate-600 text-slate-200`}><Download className="h-3.5 w-3.5" />Export measured report</button>
                <button type="button" onClick={() => reset(MISSIONS[(MISSIONS.findIndex((m) => m.id === snap.mission.id) + 1) % MISSIONS.length].id)} className={`${button} border-cyan-500/40 text-cyan-200`}>Next mission<ArrowRight className="h-3.5 w-3.5" /></button></div>
            </section>
          </div>}
        </div>
        <section aria-label="Live measured comparison" className="border-t border-slate-800 bg-slate-950/80 px-4 py-3">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2"><h2 className="text-[10px] font-semibold uppercase tracking-widest text-cyan-300">{snap.phase === "planning" ? "Comparison ready" : "Live measured comparison"}</h2><span className="text-[10px] text-slate-500">Paired starting state · common observation window</span></div>
          {snap.phase === "planning" ? <p className="py-2 text-xs leading-relaxed text-slate-400">Both runs begin when you activate your corridor. All results come from vehicle motion and elapsed simulation time.</p> : <ComparisonTable baseline={snap.baseline} coordinated={snap.coordinated} finished={snap.phase === "results"} />}
          {result && !showResults && <button type="button" onClick={() => setShowResults(true)} className="mt-2 text-xs text-cyan-300 underline">Reopen mission results</button>}
        </section>
      </div>
    </div>
  </div>;
}
