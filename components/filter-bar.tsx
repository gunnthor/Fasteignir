"use client";
// Keeps the address bar in sync with view state, without adding history entries.
export function syncUrl(search: string) {
  if (location.search.slice(1) !== search)
    history.replaceState(
      history.state,
      "",
      search ? `?${search}` : location.pathname,
    );
}
