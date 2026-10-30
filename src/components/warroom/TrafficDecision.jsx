import { MapPin, Route, Siren, Timer } from "lucide-react";

const URGENCY = {
  normal: { label: "Normal", hint: "Allow a longer detour to limit disruption." },
  urgent: { label: "Urgent", hint: "Balance arrival time with the queues ahead." },
  critical: { label: "Critical", hint: "Favor arrival time when a detour would cost too much." },
};
const ACTION = {
  clear: { title: "Clear the next junctions", tone: "text-emerald-300" },
  reroute: { title: "Take a clearer route", tone: "text-cyan-300" },
  wait: { title: "Keep traffic moving", tone: "text-amber-300" },
  hold: { title: "Ambulance held for replanning", tone: "text-amber-300" },
  manual: { title: "Manual corridor override", tone: "text-emerald-300" },
  standard: { title: "Ordinary signal operation", tone: "text-slate-300" },
  idle: { title: "Ready to assess live traffic", tone: "text-slate-300" },
};
const seconds = (value) => Number.isFinite(value) ? `${Math.round(value)} s` : "—";

export function UrgencyControl({ value = "urgent", onChange, disabled = false }) {
  return <div>
    <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
      <Siren className="h-3 w-3 text-rose-300" /> Ambulance urgency
      <select aria-label="Ambulance urgency" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}
        className="ml-auto rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] normal-case tracking-normal text-slate-100 focus:border-cyan-300 focus:outline-none disabled:opacity-50">
        {Object.entries(URGENCY).map(([key, option]) => <option key={key} value={key}>{option.label}</option>)}
      </select>
    </label>
    <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{URGENCY[value]?.hint}</p>
  </div>;
}

export default function TrafficDecision({ decision, simTime = 0, compact = false }) {
  const current = decision?.action ? decision : { action: "idle" };
  const action = ACTION[current.action] || ACTION.idle;
  const remaining = Math.max(0, (current.nextReviewAt ?? simTime) - simTime);
  const active = !["idle", "standard"].includes(current.action);
  return <section aria-label="Live ambulance decision" className={`rounded-lg border border-slate-700/70 bg-slate-950/80 ${compact ? "p-2.5" : "p-3"}`}>
    <div className="flex items-center justify-between gap-2 text-[9px] uppercase tracking-widest text-slate-500">
      <span className="flex items-center gap-1.5"><Route className="h-3 w-3 text-cyan-400" />Live decision</span>
      <span>{current.reroutes || 0} reroutes</span>
    </div>
    <h3 className={`mt-1 text-xs font-semibold ${action.tone}`}>{action.title}</h3>
    {current.location && <p className="mt-1 flex items-start gap-1 text-[10px] text-slate-300"><MapPin className="mt-0.5 h-3 w-3 shrink-0 text-cyan-400" />{current.location}</p>}
    <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{current.reason || "Dispatch an ambulance to compare live queues, arrival time and the delay to other drivers."}</p>
    {active && <div className="mt-2 grid grid-cols-3 gap-1 rounded bg-slate-900/70 px-1 py-1.5 text-center font-mono text-[10px]">
      <div><div className="text-slate-200">{current.queueVehicles ?? 0}</div><div className="text-[8px] uppercase text-slate-500">cars ahead</div></div>
      <div><div className="text-slate-200">{current.crossTrafficVehicles ?? 0}</div><div className="text-[8px] uppercase text-slate-500">cross traffic</div></div>
      <div><div className="text-slate-200">{seconds(current.etaSeconds)}</div><div className="text-[8px] uppercase text-slate-500">model ETA</div></div>
    </div>}
    <p className="mt-2 flex items-start gap-1 text-[9px] leading-relaxed text-slate-500"><Timer className="mt-0.5 h-3 w-3 shrink-0" />
      {active ? `Reviewed at ${seconds(current.at)}; next in ${remaining.toFixed(1)} s or at the next junction.` : "Checks live traffic every simulation second and at junctions."}
    </p>
  </section>;
}
