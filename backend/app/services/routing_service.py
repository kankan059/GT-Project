"""
Routing service module for Flood Evacuation Route Planning.

Implements Dijkstra's algorithm for finding shortest safe evacuation routes
from a starting location to all reachable shelters.

All flood-aware filtering is applied before running Dijkstra's algorithm.
"""

import heapq
import logging
from typing import Any, Dict, List, Optional, Tuple

import networkx as nx

from backend.config import Settings
from backend.app.algorithms.dijkstra import dijkstra_shortest_paths

logger = logging.getLogger(__name__)


class RoutingService:
    """
    Service for computing evacuation routes using Dijkstra's algorithm.

    Responsibilities:
    - Find shortest path from start node to each shelter using Dijkstra
    - Apply flood scenario before routing
    - Compare travel times and recommend the best shelter
    - Handle unreachable shelters gracefully

    Uses NetworkX implementation of Dijkstra's algorithm for correctness
    and clarity in academic evaluation.
    """

    def __init__(self, graph_service):
        """Initialize routing service with graph service dependency."""
        self.graph_service = graph_service
        self.config = Settings()

    def find_evacuation_routes(
        self,
        start_lat: float,
        start_lon: float,
        travel_mode: str,
        scenario_id: str,
        traffic_data: Optional[Dict[str, Any]] = None,
        penalty_overrides: Optional[Dict[str, float]] = None,
    ) -> Dict[str, Any]:
        """
        Find evacuation routes from a starting location to all reachable shelters.

        Process:
        1. Validate input parameters
        2. Find nearest graph node to start location
        3. Select the appropriate graph based on travel mode
        4. Apply flood scenario (remove blocked roads, penalize flooded roads)
        5. Run Dijkstra from start node to all reachable nodes
        6. Calculate path to each shelter
        7. Compare travel times and recommend fastest shelter

        Parameters:
            start_lat: Starting latitude
            start_lon: Starting longitude
            travel_mode: "driving" or "walking"
            scenario_id: Flood scenario ID
            traffic_data: Optional manual road status updates

        Returns:
            Dict containing recommended shelter, alternatives, route details,
            travel times, distances, and unreachable shelters
        """
        # Validate travel mode
        if not self.config.validate_travel_mode(travel_mode):
            raise ValueError(self.config.ERROR_MESSAGES["INVALID_TRAVEL_MODE"])

        # Validate scenario
        if not self.config.validate_scenario_id(scenario_id):
            raise ValueError(self.config.ERROR_MESSAGES["INVALID_SCENARIO"])

        center_lat, center_lon = self.config.get_study_area_center()
        if self.graph_service._haversine_distance(
            center_lat, center_lon, start_lat, start_lon
        ) > self.config.STUDY_RADIUS_KM * 1000:
            raise ValueError(self.config.ERROR_MESSAGES["OUTSIDE_STUDY_AREA"])

        if not self.graph_service.is_graph_loaded():
            self.graph_service.load_graphs()

        # Find nearest graph node to starting location
        try:
            start_node, distance_to_node = self.graph_service.find_nearest_node(
                start_lat, start_lon, travel_mode
            )
        except Exception as e:
            logger.error(f"Error finding nearest node: {e}")
            raise RuntimeError(f"Failed to find nearest node: {e}")

        logger.info(f"Starting evacuation route from node {start_node}")

        # Get the graph for this travel mode
        G = self.graph_service.get_graph(travel_mode)

        # Apply flood scenario to create filtered graph
        G_filtered = self.graph_service.apply_flood_scenario(
            G, scenario_id, traffic_data, penalty_overrides
        )

        # Run Dijkstra's algorithm from start node
        distances, predecessors = dijkstra_shortest_paths(G_filtered, start_node)

        # Load shelters
        shelters = self._load_shelters()

        # Find nearest node to each shelter
        shelter_routes = []
        unreachable_shelters = []

        for shelter in shelters:
            shelter_lat = float(shelter["latitude"])
            shelter_lon = float(shelter["longitude"])

            # Find nearest graph node to shelter
            try:
                shelter_node, shelter_distance = self.graph_service.find_nearest_node(
                    shelter_lat, shelter_lon, travel_mode
                )
            except Exception as e:
                logger.warning(f"Could not find node for shelter {shelter['name']}: {e}")
                unreachable_shelters.append({
                    "shelter_id": shelter.get("shelter_id", ""),
                    "name": shelter.get("name", ""),
                    "latitude": shelter_lat,
                    "longitude": shelter_lon,
                    "capacity": shelter.get("capacity", 0),
                    "is_demo": shelter.get("is_demo", False),
                    "reason": f"Could not find valid road node: {e}"
                })
                continue

            # Check if shelter is reachable from start node
            if shelter_node not in distances or distances[shelter_node] == float('inf'):
                unreachable_shelters.append({
                    "shelter_id": shelter.get("shelter_id", ""),
                    "name": shelter.get("name", ""),
                    "latitude": shelter_lat,
                    "longitude": shelter_lon,
                    "capacity": shelter.get("capacity", 0),
                    "is_demo": shelter.get("is_demo", False),
                    "reason": "No path available under current flood scenario"
                })
                continue

            # Reconstruct path from start to shelter
            path = self._reconstruct_path(predecessors, start_node, shelter_node)

            # Calculate total distance of path
            total_distance_m = self._calculate_path_distance(G_filtered, path)

            travel_time_min = distances[shelter_node]

            shelter_routes.append({
                "shelter_id": shelter.get("shelter_id", ""),
                "name": shelter.get("name", ""),
                "latitude": shelter_lat,
                "longitude": shelter_lon,
                "capacity": shelter.get("capacity", 0),
                "is_demo": shelter.get("is_demo", False),
                "travel_time_min": round(travel_time_min, 2),
                "distance_m": round(total_distance_m, 2),
                "distance_km": round(total_distance_m / 1000, 3),
                "path": path,
                "path_nodes": path  # Same as path for frontend consumption
            })

        # Sort shelters by travel time (fastest first)
        shelter_routes.sort(key=lambda x: x["travel_time_min"])

        # Determine recommended shelter (fastest reachable)
        recommended_shelter = shelter_routes[0] if shelter_routes else None

        # Alternative shelters (all other reachable shelters)
        alternative_shelters = shelter_routes[1:] if shelter_routes else []

        # Build route geometry for recommended shelter
        recommended_route_geometry = None
        if recommended_shelter:
            recommended_route_geometry = self._build_route_geometry(
                G_filtered, recommended_shelter["path"]
            )

        return {
            "start_node": start_node,
            "start_lat": start_lat,
            "start_lon": start_lon,
            "distance_to_start_node_m": round(distance_to_node, 2),
            "travel_mode": travel_mode,
            "scenario_id": scenario_id,
            "recommended_shelter": recommended_shelter,
            "recommended_route_geometry": recommended_route_geometry,
            "alternative_shelters": alternative_shelters,
            "unreachable_shelters": unreachable_shelters,
            "total_reachable_shelters": len(shelter_routes),
            "total_unreachable_shelters": len(unreachable_shelters)
        }

    def _load_shelters(self) -> List[Dict[str, Any]]:
        """Load shelters from CSV file."""
        import pandas as pd

        shelters_path = self.config.SHELTERS_CSV

        if not shelters_path.exists():
            logger.warning(f"Shelters file not found: {shelters_path}")
            return []

        try:
            df = pd.read_csv(shelters_path)
            shelters = df.to_dict("records")
            logger.info(f"Loaded {len(shelters)} shelters")
            return shelters
        except Exception as e:
            logger.error(f"Error loading shelters: {e}")
            return []

    def _reconstruct_path(
        self,
        predecessors: Dict[Any, Optional[Any]],
        start_node: Any,
        end_node: Any
    ) -> List[Any]:
        """
        Reconstruct the path from start to end using predecessor map.

        Parameters:
            predecessors: Dictionary mapping node -> predecessor node
            start_node: Starting node ID
            end_node: Ending node ID

        Returns:
            List of node IDs representing the path from start to end
        """
        path = []
        current = end_node

        while current is not None:
            path.append(current)
            if current == start_node:
                break
            current = predecessors.get(current)

        path.reverse()
        return path

    def _calculate_path_distance(
        self,
        G: nx.MultiDiGraph,
        path: List[Any]
    ) -> float:
        """
        Calculate total distance of a path in meters.

        Parameters:
            G: Graph containing edge data
            path: List of node IDs

        Returns:
            Total distance in meters
        """
        total_distance = 0.0

        for i in range(len(path) - 1):
            u = path[i]
            v = path[i + 1]

            # Get edge data (MultiDiGraph may have multiple edges between nodes)
            parallel_edges = G.get_edge_data(u, v)
            if parallel_edges:
                edge_data = min(
                    parallel_edges.values(),
                    key=lambda data: float(data.get("travel_time_min", 0)),
                )
                length = edge_data.get("length", 0)
                total_distance += length

        return total_distance

    def _build_route_geometry(
        self,
        G: nx.MultiDiGraph,
        path: List[Any]
    ) -> List[Dict[str, float]]:
        """
        Build route geometry (list of coordinates) for frontend display.

        Parameters:
            G: Graph with node coordinates
            path: List of node IDs

        Returns:
            List of {latitude, longitude} dictionaries
        """
        geometry = []

        for node_id in path:
            node_data = G.nodes[node_id]
            lat = float(node_data.get("lat", node_data.get("y", 0)))
            lon = float(node_data.get("lon", node_data.get("x", 0)))
            geometry.append({
                "latitude": lat,
                "longitude": lon
            })

        return geometry

    def get_route_details(
        self,
        start_lat: float,
        start_lon: float,
        shelter_lat: float,
        shelter_lon: float,
        travel_mode: str,
        scenario_id: str,
        traffic_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Get detailed route information between two specific points.

        Parameters:
            start_lat, start_lon: Starting coordinates
            shelter_lat, shelter_lon: Shelter coordinates
            travel_mode: "driving" or "walking"
            scenario_id: Flood scenario ID
            traffic_data: Optional manual road status updates

        Returns:
            Route details including path, distance, travel time
        """
        # Find nearest nodes
        start_node, _ = self.graph_service.find_nearest_node(
            start_lat, start_lon, travel_mode
        )
        shelter_node, _ = self.graph_service.find_nearest_node(
            shelter_lat, shelter_lon, travel_mode
        )

        # Get graph and apply flood scenario
        G = self.graph_service.get_graph(travel_mode)
        G_filtered = self.graph_service.apply_flood_scenario(
            G, scenario_id, traffic_data
        )

        # Run Dijkstra
        distances, predecessors = dijkstra_shortest_paths(G_filtered, start_node)

        if shelter_node not in distances or distances[shelter_node] == float('inf'):
            return {
                "reachable": False,
                "message": "No path available between start and shelter"
            }

        path = self._reconstruct_path(predecessors, start_node, shelter_node)
        travel_time = distances[shelter_node]
        distance = self._calculate_path_distance(G_filtered, path)
        geometry = self._build_route_geometry(G_filtered, path)

        return {
            "reachable": True,
            "start_node": start_node,
            "shelter_node": shelter_node,
            "travel_time_min": round(travel_time, 2),
            "distance_m": round(distance, 2),
            "distance_km": round(distance / 1000, 3),
            "path": path,
            "geometry": geometry,
            "scenario_id": scenario_id,
            "travel_mode": travel_mode
        }