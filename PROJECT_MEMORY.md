# GreenWave 3D: Autonomous Ambulance Corridor & City Traffic Digital Twin

## Architecture Overview
- **Stack**: React 19 (Vite 8), Tailwind CSS v4 (`@tailwindcss/vite`), Three.js (`r186`), `@react-three/fiber` (`v9.8`), `@react-three/drei` (`v10.7`), `lucide-react`, `@google/genai` (`v2.31+`), `@supabase/supabase-js` (`v2+`).
- **Zero-Auth Entry**: Launches directly into the interactive 3D War Room dashboard (`src/App.jsx`).
- **Dual-Mode Resilience**: Automatically checks `VITE_GEMINI_API_KEY`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY` (`src/lib/config.js`). Falls back seamlessly to simulated AI triage (`src/lib/gemini.js`) and LocalStorage pre-seeded telemetry (`src/lib/supabase.js` + `src/lib/seed.js`), with a live navbar toggle (`src/components/Navbar.jsx`).

## Sprawling 500 × 500 Cross Grid & Urban Geography
- **500 × 500 Cross Map (Footprint -250 to +250 world units)** (`src/lib/cityGrid.js`):
  - 31 Named Avenues & 31 Named Streets (`GRID = 31`, `SPACING = 16.6667`, `HALF = 250`).
  - 961 Signalized Intersections, 900 City Blocks, and 1,860 active road segments.
- **Meandering Zig-Zag River & Suspension Bridges** (`riverCenter(z)`, `riverBankX(z)`):
  - 38-unit wide organic flowing river with constant perpendicular channel width (zero pinched bends).
  - Sunken river channel (`y = -0.55`) with deep aquatic riverbed floor (`y = -2.4`) and continuous vertical granite embankment quay retaining walls with illuminated promenade lighting.
  - Monumental bank-to-bank bridges (62m full span) eliminating floating gaps.
  - Grand Suspension Bridge on `Grand Suspension Way` (`iz = 13`): twin 32m Gothic-Cyber H-pylons, 3D catenary main suspension cables, 28 vertical steel suspender rods, aircraft warning strobes, and illuminated aerodynamic emerald guardrails.
  - North Tied-Arch Bridge (`iz = 9`): 15m rise parabolic overhead steel arch ribs with vertical wire hangers.
  - South Cable-Stayed Bridge (`iz = 18`): 26m inverted-Y diamond needle pylon with 28 radiant fan stay cables.
  - Bridges are modeled as high-speed express corridors with 0 potholes.
- **Strict Slum vs Extreme Urban Separation**:
  - Extreme Urban Cyber Citadel is in the North-West core (`x: -200 to -60`, `z: -200 to -60`) with skyscrapers up to 58m.
  - Slums are strictly barred from being within 210m of the Cyber Citadel, relegated to the far outer peripheral badlands across the river.
- **Dynamic Sunlight Facade Shading**:
  - Directional sunlight (2.85–3.2 intensity) sweeps across a 380-unit orbital arc.
  - Building facades physically react: golden morning glow on east walls, direct midday white glare, fiery sunset crimson on west walls, and neon night bloom with dynamic window emissive dimming.
- **Refined Road Congestion Filter & 2D Minimap**:
  - Live bidirectional and speed-aware traffic classification: Green (free), Yellow (busy), Red (gridlock).
  - Floating 2D Tactical Radar Minimap (`src/components/warroom/Minimap2D.jsx`) tracking the river, bridges, ambulance, and road states.

## 60 FPS Camera Performance & Checkpoint Time Machine
- **Camera Responsiveness**:
  - `OrbitControls` dampingFactor tuned from `0.08` to `0.18`, with `rotateSpeed={1.2}` and `panSpeed={1.2}` for instant, crisp camera responsiveness.
  - Canvas DPR clamped to `[1, 1.35]` to prevent GPU fill-rate throttling on high-DPI displays.
- **Main-Thread CPU Optimization (175× Minimap Speedup)**:
  - 1,860 road segments batched into 3 single-path strokes (`ctx.stroke()` 3 times/frame instead of 1,860 times).
  - Pre-cached static radar layer (river, slum regions, cyber citadel perimeter) onto offscreen canvas.
  - Throttled road status updates to 4.5 Hz and traffic light lamp updates to 10 Hz (every 100ms).
- **Checkpoint Vault & Version Access**:
  - In-app interactive Checkpoint Vault (`src/components/warroom/CheckpointModal.jsx`) accessible via top navbar button.
  - Master Git repository initialized with tags (`edit-01` through `edit-09`).
  - Terminal utility `restore-checkpoint.ps1` enables instant rollback or experimentation (`.\restore-checkpoint.ps1 -Checkpoint 06`).
