import { useMemo, useState } from "react";
import { BarChart3, Download, Database, RefreshCw, Play, RotateCcw, AlertCircle } from "lucide-react";
import ComparisonTable, { seconds, downloadReport } from "../training/ComparisonTable";
import { routeFromNames, ROAD_LAYOUT_VERSION } from "../../lib/cityGrid";

const button = "inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 transition hover:border-cyan-400 disabled:opacity-40";
const mean = (rows, get) => rows.length ? rows.reduce((sum, row) => sum + get(row), 0) / rows.length : null;

function exportCsv(rows) {
  const keys = ["mission", "map_revision", "seed", "initial_state", "ordinary_journey_s", "corridor_journey_s", "ordinary_ambulance_stopped_s", "corridor_ambulance_stopped_s", "ordinary_delay_per_vehicle_s", "corridor_delay_per_vehicle_s", "observation_window_s", "seconds_saved", "passed"];
  const data = rows.map((r) => [r.missionTitle, r.layoutVersion || "legacy grid", r.seed, r.initialFingerprint, r.baseline.travelSeconds, r.coordinated.travelSeconds,
    r.baseline.ambulanceStoppedSeconds, r.coordinated.ambulanceStoppedSeconds, r.baseline.averageVehicleDelaySeconds,
    r.coordinated.averageVehicleDelaySeconds, r.horizonSeconds, r.secondsSaved, r.passed]);
  const quote = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const csv = [keys, ...data].map((row) => row.map(quote).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a"); a.href = url; a.download = "greenwave-measured-missions.csv";
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function AnalyticsPanel({ trainingResults = [], records = [], dataSource, syncError, loading,
  onRefresh, onResetDemoData, onReplayCorridor }) {
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const paired = trainingResults.filter((r) => r.layoutVersion === ROAD_LAYOUT_VERSION && r.baseline.arrived && r.coordinated.arrived);
  const report = trainingResults.find((r) => r.id === selectedId) || trainingResults[0];
  const baselineMean = mean(paired, (r) => r.baseline.travelSeconds);
  const corridorMean = mean(paired, (r) => r.coordinated.travelSeconds);
  const savedMean = mean(paired, (r) => r.secondsSaved);
  const filtered = useMemo(() => records.filter((r) => `${r.incident_type} ${r.sector} ${r.ai_dispatch_note}`.toLowerCase().includes(query.toLowerCase())), [records, query]);
  return <div className="h-full overflow-y-auto bg-slate-950 px-4 py-6 md:px-8">
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div><div className="hud-label flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Simulation evidence</div>
          <h1 className="mt-1 font-display text-2xl font-semibold text-white">Measured mission results</h1>
          <p className="mt-1 text-xs text-slate-400">Recorded vehicle motion and elapsed simulation time. Training reports are saved on this browser.</p></div>
        <button type="button" disabled={!trainingResults.length} onClick={() => exportCsv(trainingResults)} className={button}><Download className="h-4 w-4" />Export measured CSV ({trainingResults.length})</button>
      </header>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
        ["Completed comparisons", String(paired.length), "text-slate-100"],
        ["Ordinary signals · mean", seconds(baselineMean), "text-rose-200"],
        ["Your corridor · mean", seconds(corridorMean), "text-emerald-200"],
        ["Ambulance time saved · mean", seconds(savedMean), savedMean < 0 ? "text-amber-200" : "text-cyan-200"],
      ].map(([label, value, tone]) => <div key={label} className="panel p-4"><div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div><div className={`mt-2 font-mono text-2xl ${tone}`}>{value}</div></div>)}</div>
      <p className="text-[11px] text-slate-500">Means include paired arrivals on the current {ROAD_LAYOUT_VERSION} map. Older maps remain in session history. These simulation results are not a calibrated real-world benchmark.</p>
      {!report ? <div className="panel p-8 text-center"><h2 className="font-display text-lg text-slate-100">Your first mission will create the evidence.</h2><p className="mt-2 text-sm text-slate-400">Open XR Mission Training, select an incident, and activate a corridor. Results appear after both ambulances finish or the simulation reaches its 480 s limit.</p></div> : <>
        <section className="panel p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-lg text-slate-100">{report.missionTitle}</h2><p className="mt-1 font-mono text-[10px] text-slate-500">{report.layoutVersion || "legacy grid"} · Seed {report.seed} · Initial state {report.initialFingerprint} · {report.fleetSize} vehicles · {seconds(report.horizonSeconds)} observation window</p></div>
            <button type="button" onClick={() => downloadReport(report)} className={button}><Download className="h-3.5 w-3.5" />Full report & decisions</button></div>
          <ComparisonTable baseline={report.baseline} coordinated={report.coordinated} finished />
          <div className="mt-4 grid gap-3 text-xs sm:grid-cols-3"><p className={report.passed ? "text-emerald-300" : "text-amber-300"}>{report.passed ? "Objective achieved" : "Objective not achieved"} · target {report.targetSeconds} s</p><p className="text-slate-300">Civilian delay change: {report.trafficDelayChangeSeconds > 0 ? "+" : ""}{seconds(report.trafficDelayChangeSeconds)} / vehicle</p><p className="text-slate-300">Obstruction response: {seconds(report.reactionSeconds)}</p></div>
          <details className="mt-4 rounded-lg border border-slate-700 p-3 text-xs text-slate-400"><summary className="cursor-pointer text-cyan-200">Measurement method & recorded decisions</summary><p className="my-3 leading-relaxed">{report.method}</p><ol className="space-y-1 font-mono text-[11px]">{report.actions.map((a, i) => <li key={i}>{a.seconds.toFixed(2)} s · {a.type} · {a.detail}</li>)}</ol></details>
        </section>
        <section className="panel overflow-x-auto p-5"><h2 className="mb-3 font-display text-base text-slate-200">Saved training sessions</h2>
          <table className="w-full text-left text-xs"><thead><tr className="border-b border-slate-700 text-[10px] uppercase tracking-wider text-slate-500"><th className="py-2">Mission</th><th>Seed</th><th>Ordinary</th><th>Corridor</th><th>Outcome</th><th><span className="sr-only">View report</span></th></tr></thead>
            <tbody>{trainingResults.map((r) => <tr key={r.id} className={`border-b border-slate-800 ${r.id === report.id ? "bg-cyan-500/5" : ""}`}><td className="py-3 pr-3 text-slate-200">{r.missionTitle}</td><td className="pr-3 font-mono text-slate-400">{r.seed}</td><td className="pr-3 font-mono text-slate-300">{seconds(r.baseline.travelSeconds)}</td><td className="pr-3 font-mono text-emerald-200">{seconds(r.coordinated.travelSeconds)}</td><td className={`pr-3 ${r.passed ? "text-emerald-300" : "text-amber-300"}`}>{r.passed ? "Passed" : "Retry"}</td><td><button type="button" onClick={() => setSelectedId(r.id)} className="rounded px-2 py-1 text-cyan-300 hover:bg-cyan-500/10">View<span className="sr-only"> {r.missionTitle} seed {r.seed}</span></button></td></tr>)}</tbody>
          </table>
        </section>
      </>}
      <section className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-lg text-slate-200">Dispatch estimate ledger</h2><p className="mt-1 text-[11px] text-slate-500">Legacy War Room / scene-assessment records, including demo data. These estimates are separate from measured training results.</p></div><div className="flex items-center gap-2"><span className="flex items-center gap-1 text-[10px] text-slate-500"><Database className="h-3 w-3" />{dataSource === "supabase" ? "Supabase" : "Local ledger"}</span><button type="button" onClick={onRefresh} className={button}><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />Sync</button></div></div>
        {syncError && <p className="mt-3 flex items-center gap-2 text-xs text-amber-200"><AlertCircle className="h-3.5 w-3.5" />{syncError}</p>}
        <input aria-label="Search dispatch estimates" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search dispatch estimates…" className="my-4 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200" />
        <div className="max-h-72 space-y-2 overflow-y-auto">{filtered.map((r) => <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2 text-xs"><div><p className="text-slate-200">{r.incident_type}</p><p className="mt-1 text-[10px] text-slate-500">{r.sector} · estimated saving: {Number(r.estimated_time_saved_minutes || 0).toFixed(1)} min · {r.source || "demo"}</p></div><button type="button" className={button} onClick={() => onReplayCorridor({ route: routeFromNames(r.optimal_corridor_path), label: r.incident_type })}><Play className="h-3 w-3" />Replay in War Room</button></div>)}</div>
        <button type="button" onClick={onResetDemoData} className="mt-4 inline-flex items-center gap-2 text-[11px] text-slate-500 hover:text-slate-300"><RotateCcw className="h-3 w-3" />Reset demo dispatch ledger</button>
      </section>
    </div>
  </div>;
}
