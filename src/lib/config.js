// Environment detection for Live AI vs Demo Simulation mode.

const env = import.meta.env;

export const GEMINI_API_KEY = (env.VITE_GEMINI_API_KEY || "").trim();
export const SUPABASE_URL = (env.VITE_SUPABASE_URL || "").trim();
export const SUPABASE_ANON_KEY = (env.VITE_SUPABASE_ANON_KEY || "").trim();

// gemini-2.5-flash is a legacy model; the current Flash model is the default.
// Override with VITE_GEMINI_MODEL if you need a specific model id.
export const GEMINI_MODEL = (env.VITE_GEMINI_MODEL || "gemini-3.8-flash").trim();

export const HAS_GEMINI = GEMINI_API_KEY.length > 0;
export const HAS_SUPABASE = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
export const LIVE_READY = HAS_GEMINI && HAS_SUPABASE;

export const MISSING_KEYS = [
  !HAS_GEMINI && "VITE_GEMINI_API_KEY",
  !SUPABASE_URL && "VITE_SUPABASE_URL",
  !SUPABASE_ANON_KEY && "VITE_SUPABASE_ANON_KEY",
].filter(Boolean);
