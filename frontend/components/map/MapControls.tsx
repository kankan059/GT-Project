"use client";

import { Layers3, LocateFixed } from "lucide-react";
import { useMap } from "react-leaflet";

interface MapControlsProps {
  criticalEnabled: boolean;
  onToggleCritical: () => void;
  center: [number, number];
}

export function MapControls({
  criticalEnabled,
  onToggleCritical,
  center,
}: MapControlsProps) {
  const map = useMap();

  return (
    <div className="map-controls">
      <button
        aria-pressed={criticalEnabled}
        className={criticalEnabled ? "map-control active" : "map-control"}
        onClick={onToggleCritical}
        type="button"
      >
        <Layers3 size={16} />
        Critical roads
      </button>
      <button
        aria-label="Recenter map"
        className="map-control icon-only"
        onClick={() => map.setView(center, Math.max(map.getZoom(), 12))}
        type="button"
      >
        <LocateFixed size={17} />
      </button>
    </div>
  );
}
