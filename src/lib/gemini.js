// Gemini multimodal triage with a bulletproof simulated fallback.

import { GoogleGenAI } from "@google/genai";
import { GEMINI_API_KEY, GEMINI_MODEL, HAS_GEMINI } from "./config";
import {
  ALL_INTERSECTIONS,
  DEFAULT_ROUTE,
  HOSPITAL,
  etaMinutes,
  routeFromNames,
  routeNames,
  routeBetween,
  intersectionName,
  round1,
} from "./cityGrid";

const SCHEMA = {
  type: "object",
  properties: {
    congestion_severity: {
      type: "integer",
      description: "Congestion severity as a percentage from 0 to 100.",
    },
    optimal_corridor_path: {
      type: "array",
      items: { type: "string" },
      description: "Ordered list of intersections to pre-flush, using ONLY the provided intersection names.",
    },
    estimated_time_saved_minutes: {
      type: "number",
      description: "Minutes saved by the GreenWave pre-flush corridor versus standard GPS routing.",
    },
    ai_dispatch_note: {
      type: "string",
      description: "One tactical sentence for traffic control operators.",
    },
  },
  required: ["congestion_severity", "optimal_corridor_path", "estimated_time_saved_minutes", "ai_dispatch_note"],
};

const SYSTEM = `You are GreenWave, an autonomous traffic-signal controller for a city digital twin.
You analyse emergency road scenes and plan ambulance "green wave" corridors.
The city is a 7x7 grid. Valid intersection names (use these EXACT strings only):
${ALL_INTERSECTIONS.join("; ")}.
The destination hospital (${HOSPITAL.name}) sits at "${intersectionName(...HOSPITAL.node)}".
Unless the scene states otherwise, the ambulance starts at the Sector 4 dispatch base "${intersectionName(0, 4)}".
optimal_corridor_path must be an ordered, contiguous route (consecutive entries share a street or avenue) from the start to the hospital, 5–14 entries.
Time-saved model: each block is 400 m. Standard GPS speed under congestion severity s (0–1) is (32 − 23·s) km/h. A GreenWave pre-flushed corridor sustains 31 km/h. estimated_time_saved_minutes = standard minutes − GreenWave minutes, one decimal.
ai_dispatch_note must be ONE imperative sentence naming concrete streets.
Respond with JSON only.`;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function extractText(interaction) {
  if (interaction?.output_text) return interaction.output_text;
  const steps = interaction?.steps || [];
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i];
    if (s.type === "model_output" && Array.isArray(s.content)) {
      const text = s.content.filter((c) => c.type === "text").map((c) => c.text).join("");
      if (text) return text;
    }
  }
  throw new Error("Gemini returned no text output");
}

// Validate & repair the model output so the 3D corridor is always drivable.
function sanitise(raw, fallbackSeverity = 85) {
  const severity = Math.max(0, Math.min(100, Math.round(Number(raw.congestion_severity) || fallbackSeverity)));
  const route = routeFromNames(raw.optimal_corridor_path);
  const eta = etaMinutes(route, severity);
  const saved = Number(raw.estimated_time_saved_minutes);
  return {
    congestion_severity: severity,
    optimal_corridor_path: routeNames(route),
    estimated_time_saved_minutes: Number.isFinite(saved) && saved > 0 ? round1(saved) : eta.saved,
    ai_dispatch_note: String(raw.ai_dispatch_note || "Pre-flush the corridor three junctions ahead of the unit.").trim(),
    route,
    eta,
  };
}

export async function analyzeWithGemini({ text, image }) {
  if (!HAS_GEMINI) throw new Error("VITE_GEMINI_API_KEY missing");
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const input = [
    {
      type: "text",
      text: `${SYSTEM}\n\nEMERGENCY INPUT:\n${text || "Analyse the attached road scene for an ambulance dispatch."}`,
    },
  ];
  if (image) input.push({ type: "image", data: image.data, mime_type: image.mimeType });

  const request = ai.interactions.create({
    model: GEMINI_MODEL,
    input,
    response_format: { type: "text", mime_type: "application/json", schema: SCHEMA },
    store: false,
  });
  const interaction = await Promise.race([
    request,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Gemini request timed out")), 30000)),
  ]);
  const parsed = JSON.parse(extractText(interaction).replace(/^```json\s*|```$/g, "").trim());
  return { ...sanitise(parsed), engine: "gemini", model: GEMINI_MODEL };
}

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const UPLOAD_NOTES = [
  "Hard-hold cross streets on Ring Rd for 35s and flush Central Ave northbound ahead of the unit.",
  "Meter inflow from Lake Rd to 30% and run a continuous green band up Metro Ave.",
  "Lock Park St eastbound green, release queued vehicles at Central Ave first, then hand off to Hospital Ave.",
  "Clear the blocked junction via Tech Park Ave detour and pre-flush three signals ahead of the ambulance.",
];

// Deterministic, realistic offline analysis used in Demo mode or on any API failure.
export async function analyzeSimulated({ sample, fileKey }) {
  await wait(1700);
  if (sample) {
    const { severity, route, note } = sample.sim;
    const eta = etaMinutes(route, severity);
    return {
      congestion_severity: severity,
      optimal_corridor_path: routeNames(route),
      estimated_time_saved_minutes: eta.saved,
      ai_dispatch_note: note,
      route,
      eta,
      engine: "simulated",
      model: "GreenWave Sim Engine v2",
    };
  }
  const h = hashString(fileKey || String(Date.now()));
  const severity = 76 + (h % 22);
  const route = h % 3 === 0 ? DEFAULT_ROUTE : routeBetween([h % 2, 3 + (h % 4)], HOSPITAL.node, 2 + (h % 3));
  const eta = etaMinutes(route, severity);
  return {
    congestion_severity: severity,
    optimal_corridor_path: routeNames(route),
    estimated_time_saved_minutes: eta.saved,
    ai_dispatch_note: UPLOAD_NOTES[h % UPLOAD_NOTES.length],
    route,
    eta,
    engine: "simulated",
    model: "GreenWave Sim Engine v2",
  };
}

// Downscale an image (File or URL) to a JPEG ≤ 1280px and return base64 for Gemini.
export async function imageToBase64(src) {
  const url = typeof src === "string" ? src : URL.createObjectURL(src);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not load image"));
      el.src = url;
    });
    const scale = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    return { data: dataUrl.split(",")[1], mimeType: "image/jpeg" };
  } finally {
    if (typeof src !== "string") URL.revokeObjectURL(url);
  }
}
