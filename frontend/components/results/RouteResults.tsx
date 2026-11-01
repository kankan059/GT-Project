"use client";

import { AlertTriangle, ArrowUpRight, Clock3, Route, ShieldCheck } from "lucide-react";
import type { RouteResult, Shelter } from "@/types";

interface RouteResultsProps {
  result: RouteResult | null;
  shelters: Shelter[];
  selectedAlternativeId: string | null;
  onSelectAlternative: (shelterId: string) => void;
  loading: boolean;
}

export function RouteResults({
  result,
  shelters,
  selectedAlternativeId,
  onSelectAlternative,
  loading,
}: RouteResultsProps) {
  if (loading) {
    return (
      <section className="results-section">
        <div className="section-heading">
          <span className="section-icon"><Route size={16} /></span>
          <h2>Route results</h2>
        </div>
        <div className="results-placeholder">
          <span className="loading-dot" />
          Calculating routes to available shelters…
        </div>
      </section>
    );
  }

  if (!result) {
    return (
      <section className="results-section">
        <div className="section-heading">
          <span className="section-icon"><Route size={16} /></span>
          <h2>Route results</h2>
        </div>
        <div className="results-placeholder">
          Choose a starting location and find a route to see safe shelter options.
        </div>
      </section>
    );
  }

  const hasRecommendation = Boolean(result.recommended_shelter_name);
  const recommended = shelters.find(
    (shelter) => shelter.shelter_id === result.recommended_shelter_id,
  );

  return (
    <section className="results-section">
      <div className="section-heading">
        <span className="section-icon"><Route size={16} /></span>
        <h2>Route results</h2>
        {result.success && <span className="result-count">{result.total_reachable_shelters} reachable</span>}
      </div>
      {hasRecommendation ? (
        <>
          <article className="recommended-card">
            <div className="recommended-label">
              <ShieldCheck size={15} />
              Recommended · simulated
            </div>
            <h3>{result.recommended_shelter_name}</h3>
            {recommended?.is_demo && <span className="demo-pill">DEMO SHELTER</span>}
            <div className="metrics-row">
              <div className="metric">
                <Clock3 size={16} />
                <strong>
                  {result.recommended_shelter_travel_time_min?.toFixed(1)} min
                </strong>
                <span>estimated time</span>
              </div>
              <div className="metric">
                <Route size={16} />
                <strong>
                  {result.recommended_shelter_distance_km?.toFixed(2)} km
                </strong>
                <span>route distance</span>
              </div>
            </div>
            <p className="route-status">Safest reachable route for selected scenario</p>
          </article>
          {result.alternative_shelters.length > 0 && (
            <div className="alternative-list">
              <h3>Other reachable shelters</h3>
              <p className="field-hint">Select a shelter to highlight its map marker.</p>
              {result.alternative_shelters.map((option) => (
                <button
                  aria-pressed={selectedAlternativeId === option.shelter_id}
                  className={
                    selectedAlternativeId === option.shelter_id
                      ? "alternative-option active"
                      : "alternative-option"
                  }
                  key={option.shelter_id}
                  onClick={() => onSelectAlternative(option.shelter_id)}
                  type="button"
                >
                  <span className="alternative-name">
                    <span className="shelter-dot" />
                    {option.name}
                  </span>
                  <span className="alternative-time">
                    {option.travel_time_min.toFixed(1)} min
                    <ArrowUpRight size={14} />
                  </span>
                </button>
              ))}
              <p className="map-note">
                The current API only provides map geometry for the recommended route.
              </p>
            </div>
          )}
          {result.total_unreachable_shelters > 0 && (
            <div className="unreachable-note">
              <AlertTriangle size={15} />
              {result.total_unreachable_shelters} shelter
              {result.total_unreachable_shelters === 1 ? "" : "s"} unreachable in
              this scenario.
            </div>
          )}
        </>
      ) : (
        <div className="empty-route">
          <AlertTriangle size={18} />
          <div>
            <strong>No reachable shelter found</strong>
            <p>{result.message || "Try another location or flood scenario."}</p>
          </div>
        </div>
      )}
    </section>
  );
}
