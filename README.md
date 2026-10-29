# 🟢 GreenWave 3D: Autonomous Ambulance Corridor & City Traffic Digital Twin

<div align="center">

![GreenWave 3D Banner](public/favicon.svg)

**Next-Generation Autonomous Emergency Corridor Pre-Flushing & 3D Urban Traffic Control Digital Twin**

[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-r186-black.svg)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF.svg)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-v4-38B2AC.svg)](https://tailwindcss.com/)
[![Google Gemini](https://img.shields.io/badge/Gemini_AI-2.5_Flash-orange.svg)](https://ai.google.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E.svg)](https://supabase.com/)

</div>

---

## 📌 What is GreenWave 3D?

In urban centers, ambulances lose up to **65% of their transit time** stalled in gridlock, waiting at red lights, or slowed by bad road conditions (potholes and unpaved slum corridors).

**GreenWave 3D** is a real-time, browser-native 3D digital twin of a sprawling **500 × 500 metropolis** that coordinates smart traffic lights ahead of emergency units:
- **3-Junction Dynamic Lookahead**: Turns traffic signals green ahead of the ambulance to clear civilian queues before the ambulance even reaches the intersection.
- **Active Traffic Projection Laser**: 34m forward projection beam on asphalt alerting oncoming vehicles to part and pull to the curb.
- **Dynamic A* Routing**: Constantly evaluates live vehicle queues, broken slum roads, and potholes to guide emergency units through the fastest route.
- **Vision AI Triage**: Analyzes live emergency scene photos using Google Gemini Vision AI to assess severity, predict transit delay, and auto-dispatch optimal corridors.

---

## 🏙️ Key Features & Architecture

### 1. 500 × 500 Cross Metropolis (Footprint -250 to +250)
- **961 Signalized Intersections** and **1,860 road segments**.
- **Meandering Zig-Zag River & Suspension Bridges**: 34m wide water channel with animated specular sheen and monumental suspension bridges featuring the central 40m Grand Suspension Bridge.
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
