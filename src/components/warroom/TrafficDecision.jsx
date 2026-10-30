import { MapPin, Route, Siren, Timer } from "lucide-react";

const URGENCY = {
  normal: { label: "Normal", hint: "Allow a longer detour to limit disruption." },
  urgent: { label: "Urgent", hint: "Balance arrival time with the queues ahead." },
  critical: { label: "Critical", hint: "Favor arrival time when a detour would cost too much." },
};

const ACTION = {
  clear: { title: "Pre-flushing Next Signals", tone: "text-emerald-400" },
  reroute: { title: "Adaptive Detour Selected", tone: "text-teal-400" },
  wait: { title: "Standard Traffic Flow", tone: "text-amber-400" },
  hold: { title: "Holding for Route Clear", tone: "text-amber-400" },
  manual: { title: "Full Green Wave Override", tone: "text-emerald-400" },
  standard: { title: "Normal Signal Rotation", tone: "text-slate-300" },
  idle: { title: "Ready for Dispatch", tone: "text-slate-400" },
};

const seconds = (value) => (Number.isFinite(value) ? `${Math.round(value)} s` : "—");

export function UrgencyControl({ value = "urgent", onChange, disabled = false }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-medium text-slate-400">
        <span className="flex items-center gap-1.5">
          <Siren className="h-3.5 w-3.5 text-rose-400" />
          <span>Urgency</span>
        </span>
        <select
          aria-label="Ambulance urgency"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-white focus:outline-none"
        >
          {Object.entries(URGENCY).map(([key, option]) => (
            <option key={key} value={key} className="bg-slate-900 text-white">
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function TrafficDecision({ decision, simTime = 0, compact = false }) {
  const current = decision?.action ? decision : { action: "idle" };
  const action = ACTION[current.action] || ACTION.idle;
  const remaining = Math.max(0, (current.nextReviewAt ?? simTime) - simTime);
  const active = !["idle", "standard"].includes(current.action);

  return (
    <section
      aria-label="Live ambulance decision"
      className="panel p-3 flex flex-col gap-1.5"
    >
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5 font-medium text-white">
          <Route className="h-3.5 w-3.5 text-slate-400" />
          <span>AI Decision</span>
        </span>
        <span className="text-[10px] text-slate-500 font-mono">
          {current.reroutes || 0} reroutes
        </span>
      </div>

      <div className={`text-xs font-semibold ${action.tone}`}>
        {action.title}
      </div>

      {current.reason ? (
        <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
          {current.reason}
        </p>
      ) : (
        <p className="text-[11px] text-slate-500">
          Actively monitors queue density and clears downstream signals.
        </p>
      )}

      {active && (
        <div className="mt-1 grid grid-cols-3 gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] p-1.5 text-center font-mono text-[11px]">
          <div>
            <div className="text-white font-medium">{current.queueVehicles ?? 0}</div>
            <div className="text-[9px] text-slate-500 uppercase">Vehicles</div>
          </div>
          <div>
            <div className="text-white font-medium">{current.crossTrafficVehicles ?? 0}</div>
            <div className="text-[9px] text-slate-500 uppercase">Cross</div>
          </div>
          <div>
            <div className="text-white font-medium">{seconds(current.etaSeconds)}</div>
            <div className="text-[9px] text-slate-500 uppercase">Est. Arrival</div>
          </div>
        </div>
      )}
    </section>
  );
}
