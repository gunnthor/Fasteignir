"use client";
import { PERIODS, type FilterState } from "@/lib/share";

// Shared, non-geographic filters for the comparison and budget views.
export function FilterBar({
  filters,
  onChange,
  area = true,
}: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  area?: boolean;
}) {
  const set = (patch: Partial<FilterState>) =>
    onChange({ ...filters, ...patch });
  return (
    <div className="filter-bar panel">
      <label>
        Tímabil
        <select
          value={filters.months}
          onChange={(e) => set({ months: e.target.value, from: "", to: "" })}
        >
          {PERIODS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      {filters.months === "custom" && (
        <>
          <label>
            Frá
            <input
              type="date"
              aria-label="Frá dagsetningu"
              value={filters.from}
              onChange={(e) => set({ from: e.target.value })}
            />
          </label>
          <label>
            Til
            <input
              type="date"
              aria-label="Til dagsetningar"
              value={filters.to}
              onChange={(e) => set({ to: e.target.value })}
            />
          </label>
        </>
      )}
      <div className="filter-field">
        <span>Tegund eignar</span>
        <div className="segmented">
          {[
            ["all", "Allar"],
            ["apartment", "Fjölbýli"],
            ["house", "Sérbýli"],
          ].map(([v, l]) => (
            <button
              key={v}
              aria-pressed={filters.type === v}
              className={filters.type === v ? "active" : ""}
              onClick={() => set({ type: v })}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <label>
        Herbergi
        <select
          value={filters.rooms}
          onChange={(e) => set({ rooms: e.target.value })}
        >
          <option value="">Öll</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n === 5 ? "5+" : n}
            </option>
          ))}
        </select>
      </label>
      {area && (
        <>
          <label>
            Frá m²
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={filters.minArea}
              onChange={(e) => set({ minArea: e.target.value })}
            />
          </label>
          <label>
            Til m²
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={filters.maxArea}
              onChange={(e) => set({ maxArea: e.target.value })}
            />
          </label>
        </>
      )}
    </div>
  );
}

// Keeps the address bar in sync with view state, without adding history entries.
export function syncUrl(search: string) {
  if (location.search.slice(1) !== search)
    history.replaceState(
      history.state,
      "",
      search ? `?${search}` : location.pathname,
    );
}
