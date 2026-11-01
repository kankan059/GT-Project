"use client";

import { CarFront, Footprints } from "lucide-react";
import type { TravelMode as TravelModeType } from "@/types";

interface TravelModeProps {
  value: TravelModeType;
  onChange: (value: TravelModeType) => void;
}

export function TravelMode({ value, onChange }: TravelModeProps) {
  return (
    <div className="mode-toggle" role="group" aria-label="Travel mode">
      <button
        aria-pressed={value === "driving"}
        className={value === "driving" ? "mode-option selected" : "mode-option"}
        onClick={() => onChange("driving")}
        type="button"
      >
        <CarFront aria-hidden="true" size={17} />
        Driving
      </button>
      <button
        aria-pressed={value === "walking"}
        className={value === "walking" ? "mode-option selected" : "mode-option"}
        onClick={() => onChange("walking")}
        type="button"
      >
        <Footprints aria-hidden="true" size={17} />
        Walking
      </button>
    </div>
  );
}
