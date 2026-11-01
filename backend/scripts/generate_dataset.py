"""
Flood Evacuation Dataset Generator

This script generates synthetic datasets for the flood evacuation project:
- Downloads road networks from OpenStreetMap for the Tezpur University area
- Creates demo shelter locations
- Generates flood scenarios
- Exports data in required formats (GraphML, CSV)

IMPORTANT: All shelters and flood scenarios are SIMULATED for academic demonstration.
"""

import osmnx as ox
import networkx as nx
import pandas as pd
import numpy as np
from datetime import datetime
import warnings
import logging
import math
from pathlib import Path

# Suppress warnings
warnings.filterwarnings("ignore")
ox.config(use_cache=True, log_console=False)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Project constants
STUDY_CENTER = (26.1022, 92.1986)  # Tezpur University area
STUDY_RADIUS_M = 20000  # 20 km radius

# Demo shelter locations (coordinate-based landmarks in Napaam/Tezpur area)
# All marked as SIMULATED for demonstration
DEMO_SHELTERS = [
    {"name": "Tezpur University Main Campus", "lat": 26.1022, "lon": 92.1986, "capacity": 500, "is_demo": True},
    {"name": "Napaam Town Community Hall", "lat": 26.0833, "lon": 92.2200, "capacity": 150, "is_demo": True},
    {"name": "Nonoi Village SHG Centre", "lat": 26.0667, "lon": 92.1750, "capacity": 100, "is_demo": True},
    {"name": "Kharupetia High School Playground", "lat": 26.0750, "lon": 92.2500, "capacity": 200, "is_demo": True},
    {"name": "Bolpur Pathar Village Office", "lat": 26.1500, "lon": 92.1800, "capacity": 120, "is_demo": True},
]

# Travel speed settings (km/h)
DRIVING_SPEED = 40  # Average driving speed
WALKING_SPEED = 5   # Average walking speed

# Partial flood penalty multiplier
PARTIALLY_FLOODED_MULTIPLIER = 1.5
SEVERE_FLOOD_MULTIPLIER = 2.5

# Output directories
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
NETWORKS_DIR = DATA_DIR / "networks"


def download_road_network(network_type="drive", study_center=STUDY_CENTER, radius=STUDY_RADIUS_M):
    """
    Download road network from OpenStreetMap.

    Parameters:
        network_type: "drive" or "walk"
        study_center: (latitude, longitude) of center point
        radius: Study area radius in meters

    Returns:
        ox_graph: NetworkX graph with OSMnx metadata
    """
    logger.info(f"Downloading {network_type} network around {study_center}...")
    logger.info(f"Study radius: {radius/1000:.2f} km")

    try:
        ox_graph = ox.graph_from_point(
            study_center,
            dist=radius,
            network_type=network_type,
            simplify=True,
            truncate_by_edge=True,
        )
        logger.info(f"Successfully downloaded {network_type} network")
        logger.info(f"Graph has {len(ox_graph.nodes)} nodes and {len(ox_graph.edges)} edges")

        # Calculate edge lengths if not already present
        first_edge = list(ox_graph.edges(data=True))[0]
        if "length" not in first_edge[2]:
            ox_graph = ox.add_edge_lengths(ox_graph)

        return ox_graph

    except Exception as e:
        logger.error(f"Failed to download {network_type} network: {e}")
        raise


def assign_stable_edge_ids(G):
    """
    Assign stable, deterministic edge identifiers to the graph.

    Uses edge coordinate tuple in normalized form to create consistent IDs
    across multiple runs.

    Parameters:
        G: NetworkX graph

    Returns:
        G: Graph with assigned edge IDs
    """
    # Create a deterministic edge ID based on node keys and normalized geometry
    edge_id_map = {}

    for u, v, key, data in G.edges(keys=True, data=True):
        edge_id = f"{u}_{v}_{key}"
        data["edge_id"] = edge_id
        edge_id_map[edge_id] = 1

    logger.info(f"Assigned {len(edge_id_map)} stable edge IDs")
    return G


def calculate_travel_times(G, speed_kmh=DRIVING_SPEED):
    """
    Calculate travel time for each edge in minutes.

    Parameters:
        G: NetworkX graph with length attribute (meters)
        speed_kmh: Average travel speed (km/h)

    Returns:
        G: Graph with travel_time attribute
    """
    for u, v, data in G.edges(data=True):
        length_m = data.get("length", 0)

        # Calculate travel time in minutes
        length_km = length_m / 1000
        travel_time_min = (length_km / speed_kmh) * 60

        data["travel_time_min"] = round(travel_time_min, 2)

    logger.info(f"Calculated travel times using speed: {speed_kmh} km/h")
    return G


