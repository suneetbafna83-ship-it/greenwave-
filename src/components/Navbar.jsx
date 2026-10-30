import { Box, Sparkles, BarChart3, Radio, History, Glasses, ShieldCheck, Activity, Construction, Columns2 } from "lucide-react";
import { LIVE_READY, MISSING_KEYS } from "../lib/config";

const TABS = [
  { id: "warroom", label: "3D City War Room", short: "War Room", icon: Box },
  { id: "comparison", label: "Twin vs Google Maps", short: "Dual Twin", icon: Columns2 },
  { id: "hazards", label: "Road Works & Hazards", short: "Road Works", icon: Construction },
  { id: "training", label: "Mission Training", short: "Training", icon: Glasses },
  { id: "triage", label: "Vision Triage", short: "Scene AI", icon: Sparkles },
  { id: "analytics", label: "Telemetry & Logs", short: "Analytics", icon: BarChart3 },
];

export default function Navbar({
  activeTab,
  onSelectTab,
  liveMode,
  onToggleLiveMode,
  dispatchCount,
  onOpenCheckpoints,
}) {
  return (
    <header className="relative z-30 flex items-center justify-between gap-4 border-b border-white/[0.08] bg-[#070b16]/45 px-5 py-2.5 backdrop-blur-2xl">
      {/* Brand identity */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] shadow-sm">
          <Activity className="h-4 w-4 text-emerald-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight text-white font-display">
              GreenWave
            </span>
            <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
              3D Digital Twin
            </span>
          </div>
          <p className="hidden text-[11px] text-slate-400 md:block">
            Autonomous Emergency Corridor & City Traffic Intelligence
          </p>
        </div>
      </div>

      {/* Segmented Tab Navigation */}
      <nav className="flex items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.025] p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectTab(t.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                active
                  ? "border border-white/[0.1] bg-white/[0.08] text-white shadow-sm"
                  : "border border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${active ? "text-emerald-400" : "text-slate-400"}`} />
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.short}</span>
              {t.id === "analytics" && dispatchCount > 0 && (
                <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-300">
                  {dispatchCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Controls: Checkpoints Vault + Live AI Mode toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenCheckpoints}
          title="Open Checkpoint History Vault & Time Machine"
          className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.07] hover:text-white transition"
        >
          <History className="h-3.5 w-3.5 text-slate-400" />
          <span className="hidden sm:inline">Vault</span>
          <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
            10
          </span>
        </button>

        <button
          type="button"
          onClick={onToggleLiveMode}
          title={
            LIVE_READY
              ? "Toggle Live Gemini API Mode"
              : `Missing keys: ${MISSING_KEYS.join(", ")}. Using offline simulation.`
          }
          className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition ${
            liveMode
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-white/[0.08] bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              liveMode ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
            }`}
          />
          <span className="font-medium">{liveMode ? "Live AI" : "Simulation"}</span>
        </button>
      </div>
    </header>
  );
}
