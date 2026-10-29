// Supabase logging with automatic LocalStorage fallback.

import { createClient } from "@supabase/supabase-js";
import { HAS_SUPABASE, SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";
import { generateSeedRecords } from "./seed";

const TABLE = "emergency_dispatches";
const LS_KEY = "greenwave.dispatches.v1";

let client = null;
function getClient() {
  if (!HAS_SUPABASE) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  }
  return client;
}

function readLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {
    // corrupted storage — reseed below
  }
  const seeded = generateSeedRecords();
  writeLocal(seeded);
  return seeded;
}

function writeLocal(records) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(records.slice(0, 200)));
  } catch {
    // storage full or blocked — non-fatal for the demo
  }
}

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("Supabase timeout")), ms))]);

const normalise = (r) => ({
  ...r,
  optimal_corridor_path: Array.isArray(r.optimal_corridor_path) ? r.optimal_corridor_path : [],
  congestion_severity: Number(r.congestion_severity) || 0,
  estimated_time_saved_minutes: Number(r.estimated_time_saved_minutes) || 0,
  standard_eta_minutes: r.standard_eta_minutes == null ? null : Number(r.standard_eta_minutes),
  greenwave_eta_minutes: r.greenwave_eta_minutes == null ? null : Number(r.greenwave_eta_minutes),
});

export async function fetchDispatches(live) {
  const sb = live ? getClient() : null;
  if (sb) {
    try {
      const { data, error } = await withTimeout(
        sb.from(TABLE).select("*").order("created_at", { ascending: false }).limit(100),
        8000
      );
      if (error) throw error;
      return { records: data.map(normalise), source: "supabase", error: null };
    } catch (err) {
      return { records: readLocal(), source: "local", error: err.message || String(err) };
    }
  }
  return { records: readLocal(), source: "local", error: null };
}

export async function logDispatch(record, live) {
  const row = {
    incident_type: record.incident_type,
    sector: record.sector,
    congestion_severity: Math.round(record.congestion_severity),
    optimal_corridor_path: record.optimal_corridor_path,
    estimated_time_saved_minutes: record.estimated_time_saved_minutes,
    standard_eta_minutes: record.standard_eta_minutes,
    greenwave_eta_minutes: record.greenwave_eta_minutes,
    ai_dispatch_note: record.ai_dispatch_note,
    source: record.source,
    status: record.status || "dispatched",
  };

  const sb = live ? getClient() : null;
  if (sb) {
    try {
      const { data, error } = await withTimeout(sb.from(TABLE).insert(row).select().single(), 8000);
      if (error) throw error;
      return { record: normalise(data), source: "supabase", error: null };
    } catch (err) {
      const local = saveLocal(row);
      return { record: local, source: "local", error: err.message || String(err) };
    }
  }
  return { record: saveLocal(row), source: "local", error: null };
}

function saveLocal(row) {
  const record = {
    id: `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    created_at: new Date().toISOString(),
    ...row,
  };
  writeLocal([record, ...readLocal()]);
  return record;
}

export function resetLocal() {
  const seeded = generateSeedRecords();
  writeLocal(seeded);
  return seeded;
}
