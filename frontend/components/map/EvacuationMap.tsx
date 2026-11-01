"use client";

import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { STUDY_CENTER } from "@/lib/constants";
import { MapControls } from "@/components/map/MapControls";
import type { Coordinate, Location, RouteResult, Shelter } from "@/types";

function FocusLocation({ location }: { location: Location | null }) {
  const map = useMap();
  useEffect(() => {
    if (!location) return;
    map.flyTo([location.latitude, location.longitude], Math.max(map.getZoom(), 14), {
      duration: 0.6,
    });
  }, [location, map]);
  return null;
}

interface EvacuationMapProps {
  location: Location | null;
  shelters: Shelter[];
  route: RouteResult | null;
  onLocationSelect: (location: Location) => void;
  activeAlternativeId: string | null;
  criticalEnabled: boolean;
  onToggleCritical: () => void;
}

function LocationPicker({
  onSelect,
}: {
  onSelect: (location: Location) => void;
}) {
  useMapEvents({
    click(event) {
      onSelect({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
        label: `Map pin · ${event.latlng.lat.toFixed(5)}, ${event.latlng.lng.toFixed(5)}`,
      });
    },
  });
  return null;
}

function FitRoute({ geometry }: { geometry: Coordinate[] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!geometry || geometry.length === 0) return;
    const points = geometry.map(
      (point) => [point.latitude, point.longitude] as [number, number],
    );
    if (points.length === 1) {
      map.setView(points[0], 15);
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 15 });
    }
  }, [geometry, map]);
  return null;
}

export default function EvacuationMap({
  location,
  shelters,
  route,
  onLocationSelect,
  activeAlternativeId,
  criticalEnabled,
  onToggleCritical,
}: EvacuationMapProps) {
  const routePoints =
    route?.recommended_route_geometry?.map(
      (point) => [point.latitude, point.longitude] as [number, number],
    ) ?? [];

  return (
    <MapContainer
      center={STUDY_CENTER}
      className="leaflet-map"
      zoom={12}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <LocationPicker onSelect={onLocationSelect} />
      <FocusLocation location={location} />
      <FitRoute geometry={route?.recommended_route_geometry ?? null} />
      <MapControls
        center={
          location
            ? [location.latitude, location.longitude]
            : STUDY_CENTER
        }
        criticalEnabled={criticalEnabled}
        onToggleCritical={onToggleCritical}
      />
      {routePoints.length > 1 && (
        <Polyline
          positions={routePoints}
          pathOptions={{ color: "#0f766e", weight: 6, opacity: 0.88 }}
        >
          <Tooltip sticky>Recommended safe route · simulated</Tooltip>
        </Polyline>
      )}
      {location && (
        <CircleMarker
          center={[location.latitude, location.longitude]}
          pathOptions={{ color: "#ffffff", fillColor: "#f97316", fillOpacity: 1 }}
          radius={9}
        >
          <Tooltip direction="top" offset={[0, -8]} permanent>
            Start
          </Tooltip>
        </CircleMarker>
      )}
      {shelters.map((shelter) => {
        const recommended =
          shelter.shelter_id === route?.recommended_shelter_id;
        const selected = shelter.shelter_id === activeAlternativeId;
        return (
          <CircleMarker
            center={[shelter.latitude, shelter.longitude]}
            key={shelter.shelter_id}
            pathOptions={{
              color: "#ffffff",
              fillColor: recommended ? "#0f766e" : selected ? "#2563eb" : "#64748b",
              fillOpacity: 1,
            }}
            radius={recommended || selected ? 9 : 7}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              {shelter.name} · demo shelter
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