def export_nodes_csv(G, output_path):
    """
    Export nodes to CSV.

    Parameters:
        G: NetworkX graph with node attributes
        output_path: Path to save CSV file
    """
    logger.info("Exporting nodes.csv...")

    nodes_data = []
    for node_id, data in G.nodes(data=True):
        # Extract X, Y for OSMnx compatibility
        x = data.get("x", data.get("lon", 0))
        y = data.get("y", data.get("lat", 0))

        nodes_data.append({
            "node_id": node_id,
            "latitude": y,
            "longitude": x
        })

    df = pd.DataFrame(nodes_data)
    df.to_csv(output_path, index=False)

    logger.info(f"Exported {len(df)} nodes to {output_path}")


def export_roads_csv(G, output_path):
    """
    Export roads to CSV.

    Parameters:
        G: NetworkX graph with edge_id and other attributes
        output_path: Path to save CSV file
    """
    logger.info("Exporting roads.csv...")

    roads_data = []
    for u, v, data in G.edges(data=True):
        roads_data.append({
            "edge_id": data.get("edge_id", ""),
            "source_node": u,
            "target_node": v,
            "length_m": data.get("length", 0),
            "road_type": str(data.get("highway", "unknown")),
            "oneway": data.get("oneway", False),
        })

    df = pd.DataFrame(roads_data)
    df.to_csv(output_path, index=False)

    logger.info(f"Exported {len(df)} roads to {output_path}")


def export_travel_times_csv(G, output_path):
    """
    Export travel times to CSV for both driving and walking.

    Parameters:
        G: NetworkX graph with travel_time_min attribute
        output_path: Path to save CSV file
    """
    logger.info("Exporting travel_times.csv...")

    travel_times_data = []

    for mode, speed in [("driving", DRIVING_SPEED), ("walking", WALKING_SPEED)]:
        for u, v, data in G.edges(data=True):
            # Recalculate travel time for this mode
            length_m = data.get("length", 0)
            length_km = length_m / 1000
            travel_time_min = (length_km / speed) * 60

            travel_times_data.append({
                "edge_id": data.get("edge_id", ""),
                "mode": mode,
                "base_speed_kmh": speed,
                "travel_time_min": round(travel_time_min, 2)
            })

    df = pd.DataFrame(travel_times_data)
    df.to_csv(output_path, index=False)

    logger.info(f"Exported {len(df)} travel times to {output_path}")


def export_shelters_csv(output_path):
    """
    Export demo shelters to CSV.

    IMPORTANT: These are SIMULATED shelters for demonstration only.
    """
    logger.info("Exporting shelters.csv (DEMO DATA)...")

    shelters_data = []
    for shelter in DEMO_SHELTERS:
        shelters_data.append({
            "shelter_id": shelter["name"].replace(" ", "_").replace(",", ""),
            "name": shelter["name"],
            "latitude": shelter["lat"],
            "longitude": shelter["lon"],
            "capacity": shelter["capacity"],
            "is_demo": shelter["is_demo"]
        })

    df = pd.DataFrame(shelters_data)
    df.to_csv(output_path, index=False)

    logger.info(f"Exported {len(df)} demo shelters to {output_path}")
    logger.warning("All shelters are SIMULATED for academic demonstration")


def export_flood_scenarios_csv(G, output_path):
    """
    Export flood scenarios to CSV.

    IMPORTANT: These are SIMULATED flood scenarios for demonstration only.
    """
    logger.info("Exporting flood_scenarios.csv (SIMULATED)...")

    edge_ids = sorted({
        str(data["edge_id"])
        for _, _, data in G.edges(data=True)
        if data.get("edge_id")
    })
    scenarios_data = []
    for edge_id in edge_ids[::20]:
        scenarios_data.append({
            "scenario_id": "MODERATE_FLOOD",
            "edge_id": edge_id,
            "status": "PARTIALLY_FLOODED",
            "severity": "moderate",
            "penalty_multiplier": PARTIALLY_FLOODED_MULTIPLIER,
        })
    for edge_id in edge_ids[10::50]:
        scenarios_data.append({
            "scenario_id": "SEVERE_FLOOD",
            "edge_id": edge_id,
            "status": "BLOCKED",
            "severity": "severe",
            "penalty_multiplier": SEVERE_FLOOD_MULTIPLIER,
        })

    df = pd.DataFrame(scenarios_data, columns=[
        "scenario_id", "edge_id", "status", "severity", "penalty_multiplier"
    ])
    df.to_csv(output_path, index=False)

    logger.info(f"Exported {len(df)} flood scenarios to {output_path}")
    logger.warning("All flood scenarios are SIMULATED for academic demonstration")


