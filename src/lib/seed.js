// Pre-seeded emergency corridor records for the expanded 11 × 11 city grid.

import { routeBetween, routeNames, etaMinutes, sectorOf, HOSPITAL } from "./cityGrid";

const SEEDS = [
  { start: [1, 6], jog: 5, sev: 94, type: "Cardiac Arrest Response", note: "Hold Ring Rd cross-traffic 40s; flush Central Ave northbound ahead of AMB-07." },
  { start: [2, 9], jog: 4, sev: 88, type: "Multi-Vehicle Collision", note: "Divert Station Rd buses to Market St; pre-flush Metro Ave junctions." },
  { start: [3, 5], jog: 6, sev: 76, type: "Stroke Alert Transfer", note: "Stagger Lotus Ave signals at 11s offsets for a continuous green band." },
  { start: [10, 8], jog: 9, sev: 91, type: "Trauma Evacuation", note: "Lock Sunrise Ave northbound green; meter Market St truck inflow to 30%." },
  { start: [0, 2], jog: 5, sev: 69, type: "VIP Medical Transport", note: "Soft corridor: extend MG Rd greens by 8s, clear auto-rickshaw bays." },
  { start: [5, 10], jog: 5, sev: 96, type: "Junction Blockage · Bus Stall", note: "Reroute around South Ring Blvd × Central Ave bus stall; hard-hold cross streets." },
  { start: [6, 7], jog: 8, sev: 82, type: "Pediatric Emergency", note: "Pre-flush Commercial St westbound queue, then green-lock Hospital Ave." },
  { start: [2, 3], jog: 4, sev: 73, type: "Organ Transport", note: "Time Residency St greens to a 31 km/h platoon from Tech Park Ave." },
  { start: [8, 10], jog: 8, sev: 90, type: "Cardiac Arrest Response", note: "Clear Hospital Ave northbound; hold South Ring Blvd and Station Rd 35s." },
  { start: [3, 8], jog: 5, sev: 85, type: "Multi-Vehicle Collision", note: "Contra-flow advisory on Central Ave; flush Market St pothole bottleneck." },
  { start: [10, 5], jog: 9, sev: 64, type: "Maternity Emergency", note: "Light-touch corridor along Sunrise Ave; keep pedestrian phases intact." },
  { start: [0, 9], jog: 5, sev: 93, type: "Burn Victim Transfer", note: "Full green wave: Harbor Ave → Central Ave, hold 8 cross junctions." },
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
