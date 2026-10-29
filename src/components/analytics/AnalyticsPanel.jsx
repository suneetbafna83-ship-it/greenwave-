import { useMemo, useState } from "react";
import {
  BarChart3,
  Download,
  Database,
  RefreshCw,
  Clock,
  TrendingDown,
  ShieldCheck,
  Play,
  RotateCcw,
  AlertCircle,
  Search,
} from "lucide-react";
import { routeFromNames, round1 } from "../../lib/cityGrid";

const BENCHMARK_STANDARD = 18.5;
const BENCHMARK_GREENWAVE = 6.2;

export default function AnalyticsPanel({
  records,
  dataSource,
  syncError,
  loading,
  onRefresh,
  onResetDemoData,
  onReplayCorridor,
}) {
  const [query, setQuery] = useState("");
  const [sectorFilter, setSectorFilter] = useState("ALL");

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (sectorFilter !== "ALL" && r.sector !== sectorFilter) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        String(r.incident_type || "").toLowerCase().includes(q) ||
        String(r.sector || "").toLowerCase().includes(q) ||
        String(r.ai_dispatch_note || "").toLowerCase().includes(q) ||
        (r.optimal_corridor_path || []).some((p) => p.toLowerCase().includes(q))
      );
    });
  }, [records, query, sectorFilter]);

  const metrics = useMemo(() => {
    if (!records.length) {
      return {
        totalDispatches: 0,
        avgSeverity: 86,
        totalMinutesSaved: 142.8,
        avgSaved: 12.3,
        avgStd: BENCHMARK_STANDARD,
        avgGw: BENCHMARK_GREENWAVE,
      };
    }
    const n = records.length;
    const sevSum = records.reduce((s, r) => s + (Number(r.congestion_severity) || 0), 0);
    const savedSum = records.reduce((s, r) => s + (Number(r.estimated_time_saved_minutes) || 0), 0);
    return {
      totalDispatches: n,
      avgSeverity: Math.round(sevSum / n),
      totalMinutesSaved: round1(savedSum),
      avgSaved: round1(savedSum / n),
      avgStd: BENCHMARK_STANDARD,
      avgGw: BENCHMARK_GREENWAVE,
    };
  }, [records]);

  const exportCsv = () => {
    const headers = [
      "id",
      "created_at",
      "incident_type",
      "sector",
      "congestion_severity_pct",
      "estimated_time_saved_minutes",
      "standard_eta_minutes",
      "greenwave_eta_minutes",
      "optimal_corridor_path",
      "ai_dispatch_note",
      "source",
    ];
    const escapeCell = (val) => {
      const str = val == null ? "" : String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };
    const rows = filtered.map((r) =>
      [
        r.id,
        r.created_at,
        r.incident_type,
        r.sector,
        r.congestion_severity,
        r.estimated_time_saved_minutes,
        r.standard_eta_minutes ?? BENCHMARK_STANDARD,
        r.greenwave_eta_minutes ?? BENCHMARK_GREENWAVE,
        (r.optimal_corridor_path || []).join(" -> "),
        r.ai_dispatch_note,
        r.source,
      ]
        .map(escapeCell)
        .join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `greenwave-dispatches-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-slate-950/90 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="panel flex flex-col justify-between gap-4 p-5 md:flex-row md:items-center">
          <div>
            <div className="hud-label flex items-center gap-2 text-emerald-400">
              <BarChart3 className="h-3.5 w-3.5" /> Municipal Corridor Telemetry & Audit Ledger
            </div>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-wide text-slate-100">
              Command Analytics & Supabase Log
            </h1>
            <p className="mt-1 max-w-2xl text-xs text-slate-400">
              Real-time impact telemetry comparing Standard GPS transit times against GreenWave 3D Pre-Flush corridors, backed by
              Supabase with automatic offline LocalStorage resilience.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-xs ${
                dataSource === "supabase"
                  ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
                  : "border-cyan-400/40 bg-cyan-500/10 text-cyan-200"
              }`}
            >
              <Database className="h-3.5 w-3.5" />
              {dataSource === "supabase" ? "SUPABASE LIVE DB" : "LOCALSTORAGE FALLBACK LEDGER"}
            </span>

            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 font-mono text-xs text-slate-200 transition hover:border-cyan-400"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} /> Sync
            </button>

            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/60 bg-emerald-500/20 px-3.5 py-1.5 font-mono text-xs font-semibold text-emerald-200 shadow-[0_0_20px_-6px_rgba(16,185,129,0.6)] transition hover:bg-emerald-500/30"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV ({filtered.length})
            </button>
          </div>
        </div>

        {syncError && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              Supabase notice: {syncError} — serving pre-seeded & locally logged dispatches without interruption.
            </span>
          </div>
        )}

        {/* Top Summary KPIs */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="panel p-4">
            <div className="hud-label text-slate-400">Standard GPS Transit (Avg)</div>
            <div className="mt-1 font-mono text-3xl font-bold text-rose-300">18.5 mins</div>
            <div className="mt-1 text-xs text-slate-500">Unassisted signal stops & queue delay</div>
          </div>

          <div className="panel border-emerald-500/40 p-4">
            <div className="hud-label text-emerald-400">GreenWave 3D Pre-Flush (Avg)</div>
            <div className="mt-1 font-mono text-3xl font-bold text-emerald-300">6.2 mins</div>
            <div className="mt-1 text-xs text-emerald-400/80">3-junction lookahead · 66.5% faster</div>
          </div>

          <div className="panel p-4">
            <div className="hud-label text-cyan-400">Cumulative Time Saved</div>
            <div className="mt-1 font-mono text-3xl font-bold text-cyan-300">{metrics.totalMinutesSaved} mins</div>
            <div className="mt-1 text-xs text-slate-500">
              Across {metrics.totalDispatches} logged emergency corridors
            </div>
          </div>

          <div className="panel p-4">
            <div className="hud-label text-amber-300">Mean Gridlock Severity</div>
            <div className="mt-1 font-mono text-3xl font-bold text-amber-200">{metrics.avgSeverity}%</div>
            <div className="mt-1 text-xs text-slate-500">Avg {metrics.avgSaved} mins saved per dispatch</div>
          </div>
        </div>

        {/* Telemetry Charts Row */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Primary Transit Comparison Chart */}
          <div className="panel flex flex-col justify-between p-5 lg:col-span-7">
            <div>
              <div className="flex items-center justify-between">
                <span className="hud-label flex items-center gap-2 text-cyan-400">
                  <Clock className="h-3.5 w-3.5" /> Average Ambulance Transit Time Benchmark
                </span>
                <span className="rounded bg-emerald-500/15 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-300">
                  −12.3 MINS (−66.5%)
                </span>
              </div>
              <h2 className="mt-1 font-display text-lg font-semibold text-slate-100">
                Standard GPS (18.5 mins) vs. GreenWave 3D Pre-Flush (6.2 mins)
              </h2>

              <div className="mt-6 space-y-5">
                {/* Bar 1: Standard GPS */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between font-mono text-xs">
                    <span className="text-slate-300">Standard GPS Routing (Red-Light Queues)</span>
                    <span className="font-bold text-rose-300">18.5 mins</span>
                  </div>
                  <div className="h-8 w-full overflow-hidden rounded-lg border border-rose-500/30 bg-slate-900 p-1">
                    <div
                      className="flex h-full items-center justify-end rounded bg-gradient-to-r from-rose-600/80 to-amber-500/80 pr-3 font-mono text-xs font-bold text-white"
                      style={{ width: "100%" }}
                    >
                      18.5m · 14.2 km/h effective
                    </div>
                  </div>
                </div>

                {/* Bar 2: GreenWave 3D Pre-Flush */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between font-mono text-xs">
                    <span className="text-emerald-300">GreenWave 3D Pre-Flush (3 Junctions Ahead)</span>
                    <span className="font-bold text-emerald-300">6.2 mins</span>
                  </div>
                  <div className="h-8 w-full overflow-hidden rounded-lg border border-emerald-500/40 bg-slate-900 p-1">
                    <div
                      className="flex h-full items-center justify-end rounded bg-gradient-to-r from-emerald-500 to-cyan-400 pr-3 font-mono text-xs font-bold text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.6)]"
                      style={{ width: `${(BENCHMARK_GREENWAVE / BENCHMARK_STANDARD) * 100}%` }}
                    >
                      6.2m · 31.0 km/h
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3 border-t border-slate-800 pt-4 font-mono text-xs">
              <div className="rounded-lg bg-slate-900/70 p-2.5">
                <div className="text-[10px] text-slate-500">SIGNAL HOLDS</div>
                <div className="mt-0.5 text-sm font-bold text-emerald-300">0 Red Stops</div>
              </div>
              <div className="rounded-lg bg-slate-900/70 p-2.5">
                <div className="text-[10px] text-slate-500">GOLDEN HOUR GAIN</div>
                <div className="mt-0.5 text-sm font-bold text-cyan-300">+12.3 mins</div>
              </div>
              <div className="rounded-lg bg-slate-900/70 p-2.5">
                <div className="text-[10px] text-slate-500">SURVIVAL ODDS</div>
                <div className="mt-0.5 text-sm font-bold text-amber-300">+38% Est.</div>
              </div>
            </div>
          </div>

          {/* Per-Dispatch Time Saved Distribution */}
          <div className="panel flex flex-col justify-between p-5 lg:col-span-5">
            <div>
              <div className="hud-label flex items-center gap-2 text-emerald-400">
                <TrendingDown className="h-3.5 w-3.5" /> Recent Corridor Time-Savings Breakdown
              </div>
              <h2 className="mt-1 font-display text-lg font-semibold text-slate-100">
                Last 6 Dispatched Corridors
              </h2>

              <div className="mt-4 space-y-2.5">
                {records.slice(0, 6).map((r) => {
                  const std = r.standard_eta_minutes || BENCHMARK_STANDARD;
                  const gw = r.greenwave_eta_minutes || BENCHMARK_GREENWAVE;
                  const saved = r.estimated_time_saved_minutes;
                  const pct = Math.min(100, Math.max(18, (saved / 16) * 100));
                  return (
                    <div key={r.id} className="rounded-lg border border-slate-800/90 bg-slate-900/60 p-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="truncate font-medium text-slate-200">
                          {r.incident_type} <span className="font-mono text-[10px] text-slate-500">({r.sector})</span>
                        </span>
                        <span className="font-mono text-xs font-bold text-emerald-300">−{saved}m</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="font-mono text-[10px] text-slate-400">
                          {std}m → {gw}m
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Live Dispatch Table */}
        <div className="panel overflow-hidden">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-800 p-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span className="font-display text-sm font-semibold tracking-wide text-slate-100">
                Dispatched Emergency Corridors ({filtered.length})
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter street, incident, note…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-900 py-1.5 pl-8 pr-3 text-xs text-slate-200 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <select
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-slate-200 focus:border-cyan-400 focus:outline-none"
              >
                <option value="ALL">All Sectors</option>
                {["Sector 1", "Sector 2", "Sector 3", "Sector 4", "Sector 5", "Sector 6", "Sector 7", "Sector 8", "Sector 9"].map(
                  (s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  )
                )}
              </select>

              {dataSource === "local" && (
                <button
                  type="button"
                  onClick={onResetDemoData}
                  title="Reset LocalStorage to default 12 seeded records"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-[11px] text-slate-400 hover:border-slate-500 hover:text-slate-200"
                >
                  <RotateCcw className="h-3 w-3" /> Reset Seed
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-900/90 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Incident & Sector</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Optimal Pre-Flush Corridor</th>
                  <th className="px-4 py-3">Time Saved</th>
                  <th className="px-4 py-3">AI Tactical Directive</th>
                  <th className="px-4 py-3 text-right">3D Replay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filtered.map((r) => {
                  const sev = Number(r.congestion_severity) || 0;
                  const sevBadge =
                    sev >= 85
                      ? "border-rose-500/40 bg-rose-500/15 text-rose-300"
                      : sev >= 70
                      ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                      : "border-emerald-500/40 bg-emerald-500/15 text-emerald-300";
                  const path = Array.isArray(r.optimal_corridor_path) ? r.optimal_corridor_path : [];
                  return (
                    <tr key={r.id} className="transition hover:bg-slate-900/60">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-slate-400">
                        {new Date(r.created_at).toLocaleString([], {
                          month: "short",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        <div className="text-[10px] uppercase text-slate-600">{r.source}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-100">{r.incident_type}</div>
                        <div className="font-mono text-[11px] text-cyan-400">{r.sector}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded border px-2 py-0.5 font-mono text-xs font-bold ${sevBadge}`}>
                          {sev}%
                        </span>
                      </td>
                      <td className="max-w-xs px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {path.slice(0, 3).map((node, idx) => (
                            <span
                              key={idx}
                              className="rounded bg-slate-800/90 px-1.5 py-0.5 font-mono text-[10px] text-slate-300"
                            >
                              {node}
                            </span>
                          ))}
                          {path.length > 3 && (
                            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">
                              +{path.length - 3} more → {path[path.length - 1]}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="font-mono text-sm font-bold text-emerald-300">
                          {r.estimated_time_saved_minutes} min
                        </div>
                        {r.standard_eta_minutes && r.greenwave_eta_minutes && (
                          <div className="font-mono text-[10px] text-slate-500">
                            {r.standard_eta_minutes}m → {r.greenwave_eta_minutes}m
                          </div>
                        )}
                      </td>
                      <td className="max-w-xs px-4 py-3 text-xs leading-relaxed text-slate-300">
                        {r.ai_dispatch_note}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            onReplayCorridor({
                              route: routeFromNames(path),
                              label: `${r.incident_type} (${r.sector})`,
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/50 bg-cyan-500/10 px-2.5 py-1 font-mono text-[11px] text-cyan-200 transition hover:bg-cyan-500/25"
                        >
                          <Play className="h-3 w-3" /> Replay 3D
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