def save_graphml_files(G, driving=True, output_dir=None):
    """
    Save graph as GraphML file for future use.

    Parameters:
        G: NetworkX graph
        driving: True for driving graph, False for walking
        output_dir: Output directory for GraphML files
    """
    if output_dir is None:
        output_dir = NETWORKS_DIR

    output_dir.mkdir(parents=True, exist_ok=True)

    network_type = "drive" if driving else "walk"
    graph_filename = f"tezu_roads_{network_type}.graphml"
    output_path = output_dir / graph_filename

    try:
        graph_for_graphml = G.copy()
        for _, _, _, data in graph_for_graphml.edges(keys=True, data=True):
            data.pop("geometry", None)
            for attribute, value in data.items():
                if isinstance(value, np.generic):
                    data[attribute] = value.item()
                elif not isinstance(value, (str, int, float, bool)):
                    data[attribute] = str(value)

        for _, data in graph_for_graphml.nodes(data=True):
            for attribute, value in data.items():
                if isinstance(value, np.generic):
                    data[attribute] = value.item()
                elif not isinstance(value, (str, int, float, bool)):
                    data[attribute] = str(value)

        for attribute, value in graph_for_graphml.graph.items():
            if isinstance(value, np.generic):
                graph_for_graphml.graph[attribute] = value.item()
            elif not isinstance(value, (str, int, float, bool)):
                graph_for_graphml.graph[attribute] = str(value)

        nx.write_graphml(graph_for_graphml, output_path)
        logger.info(f"Saved {len(G.nodes)} node, {len(G.edges)} edge graph to {output_path}")
    except Exception as e:
        logger.error(f"Failed to save GraphML file: {e}")
        raise


def validate_dataset(driving_G, walking_G, shelters_path, roads_path, scenarios_path):
    """
    Validate the generated dataset.

    Parameters:
        driving_G: Driving network graph
        walking_G: Walking network graph
        shelters_path: Path to shelters.csv
        roads_path: Path to roads.csv
        scenarios_path: Path to flood_scenarios.csv

    Returns:
        bool: True if validation passes, False otherwise
    """
    logger.info("Validating dataset...")

    all_valid = True

    # Validate graphs have nodes and edges
    if len(driving_G.nodes) == 0 or len(driving_G.edges) == 0:
        logger.error("Driving graph is empty or malformed")
        all_valid = False
    else:
        logger.info(f"✓ Driving network: {len(driving_G.nodes)} nodes, {len(driving_G.edges)} edges")

    if len(walking_G.nodes) == 0 or len(walking_G.edges) == 0:
        logger.error("Walking graph is empty or malformed")
        all_valid = False
    else:
        logger.info(f"✓ Walking network: {len(walking_G.nodes)} nodes, {len(walking_G.edges)} edges")

    # Validate CSV files exist
    shelters_df = pd.read_csv(shelters_path)
    if len(shelters_df) == 0:
        logger.error("No shelters found in shelters.csv")
        all_valid = False
    else:
        logger.info(f"✓ Shelters: {len(shelters_df)} shelters loaded")

    roads_df = pd.read_csv(roads_path)
    if len(roads_df) == 0:
        logger.error("No roads found in roads.csv")
        all_valid = False
    else:
        logger.info(f"✓ Roads: {len(roads_df)} roads loaded")

    # Validate no empty edge IDs
    empty_edge_ids = roads_df["edge_id"].isna().sum()
    if empty_edge_ids > 0:
        logger.error(f"{empty_edge_ids} roads have empty edge IDs")
        all_valid = False
    else:
        logger.info(f"✓ All roads have valid edge IDs: {roads_df['edge_id'].nunique()} unique")

    scenarios_df = pd.read_csv(scenarios_path)
    if not set(scenarios_df["status"]).issubset({"AVAILABLE", "PARTIALLY_FLOODED", "BLOCKED"}):
        logger.error("Invalid road status found in flood scenarios")
        all_valid = False

    shelter_graph = []
    for _, shelter in shelters_df.iterrows():
        latitude = float(shelter["latitude"])
        longitude = float(shelter["longitude"])
        nearest_node = min(
            driving_G.nodes(data=True),
            key=lambda item: _haversine_distance(
                latitude,
                longitude,
                float(item[1].get("y", item[1].get("lat"))),
                float(item[1].get("x", item[1].get("lon"))),
            ),
        )[0]
        shelter_graph.append(nearest_node)

    if len(shelter_graph) != len(shelters_df) or any(
        driving_G.degree(node) == 0 for node in shelter_graph
    ):
        logger.error("Some shelters could not be connected to the driving network")
        all_valid = False

    if all_valid:
        logger.info("✓ Dataset validation PASSED")
    else:
        logger.error("✗ Dataset validation FAILED")

    return all_valid


