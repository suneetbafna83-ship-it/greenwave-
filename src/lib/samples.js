// Quick sample emergency scenarios for the triage tab on the expanded 11 × 11 city grid.

import { routeBetween, DEFAULT_ROUTE, HOSPITAL } from "./cityGrid";

export const SAMPLES = [
  {
    id: "sample-1",
    title: "Heavy Junction Blockage",
    tag: "Sample 1",
    image: "/samples/sample-1-junction-blockage.jpg",
    sector: "Sector 4",
    incident: "Cardiac Arrest Response",
    description:
      "Dusk CCTV feed: a stalled city bus and a heavy goods truck are blocking the Ring Rd × Metro Ave junction while auto-rickshaws and two-wheelers pack every lane. A cardiac-arrest patient must reach St. Aurora Medical Center from Sector 4 (Ring Rd × Westgate Ave).",
    sim: {
      severity: 94,
      route: DEFAULT_ROUTE,
      note: "Hard-hold Ring Rd cross-traffic for 40s, clear auto-rickshaw & bus queues on Central Ave, and pre-flush 3 junctions ahead of AMB-07.",
    },
  },
  {
    id: "sample-2",
    title: "Multi-Vehicle Intersection Jam",
    tag: "Sample 2",
    image: "/samples/sample-2-multi-vehicle-jam.jpg",
    sector: "Sector 7",
    incident: "Multi-Vehicle Collision",
    description:
      "Daytime traffic camera: a three-vehicle collision sits in the middle of Station Rd × Tech Park Ave with potholes and speed breakers slowing diversion queues. Injured occupants need transfer to St. Aurora Medical Center.",
    sim: {
      severity: 87,
      route: routeBetween([2, 9], HOSPITAL.node, 4),
      note: "Divert Station Rd heavy trucks onto Market St and green-lock Metro Ave northbound so AMB-12 bypasses pothole bottlenecks.",
    },
  },
  {
    id: "sample-3",
    title: "VIP Medical Transport",
    tag: "Sample 3",
    image: "/samples/sample-3-vip-medical.jpg",
    sector: "Sector 9",
    incident: "VIP Medical Transport",
    description:
      "Night street-level view: an ambulance with flashing lights navigates wet asphalt with potholes while city buses, autos and sedans pull aside. A priority organ-transport run must travel from Market St × Eastgate Ave to St. Aurora Medical Center.",
    sim: {
      severity: 73,
      route: routeBetween([10, 8], HOSPITAL.node, 9),
      note: "Run a synchronized green wave up Sunrise Ave at 31 km/h, holding bus bays for 25s before handing off to Hospital Ave.",
    },
  },
];
