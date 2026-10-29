// Pre-seeded emergency corridor records used when Supabase is not connected.

import { routeBetween, routeNames, etaMinutes, sectorOf, HOSPITAL } from "./cityGrid";

const SEEDS = [
  { start: [0, 4], jog: 3, sev: 94, type: "Cardiac Arrest Response", note: "Hold Ring Rd cross-traffic 40s; flush Central Ave northbound ahead of AMB-07." },
  { start: [1, 6], jog: 2, sev: 88, type: "Multi-Vehicle Collision", note: "Divert South Blvd eastbound to Market St; pre-flush Metro Ave junctions." },
  { start: [2, 3], jog: 4, sev: 76, type: "Stroke Alert Transfer", note: "Stagger Lotus Ave signals at 11s offsets for a continuous green band." },
  { start: [6, 5], jog: 6, sev: 91, type: "Trauma Evacuation", note: "Lock Eastgate Ave northbound green; meter Market St inflow to 30%." },
  { start: [0, 1], jog: 3, sev: 69, type: "VIP Medical Transport", note: "Soft corridor: extend MG Rd greens by 8s, no hard holds required." },
  { start: [3, 6], jog: 3, sev: 96, type: "Junction Blockage · Bus Stall", note: "Reroute around Market St × Central Ave stall; hard-hold all cross streets." },
  { start: [4, 4], jog: 5, sev: 82, type: "Pediatric Emergency", note: "Pre-flush Ring Rd westbound queue, then green-lock Hospital Ave." },
  { start: [1, 2], jog: 1, sev: 73, type: "Organ Transport", note: "Time Park St greens to a 31 km/h platoon from Tech Park Ave." },
  { start: [5, 6], jog: 5, sev: 90, type: "Cardiac Arrest Response", note: "Clear Hospital Ave northbound; hold South Blvd and Market St 35s." },
  { start: [2, 5], jog: 2, sev: 85, type: "Multi-Vehicle Collision", note: "Contra-flow advisory on Metro Ave; flush Lake Rd eastbound queue." },
  { start: [6, 3], jog: 6, sev: 64, type: "Maternity Emergency", note: "Light-touch corridor along Eastgate Ave; keep pedestrian phases intact." },
  { start: [0, 6], jog: 3, sev: 93, type: "Burn Victim Transfer", note: "Full green wave: Harbor Ave → Central Ave, hold 6 cross junctions." },
];

export function generateSeedRecords() {
  const now = Date.now();
  return SEEDS.map((s, i) => {
    const route = routeBetween(s.start, HOSPITAL.node, s.jog);
    const eta = etaMinutes(route, s.sev);
    return {
      id: `seed-${i + 1}`,
      created_at: new Date(now - (i * 13 + 2) * 3600 * 1000 - i * 517000).toISOString(),
      incident_type: s.type,
      sector: sectorOf(s.start[0], s.start[1]),
      congestion_severity: s.sev,
      optimal_corridor_path: routeNames(route),
      estimated_time_saved_minutes: eta.saved,
      standard_eta_minutes: eta.standard,
      greenwave_eta_minutes: eta.greenwave,
      ai_dispatch_note: s.note,
      source: "seed",
      status: "completed",
    };
  });
}
