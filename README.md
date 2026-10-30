# GreenWave XR: Emergency Response Training

<div align="center">

![GreenWave 3D Banner](public/favicon.svg)

**Interactive emergency missions, a WebXR city tabletop, and repeatable simulation measurements.**

[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-r186-black.svg)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF.svg)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-v4-38B2AC.svg)](https://tailwindcss.com/)
[![Google Gemini](https://img.shields.io/badge/Gemini_AI-2.5_Flash-orange.svg)](https://ai.google.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E.svg)](https://supabase.com/)

</div>

---

## Start with Mission Training

The app opens in **XR Mission Training**. Select an incident, inspect a road, choose a proposed crossing or route via the inspected road, and activate your corridor. Desktop mouse/keyboard controls and headset controller rays use the same mission actions.

- **Rush-hour rescue:** reach St. Aurora within 180 simulation seconds.
- **Bridge out of service:** the Grand Suspension Bridge is excluded from routes and new traffic; select another crossing.
- **Unexpected obstruction:** a route segment closes 8 simulation seconds after dispatch. Choose a revised route and reactivate the corridor. Ambulance waiting and your response time are recorded.

Use **Your corridor / Ordinary signals** to inspect either run. Pause, change playback speed, or reset to the same seed. Leaving the training tab pauses a running mission. Completed reports persist locally in **Measured Results & Logs**, with JSON decision reports and CSV measurements available for export.

### How the comparison works

The adaptive run reviews live directional queues and civilian impact every simulation second and at junctions. Low crossing demand permits local signal clearance at up to three junctions; busy crossings retain normal signals while a better route is considered. Normal/urgent/critical urgency permits at most 50%/30%/12% extra estimated travel time for a detour. Route switches require an improvement of at least 8% in the combined travel/traffic score and a six-second cooldown; road closures bypass that cooldown. Replanning preserves the occupied road and elapsed journey time. The live decision card names the next junction and explains each action. These settings are simulation heuristics.

Both maps share traffic samples every 0.1 simulation seconds. The 2D map uses the same road centerlines as the 3D scene, scales its canvas to its display size, and highlights the remaining route.

Both runs start from the same seeded vehicles, traffic-light offsets, closures, initial route, and ambulance speed limit. They advance together in fixed 1/30-second steps. Random demand surges and bus dwell are disabled for these controlled scenarios. The ordinary-signals reference reroutes automatically after the obstruction; the trainee's decision time is included in the coordinated run.

Results record ambulance journey time, ambulance stopped time, and other vehicles' delay/stopped time. Civilian delay integrates `max(0, 1 - speed / freeFlowSpeed)` over time, averaged across the fixed fleet. Both runs observe civilian traffic over the same window, ending when both ambulances arrive or after 480 simulation seconds. A non-arrival is reported explicitly; no saving is invented for an unfinished pair. All times are simulation seconds, not calibrated real-world travel times. Legacy War Room/AI estimates and demo ledger rows are kept separate from measured reports.

### XR setup

Use **Enter XR** in a compatible WebXR browser with an available headset and controllers. The city becomes a 1.6 m tabletop; point and press the controller trigger to inspect incidents and roads, select routes, activate/reactivate the corridor, pause, retry, select a mission, and exit XR. The in-headset panel includes live status and measured results. Session failure and unsupported browsers retain the desktop workflow.

Headset access needs an HTTPS origin reachable from that headset. `pnpm dev` serves the desktop preview on localhost; localhost on a standalone headset refers to the headset itself, and a plain HTTP LAN address does not provide the secure context required for XR. Hardware rendering and controller ergonomics still require validation on a physical headset.

### Validation

```text
pnpm build
pnpm test:training
pnpm test:adaptive
pnpm test:river
pnpm test:roads
pnpm test:signals
```

Training checks cover all three missions, blocked crossings, rerouting, identical initial states, repeatable measurements for identical seeds/actions, equal observation windows, pause/reset, custom routes, closed-road entry, and timeout reporting. This is a training prototype; collision validation and full signal-transition interlocks are not implemented.

## Existing War Room sandbox

The original **3D City War Room** remains available as a browser-native traffic simulation of a **500 × 500 metropolis** with signal coordination ahead of emergency units:
- **3-Junction Dynamic Lookahead**: Turns traffic signals green ahead of the ambulance to clear civilian queues before the ambulance even reaches the intersection.
- **Active Traffic Projection Laser**: 34m forward projection beam on asphalt alerting oncoming vehicles to part and pull to the curb.
- **Adaptive routing**: Rechecks live queues, hazards, civilian impact and selected urgency; changes the remaining route when the improvement justifies a switch.
- **Road-scene assessment**: Uses Gemini, when configured, to estimate congestion and propose dispatch routes, with an explicit simulated fallback.

---

## 🏙️ Key Features & Architecture

### 1. 500 × 500 Cross Metropolis (Footprint -250 to +250)
- **671 active road junctions** and **811 road segments** with stable coordinate IDs for saved scenarios.
- **Mixed street geometry**: Civic Circle Boulevard, West Park's one-way roundabout, Triangle Quarter, Hexagon Gardens, and a rectangular market loop. Ordinary streets and connectors are straight; intentional circular roads retain their curves. Vehicle motion, routing, lane marks, closures, road picking and the minimap use the same centerlines and true edge lengths.
- **Roadside signals**: 1.8-unit footways and paved signal bases. Placement checks all driving surfaces at intersections, with at least 0.8 units of clearance; no signal pole falls back to a driving lane. Building footprints reserve the wider pavements and signal pads.
- **Protected river and three landmark crossings**: recessed 38-unit channel with animated flow, concrete bank barriers, promenade and planted road setback. Bridge spans reach dry grid junctions.
- **Strict Urban Zoning**: High-tech Cyber Citadel core strictly separated from outer peripheral slum badlands.
- **Asymmetric Road Hazards**: High-speed cyber expressways (0 potholes) vs slum roads with heavy crater clusters (+2.4 edge impedance).

### 2. Continuous 24-Hour Solar Lighting Engine
- Realistic celestial sun arc sweeps from golden dawn sunrise (`06:00`), crisp white midday glare (`12:00`), fiery crimson sunset (`18:30`), to cyberpunk neon night (`00:00`).
- Building facades dynamically shade east/west walls and toggle illuminated window emissives.
- Natural diurnal traffic surges during morning/evening rush hours with spontaneous flash gridlocks.

### 3. Floating 2D Tactical Radar Minimap
- Draggable glassmorphism radar window tracking live ambulance location, speed, river contours, and real-time road conditions.
- **Batched Path Rendering**: 1,860 road segments batched into 3 single-path strokes for silky 60 FPS performance.

### 4. Zero-Auth Entry & Dual-Mode SDK Resilience
- **Instant Launch**: Loads directly into the 3D War Room with zero login walls.
- **Auto Fallback**: If `VITE_GEMINI_API_KEY` or `VITE_SUPABASE_URL` are not provided in `.env`, the system automatically defaults to deterministic simulated AI triage and pre-seeded local storage.

### 5. Interactive Checkpoint Vault & Version Time Machine
- In-app timeline modal tracking all project iterations from Checkpoint 01 to Checkpoint 09.
- One-click rollback using the built-in PowerShell utility (`restore-checkpoint.ps1`) or native Git checkout.

---

## 🚀 Quick Start & Local Setup

### Prerequisites
- Node.js (v18 or higher)
- `pnpm` (or `npm`)

### 1. Clone the repository
```bash
git clone https://github.com/<your-username>/greenwave.git
cd greenwave
```

### 2. Install dependencies
```bash
pnpm install
```

### 3. (Optional) Configure API Keys
Copy the example environment file:
```bash
cp .env.example .env
```
Fill in your keys in `.env`:
```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_SUPABASE_URL=your_supabase_project_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```
> *Note: If keys are omitted, GreenWave 3D automatically runs in **Demo Simulation Mode** with 100% offline functionality.*

### 4. Launch the local dev server
```bash
pnpm dev
```
Open **`http://localhost:5173/`** in your browser.

---

## ⏳ Checkpoint Time Machine (Version History)

GreenWave 3D includes a built-in checkpoint time machine allowing you to inspect or run earlier milestones:

```powershell
# List all saved checkpoints:
.\restore-checkpoint.ps1 -List

# Run the very first 7x7 grid checkpoint locally:
.\restore-checkpoint.ps1 -Checkpoint 01

# Return to the latest 500x500 production build:
git checkout main
```

---

## 📦 Project Structure

```text
├── checkpoints/              # Detailed milestone documentation (Edits 01-09)
├── public/                   # Static icons and sample triage scenario photos
├── src/
│   ├── components/
│   │   ├── analytics/        # Benchmark charts and Supabase audit log
│   │   ├── triage/           # Gemini AI image triage and dispatch cards
│   │   └── warroom/          # 3D City Scene, Minimap, HUD, and Checkpoint Vault
│   ├── lib/
│   │   ├── cityGrid.js       # 500x500 grid geometry, river, bridges, and zoning
│   │   ├── trafficSim.js     # Vehicle kinematics, traffic lights, and A* router
│   │   ├── gemini.js         # Gemini Vision AI prompt engine & fallback
│   │   └── supabase.js       # Database client and local storage ledger
│   ├── App.jsx               # Main application entry and tab router
│   └── index.css             # Tailwind CSS styles and theme colors
├── restore-checkpoint.ps1    # Interactive PowerShell version rollback script
└── package.json              # Project dependencies and build scripts
```

---

## 📄 License
MIT License. Built for hackathon innovation in smart urban transit and autonomous emergency corridors.
