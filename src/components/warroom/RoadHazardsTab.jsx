import { useState, useEffect } from "react";
import {
  Construction,
  Waves,
  CircleDot,
  Wrench,
  Trash2,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  MapPin,
  ExternalLink,
  ShieldCheck,
  Zap,
  X,
} from "lucide-react";
import HazardMap2D from "./HazardMap2D";
import { ROAD_HAZARDS } from "../../lib/cityGrid";

export default function RoadHazardsTab({ sim, onClose }) {
  const [, setTick] = useState(0);
  const [activeTool, setActiveTool] = useState("construction");
  const [activeSubTab, setActiveSubTab] = useState("blockages"); // "blockages" | "potholes"
  const [potholeFilter, setPotholeFilter] = useState("all"); // "all" | "slums" | "urban"

  const refresh = () => setTick((t) => t + 1);

  useEffect(() => {
    const interval = setInterval(refresh, 150);
    return () => clearInterval(interval);
  }, []);

  const snap = sim ? sim.snapshot() : { closures: [], potholes: [] };
  const closures = snap.closures || [];
  const constructionClosures = closures.filter((c) => c.reason === "construction");
  const waterClosures = closures.filter((c) => c.reason === "water_logging");
  const potholes = sim?.potholes || [];
  const activePotholes = potholes.filter((p) => p.active !== false);
  const repairedCount = sim?.repairedPotholesCount || 0;

  // Filtered potholes for table
  const displayedPotholes = activePotholes.filter((p) => {
    if (potholeFilter === "slums") return p.isSlum;
    if (potholeFilter === "urban") return !p.isSlum;
    return true;
  });

  const handleSimulateBridgeClosure = () => {
    if (!sim) return;
    sim.closeRoadWithReason("15,13,0", "construction", "Grand Suspension Way Bridge (West)", 0, 0);
    refresh();
  };

  const handleSimulateFlood = () => {
    if (!sim) return;
    sim.closeRoadWithReason("14,16,1", "water_logging", "Station Rd × Metro Ave (Underpass Flood)", 0, 0);
    sim.closeRoadWithReason("15,16,1", "water_logging", "Station Rd × Grand Central (Waterlogged)", 0, 0);
    refresh();
  };

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-[#070b14] p-4 lg:p-6 text-slate-200">
      {/* Top Header Card */}
      <div className="panel p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10">
              <Construction className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-wide">
                Road Works & Hazard Control Center
              </h1>
              <p className="text-xs text-slate-400">
                Interactive 2D spatial mapping for construction barriers, water logging & pothole repairs
              </p>
            </div>
          </div>
        </div>

        {/* Global Quick Action Chips & Optional Close Button */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs">
            <Construction className="h-3.5 w-3.5 text-amber-400" />
            <span className="font-semibold text-amber-300">{constructionClosures.length}</span>
            <span className="text-amber-400/80">Construction</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs">
            <Waves className="h-3.5 w-3.5 text-cyan-400" />
            <span className="font-semibold text-cyan-300">{waterClosures.length}</span>
            <span className="text-cyan-400/80">Flooded</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs">
            <CircleDot className="h-3.5 w-3.5 text-rose-400" />
            <span className="font-semibold text-rose-300">{activePotholes.length}</span>
            <span className="text-rose-400/80">Potholes</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span className="font-semibold text-emerald-300">{repairedCount}</span>
            <span className="text-emerald-400/80">Repaired</span>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close Panel"
              className="ml-2 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Left 2D Hazard Map & Right Data Manager */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
        {/* Left Column: Dedicated 2D Hazard Map (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <div className="panel p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-xs font-semibold text-white uppercase tracking-wider">
                  Interactive 2D Hazard Map
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Click map to place or repair
              </span>
            </div>

            <HazardMap2D
              sim={sim}
              snap={snap}
              activeTool={activeTool}
              setActiveTool={setActiveTool}
            />

            {/* Quick Simulation Scenarios */}
            <div className="border-t border-white/[0.08] pt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-400 font-medium">Quick Scenarios:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSimulateBridgeClosure}
                  className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300 hover:bg-amber-500/20 transition"
                >
                  🚧 Block Grand Bridge
                </button>
                <button
                  type="button"
                  onClick={handleSimulateFlood}
                  className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-300 hover:bg-cyan-500/20 transition"
                >
                  🌊 Waterlog Metro Underpass
                </button>
                <button
                  type="button"
                  onClick={() => sim?.clearAllClosures()}
                  className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/10 transition"
                >
                  Clear All Blockages
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Data Management & Tables (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          {/* Sub-tab Navigation */}
          <div className="panel p-1.5 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveSubTab("blockages")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition ${
                activeSubTab === "blockages"
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Construction className="h-3.5 w-3.5 text-amber-400" />
              <span>Active Closures ({closures.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab("potholes")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition ${
                activeSubTab === "potholes"
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <CircleDot className="h-3.5 w-3.5 text-rose-400" />
              <span>Potholes ({activePotholes.length})</span>
            </button>
          </div>

          {/* Sub-Tab 1: Active Closures Management */}
          {activeSubTab === "blockages" && (
            <div className="panel p-4 flex flex-col gap-3 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">
                  Active Road Blockages
                </span>
                {closures.length > 0 && (
                  <button
                    type="button"
                    onClick={() => sim?.clearAllClosures()}
                    className="text-[11px] text-rose-400 hover:text-rose-300 transition"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {closures.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
                    <ShieldCheck className="h-6 w-6 text-emerald-400" />
                  </div>
                  <div className="text-sm font-semibold text-white">All City Corridors Open</div>
                  <p className="text-xs text-slate-400 max-w-[280px]">
                    No roads are currently closed. Click on the 2D map with the Construction or Water Logging tool to block a street.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-[460px] overflow-y-auto pr-1">
                  {closures.map((c) => (
                    <div
                      key={c.key}
                      className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3 flex items-center justify-between gap-3 hover:bg-white/[0.04] transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {c.reason === "water_logging" ? (
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 shrink-0">
                            <Waves className="h-4 w-4 text-cyan-400" />
                          </div>
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 shrink-0">
                            <Construction className="h-4 w-4 text-amber-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white truncate">
                            {c.name}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                            <span className="capitalize text-slate-300 font-medium">
                              {c.reason.replace("_", " ")}
                            </span>
                            <span>•</span>
                            <span className="font-mono text-slate-400">{c.key}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => sim?.openRoad(c.key)}
                        className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 transition shrink-0"
                      >
                        Reopen
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sub-Tab 2: Potholes Registry & Repairs */}
          {activeSubTab === "potholes" && (
            <div className="panel p-4 flex flex-col gap-3 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">
                  Potholes Registry & Maintenance
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => sim?.repairAllPotholes()}
                    className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition"
                  >
                    Repair All
                  </button>
                  <span className="text-white/20">|</span>
                  <button
                    type="button"
                    onClick={() => sim?.resetPotholes()}
                    title="Reset to survey survey"
                    className="text-[11px] text-slate-400 hover:text-slate-200 transition"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5">
                {[
                  { id: "all", label: `All (${activePotholes.length})` },
                  { id: "slums", label: `Slum Badlands (${activePotholes.filter((p) => p.isSlum).length})` },
                  { id: "urban", label: `Urban Core (${activePotholes.filter((p) => !p.isSlum).length})` },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setPotholeFilter(f.id)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                      potholeFilter === f.id
                        ? "bg-white/10 text-white font-semibold"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Pothole Items List */}
              <div className="flex flex-col gap-2 max-h-[440px] overflow-y-auto pr-1">
                {displayedPotholes.slice(0, 40).map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 flex items-center justify-between gap-3 hover:bg-white/[0.04] transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/10 shrink-0">
                        <CircleDot className="h-3.5 w-3.5 text-rose-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white">
                          Pothole #{p.id}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Coord ({p.x.toFixed(1)}, {p.z.toFixed(1)}) • {p.isSlum ? "Slum District" : "Urban Sector"}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => sim?.removePothole(p.id)}
                      className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 transition shrink-0"
                    >
                      🛠️ Repair
                    </button>
                  </div>
                ))}

                {displayedPotholes.length > 40 && (
                  <div className="text-center py-2 text-[11px] text-slate-400 font-mono">
                    + {displayedPotholes.length - 40} additional surveyed potholes in registry
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
