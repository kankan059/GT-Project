export type TravelMode = "driving" | "walking";
export type ScenarioId = "NORMAL" | "MODERATE_FLOOD" | "SEVERE_FLOOD";
export type RoadStatus = "AVAILABLE" | "PARTIALLY_FLOODED" | "BLOCKED";

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface Shelter {
  shelter_id: string;
  name: string;
  latitude: number;
  longitude: number;
  capacity: number;
  is_demo: boolean;
}

export interface Scenario {
  scenario_id: ScenarioId;
  status: RoadStatus;
  severity: string;
  penalty_multiplier: number;
}

export interface RouteOption {
  shelter_id: string;
  name: string;
  travel_time_min: number;
  distance_km: number;
  is_demo: boolean;
}

export interface UnreachableShelter {
  shelter_id: string;
  name: string;
  reason: string;
  is_demo: boolean;
}

export interface RouteResult {
  start_latitude: number;
  start_longitude: number;
  distance_to_start_node_m: number;
  travel_mode: TravelMode;
  scenario_id: ScenarioId;
  recommended_shelter_id: string | null;
  recommended_shelter_name: string | null;
  recommended_shelter_travel_time_min: number | null;
  recommended_shelter_distance_km: number | null;
  alternative_shelters: RouteOption[];
  unreachable_shelters: UnreachableShelter[];
  total_reachable_shelters: number;
  total_unreachable_shelters: number;
  recommended_route_geometry: Coordinate[] | null;
  success: boolean;
  message?: string | null;
}

export interface CriticalRoad {
  source_node: number;
  target_node: number;
  length_m: number;
  road_type: string;
  oneway: boolean;
  affected_node_count: number;
  impact_score: number;
  is_bridge: boolean;
  explanation: string;
}

export interface CriticalRoadsResponse {
  critical_roads: CriticalRoad[];
  analysis_summary: Record<string, number>;
  success: boolean;
}

export interface Location {
  latitude: number;
  longitude: number;
  label: string;
}
