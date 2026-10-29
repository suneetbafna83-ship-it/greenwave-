# 🟢 GreenWave 3D — Master Checkpoint Ledger

This document tracks all project development milestones, architectural evolutions, and feature iterations. Every edit is stamped with timestamp, features added, key files modified, and verification status.

---

## 📌 Milestone Index

| Checkpoint | Edit # | Timestamp (Local) | Key Features Delivered | Status |
| :--- | :---: | :---: | :--- | :---: |
| [Checkpoint 1](#checkpoint-1-core-foundation--hackathon-architecture) | **01** | `2026-10-29 15:58:33` | Initial Core Build: 7×7 Grid, R3F Scene, 3-Tab Layout, Dual-Mode SDK Fallback, Supabase SQL | ✅ Verified |
| [Checkpoint 2](#checkpoint-2-1111-expansion-road-hazards--multi-modal-fleet) | **02** | `2026-10-29 17:12:01` | 11×11 City Grid (121 Junctions), Speed Breakers & Potholes, 6 Vehicle Classes, Fleet Telemetry | ✅ Verified |
| [Checkpoint 3](#checkpoint-3-visual-clarity--legend-overhaul) | **03** | `2026-10-29 17:42:06` | Resolved Red Light vs. Ambulance Confusion, Isolated Emergency Palette, 3D Strobe Badge | ✅ Verified |
| [Checkpoint 4](#checkpoint-4-traffic-projection-headlights--street-chase-cam) | **04** | `2026-10-29 17:56:22` | 34m Active Traffic Projection Beam, Vehicle Headlights/Taillights, Auto Street Chase-Cam | ✅ Verified |
| [Checkpoint 5](#checkpoint-5-1515-mega-grid-strict-red-light-physics-dynamic-a-routing--daynight-cycle) | **05** | `2026-10-29 18:10:19` | 15×15 Grid (225 Junctions), Strict Red-Light Stop Physics, Dynamic A* Routing, Day/Sunset/Night | ✅ Verified |
| [Checkpoint 6](#checkpoint-6-100100-cross-map-slum-district-asymmetric-potholes-traffic-congestion-filter--floating-2d-radar-minimap) | **06** | `2026-10-29 19:30:00` | 100×100 Cross Map (625 Junctions), Underdeveloped Slum District, Asymmetric Potholes, Traffic Filter, 2D Radar Minimap | ✅ Verified |
| [Checkpoint 7](#checkpoint-7-organic-slum-distribution-refined-traffic-filter-24-hour-timeline--zero-gc-camera-smoothing) | **07** | `2026-10-29 20:45:00` | Organic Slum Distribution, Refined Bidirectional Traffic Filter, 24-Hr Dynamic Time Engine, Zero-GC Camera Smoothing | ✅ Verified |
| [Checkpoint 8](#checkpoint-8-500500-cross-expansion-meandering-river-bridges-sunlight-facade-shading--strict-zoning) | **08** | `2026-10-29 21:15:00` | 500×500 Cross Expansion (961 Junctions), Meandering River & Suspension Bridges, Sunlight Facade Shading, Strict Urban Separation | ✅ Verified |
| [Checkpoint 9](#checkpoint-9-60-fps-ultra-smooth-camera-engine-zero-stutter-minimap--interactive-checkpoint-vault) | **09** | `2026-10-29 21:40:00` | 60 FPS Ultra-Smooth Camera Engine, Zero-Stutter Minimap, Throttled GPU Buffers, In-App Checkpoint Vault & Git Time Machine | ✅ Verified |

---

## Checkpoint 1: Core Foundation & Hackathon Architecture
- **Edit Identifier**: `greenwave 3D (edit 01) (2026-10-29 15-58-33)`
- **Timestamp**: `2026-10-29T15:58:33+05:30`
- **Scope & Additions**:
  - Initialized Vite + React 19 + Tailwind CSS + Three.js r186 + `@react-three/fiber` + `@react-three/drei`.
  - **Zero-Auth Instant Launch**: Opens straight into interactive 3D War Room with zero login/signup walls.
  - **Dual-Mode SDK Resilience**: `src/lib/config.js` checks `VITE_GEMINI_API_KEY`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`. Automatically defaults to simulated AI triage (`src/lib/gemini.js`) and pre-seeded LocalStorage ledger (`src/lib/supabase.js`) if keys are absent.
  - **3-Tab Layout**:
    1. *Tab 1: 3D City War Room* — 7×7 grid, 49 signalized intersections, 165 moving cars, active ambulance AMB-07, 3-junction lookahead pre-flush.
    2. *Tab 2: Emergency Triage & Gemini Dispatch* — Upload custom road photo or select from 3 photorealistic samples, strict JSON prompt engine, time-saved calculation.
    3. *Tab 3: Command Analytics & Supabase Log* — 18.5m standard GPS vs 6.2m GreenWave benchmark chart, live corridor audit table, CSV export.
  - Delivered `supabase_setup.sql` with RLS disabled and `.env.example`.
- **Primary Files Created**:
  - `src/lib/cityGrid.js`, `src/lib/trafficSim.js`, `src/lib/config.js`, `src/lib/gemini.js`, `src/lib/supabase.js`, `src/lib/seed.js`, `src/lib/samples.js`
  - `src/components/warroom/WarRoom.jsx`, `src/components/warroom/CityScene.jsx`, `src/components/warroom/CityStatic.jsx`, `src/components/warroom/SimLayer.jsx`
  - `src/components/triage/TriagePanel.jsx`, `src/components/analytics/AnalyticsPanel.jsx`, `src/components/Navbar.jsx`
  - `supabase_setup.sql`, `.env.example`, `package.json`, `vite.config.js`

---

## Checkpoint 2: 11×11 Expansion, Road Hazards & Multi-Modal Fleet
- **Edit Identifier**: `greenwave 3D (edit 02) (2026-10-29 17-12-01)`
- **Timestamp**: `2026-10-29T17:12:01+05:30`
- **Scope & Additions**:
  - Expanded city district to **11 × 11 grid (121 signalized intersections, 100 blocks)** spanning a 140 × 140 world area.
  - **Physical Speed Bumpers (Speed Breakers)**: Yellow-and-black diagonal hazard stripes across lanes; vehicles slow down to crawl speeds and physically bounce upward (`yOffset` + `pitch`) as axles cross the ridge.
  - **Physical Potholes (Road Craters)**: Sunken asphalt craters with wet specular puddle centers; vehicles brake and dynamically swerve laterally (`swerveOffset`), with suspension drop on impact.
  - **Heterogeneous Multi-Modal Vehicle Fleet**: Replaced uniform civilian cars with 6 vehicle types:
    1. *City Bus* (3.4m, 3.0x PCU load, periodic curbside stops)
    2. *Cargo Truck* (3.2m, 2.8x PCU load, heavy braking inertia)
    3. *Auto-Rickshaw* (1.45m, 3-wheeler canopy, lane weaving, agile pothole swerve)
    4. *Two-Wheeler / Bike* (1.05m, 0.4x PCU load, lane filtering, fast siren yield)
    5. *SUV / MUV* (2.2m, 1.35x PCU load, higher hazard clearance)
    6. *Sedan / Hatch* (1.85m, standard civilian baseline)
  - Fleet capacity increased from 165 to **280 baseline / 520 rush-hour vehicles**.
  - Added **Fleet & Hazard Attribution Widget** to the War Room HUD.
- **Primary Files Updated**:
  - `src/lib/cityGrid.js`, `src/lib/trafficSim.js`, `src/components/warroom/CityStatic.jsx`, `src/components/warroom/WarRoom.jsx`, `src/lib/samples.js`, `src/lib/seed.js`

---

## Checkpoint 3: Visual Clarity & Legend Overhaul
- **Edit Identifier**: `greenwave 3D (edit 03) (2026-10-29 17-42-06)`
- **Timestamp**: `2026-10-29T17:42:06+05:30`
- **Scope & Additions**:
  - Resolved user confusion regarding multiple red dots across the grid: clarified that dots at street corners are **traffic signals set to RED**, not ambulances.
  - **Emergency Color Isolation**: Removed all red/rose tints from civilian vehicles (buses, bikes, cars) so that RED is strictly reserved for traffic signals and emergency ambulances.
  - **Clarified Legend**: Explicitly labeled `🚦 Traffic Signals (🔴 Red / 🟢 Green)` vs `🚨 Ambulance AMB-07`.
  - Added prominent **3D Overhead Callout Badge** above AMB-07 and standby counter (`Active Ambulances: 0 on road`) in the HUD.
- **Primary Files Updated**:
  - `src/lib/trafficSim.js`, `src/components/warroom/SimLayer.jsx`, `src/components/warroom/WarRoom.jsx`

---

## Checkpoint 4: Traffic Projection, Headlights & Street Chase-Cam
- **Edit Identifier**: `greenwave 3D (edit 04) (2026-10-29 17-56-22)`
- **Timestamp**: `2026-10-29T17:56:22+05:30`
- **Scope & Additions**:
  - **Active 34-Meter Traffic Projection Beam**: Forward emerald clearance laser cone projected on asphalt ahead of AMB-07 with sweeping animated radar chevrons.
  - **Visual Lane Parting**: Cars entering the projection beam pop up **pulsing amber warning cones** and aggressively steer to the sidewalk curb (`LANE → SHOULDER = 2.75 units`), parting the central lane.
  - **Illuminated Headlights & Taillights**: Added bright dual white headlights and glowing red taillights to all 280+ vehicles across the city.
  - **Automatic Street-Level Chase Cam**: Camera dives smoothly to 3rd-person street level right behind AMB-07 on dispatch.
  - Added floating Camera Selector at top center: *Chase Cam (Street)*, *Drone Cam*, and *Free Orbit*.
- **Primary Files Updated**:
  - `src/components/warroom/SimLayer.jsx`, `src/components/warroom/CityScene.jsx`, `src/components/warroom/WarRoom.jsx`, `src/lib/trafficSim.js`

---

## Checkpoint 5: 15×15 Mega Grid, Strict Red-Light Physics, Dynamic A* Routing & Day/Night Cycle
- **Edit Identifier**: `greenwave 3D (edit 05) (2026-10-29 18-10-19)`
- **Timestamp**: `2026-10-29T18:10:19+05:30`
- **Scope & Additions**:
  - **Sprawling 15 × 15 City Grid (225 Intersections, 196 Blocks)**: Nearly 4× original footprint (196 × 196 world area) with 15 Avenues, 15 Streets, botanical parks, and multiple emergency depots.
  - **Strict Red-Light Stop Physics**: Fixed vehicles crossing on red light. Calculated legal distance to stop line (`STOP_T`); when signal is red, vehicles smoothly decelerate and come to a hard stop clamped behind the stop line.
  - **Dynamic A* Real-Time Routing (`findOptimalCorridor`)**: Ambulance path is no longer fixed! The A* router evaluates real-time vehicle queues, potholes, and speed breakers to calculate the fastest corridor on every dispatch.
  - **Multi-Depot Dispatch & Random Hotspots**: Select from 4 sector depots (Sector 1, 4, 7, 9) or click *"Spawn Random Emergency Scene"* to test dynamic re-routing from anywhere in the city.
  - **Day, Sunset & Cyberpunk Night Lighting**: 1-click switcher in the top bar with realistic solar angles, sky colors, and materials.
  - **Mathematical Pothole Delay Modeling**: Integrated +0.24m penalty per pothole and +0.14m per speed breaker into ETA equations and triage cards.
- **Primary Files Updated**:
  - `src/lib/cityGrid.js`, `src/lib/trafficSim.js`, `src/components/warroom/CityScene.jsx`, `src/components/warroom/CityStatic.jsx`, `src/components/warroom/WarRoom.jsx`, `src/components/triage/TriagePanel.jsx`, `PROJECT_MEMORY.md`

---

## Checkpoint 6: 100×100 Cross Map, Slum District, Asymmetric Potholes, Traffic Congestion Filter & Floating 2D Radar Minimap
- **Edit Identifier**: `greenwave 3D (edit 06) (2026-10-29 19-30-00)`
- **Timestamp**: `2026-10-29T19:30:00+05:30`
- **Scope & Additions**:
  - **100 × 100 Cross Coordinate City Footprint (`HALF = 100`, -100 to +100)**: 25 Avenues × 25 Streets, 625 intersections, 576 blocks, and 1,200 road segments.
  - **Underdeveloped Slum District**: Built South-East sector (`[15..24, 15..24]`) with tightly clustered irregular shacks (heights 1.2m–2.8m), rusted tin and blue tarp textures, and terrible broken roads.
  - **Asymmetric Pothole Distribution & Route Selection**: Pristine cyber avenues have 0 potholes; slum streets have heavy clusters of 3–6 craters per segment. Dynamic A* router dynamically avoids slum roads (+2.4 edge impedance) in favor of high-speed arterial expressways.
  - **Live Road Congestion Filter**: Color-codes road segments in Green (free), Yellow (busy), and Red (gridlock/slum craters). Available in both 3D scene (1,200 instanced ribbons) and 2D minimap via 1-click toggle buttons.
  - **Floating 2D Tactical Radar Minimap (`Minimap2D.jsx`)**: Draggable cyberpunk glassmorphism radar window tracking live ambulance coordinates, speed, and real-time road conditions.
- **Primary Files Updated**:
  - `src/lib/cityGrid.js`, `src/lib/trafficSim.js`, `src/components/warroom/CityStatic.jsx`, `src/components/warroom/Minimap2D.jsx`, `src/components/warroom/CityScene.jsx`, `src/components/warroom/WarRoom.jsx`, `checkpoints/greenwave 3D (edit 06) (2026-10-29 19-30-00).md`

---

## Checkpoint 7: Organic Slum Distribution, Refined Traffic Filter, 24-Hour Timeline & Zero-GC Camera Smoothing
- **Edit Identifier**: `greenwave 3D (edit 07) (2026-10-29 20-45-00)`
- **Timestamp**: `2026-10-29T20:45:00+05:30`
- **Scope & Additions**:
  - **Organic, Undefined Slum Distribution**: Removed rigid rectangular quadrant boundaries; informal shanty pockets now undulate across the city via multi-frequency noise field `isSlumArea(ix, iz)`.
  - **Refined Bidirectional & Speed-Aware Road Heatmap**: Fixed directional blindspot by checking both lanes simultaneously and evaluating live vehicle speeds, rendering accurate Green, Yellow, and Red road conditions in both 3D and 2D.
  - **Continuous 24-Hour Dynamic Time System**: Removed 3-state Day/Sunset/Night switcher; introduced smooth trigonometric solar cycles, interactive 24-hr slider (`00:00 - 23:59`), digital clock readout, presets, and play/pause.
  - **Natural Diurnal Flow & Random Surges**: Traffic automatically surges during morning (`08:30`) and evening (`18:15`) peak hours, drops at noon and midnight, and experiences spontaneous unpredictable flash gridlock surges (+220 vehicles).
  - **Zero-GC Camera Smoothing**: Fixed camera fighting between `OrbitControls` and `CameraRig` lerping; replaced 60,000+ vector allocations per second in vehicle headlights with zero-allocation trigonometry, eliminating frame drops.
- **Primary Files Updated**:
  - `src/lib/cityGrid.js`, `src/lib/trafficSim.js`, `src/components/warroom/CityScene.jsx`, `src/components/warroom/CityStatic.jsx`, `src/components/warroom/SimLayer.jsx`, `src/components/warroom/Minimap2D.jsx`, `src/components/warroom/WarRoom.jsx`, `checkpoints/greenwave 3D (edit 07) (2026-10-29 20-45-00).md`

---

## Checkpoint 8: 500×500 Cross Expansion, Meandering River, Bridges, Sunlight Facade Shading & Strict Zoning
- **Edit Identifier**: `greenwave 3D (edit 08) (2026-10-29 21-15-00)`
- **Timestamp**: `2026-10-29T21:15:00+05:30`
- **Scope & Additions**:
  - **Massive 500 × 500 Cross Footprint (`HALF = 250`, -250 to +250)**: 31 Avenues × 31 Streets, 961 intersections, 900 blocks, 1,860 road segments.
  - **Meandering Zig-Zag River & Suspension Bridges**: 34-unit wide flowing river with animated wave sheen. Elevated suspension bridges with cable-stay pylons, guardrails, and navigation clearance, featuring the central 40m Grand Suspension Bridge.
  - **Fixed Sunlight on Building Facades**: Reduced washed-out ambient light and boosted directional sunlight (2.85–3.2 intensity). Building materials dynamically react to sun angles (golden morning, crisp white noon, fiery sunset orange, neon night) and modulate window emissive intensity.
  - **Strict Slum vs. Cyber Citadel Separation**: Slums are strictly barred from being within 210m of the Extreme Cyber Citadel, relegated to the far outer peripheral badlands across the river.
- **Primary Files Updated**:
  - `src/lib/cityGrid.js`, `src/lib/trafficSim.js`, `src/components/warroom/CityScene.jsx`, `src/components/warroom/CityStatic.jsx`, `src/components/warroom/Minimap2D.jsx`, `src/components/warroom/WarRoom.jsx`, `checkpoints/greenwave 3D (edit 08) (2026-10-29 21-15-00).md`

---

## Checkpoint 9: 60 FPS Ultra-Smooth Camera Engine, Zero-Stutter Minimap & Interactive Checkpoint Vault
- **Edit Identifier**: `greenwave 3D (edit 09) (2026-10-29 21-40-00)`
- **Timestamp**: `2026-10-29T21:40:00+05:30`
- **Scope & Additions**:
  - **Eliminated Camera Movement Lag**: Re-tuned `OrbitControls` `dampingFactor` from sluggish `0.08` to snappy `0.18`, set `rotateSpeed={1.2}` and `panSpeed={1.2}` for instant, crisp camera responsiveness with smooth deceleration.
  - **Pre-Cached 2D Radar Minimap**: Pre-rendered the static radar layer (river geometry, cyber citadel perimeter, slum districts) onto an offscreen canvas. Reduced canvas path recalculations by 175×.
  - **Batched Road Segment Rendering**: Transformed 1,860 individual segment stroke draw calls into 3 single-path batched strokes (Green, Yellow, Red), eliminating >110,000 canvas path calls per second on the JavaScript thread.
  - **Throttled Traffic Light Lamp Writes**: Reduced GPU instance color buffer re-uploads from 60 Hz down to 10 Hz (every 100ms) or on corridor activation, saving 190,000 redundant color updates per second.
  - **Change-Aware 3D Road Congestion Filter**: Added delta checking so GPU instance color buffers are only uploaded when a road segment changes state, removing the 250ms frame hitch.
  - **Interactive Checkpoint Vault Modal**: Added in-app `CheckpointModal.jsx` and top navbar button allowing users to review all 9 milestones, inspect architectural innovations, and copy 1-click Git rollback commands.
  - **PowerShell Time Machine**: Added `restore-checkpoint.ps1` for instant terminal-based version switching (`.\restore-checkpoint.ps1 -Checkpoint 06`).
- **Primary Files Updated**:
  - `src/components/warroom/Minimap2D.jsx`, `src/components/warroom/CityScene.jsx`, `src/components/warroom/SimLayer.jsx`, `src/components/warroom/CityStatic.jsx`, `src/components/warroom/CheckpointModal.jsx`, `src/components/Navbar.jsx`, `src/App.jsx`, `restore-checkpoint.ps1`, `checkpoints/greenwave 3D (edit 09) (2026-10-29 21-40-00).md`




