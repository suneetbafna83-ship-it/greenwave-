# GreenWave 3D: Autonomous Ambulance Corridor & City Traffic Digital Twin

## Branching & Checkpoint Rule (User Mandate)
- NEVER commit directly to `main`.
- ALWAYS create a new branch named after the checkpoint (e.g. `checkpoint-11`, `checkpoint-12`, `checkpoint-13`, etc.) when saving or pushing work.

## Checkpoint 13: Interactive 2D Radar Drop Pinning & Aero-Glass Translucency (2026-10-31)
- **Interactive 2D Minimap Pin Dropping**: Click/tap anywhere across the 2D tactical radar to drop a destination pin. Automatically snaps to the nearest connected road node (`nearestRoadNodeFromWorld`) with crosshairs and pulsating beacon.
- **Removed Dropdown**: Replaced the "Emergency Incident Location" selector dropdown with a live "Pinned Drop Destination" HUD tile displaying the active junction name and `[x, z]` coordinates.
- **Hospital Round-Trip Preserved**: Ambulance spawn point remains locked at St. Aurora Medical ER Bay (`HOSPITAL.node` = `[23, 7]`). Dispatch triggers full round trip: Hospital -> Outbound to Pinned Target -> On Scene triage -> Inbound return to Hospital ER -> Admitted.
- **Enhanced Translucent Aero-Glass**:
  - Refined `.panel` and `.panel-subtle` in `src/index.css` to `background: rgba(8, 12, 24, 0.42)` with `backdrop-filter: blur(24px) saturate(150%)`.
  - Floating top dock (clock, camera segmented control, overlay filters), floating minimap container (`bg-[#070b16]/45 backdrop-blur-2xl`), and bottom HUD legend all updated for clean translucency letting the 3D metropolis shine through.
- **Zero 3D City Changes**: Metropolitical geometry, bridges, roads, and physics preserved 100%. All regression suites pass.

## Checkpoint 12: Hospital Spawn Point & Round-Trip Emergency Mission Cycle (2026-10-31)
- **Hospital Permanent Spawn Point**: Ambulance home base permanently anchored at St. Aurora Riverfront Medical (`HOSPITAL.node` = `[23, 7]`).
- **Emergency Destination Selection**: Replaced old "Dispatch Origin" with "Emergency Incident Location" selector with presets (`EMERGENCY_DESTINATIONS`: Sector 4 Cyber Citadel, Sector 1 North Waterfront, Sector 7 Grand Bridge Midspan, Sector 9 Slum Post, Sector 5 Metro Central) and dynamic city hotspot incident dispatch.
- **Full Round-Trip Mission State Machine**:
  - `OUTBOUND` (Responding): Dispatches from Hospital to destination scene with real-time GreenWave corridor pre-flushing.
  - `ON_SCENE` (Triage): Halts at scene for 2.5s triage countdown, preparing patient for transport.
  - `INBOUND` (Returning): Swaps route to dynamically-calculated return corridor to Hospital ER with patient secured on board.
  - `COMPLETED` (Admitted): Reaches Hospital ER, logs mission completion and admission, and enters standby cooldown.
- **UI & Minimap**:
  - `WarRoom.jsx`: Visual 4-phase mission step tracker (`Outbound` -> `On Scene` -> `Return ER` -> `Admitted`), fixed hospital spawn badge, patient status pill (`Outbound` / `Loading` / `On Board`).
  - `Minimap2D.jsx`: Live pulsating radar beacon highlighting the targeted incident location alongside hospital and vehicle positions.
  - Preserved 100% of 3D city geometry, road layouts, and physics. All regression suites pass.

## Current map: mixed-streets-v2 (2026-10-30)
- `src/lib/roadLayout.js` authors the circular boulevard, one-way roundabout, triangular/hexagonal/rectangular loops and straight ordinary streets/connectors. Background coordinate jitter and sine bulges are removed. Logical node IDs are retained; `nodePosition`, `segmentGeometry`, `directedRoadSample`, `roadLength` and `routePolyline` supply world geometry.
- `cityGrid.js` filters the mixed layout for protected riverbanks and returnable connectivity: 811 roads / 671 active junctions; three bridge spans stay aligned with their original abutments.
- `src/lib/trafficFurniture.js` places 852 roadside signals at 257 junctions, using global driving-surface clearance of 0.8 units and no unsafe fallback. 1.8-unit footways, discrete paved bases, and reserved building space keep posts off asphalt. `pnpm test:signals` checks post/lamp/pad clearance and approach coverage.
- Simulation, renderers, hazard placement, road picking, and minimap all use actual centerlines and lengths. Bends are unsignalized; preflush counts actual junctions. Building footprints and park planting avoid roads.
- `pnpm test:roads` checks complete shape loops, bridge alignment, endpoint continuity, one-way direction and hazard distances. Training and river regression suites pass.
- New reports/fingerprints include `ROAD_LAYOUT_VERSION`; current-map analytics exclude older grid reports from aggregate means, while retaining their history.

## Current addition: GreenWave XR Mission Training (2026-10-30)
- The app now opens in a dedicated training tab; the original War Room remains a separate sandbox.
- `src/lib/training.js` owns three playable missions, planning/activation, closure response, paired simulations, metrics, and local report persistence.
- `src/components/training/` provides desktop controls, native Three.js WebXR tabletop/controller ray interaction, and shared measured comparison/report UI. No new runtime dependencies.
- Paired runs share seed, initial traffic/signal state, initial route, closures, and ambulance speed limit; fixed 1/30 s steps; a shared observation window ending at both arrivals or 480 s. Random surges and bus dwell are disabled for controlled missions. Metrics are simulation seconds, not real-world calibration.
- Analytics now uses recorded training results. Legacy dispatch estimates/demo rows are separate. Reports persist under LocalStorage `greenwave.training.v1` and export JSON/CSV.
- Scripts: `pnpm test:training`, `pnpm test:river`, `pnpm build`. Browser checks completed all three missions and persisted results. Physical headset/controller testing is still outstanding; the preview browser has no immersive device.
- The protected river leaves 847 road nodes and 1,582 road segments with three landmark bridges. Older checkpoint descriptions below document historical implementations.

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
  - Master Git repository initialized with tags (`edit-01` through `edit-10`).
  - Terminal utility `restore-checkpoint.ps1` enables instant rollback or experimentation (`.\restore-checkpoint.ps1 -Checkpoint 06`).

## Adaptive traffic policy (2026-10-30)
- trafficPolicy.js scores directional queues, road length/hazards, crossing demand and urgency. Reviews every simulation second/junction; six-second reroute cooldown plus 8% score threshold; closures bypass cooldown. Occupied edge and journey time preserved.
- Selective clearance at next three junctions; normal/urgent cross limits 3/5; critical prioritizes arrival if no accepted detour. Reports store policyVersion, urgency and decisionHistory; ordinary-signals reference unchanged.
- Shared 100ms simulation-time traffic samples feed both maps. Minimap uses actual centerlines, square/DPI scaling and remaining-route trimming.
- Checks: test:adaptive, test:training, test:roads, test:signals, build. Browser verified urgency/decision panels, active dispatch and minimap geometry.
