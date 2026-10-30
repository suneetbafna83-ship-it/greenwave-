export const seconds = (value, precision = 1) => value == null ? "—" : `${value.toFixed(precision)} s`;

export function downloadReport(report) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = `greenwave-${report.missionId}-seed-${report.seed}.json`;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ComparisonTable({ baseline, coordinated, finished = false }) {
  const rows = [
    ["Ambulance journey", "travelSeconds"],
    ["Ambulance stopped", "ambulanceStoppedSeconds"],
    ["Delay per other vehicle", "averageVehicleDelaySeconds"],
    ["Stopped per other vehicle", "averageVehicleStoppedSeconds"],
  ];
  return <div className="overflow-x-auto">
    <table className="w-full text-left text-xs">
      <caption className="sr-only">Measured simulation comparison: ordinary signals and coordinated corridor</caption>
      <thead><tr className="border-b border-slate-700 text-[10px] uppercase tracking-wider text-slate-400">
        <th scope="col" className="py-2 pr-3 font-medium">Measured metric</th>
        <th scope="col" className="px-2 py-2 text-right font-medium">Ordinary</th>
        <th scope="col" className="py-2 pl-2 text-right font-medium text-emerald-300">Corridor</th>
      </tr></thead>
      <tbody>{rows.map(([label, key]) => <tr key={key} className="border-b border-slate-800/70">
        <th scope="row" className="py-2.5 pr-3 font-normal text-slate-300">{label}</th>
        <td className="px-2 py-2.5 text-right font-mono text-slate-200">{key === "travelSeconds" && baseline[key] == null ? finished ? "Not arrived" : "In progress" : seconds(baseline[key], key.startsWith("average") ? 2 : 1)}</td>
        <td className="py-2.5 pl-2 text-right font-mono text-emerald-200">{key === "travelSeconds" && coordinated[key] == null ? finished ? "Not arrived" : "In progress" : seconds(coordinated[key], key.startsWith("average") ? 2 : 1)}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}
