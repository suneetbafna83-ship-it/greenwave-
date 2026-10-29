import { Box, Sparkles, BarChart3, Radio, Cpu, ShieldCheck } from "lucide-react";
import { LIVE_READY, MISSING_KEYS } from "../lib/config";

const TABS = [
  {
    id: "warroom",
    label: "3D City War Room",
    short: "War Room",
    icon: Box,
    badge: "LIVE 3D",
  },
  {
    id: "triage",
    label: "Emergency Triage & Gemini AI Dispatch",
    short: "Gemini Triage",
    icon: Sparkles,
    badge: "VISION AI",
  },
  {
    id: "analytics",
    label: "Command Analytics & Supabase Log",
    short: "Analytics",
    icon: BarChart3,
    badge: "METRICS",
  },
];

export default function Navbar({ activeTab, onSelectTab, liveMode, onToggleLiveMode, dispatchCount }) {
  return (
    <header className="relative z-30 flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/20 bg-slate-950/90 px-4 py-2.5 backdrop-blur-md">
      {/* Brand identity */}
      <div className="flex items-center gap-3">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/50 bg-gradient-to-br from-emerald-500/25 via-slate-900 to-cyan-500/25 shadow-[0_0_24px_-4px_rgba(16,185,129,0.65)]">
          <Radio className="h-5 w-5 text-emerald-300" />
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-slate-950" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display text-base font-bold tracking-wider text-slate-100">
              GREENWAVE <span className="text-emerald-400">3D</span>
            </span>
            <span className="hidden rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[10px] text-cyan-300 sm:inline-block">
              DIGITAL TWIN v2.5
            </span>
          </div>
          <p className="hidden text-[11px] text-slate-400 xl:block">
            Autonomous Ambulance Corridor &amp; City Traffic Control
          </p>
        </div>
      </div>

      {/* 3-Tab Navigation */}
      <nav className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectTab(t.id)}
              className={`group flex items-center gap-2 rounded-lg px-3 py-1.5 text-left transition-all ${
                active
                  ? "border border-cyan-400/60 bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 text-white shadow-[0_0_20px_-6px_rgba(34,211,238,0.7)]"
                  : "border border-transparent text-slate-400 hover:bg-slate-800/70 hover:text-slate-200"
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${active ? "text-cyan-300" : "text-slate-400 group-hover:text-cyan-300"}`} />
              <span className="hidden font-display text-xs font-semibold tracking-wide lg:inline">{t.label}</span>
              <span className="font-display text-xs font-semibold tracking-wide lg:hidden">{t.short}</span>
              {t.id === "analytics" && dispatchCount > 0 && (
                <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.2 font-mono text-[10px] font-bold text-emerald-300">
                  {dispatchCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Subtle Live AI Mode vs Demo Simulation Mode toggle */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onToggleLiveMode}
          title={
            LIVE_READY
              ? "Switch between Live Gemini + Supabase APIs and Demo Simulation Mode"
              : `Missing in .env: ${MISSING_KEYS.join(", ")}. Demo Simulation fallback guarantees 100% offline reliability.`
          }
          className={`flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[11px] transition ${
            liveMode
              ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200 shadow-[0_0_20px_-6px_rgba(16,185,129,0.7)]"
              : "border-cyan-400/50 bg-slate-900 text-cyan-200 hover:border-cyan-300"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              liveMode ? "animate-pulse bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-cyan-400"
            }`}
          />
          <Cpu className="h-3.5 w-3.5" />
          <span className="font-semibold">{liveMode ? "Live AI Mode" : "Demo Simulation Mode"}</span>
          <span className="rounded bg-slate-950/80 px-1.5 py-0.5 text-[9.5px] uppercase text-slate-400">
            {LIVE_READY ? "KEYS OK" : "AUTO-FALLBACK"}
          </span>
        </button>

        <div className="hidden items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/80 px-2.5 py-1 font-mono text-[10px] text-slate-400 2xl:flex">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          <span>ZERO-AUTH WAR ROOM</span>
        </div>
      </div>
    </header>
  );
}
