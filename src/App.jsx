import { useCallback, useEffect, useRef, useState } from "react";
import Navbar from "./components/Navbar";
import WarRoom from "./components/warroom/WarRoom";
import TriagePanel from "./components/triage/TriagePanel";
import AnalyticsPanel from "./components/analytics/AnalyticsPanel";
import { TrafficSim } from "./lib/trafficSim";
import { LIVE_READY } from "./lib/config";
import { fetchDispatches, logDispatch, resetLocal } from "./lib/supabase";

export default function App() {
  const simRef = useRef(null);
  if (!simRef.current) {
    simRef.current = new TrafficSim();
  }

  const [activeTab, setActiveTab] = useState("warroom");
  const [liveMode, setLiveMode] = useState(LIVE_READY);
  const [records, setRecords] = useState([]);
  const [dataSource, setDataSource] = useState("local");
  const [syncError, setSyncError] = useState(null);
  const [loadingRecords, setLoadingRecords] = useState(false);

  const loadDispatches = useCallback(
    async (useLive = liveMode) => {
      setLoadingRecords(true);
      try {
        const res = await fetchDispatches(useLive);
        setRecords(res.records);
        setDataSource(res.source);
        setSyncError(res.error);
      } finally {
        setLoadingRecords(false);
      }
    },
    [liveMode]
  );

  useEffect(() => {
    loadDispatches(liveMode);
  }, [liveMode, loadDispatches]);

  const handleLogDispatch = useCallback(
    async (payload) => {
      const res = await logDispatch(payload, liveMode);
      setRecords((prev) => [res.record, ...prev]);
      setDataSource(res.source);
      if (res.error) setSyncError(res.error);
      return res.record;
    },
    [liveMode]
  );

  const handleDeployCorridor = useCallback(({ route, label }) => {
    simRef.current.dispatch(route, label);
    setActiveTab("warroom");
  }, []);

  const handleResetDemoData = useCallback(() => {
    const seeded = resetLocal();
    setRecords(seeded);
    setDataSource("local");
    setSyncError(null);
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-950 text-slate-100 select-none">
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        liveMode={liveMode}
        onToggleLiveMode={() => setLiveMode((m) => !m)}
        dispatchCount={records.length}
      />

      <main className="relative flex-1 overflow-hidden">
        {/* Keep 3D War Room mounted for instant tab switching; pause frameloop when hidden */}
        <div className={activeTab === "warroom" ? "h-full w-full" : "pointer-events-none invisible absolute inset-0"}>
          <WarRoom sim={simRef.current} active={activeTab === "warroom"} onDispatch={handleLogDispatch} />
        </div>

        {activeTab === "triage" && (
          <TriagePanel
            liveMode={liveMode}
            onDeployCorridor={handleDeployCorridor}
            onLogDispatch={handleLogDispatch}
          />
        )}

        {activeTab === "analytics" && (
          <AnalyticsPanel
            records={records}
            dataSource={dataSource}
            syncError={syncError}
            loading={loadingRecords}
            onRefresh={() => loadDispatches(liveMode)}
            onResetDemoData={handleResetDemoData}
            onReplayCorridor={handleDeployCorridor}
          />
        )}
      </main>
    </div>
  );
}
