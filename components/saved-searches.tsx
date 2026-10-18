"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Check, Copy, Pencil, Rss, Trash2, X } from "lucide-react";
import {
  MAX_SAVED,
  NAME_MAX,
  SEARCH_PAGES,
  STORAGE_KEY,
  createSearch,
  defaultName,
  feedHref,
  parseStore,
  searchHref,
  serializeStore,
  viewOf,
  type LoadedStore,
  type SavedSearch,
  type SearchPage,
} from "@/lib/saved-search";
import { filterSummary, periodLabel, type View } from "@/lib/share";

// localStorage can be missing or throw (private windows, blocked storage).
function read(): LoadedStore {
  try {
    return parseStore(localStorage.getItem(STORAGE_KEY));
  } catch {
    return { searches: [], adjusted: [], dropped: 0, problem: null };
  }
}
function write(searches: SavedSearch[]) {
  try {
    localStorage.setItem(STORAGE_KEY, serializeStore(searches));
    return true;
  } catch {
    return false;
  }
}
const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function useSavedSearches() {
  const [store, setStore] = useState<LoadedStore | null>(null),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    setStore(read());
    const sync = (e: StorageEvent) => e.key === STORAGE_KEY && setStore(read());
    addEventListener("storage", sync);
    return () => removeEventListener("storage", sync);
  }, []);
  const update = useCallback(
    (change: (list: SavedSearch[]) => SavedSearch[]) => {
      const current = read();
      // Never overwrite searches saved by a newer version of the site.
      if (current.problem === "newer") return setStore(current);
      const next = change(current.searches);
      setFailed(!write(next));
      setStore({ ...current, searches: next, problem: null });
    },
    [],
  );
  return { store, failed, update };
}

export function SavedSearchList({
  store,
  update,
  onOpen,
  page,
}: {
  store: LoadedStore;
  update: ReturnType<typeof useSavedSearches>["update"];
  onOpen?: (view: View) => void;
  page?: SearchPage;
}) {
  const router = useRouter(),
    [editing, setEditing] = useState(""),
    [draft, setDraft] = useState(""),
    [confirm, setConfirm] = useState(""),
    [copied, setCopied] = useState("");
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(""), 2000);
    return () => clearTimeout(t);
  }, [copied]);
  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
    } catch {
      setCopied("");
    }
  }
  function open(s: SavedSearch) {
    if (onOpen && s.page === page) onOpen(viewOf(s));
    else router.push(searchHref(s));
  }
  if (!store.searches.length)
    return (
      <p className="micro saved-empty">
        Engar vistaðar leitir enn. Leitir eru geymdar í þessum vafra, ekki á
        aðgangi, og hverfa ef vafragögnum er eytt.
      </p>
    );
  return (
    <ul className="saved-list">
      {store.searches.map((s) => {
        const v = viewOf(s),
          adjusted = store.adjusted.includes(s.id);
        return (
          <li key={s.id}>
            {editing === s.id ? (
              <form
                className="saved-rename"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = draft.trim();
                  if (name)
                    update((list) =>
                      list.map((x) =>
                        x.id === s.id
                          ? {
                              ...x,
                              name: name.slice(0, NAME_MAX),
                              updated: new Date().toISOString(),
                            }
                          : x,
                      ),
                    );
                  setEditing("");
                }}
              >
                <input
                  aria-label="Nýtt heiti leitar"
                  value={draft}
                  maxLength={NAME_MAX}
                  autoFocus
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Escape" && (e.stopPropagation(), setEditing(""))
                  }
                />
                <button type="submit">Vista</button>
                <button type="button" onClick={() => setEditing("")}>
                  Hætta við
                </button>
              </form>
            ) : (
              <button className="saved-open" onClick={() => open(s)}>
                <strong>{s.name}</strong>
                <small>
                  {SEARCH_PAGES[s.page]} · {periodLabel(v.filters)} ·{" "}
                  {filterSummary(v.filters, v.q).join(", ")}
                </small>
                {adjusted && (
                  <small className="saved-adjusted">
                    Sumar síur áttu ekki lengur við og voru felldar niður.
                  </small>
                )}
              </button>
            )}
            <div className="saved-actions">
              <button
                className="icon-button"
                aria-label={`Endurnefna ${s.name}`}
                title="Endurnefna"
                onClick={() => {
                  setEditing(s.id);
                  setDraft(s.name);
                }}
              >
                <Pencil size={15} />
              </button>
              <button
                className="icon-button"
                aria-label={`Afrita tengil á ${s.name}`}
                title="Afrita tengil"
                onClick={() =>
                  copy(`link-${s.id}`, location.origin + searchHref(s))
                }
              >
                {copied === `link-${s.id}` ? (
                  <Check size={15} />
                ) : (
                  <Copy size={15} />
                )}
              </button>
              <button
                className="icon-button"
                aria-label={`Afrita RSS-slóð fyrir ${s.name}`}
                title="Afrita RSS-slóð (Atom)"
                onClick={() =>
                  copy(`feed-${s.id}`, location.origin + feedHref(v))
                }
              >
                {copied === `feed-${s.id}` ? (
                  <Check size={15} />
                ) : (
                  <Rss size={15} />
                )}
              </button>
              {confirm === s.id ? (
                <button
                  className="danger-button"
                  onClick={() => {
                    update((list) => list.filter((x) => x.id !== s.id));
                    setConfirm("");
                  }}
                >
                  Staðfesta eyðingu
                </button>
              ) : (
                <button
                  className="icon-button"
                  aria-label={`Eyða ${s.name}`}
                  title="Eyða"
                  onClick={() => setConfirm(s.id)}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </li>
        );
      })}
      <li className="visually-hidden" aria-live="polite">
        {copied ? "Afritað á klippiborð" : ""}
      </li>
    </ul>
  );
}

