import type { Scenario } from "@/types";

export const STUDY_CENTER: [number, number] = [26.1022, 92.1986];
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:8000";

export const FALLBACK_SCENARIOS: Scenario[] = [
  {
    scenario_id: "NORMAL",
    status: "AVAILABLE",
    severity: "none",
    penalty_multiplier: 1,
  },
  {
    scenario_id: "MODERATE_FLOOD",
    status: "PARTIALLY_FLOODED",
    severity: "moderate",
    penalty_multiplier: 1.5,
  },
  {
    scenario_id: "SEVERE_FLOOD",
    status: "BLOCKED",
    severity: "severe",
    penalty_multiplier: 2.5,
  },
];
