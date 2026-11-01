"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle, MapPin, Search } from "lucide-react";
import { searchLocations } from "@/services/api";
import type { Location } from "@/types";

interface LocationSearchProps {
  onSelect: (location: Location) => void;
}

export function LocationSearch({ onSelect }: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError("");
    setResults([]);
    try {
      const locations = await searchLocations(query.trim());
      setResults(locations);
      if (locations.length === 0) setError("No matching places in the study area.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  function choose(location: Location) {
    onSelect(location);
    setQuery(location.label.split(",")[0]);
    setResults([]);
    setError("");
  }

  return (
    <div className="search-block">
      <label className="field-label" htmlFor="location-search">
        Starting location
      </label>
      <form className="search-form" onSubmit={submit}>
        <MapPin aria-hidden="true" size={17} />
        <input
          id="location-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search a place or address"
          autoComplete="off"
        />
        <button
          aria-label="Search locations"
          className="search-submit"
          disabled={loading || query.trim().length === 0}
          type="submit"
        >
          {loading ? (
            <LoaderCircle className="spin" size={17} />
          ) : (
            <Search size={17} />
          )}
        </button>
      </form>
      <p className="field-hint">Or click anywhere on the map to set your start.</p>
      {error && <p className="inline-error">{error}</p>}
      {results.length > 0 && (
        <ul className="search-results">
          {results.map((location) => (
            <li key={`${location.latitude}-${location.longitude}`}>
              <button onClick={() => choose(location)} type="button">
                <MapPin aria-hidden="true" size={15} />
                <span>{location.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
