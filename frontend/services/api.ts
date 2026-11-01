import { API_BASE_URL } from "@/lib/constants";
import type {
  CriticalRoadsResponse,
  Location,
  RoadStatus,
  RouteResult,
  Scenario,
  ScenarioId,
  Shelter,
  TravelMode,
} from "@/types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  } catch {
    throw new Error(
      `Could not connect to the backend at ${API_BASE_URL}. Start the FastAPI server and try again.`,
    );
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { detail?: string | Array<{ msg?: string }> }
      | null;
    const detail = Array.isArray(body?.detail)
      ? body.detail.map((item) => item.msg).filter(Boolean).join(", ")
      : body?.detail;
    throw new Error(detail || `Request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

export function getShelters(): Promise<{ shelters: Shelter[]; success: boolean }> {
  return request("/api/shelters");
}

export function getScenarios(): Promise<{
  scenarios: Scenario[];
  current_scenario: ScenarioId;
  success: boolean;
}> {
  return request("/api/scenarios");
}

export function findRoutes(
  location: Location,
  mode: TravelMode,
  scenarioId: ScenarioId,
): Promise<RouteResult> {
  return request("/api/routes/find", {
    method: "POST",
    body: JSON.stringify({
      latitude: location.latitude,
      longitude: location.longitude,
      mode,
      scenario_id: scenarioId,
    }),
  });
}

export function getCriticalRoads(): Promise<CriticalRoadsResponse> {
  return request("/api/critical-roads");
}

export function updateRoadStatus(
  edgeId: string,
  status: RoadStatus,
  penaltyMultiplier?: number,
): Promise<{ success: boolean; message: string }> {
  return request("/api/flood/update", {
    method: "POST",
    body: JSON.stringify({
      edge_id: edgeId,
      status,
      penalty_multiplier:
        status === "PARTIALLY_FLOODED" ? penaltyMultiplier ?? null : null,
    }),
  });
}

export async function searchLocations(query: string): Promise<Location[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("viewbox", "91.9,26.3,92.5,25.9");
  url.searchParams.set("bounded", "1");

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new Error("Location search is unavailable. You can still click the map.");
  }

  if (!response.ok) {
    throw new Error(`Location search failed (${response.status})`);
  }

  const results = (await response.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;
  return results.map((result) => ({
    latitude: Number(result.lat),
    longitude: Number(result.lon),
    label: result.display_name,
  }));
}
