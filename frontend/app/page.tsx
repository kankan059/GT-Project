"use client";

import dynamic from "next/dynamic";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CloudRain,
  LoaderCircle,
  MapPinned,
  Radio,
  Route,
  ShieldAlert,
  Waves,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { LocationSearch } from "@/components/controls/LocationSearch";
import { ScenarioSelector } from "@/components/controls/ScenarioSelector";
import { TravelMode } from "@/components/controls/TravelMode";
import { RouteResults } from "@/components/results/RouteResults";
import { FALLBACK_SCENARIOS, STUDY_CENTER } from "@/lib/constants";
import {
  findRoutes,
  getCriticalRoads,
  getScenarios,
  getShelters,
  updateRoadStatus,
} from "@/services/api";
import type {
  CriticalRoadsResponse,
  Location,
  RoadStatus,
  RouteResult,
  Scenario,
  ScenarioId,
  Shelter,
  TravelMode as TravelModeType,
} from "@/types";

const EvacuationMap = dynamic(() => import("@/components/map/EvacuationMap"), {
  ssr: false,
  loading: () => <div className="map-loading">Loading interactive map…</div>,
});

export default function Home() {
  const [location, setLocation] = useState<Location | null>(null);
  const [mode, setMode] = useState<TravelModeType>("driving");
  const [scenarioId, setScenarioId] = useState<ScenarioId>("NORMAL");
  const [scenarios, setScenarios] = useState<Scenario[]>(FALLBACK_SCENARIOS);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [backendOnline, setBackendOnline] = useState(false);
  const [criticalEnabled, setCriticalEnabled] = useState(false);
  const [criticalData, setCriticalData] = useState<CriticalRoadsResponse | null>(
    null,
  );
  const [criticalLoading, setCriticalLoading] = useState(false);
  const [criticalError, setCriticalError] = useState("");
  const [activeAlternativeId, setActiveAlternativeId] = useState<string | null>(
    null,
  );
  const [roadEdgeId, setRoadEdgeId] = useState("");
  const [roadStatus, setRoadStatus] = useState<RoadStatus>("PARTIALLY_FLOODED");
  const [penalty, setPenalty] = useState("1.5");
  const [updateMessage, setUpdateMessage] = useState("");
  const [updateError, setUpdateError] = useState("");
  const [updateLoading, setUpdateLoading] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([getShelters(), getScenarios()])
      .then(([shelterResponse, scenarioResponse]) => {
        if (!active) return;
        setShelters(shelterResponse.shelters);
        setScenarios(scenarioResponse.scenarios);
        setScenarioId(scenarioResponse.current_scenario);
        setBackendOnline(true);
      })
      .catch((error: unknown) => {
        if (active) {
          setBackendOnline(false);
          setPageError(
            error instanceof Error ? error.message : "Could not load backend data.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function calculateRoute() {
    if (!location) {
      setPageError("Set a starting location by searching or clicking the map.");
      return;
    }
    setRouteLoading(true);
    setPageError("");
    setActiveAlternativeId(null);
    try {
      setRoute(await findRoutes(location, mode, scenarioId));
    } catch (error) {
      setRoute(null);
      setPageError(error instanceof Error ? error.message : "Route request failed.");
    } finally {
      setRouteLoading(false);
    }
  }

  const loadCriticalRoads = useCallback(async () => {
    setCriticalLoading(true);
    setCriticalError("");
    try {
      setCriticalData(await getCriticalRoads());
    } catch (error) {
      setCriticalError(
        error instanceof Error ? error.message : "Critical-road analysis failed.",
      );
    } finally {
      setCriticalLoading(false);
    }
  }, []);

  function toggleCriticalLayer() {
    const nextEnabled = !criticalEnabled;
    setCriticalEnabled(nextEnabled);
    if (nextEnabled && !criticalData && !criticalLoading) void loadCriticalRoads();
  }

  async function submitRoadUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUpdateError("");
    setUpdateMessage("");
    const parsedPenalty = Number(penalty);
    if (
      roadStatus === "PARTIALLY_FLOODED" &&
      (!Number.isFinite(parsedPenalty) || parsedPenalty <= 0)
    ) {
      setUpdateError("Penalty must be a positive number.");
      return;
    }

    setUpdateLoading(true);
    try {
      const response = await updateRoadStatus(
        roadEdgeId.trim(),
        roadStatus,
        roadStatus === "PARTIALLY_FLOODED" ? parsedPenalty : undefined,
      );
      setRoute(null);
      setUpdateMessage(response.message);
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : "Road update failed.");
    } finally {
      setUpdateLoading(false);
    }
  }

  function selectLocation(nextLocation: Location) {
    setLocation(nextLocation);
    setRoute(null);
    setPageError("");
  }

  const criticalSummary = criticalData?.analysis_summary;

  return (
    <main className="app-shell">
      <header className="topbar">
        <a aria-label="FloodSafe home" className="brand" href="/">
          <span className="brand-mark"><Waves size={21} /></span>
          <span className="brand-text">
            <strong>FloodSafe</strong>
            <span>ROUTE SIMULATOR</span>
          </span>
        </a>
        <div className="topbar-right">
          <span className="study-area">
            <MapPinned size={15} />
            Tezpur University · Assam
          </span>
          <span className={backendOnline ? "connection online" : "connection"}>
            <span className="connection-dot" />
            {backendOnline ? "Backend connected" : "Backend offline"}
          </span>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-intro">
            <div className="eyebrow"><CloudRain size={15} /> FLOOD EVACUATION</div>
            <h1>Find a safer way.</h1>
            <p>Explore simulated routes to nearby evacuation shelters.</p>
          </div>

          <section className="control-section">
            <LocationSearch onSelect={selectLocation} />
          </section>

          <section className="control-section compact-section">
            <span className="field-label">Travel mode</span>
            <TravelMode
              value={mode}
              onChange={(nextMode) => {
                setMode(nextMode);
                setRoute(null);
                setActiveAlternativeId(null);
              }}
            />
          </section>

          <section className="control-section compact-section">
            <ScenarioSelector
              scenarios={scenarios}
              value={scenarioId}
              onChange={(nextScenario) => {
                setScenarioId(nextScenario);
                setRoute(null);
                setActiveAlternativeId(null);
              }}
            />
          </section>

          <button
            className="route-button"
            disabled={routeLoading}
            onClick={calculateRoute}
            type="button"
          >
            {routeLoading ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <Route size={18} />
            )}
            {routeLoading ? "Finding safe route…" : "Find safe route"}
            {!routeLoading && <ArrowUpRight className="route-arrow" size={17} />}
          </button>

          {pageError && (
            <div className="error-banner" role="alert">
              <AlertTriangle size={16} />
              <span>{pageError}</span>
            </div>
          )}

          <RouteResults
            loading={routeLoading}
            onSelectAlternative={(id) =>
              setActiveAlternativeId((current) => (current === id ? null : id))
            }
            result={route}
            selectedAlternativeId={activeAlternativeId}
            shelters={shelters}
          />

          <section className="analysis-section">
            <div className="section-heading">
              <span className="section-icon"><Activity size={16} /></span>
              <h2>Network vulnerability</h2>
            </div>
            <p className="section-copy">
              Critical road analysis highlights bridges that may isolate areas
              from demo shelters. It is separate from route calculation.
            </p>
            {criticalEnabled && (
              <div className="analysis-content">
                {criticalLoading && <p className="field-hint">Analyzing road network…</p>}
                {criticalError && <p className="inline-error">{criticalError}</p>}
                {criticalSummary && (
                  <div className="analysis-stats">
                    <span><strong>{criticalSummary.graph_nodes ?? 0}</strong> nodes</span>
                    <span><strong>{criticalSummary.critical_bridges_count ?? criticalData?.critical_roads.length ?? 0}</strong> critical roads</span>
                  </div>
                )}
                {criticalData?.critical_roads.slice(0, 5).map((road, index) => (
                  <div className="critical-road" key={`${road.source_node}-${road.target_node}`}>
                    <span className="critical-rank">{index + 1}</span>
                    <span>
                      <strong>{road.road_type.replaceAll("_", " ")}</strong>
                      <small>{road.affected_node_count} locations affected if blocked</small>
                    </span>
                    <ShieldAlert size={16} />
                  </div>
                ))}
                {criticalData && criticalData.critical_roads.length === 0 && (
                  <p className="field-hint">No critical roads were returned.</p>
                )}
                {criticalData && criticalData.critical_roads.length > 0 && (
                  <p className="map-note">
                    The API returns node IDs but not coordinates, so these roads
                    can’t be drawn on the map yet.
                  </p>
                )}
              </div>
            )}
          </section>

          <details className="manual-update">
            <summary><Radio size={16} /> Manual simulated road update</summary>
            <p className="section-copy">
              Update a known road edge ID for subsequent route requests.
            </p>
            <form onSubmit={submitRoadUpdate}>
              <label className="field-label" htmlFor="edge-id">Road edge ID</label>
              <input
                id="edge-id"
                onChange={(event) => setRoadEdgeId(event.target.value)}
                placeholder="e.g. Road_0_1_0"
                required
                value={roadEdgeId}
              />
              <label className="field-label" htmlFor="road-status">Status</label>
              <select
                id="road-status"
                onChange={(event) => setRoadStatus(event.target.value as RoadStatus)}
                value={roadStatus}
              >
                <option value="AVAILABLE">Available</option>
                <option value="PARTIALLY_FLOODED">Partially flooded</option>
                <option value="BLOCKED">Blocked</option>
              </select>
              {roadStatus === "PARTIALLY_FLOODED" && (
                <>
                  <label className="field-label" htmlFor="penalty">Travel-time multiplier</label>
                  <input
                    id="penalty"
                    min="0.1"
                    onChange={(event) => setPenalty(event.target.value)}
                    step="0.1"
                    type="number"
                    value={penalty}
                  />
                </>
              )}
              <button className="secondary-button" disabled={updateLoading} type="submit">
                {updateLoading && <LoaderCircle className="spin" size={15} />}
                Apply simulated update
              </button>
              {updateMessage && <p className="success-message">{updateMessage}</p>}
              {updateError && <p className="inline-error">{updateError}</p>}
            </form>
          </details>

          <div className="disclaimer">
            <ShieldAlert size={17} />
            <p>
              <strong>Academic simulation only.</strong> Flood conditions,
              travel times, and shelters are simulated. Do not use for real
              emergency decisions.
            </p>
          </div>
        </aside>

        <section aria-label="Evacuation map" className="map-panel">
          <div className="map-caption">
            <div>
              <span className="map-kicker">STUDY AREA</span>
              <strong>Tezpur, Napaam</strong>
            </div>
            <span className="map-live"><span /> OpenStreetMap</span>
          </div>
          <EvacuationMap
            activeAlternativeId={activeAlternativeId}
            location={location}
            onLocationSelect={selectLocation}
            route={route}
            shelters={shelters}
            criticalEnabled={criticalEnabled}
            onToggleCritical={toggleCriticalLayer}
          />
          <div className="map-legend">
            <span><i className="legend-start" /> Start</span>
            <span><i className="legend-recommended" /> Recommended shelter</span>
            <span><i className="legend-other" /> Demo shelter</span>
            {route?.recommended_route_geometry && (
              <span><i className="legend-route" /> Recommended route</span>
            )}
          </div>
          <div className="map-footnote">
            <AlertTriangle size={14} />
            Simulated data · Flooded/blocked road overlays are not provided by the current API.
          </div>
        </section>
      </div>
    </main>
  );
}
