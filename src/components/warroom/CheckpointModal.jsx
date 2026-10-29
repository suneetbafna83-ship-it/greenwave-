// GreenWave 3D — Checkpoint Vault & Version Time-Machine
// Allows users to inspect every architectural milestone, view file diffs/notes,
// and copy 1-click Git commands to restore or branch from any past version.

import { useState } from "react";
import {
  History,
  X,
  GitBranch,
  Copy,
  Check,
  Calendar,
  Layers,
  ChevronRight,
  Terminal,
  ExternalLink,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export const CHECKPOINTS = [
  {
    id: "edit-09",
    number: "09",
    tag: "edit-09",
    timestamp: "2026-10-29 21:40:00",
    name: "60 FPS Ultra-Smooth Camera Engine & Zero-Stutter Minimap",
    status: "CURRENT",
    badge: "Active Release",
    highlights: [
      "Batched 1,860 road segments into 3 single-path strokes, eliminating 110,000 canvas calls/sec.",
      "Pre-cached static radar background (river, slum districts, cyber citadel) onto offscreen canvas.",
      "Throttled traffic light GPU buffer writes to 10 FPS, saving 190,000 instance color updates/sec.",
      "Tuned OrbitControls dampingFactor to 0.18 with rotateSpeed 1.2 for instant, crisp camera responsiveness.",
      "Added in-app Checkpoint Vault and initialized full Git repository with tags.",
    ],
    file: "greenwave 3D (edit 09) (2026-10-29 21-40-00).md",
  },
  {
    id: "edit-08",
    number: "08",
    tag: "edit-08",
    timestamp: "2026-10-29 21:15:00",
    name: "500×500 Cross Expansion, Meandering River, Bridges & Sunlight Shading",
    status: "MILESTONE",
    badge: "500×500 Grid",
    highlights: [
      "Expanded metropolis to 500 × 500 units (31×31 avenues/streets, 961 junctions, 1,860 road segments).",
      "Created 34m wide zig-zag meandering river with water reflections & monumental suspension bridges.",
      "Enhanced directional solar engine (2.85–3.2 intensity) creating realistic facade shading (golden sunrise to crimson sunset).",
      "Strict zoning: cyber citadel strictly isolated from peripheral outer slum badlands.",
    ],
    file: "greenwave 3D (edit 08) (2026-10-29 21-15-00).md",
  },
  {
    id: "edit-07",
    number: "07",
    tag: "edit-07",
    timestamp: "2026-10-29 20:45:00",
    name: "Organic Slum Distribution, 24-Hr Dynamic Solar Cycle & Zero-GC Math",
    status: "MILESTONE",
    badge: "24-Hr Engine",
    highlights: [
      "Organic multi-frequency noise field for informal slum badlands across the city.",
      "Continuous 24-hour mathematical time engine with celestial solar arc and interactive timeline slider.",
      "Natural morning/evening rush hour vehicle surges and spontaneous flash gridlock events.",
      "Zero-GC camera vector smoothing and bidirectional speed-aware road congestion filter.",
    ],
    file: "greenwave 3D (edit 07) (2026-10-29 20-45-00).md",
  },
  {
    id: "edit-06",
    number: "06",
    tag: "edit-06",
    timestamp: "2026-10-29 19:30:00",
    name: "100×100 Cross Map, Slum District, Asymmetric Potholes & 2D Tactical Minimap",
    status: "MILESTONE",
    badge: "100×100 Grid",
    highlights: [
      "100×100 cross footprint (25×25 grid, 625 junctions, 1,200 road segments).",
      "Underdeveloped slum district with rusted shacks, tarps, and heavy crater clusters.",
      "Asymmetric road hazards: pristine cyber expressways (0 potholes) vs slum roads (3–6 craters).",
      "Floating 2D Tactical Radar Minimap tracking live ambulance and bidirectional traffic conditions.",
    ],
    file: "greenwave 3D (edit 06) (2026-10-29 19-30-00).md",
  },
  {
    id: "edit-05",
    number: "05",
    tag: "edit-05",
    timestamp: "2026-10-29 18:10:19",
    name: "15×15 Mega Grid, Strict Red-Light Clamping & Dynamic A* Routing",
    status: "MILESTONE",
    badge: "Dynamic A*",
    highlights: [
      "15×15 city grid (225 junctions, 196 blocks) with 4 sector emergency dispatch bases.",
      "Strict red-light stop line clamping: vehicles stop legally behind the stop bar.",
      "Dynamic A* real-time corridor optimization evaluating live queue lengths and potholes.",
      "Day, sunset, and cyberpunk night lighting modes with random incident spawner.",
    ],
    file: "greenwave 3D (edit 05) (2026-10-29 18-10-19).md",
  },
  {
    id: "edit-04",
    number: "04",
    tag: "edit-04",
    timestamp: "2026-10-29 17:56:22",
    name: "34m Traffic Projection Beam, Vehicle Headlights & Street Chase-Cam",
    status: "MILESTONE",
    badge: "Traffic Projection",
    highlights: [
      "Forward 34-meter traffic projection laser beam with sweeping animated radar chevrons.",
      "Visual civilian vehicle yielding: cars pop amber warning beacons and steer to sidewalk curb.",
      "Illuminated headlights and taillights for all 280+ vehicles across the city.",
      "Street-level 3rd-person chase camera diving behind AMB-07 on dispatch.",
    ],
    file: "greenwave 3D (edit 04) (2026-10-29 17-56-22).md",
  },
  {
    id: "edit-03",
    number: "03",
    tag: "edit-03",
    timestamp: "2026-10-29 17:42:06",
    name: "Emergency Palette Isolation & Signal Deconfliction",
    status: "MILESTONE",
    badge: "Visual Clarity",
    highlights: [
      "Deconflicted red traffic signals vs emergency ambulances (clarified street corner red dots).",
      "Removed red/rose tints from civilian vehicles, reserving pure RED strictly for AMB-07 and signals.",
      "Added 3D overhead callout beacon badge above AMB-07.",
    ],
    file: "greenwave 3D (edit 03) (2026-10-29 17-42-06).md",
  },
  {
    id: "edit-02",
    number: "02",
    tag: "edit-02",
    timestamp: "2026-10-29 17:12:01",
    name: "11×11 Grid, Road Hazards & 6-Class Multi-Modal Fleet",
    status: "MILESTONE",
    badge: "Multi-Modal Fleet",
    highlights: [
      "Expanded to 11×11 grid (121 junctions) with speed breakers and potholes.",
      "6 multi-modal vehicle types: Bus, Cargo Truck, Auto-Rickshaw, Two-Wheeler, SUV, Sedan.",
      "Physical vehicle bounce on speed humps and swerving avoidance around asphalt craters.",
    ],
    file: "greenwave 3D (edit 02) (2026-10-29 17-12-01).md",
  },
  {
    id: "edit-01",
    number: "01",
    tag: "edit-01",
    timestamp: "2026-10-29 15:58:33",
    name: "Core Foundation & Hackathon Digital Twin v1.0",
    status: "MILESTONE",
    badge: "Initial Build",
    highlights: [
      "Initial production build: 7×7 grid, 49 signalized intersections, 165 vehicles.",
      "3-junction pre-flush green wave corridor engine.",
      "Zero-auth instant entry with dual-mode Gemini AI and Supabase fallback.",
      "3-tab layout: 3D War Room, Vision Triage, and Command Analytics.",
    ],
    file: "greenwave 3D (edit 01) (2026-10-29 15-58-33).md",
  },
];

export default function CheckpointModal({ isOpen, onClose }) {
  const [selectedCp, setSelectedCp] = useState(CHECKPOINTS[0]);
  const [copiedTag, setCopiedTag] = useState(null);

  if (!isOpen) return null;

  const handleCopyCmd = (tag) => {
    const cmd = `git checkout ${tag}`;
    navigator.clipboard?.writeText(cmd);
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 2200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
      <div className="relative flex h-[85vh] w-full max-w-5xl flex-col rounded-2xl border border-cyan-500/40 bg-slate-950/95 shadow-[0_0_50px_rgba(6,182,212,0.25)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-500/15 shadow-[0_0_15px_rgba(34,211,238,0.3)]">
              <History className="h-5 w-5 text-cyan-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-bold tracking-wide text-white">
                  GREENWAVE CHECKPOINT VAULT
                </h2>
                <span className="rounded-full border border-emerald-400/40 bg-emerald-500/20 px-2.5 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                  9 SAVED CHECKPOINTS
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Explore project history, inspect architectural deliverables, or revert to any past version.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body: Left sidebar list & Right detail pane */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Checkpoint Timeline List */}
          <div className="w-80 shrink-0 border-r border-slate-800/80 bg-slate-950/50 p-4 overflow-y-auto space-y-2">
            <div className="px-2 py-1 text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
              Milestone Timeline
            </div>
            {CHECKPOINTS.map((cp) => {
              const active = selectedCp.id === cp.id;
              return (
                <button
                  key={cp.id}
                  type="button"
                  onClick={() => setSelectedCp(cp)}
                  className={`w-full text-left rounded-xl p-3 transition border ${
                    active
                      ? "border-cyan-400/60 bg-gradient-to-r from-cyan-950/60 to-slate-900/80 shadow-[0_0_20px_-6px_rgba(34,211,238,0.5)]"
                      : "border-slate-800/60 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/80"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-mono text-xs font-bold text-cyan-400">
                      EDIT {cp.number}
                    </span>
                    <span
                      className={`text-[9.5px] font-mono px-1.5 py-0.5 rounded ${
                        cp.status === "CURRENT"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {cp.badge}
                    </span>
                  </div>
                  <div className="font-medium text-xs text-slate-200 line-clamp-1">
                    {cp.name}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 text-[10px] font-mono text-slate-500">
                    <Calendar className="h-3 w-3" />
                    <span>{cp.timestamp}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Detail Pane */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-950/30 space-y-6">
            {/* Top overview card */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="rounded border border-cyan-400/40 bg-cyan-500/20 px-2 py-0.5 font-mono text-xs font-bold text-cyan-300">
                    EDIT {selectedCp.number}
                  </span>
                  <span className="font-mono text-xs text-slate-400">
                    Tag: <code className="text-emerald-400">{selectedCp.tag}</code>
                  </span>
                  <span className="font-mono text-xs text-slate-500">
                    • {selectedCp.timestamp}
                  </span>
                </div>

                {/* Git Checkout Button */}
                <button
                  type="button"
                  onClick={() => handleCopyCmd(selectedCp.tag)}
                  className="flex items-center gap-2 rounded-lg border border-cyan-500/50 bg-cyan-950/50 px-3 py-1.5 font-mono text-xs text-cyan-200 hover:bg-cyan-900/50 transition shadow-[0_0_15px_-4px_rgba(6,182,212,0.4)]"
                >
                  {copiedTag === selectedCp.tag ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-emerald-300 font-bold">Copied: git checkout {selectedCp.tag}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-cyan-400" />
                      <span>Copy Rollback Command</span>
                    </>
                  )}
                </button>
              </div>

              <h3 className="font-display text-xl font-bold text-white mb-2">
                {selectedCp.name}
              </h3>

              <div className="text-xs text-slate-400 font-mono">
                Documentation File: <span className="text-slate-300">checkpoints/{selectedCp.file}</span>
              </div>
            </div>

            {/* Innovations Delivered */}
            <div className="space-y-3">
              <h4 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-cyan-300">
                <Sparkles className="h-4 w-4" />
                Key Architectural Deliverables
              </h4>
              <div className="space-y-2">
                {selectedCp.highlights.map((h, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 rounded-lg border border-slate-800/80 bg-slate-900/50 p-3 text-xs text-slate-300"
                  >
                    <ChevronRight className="h-4 w-4 shrink-0 text-cyan-400 mt-0.5" />
                    <span>{h}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* How to Access / Rollback Guide */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 space-y-3">
              <h4 className="flex items-center gap-2 font-display text-sm font-bold text-emerald-400">
                <Terminal className="h-4 w-4" />
                How to Access &amp; Restore Any Checkpoint in Terminal
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Every milestone is permanently tagged in the Git history. You can preview, test, or branch off an older version at any time without losing any current work:
              </p>

              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-300 space-y-2">
                <div>
                  <span className="text-slate-500"># 1. Inspect older version directly:</span>
                  <div className="text-cyan-300 font-bold">git checkout {selectedCp.tag}</div>
                </div>
                <div>
                  <span className="text-slate-500"># 2. Or create a branch to experiment safely from this checkpoint:</span>
                  <div className="text-emerald-300 font-bold">git checkout -b branch-{selectedCp.tag} {selectedCp.tag}</div>
                </div>
                <div>
                  <span className="text-slate-500"># 3. Return to the latest version anytime:</span>
                  <div className="text-amber-300 font-bold">git checkout main</div>
                </div>
                <div>
                  <span className="text-slate-500"># 4. Read the complete architectural spec:</span>
                  <div className="text-slate-400">cat checkpoints/&quot;{selectedCp.file}&quot;</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