def _haversine_distance(lat1, lon1, lat2, lon2):
    """Return the distance in meters between two latitude/longitude points."""
    earth_radius_m = 6371000
    lat1_rad, lat2_rad = math.radians(lat1), math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    haversine = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1_rad)
        * math.cos(lat2_rad)
        * math.sin(delta_lon / 2) ** 2
    )
    return 2 * earth_radius_m * math.asin(math.sqrt(haversine))


def main():
    """
    Main execution function for dataset generation.

    Creates:
    - Downloaded road networks (GraphML files)
    - nodes.csv
    - roads.csv
    - travel_times.csv
    - shelters.csv (DEMO DATA)
    - flood_scenarios.csv (SIMULATED DATA)
    """
    logger.info("="*60)
    logger.info("Flood Evacuation Dataset Generator")
    logger.info("="*60)
    logger.info(f"Study centered at: {STUDY_CENTER}")
    logger.info(f"Study radius: {STUDY_RADIUS_M/1000:.2f} km")
    logger.info(f"All shelters and flood scenarios are SIMULATED for demonstration\n")

    # Create output directory
    NETWORKS_DIR.mkdir(parents=True, exist_ok=True)

    try:
        # Phase 1: Download driving network
        logger.info("\n>>> PHASE 1: Downloading driving network...")
        driving_graph = download_road_network(network_type="drive")

        # Assign stable edge IDs
        driving_graph = assign_stable_edge_ids(driving_graph)

        # Calculate travel times
        driving_graph = calculate_travel_times(driving_graph, speed_kmh=DRIVING_SPEED)

        # Save graphs
        save_graphml_files(driving_graph, driving=True)

        # Export driving data
        export_nodes_csv(driving_graph, DATA_DIR / "nodes.csv")
        export_roads_csv(driving_graph, DATA_DIR / "roads.csv")
        export_travel_times_csv(driving_graph, DATA_DIR / "travel_times.csv")

        logger.info("\n" + "="*60)

        # Phase 2: Download walking network
        logger.info("\n>>> PHASE 2: Downloading walking network...")
        walking_graph = download_road_network(network_type="walk")

        # Assign stable edge IDs (reuse IDs across graphs for consistency)
        walking_graph = assign_stable_edge_ids(walking_graph)
        walking_graph = calculate_travel_times(walking_graph, speed_kmh=WALKING_SPEED)

        # Save graph
        save_graphml_files(walking_graph, driving=False)

        logger.info("\n" + "="*60)

        # Phase 3: Export shelters (DEMO DATA)
        export_shelters_csv(DATA_DIR / "shelters.csv")

        # Phase 4: Export flood scenarios (SIMULATED DATA)
        export_flood_scenarios_csv(driving_graph, DATA_DIR / "flood_scenarios.csv")

        logger.info("\n" + "="*60)

        # Phase 5: Validate dataset
        validation_passed = validate_dataset(
            driving_graph,
            walking_graph,
            DATA_DIR / "shelters.csv",
            DATA_DIR / "roads.csv",
            DATA_DIR / "flood_scenarios.csv"
        )

        # Summary
        logger.info("\n" + "="*60)
        logger.info("DATASET GENERATION COMPLETE")
        logger.info("="*60)
        logger.info(f"Nodes exported: {len(driving_graph.nodes)}")
        logger.info(f"Edges exported: {len(driving_graph.edges)}")
        logger.info(f"Nodes in nodes.csv: {len(pd.read_csv(DATA_DIR / 'nodes.csv'))}")
        logger.info(f"Edges in roads.csv: {len(pd.read_csv(DATA_DIR / 'roads.csv'))}")
        logger.info(f"Travel times exported: {len(pd.read_csv(DATA_DIR / 'travel_times.csv'))}")
        logger.info(f"Demo shelters: {len(pd.read_csv(DATA_DIR / 'shelters.csv'))}")
        logger.info(f"Flood scenarios: {len(pd.read_csv(DATA_DIR / 'flood_scenarios.csv'))}")

        if validation_passed:
            logger.info("\n✓ All validations passed!")
            logger.info("✓ Dataset is ready for Phase 2")
        else:
            logger.error("\n✗ Validation failed - check dataset integrity")

        logger.warning("""
IMPORTANT:
-----------
All shelters and flood scenarios in this dataset are SIMULATED for
academic demonstration purposes. This is NOT a real flood or shelter
system.

Use the graph files in 'data/networks/' and CSV files in 'data/' as
the foundation for Phase 2 (Routing Engine).
        """)
        logger.info("="*60)

    except Exception as e:
        logger.error(f"\n✗ Dataset generation FAILED: {e}")
        logger.error("Please check the error above and try again.")
        raise


if __name__ == "__main__":
    main()