// Read-only overview for pages without a View of their own (e.g. /nyskrad).
export function SavedSearchOverview() {
  const { store, update } = useSavedSearches();
  if (!store?.searches.length) return null;
  return (
    <div className="saved-overview">
      <strong className="saved-title">Vistaðar leitir</strong>
      <SavedSearchList store={store} update={update} />
    </div>
  );
}

// "Vista leit" / "Vistaðar leitir" popover for pages whose state is a View.
export function SavedSearches({
  view,
  page,
  onOpen,
}: {
  view: View;
  page: SearchPage;
  onOpen: (view: View) => void;
}) {
  const { store, failed, update } = useSavedSearches(),
    [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [saved, setSaved] = useState(false),
    [copied, setCopied] = useState(false),
    root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    input = useRef<HTMLInputElement>(null);
  function close(restoreFocus: boolean) {
    setOpen(false);
    setSaved(false);
    if (restoreFocus) trigger.current?.focus();
  }
  useEffect(() => {
    if (!open) return;
    setName(defaultName(view));
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close(true),
      onClick = (e: MouseEvent) =>
        !root.current?.contains(e.target as Node) && close(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
    // The suggested name is taken when the panel opens, not on every change.
  }, [open]);
  const count = store?.searches.length ?? 0,
    full = count >= MAX_SAVED,
    readOnly = store?.problem === "newer";
  return (
    <div className="share saved" ref={root}>
      <button
        ref={trigger}
        className="icon-button share-button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => (open ? close(true) : setOpen(true))}
      >
        <Bookmark size={16} /> Vista leit
        {count > 0 && <span className="count-badge">{count}</span>}
      </button>
      {open && store && (
        <div
          className="share-panel saved-panel"
          role="dialog"
          aria-label="Vistaðar leitir"
        >
          <div className="share-head">
            <strong>Vista leit</strong>
            <button
              className="icon-button"
              aria-label="Loka"
              onClick={() => close(true)}
            >
              <X size={16} />
            </button>
          </div>
          <form
            className="share-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (full || readOnly) return;
              update((list) => [
                createSearch(
                  view,
                  page,
                  name,
                  new Date().toISOString(),
                  newId(),
                ),
                ...list,
              ]);
              setSaved(true);
            }}
          >
            <input
              ref={input}
              aria-label="Heiti leitar"
              value={name}
              maxLength={NAME_MAX}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
            />
            <button type="submit" disabled={full || readOnly}>
              {saved ? <Check size={15} /> : <Bookmark size={15} />}
              {saved ? "Vistað" : "Vista"}
            </button>
          </form>
          <p className="micro">
            {periodLabel(view.filters)} ·{" "}
            {filterSummary(view.filters, view.q).join(", ")}
          </p>
          {full && (
            <p className="notice">
              Hámark {MAX_SAVED} vistaðar leitir. Eyddu leit til að vista nýja.
            </p>
          )}
          {failed && (
            <p className="notice" role="alert">
              Vafrinn leyfði ekki vistun (t.d. í huliðsglugga).
            </p>
          )}
          {store.problem === "corrupt" && (
            <p className="notice">
              Ekki tókst að lesa eldri vistaðar leitir í þessum vafra.
            </p>
          )}
          {readOnly && (
            <p className="notice">
              Leitirnar voru vistaðar með nýrri útgáfu vefsins og er ekki breytt
              hér.
            </p>
          )}
          {store.dropped > 0 && (
            <p className="notice">
              {store.dropped === 1
                ? "Ein vistuð leit var ógild"
                : `${store.dropped} vistaðar leitir voru ógildar`}{" "}
              og er ekki sýnd.
            </p>
          )}
          <div className="saved-feed">
            <a
              href={feedHref(view)}
              target="_blank"
              rel="noopener"
              type="application/atom+xml"
            >
              <Rss size={15} /> Gerast áskrifandi að RSS
            </a>
            <button
              className="text-link"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    location.origin + feedHref(view),
                  );
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {}
              }}
            >
              {copied ? "Slóð afrituð" : "Afrita slóð"}
            </button>
            <small>
              Nýjar færslur úr kaupskrá HMS sem passa við síurnar, óháð
              tímabili. Settu slóðina í RSS-lesara.
            </small>
          </div>
          <strong className="saved-title">Vistaðar leitir</strong>
          <SavedSearchList
            store={store}
            update={update}
            page={page}
            onOpen={(v) => {
              onOpen(v);
              close(true);
            }}
          />
        </div>
      )}
    </div>
  );
}
