// Quick sample emergency scenarios for the triage tab.

import { routeBetween, DEFAULT_ROUTE } from "./cityGrid";

export const SAMPLES = [
  {
    id: "sample-1",
    title: "Heavy Junction Blockage",
    tag: "Sample 1",
    image: "/samples/sample-1-junction-blockage.jpg",
    sector: "Sector 4",
    incident: "Cardiac Arrest Response",
    description:
      "Dusk CCTV feed: a stalled city bus and a goods truck are blocking the Ring Rd × Metro Ave junction. All four approaches are saturated bumper-to-bumper with cars, auto-rickshaws and motorbikes. A cardiac-arrest patient must reach St. Aurora Medical Center from the Sector 4 dispatch base (Ring Rd × Harbor Ave).",
    sim: {
      severity: 94,
      route: DEFAULT_ROUTE,
      note: "Hard-hold Ring Rd cross-traffic for 40s, bypass the stalled bus via Central Ave and pre-flush 3 junctions ahead of AMB-07.",
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
      "Daytime traffic camera: a three-car collision sits in the middle of a four-way intersection with hazard lights on; queues extend in every direction while an officer directs traffic. Injured occupants need transfer from South Blvd × Tech Park Ave to St. Aurora Medical Center.",
    sim: {
      severity: 87,
      route: routeBetween([1, 6], [5, 1], 2),
      note: "Divert South Blvd eastbound onto Market St and green-lock Metro Ave northbound so AMB-12 never stops at a red.",
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
      "Night street-level view: an ambulance with flashing lights is crawling along a wet, congested multi-lane avenue while some cars try to pull aside. A priority organ-transport run must travel from Market St × Eastgate Ave to St. Aurora Medical Center.",
    sim: {
      severity: 71,
      route: routeBetween([6, 5], [5, 1], 6),
      note: "Run a soft green band up Eastgate Ave at 31 km/h, then hand off to Hospital Ave with a 12s offset — no hard holds needed.",
    },
  },
];
