"use client";

import type { Scenario, ScenarioId } from "@/types";

interface ScenarioSelectorProps {
  scenarios: Scenario[];
  value: ScenarioId;
  onChange: (value: ScenarioId) => void;
}

const descriptions: Record<ScenarioId, string> = {
  NORMAL: "Normal road conditions",
  MODERATE_FLOOD: "Flooded roads have slower travel times",
  SEVERE_FLOOD: "Blocked roads are excluded from routing",
};

export function ScenarioSelector({
  scenarios,
  value,
  onChange,
}: ScenarioSelectorProps) {
  return (
    <div className="scenario-field">
      <label className="field-label" htmlFor="scenario-select">
        Simulated flood scenario
      </label>
      <select
        id="scenario-select"
        value={value}
        onChange={(event) => onChange(event.target.value as ScenarioId)}
      >
        {scenarios.map((scenario) => (
          <option key={scenario.scenario_id} value={scenario.scenario_id}>
            {scenario.scenario_id.replaceAll("_", " ")}
          </option>
        ))}
      </select>
      <p className="field-hint">{descriptions[value]}</p>
    </div>
  );
}
