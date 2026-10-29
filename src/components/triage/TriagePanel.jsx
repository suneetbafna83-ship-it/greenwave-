import { useRef, useState } from "react";
import {
  Upload,
  Sparkles,
  AlertTriangle,
  Route,
  Clock,
  Terminal,
  Send,
  CheckCircle2,
  Cpu,
  Image as ImageIcon,
  ArrowUpRight,
  ShieldAlert,
  Layers,
  FileJson,
} from "lucide-react";
import { SAMPLES } from "../../lib/samples";
import { analyzeWithGemini, analyzeSimulated, imageToBase64 } from "../../lib/gemini";
import { sectorOf, parseIntersection } from "../../lib/cityGrid";

export default function TriagePanel({ liveMode, onDeployCorridor, onLogDispatch }) {
  const fileInputRef = useRef(null);
  const [selectedSample, setSelectedSample] = useState(SAMPLES[0]);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(SAMPLES[0].image);
  const [customNotes, setCustomNotes] = useState(SAMPLES[0].description);
  const [incidentTitle, setIncidentTitle] = useState(SAMPLES[0].incident);
  const [sector, setSector] = useState(SAMPLES[0].sector);

  const [analyzing, setAnalyzing] = useState(false);
  const [scanStep, setScanStep] = useState("");
  const [result, setResult] = useState(null);
  const [fallbackNotice, setFallbackNotice] = useState(null);
  const [deployedBanner, setDeployedBanner] = useState(false);

  const handleSelectSample = (sample) => {
    setSelectedSample(sample);
    setUploadedFile(null);
    setPreviewUrl(sample.image);
    setCustomNotes(sample.description);
    setIncidentTitle(sample.incident);
    setSector(sample.sector);
    setDeployedBanner(false);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedSample(null);
    setUploadedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setIncidentTitle(`Uploaded Scene · ${file.name.replace(/\.[^.]+$/, "")}`);
    setSector("Sector 4");
    setCustomNotes(
      `Uploaded traffic camera frame (${file.name}, ${Math.round(file.size / 1024)} KB). Evaluate queue density, lane blockage, and compute optimal GreenWave pre-flush corridor from Sector 4 to St. Aurora Medical Center.`
    );
    setDeployedBanner(false);
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    setFallbackNotice(null);
    setDeployedBanner(false);

    try {
      let analysis = null;
      if (liveMode) {
        setScanStep("Encoding multimodal frame & contacting Gemini Vision API…");
        try {
          const imgSource = uploadedFile || previewUrl;
          const image = imgSource ? await imageToBase64(imgSource) : null;
          setScanStep("Running structured JSON corridor solver on Gemini…");
          analysis = await analyzeWithGemini({
            text: `Incident: ${incidentTitle} (${sector}). ${customNotes}`,
            image,
          });
        } catch (err) {
          setFallbackNotice(
            `Live Gemini API unavailable (${err.message || "connection error"}) — automatically switched to Bulletproof Demo Simulation Engine.`
          );
          setScanStep("Fallback active · synthesising tactical corridor via local digital-twin solver…");
          analysis = await analyzeSimulated({
            sample: selectedSample,
            fileKey: uploadedFile ? `${uploadedFile.name}-${uploadedFile.size}` : customNotes,
          });
        }
      } else {
        setScanStep("Scanning lane occupancy & vehicle queue vectors…");
        await new Promise((r) => setTimeout(r, 450));
        setScanStep("Solving 7×7 signal phase offsets & GreenWave pre-flush window…");
        analysis = await analyzeSimulated({
          sample: selectedSample,
          fileKey: uploadedFile ? `${uploadedFile.name}-${uploadedFile.size}` : customNotes,
        });
      }

      setResult(analysis);

      // Determine starting sector from first intersection if available
      const firstPt = parseIntersection(analysis.optimal_corridor_path?.[0]);
      const resolvedSector = firstPt ? sectorOf(firstPt[0], firstPt[1]) : sector;

      // Log to Supabase / LocalStorage automatically
      await onLogDispatch({
        incident_type: incidentTitle || "Emergency Triage Dispatch",
        sector: resolvedSector,
        congestion_severity: analysis.congestion_severity,
        optimal_corridor_path: analysis.optimal_corridor_path,
        estimated_time_saved_minutes: analysis.estimated_time_saved_minutes,
        standard_eta_minutes: analysis.eta.standard,
        greenwave_eta_minutes: analysis.eta.greenwave,
        ai_dispatch_note: analysis.ai_dispatch_note,
        source: analysis.engine === "gemini" ? "gemini-ai" : "triage-sim",
        status: "dispatched",
      });
    } finally {
      setAnalyzing(false);
      setScanStep("");
    }
  };

  const handleDeployToWarRoom = () => {
    if (!result) return;
    setDeployedBanner(true);
    onDeployCorridor({
      route: result.route,
      label: incidentTitle || "AI Triage Corridor",
    });
  };

  const strictJsonPayload = result
    ? {
        congestion_severity: `${result.congestion_severity}%`,
        optimal_corridor_path: result.optimal_corridor_path,
        estimated_time_saved_minutes: `${result.estimated_time_saved_minutes} minutes saved`,
        ai_dispatch_note: result.ai_dispatch_note,
      }
    : null;

  return (
    <div className="h-full w-full overflow-y-auto bg-slate-950/90 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header banner */}
        <div className="panel flex flex-col justify-between gap-4 p-5 md:flex-row md:items-center">
          <div>
            <div className="hud-label flex items-center gap-2 text-cyan-400">
              <Sparkles className="h-3.5 w-3.5" /> Multimodal Emergency Vision & Prompt Engine
            </div>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-wide text-slate-100">
              Emergency Triage & Gemini AI Dispatch
            </h1>
            <p className="mt-1 max-w-2xl text-xs text-slate-400">
              Upload a live CCTV / dashcam road photo or pick one of the 3 Quick Sample Emergency Cards. The engine returns a strict
              JSON corridor directive and pre-flushes the 3D digital twin.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-xs ${
                liveMode
                  ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
                  : "border-cyan-400/40 bg-cyan-500/10 text-cyan-200"
              }`}
            >
              <Cpu className="h-3.5 w-3.5" />
              {liveMode ? "LIVE GEMINI VISION API" : "DEMO SIMULATION ENGINE"}
            </span>
          </div>
        </div>

        {/* 3 Quick Sample Emergency Cards */}
        <div>
          <div className="mb-2.5 flex items-center justify-between">
            <span className="hud-label flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-emerald-400" /> Quick Sample Emergency Cards
            </span>
            <span className="font-mono text-[11px] text-slate-500">CLICK A SCENARIO OR UPLOAD YOUR OWN PHOTO BELOW</span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {SAMPLES.map((s, idx) => {
              const isSelected = selectedSample?.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSelectSample(s)}
                  className={`group relative flex flex-col overflow-hidden rounded-xl border text-left transition-all ${
                    isSelected
                      ? "border-cyan-400 bg-slate-900/90 shadow-[0_0_30px_-6px_rgba(34,211,238,0.45)]"
                      : "border-slate-800 bg-slate-900/50 hover:border-slate-600"
                  }`}
                >
                  <div className="relative h-40 w-full overflow-hidden bg-slate-950">
                    <img
                      src={s.image}
                      alt={s.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
                    <span className="absolute left-3 top-3 rounded border border-cyan-400/50 bg-slate-950/85 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                      Sample {idx + 1}: {s.title}
                    </span>
                    <span className="absolute right-3 top-3 rounded bg-rose-500/80 px-2 py-0.5 font-mono text-[10px] font-bold text-white">
                      {s.sim.severity}% JAM
                    </span>
                    <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between">
                      <span className="font-display text-sm font-semibold text-slate-100">{s.incident}</span>
                      <span className="font-mono text-[11px] text-emerald-300">{s.sector}</span>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col justify-between p-3.5">
                    <p className="line-clamp-2 text-xs leading-relaxed text-slate-400">{s.description}</p>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2 font-mono text-[11px]">
                      <span className="text-slate-500">{s.sim.route.length} intersections</span>
                      <span className={isSelected ? "font-semibold text-cyan-300" : "text-slate-400"}>
                        {isSelected ? "● ACTIVE SCENARIO" : "Select scenario →"}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main 2-column Triage Workbench */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* LEFT 5 COLS: Visual Input + Prompt Context */}
          <div className="panel flex flex-col justify-between p-5 lg:col-span-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="hud-label flex items-center gap-2">
                  <ImageIcon className="h-3.5 w-3.5 text-cyan-400" /> Scene Feed & Upload
                </span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/50 bg-cyan-500/10 px-3 py-1.5 font-mono text-xs text-cyan-200 transition hover:bg-cyan-500/20"
                >
                  <Upload className="h-3.5 w-3.5" /> Upload Road Photo
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Image preview frame with scanning laser */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="group relative h-56 w-full cursor-pointer overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950"
              >
                {previewUrl ? (
                  <img src={previewUrl} alt="Emergency feed" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-500">
                    Click to upload an incident photo
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-slate-950/40" />
                {analyzing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/75 backdrop-blur-xs">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
                    <p className="mt-3 px-4 text-center font-mono text-xs text-cyan-200">{scanStep}</p>
                  </div>
                )}
                <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between font-mono text-[11px] text-slate-300">
                  <span>
                    {uploadedFile
                      ? `CUSTOM UPLOAD · ${uploadedFile.name}`
                      : `${selectedSample?.tag.toUpperCase()} · ${selectedSample?.title}`}
                  </span>
                  <span className="rounded bg-slate-900/90 px-2 py-0.5 text-cyan-300 group-hover:bg-cyan-500/20">
                    Change image
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-slate-400">
                    Incident Classification
                  </label>
                  <input
                    type="text"
                    value={incidentTitle}
                    onChange={(e) => setIncidentTitle(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-slate-400">
                    Origin Sector
                  </label>
                  <select
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                  >
                    {["Sector 1", "Sector 2", "Sector 3", "Sector 4", "Sector 5", "Sector 6", "Sector 7", "Sector 8", "Sector 9"].map(
                      (sec) => (
                        <option key={sec} value={sec}>
                          {sec}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  Dispatcher Telemetry & Scene Context
                </label>
                <textarea
                  rows={3}
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/90 p-3 text-xs leading-relaxed text-slate-200 focus:border-cyan-400 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={analyzing}
              onClick={runAnalysis}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/70 bg-gradient-to-r from-emerald-500/25 via-cyan-500/25 to-emerald-500/25 px-5 py-3.5 font-display text-sm font-bold tracking-wider text-emerald-200 shadow-[0_0_30px_-6px_rgba(16,185,129,0.65)] transition hover:border-emerald-300 hover:text-white disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {analyzing ? "ANALYSING CORRIDOR TELEMETRY…" : "RUN GEMINI AI TRIAGE & COMPUTE GREEN WAVE"}
            </button>
          </div>

          {/* RIGHT 7 COLS: AI Structured Output & Corridor Deployment */}
          <div className="panel flex flex-col justify-between p-5 lg:col-span-7">
            {fallbackNotice && (
              <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-400/40 bg-amber-500/10 p-3 text-xs text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <span>{fallbackNotice}</span>
              </div>
            )}

            {!result ? (
              <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                  <Sparkles className="h-8 w-8" />
                </div>
                <h2 className="mt-4 font-display text-lg font-semibold text-slate-200">
                  Awaiting Emergency Scene Analysis
                </h2>
                <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-400">
                  Select one of the 3 sample emergency cards above or upload a road photo, then click{" "}
                  <span className="text-emerald-300">Run Gemini AI Triage</span> to compute congestion severity, pre-flush
                  intersections, and time saved.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <span className="hud-label flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Triage Output Locked
                    </span>
                    <h2 className="mt-0.5 font-display text-lg font-bold text-slate-100">
                      Corridor Pre-Flush Plan · {incidentTitle}
                    </h2>
                  </div>
                  <span className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1 font-mono text-[11px] text-cyan-300">
                    MODEL: {result.model}
                  </span>
                </div>

                {/* Top KPI Cards */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5">
                    <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-rose-300">
                      <ShieldAlert className="h-3.5 w-3.5" /> congestion_severity
                    </div>
                    <div className="mt-1 font-mono text-3xl font-bold text-rose-200">
                      {result.congestion_severity}%
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-900">
                      <div
                        className="h-full bg-gradient-to-r from-amber-400 to-rose-500"
                        style={{ width: `${result.congestion_severity}%` }}
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5">
                    <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-emerald-300">
                      <Clock className="h-3.5 w-3.5" /> estimated_time_saved_minutes
                    </div>
                    <div className="mt-1 font-mono text-2xl font-bold text-emerald-200">
                      {result.estimated_time_saved_minutes} min saved
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-emerald-300/80">
                      Std GPS {result.eta.standard}m → GreenWave {result.eta.greenwave}m
                    </div>
                  </div>

                  <div className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-3.5">
                    <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-cyan-300">
                      <Route className="h-3.5 w-3.5" /> optimal_corridor_path
                    </div>
                    <div className="mt-1 font-mono text-2xl font-bold text-cyan-200">
                      {result.optimal_corridor_path.length} junctions
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-cyan-300/80">
                      {result.eta.distKm} km pre-flushed @ 31 km/h
                    </div>
                  </div>
                </div>

                {/* Tactical 1-sentence AI dispatch directive */}
                <div className="rounded-xl border border-cyan-400/40 bg-slate-900/90 p-4">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-cyan-400">
                    ai_dispatch_note · Tactical Traffic Control Directive
                  </div>
                  <p className="mt-1.5 font-display text-base font-medium text-slate-100">
                    “{result.ai_dispatch_note}”
                  </p>
                </div>

                {/* Ordered intersections to pre-flush */}
                <div>
                  <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-400">
                    Pre-Flush Signal Sequence ({result.optimal_corridor_path.length} Intersections)
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {result.optimal_corridor_path.map((node, i) => (
                      <span
                        key={`${node}-${i}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 font-mono text-[11px] text-emerald-200"
                      >
                        <span className="text-emerald-400">{i + 1}.</span> {node}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Strict JSON response viewer */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-3.5">
                  <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <FileJson className="h-3.5 w-3.5 text-cyan-400" /> Strict JSON Schema Response
                    </span>
                    <span className="text-emerald-400">200 OK · Logged to Dispatch Ledger</span>
                  </div>
                  <pre className="max-h-40 overflow-auto font-mono text-[11px] leading-relaxed text-cyan-200">
                    {JSON.stringify(strictJsonPayload, null, 2)}
                  </pre>
                </div>

                {/* Action button to push directly into Tab 1 3D War Room */}
                <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={handleDeployToWarRoom}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-cyan-400 bg-cyan-500/20 px-5 py-3 font-display text-sm font-bold tracking-wider text-cyan-100 shadow-[0_0_25px_-5px_rgba(34,211,238,0.6)] transition hover:bg-cyan-500/30"
                  >
                    <Terminal className="h-4 w-4" />
                    DEPLOY CORRIDOR TO 3D CITY WAR ROOM
                    <ArrowUpRight className="h-4 w-4" />
                  </button>
                  {deployedBanner && (
                    <span className="font-mono text-xs text-emerald-300">
                      ✓ Dispatched to 3D War Room!
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
