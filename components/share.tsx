"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Copy, Share2, X } from "lucide-react";
import { date } from "@/lib/format";
import { serializeFilters, serializeView, type View } from "@/lib/share";

// Share the current view as a link, an <iframe> card or an image. Relative periods
// can be pinned to the exact dates on screen so a published figure does not drift.
export function SharePanel({
  view,
  path,
  title,
  range,
  version,
}: {
  view: View;
  path: string;
  title: string;
  range: { from: string; to: string };
  version?: string;
}) {
  const [open, setOpen] = useState(false),
    [pin, setPin] = useState(false),
    [copied, setCopied] = useState(""),
    root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    link = useRef<HTMLInputElement>(null);
  // Closing by keyboard or button returns focus to the trigger; an outside click
  // leaves focus where the user put it.
  function close(restoreFocus: boolean) {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  }
  useEffect(() => {
    if (!open) return;
    link.current?.focus();
    link.current?.select();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close(true),
      onClick = (e: MouseEvent) =>
        !root.current?.contains(e.target as Node) && close(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(""), 2000);
    return () => clearTimeout(t);
  }, [copied]);
  const relative = view.filters.months !== "custom",
    pinned = pin && relative ? range : undefined;
  function urls() {
    const origin = location.origin,
      page = serializeView(view, pinned),
      card = serializeFilters(view.filters, pinned);
    if (view.q) card.set("q", view.q);
    // With fixed dates and the snapshot version, cards can be cached as immutable.
    if (version && (pinned || !relative)) card.set("v", version);
    const suffix = (p: URLSearchParams) => (p.size ? `?${p}` : "");
    return {
      link: `${origin}${path}${suffix(page)}`,
      embed: `${origin}/embed${suffix(card)}`,
      image: `${origin}/api/card${suffix(card)}`,
    };
  }
  async function copy(kind: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
    } catch {
      setCopied("");
    }
  }
  const u = open ? urls() : null,
    iframe =
      u &&
      `<iframe src="${u.embed}" title="${title.replace(/"/g, "&quot;")} · Fasteign" width="100%" height="380" style="border:0;max-width:560px" loading="lazy"></iframe>`;
  return (
    <div className="share" ref={root}>
      <button
        ref={trigger}
        className="icon-button share-button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => (open ? close(true) : setOpen(true))}
      >
        <Share2 size={16} /> Deila
      </button>
      {open && u && (
        <div className="share-panel" role="dialog" aria-label="Deila sýn">
          <div className="share-head">
            <strong>Deila þessari sýn</strong>
            <button
              className="icon-button"
              aria-label="Loka"
              onClick={() => close(true)}
            >
              <X size={16} />
            </button>
          </div>
          {relative && (
            <label className="share-pin">
              <input
                type="checkbox"
                checked={pin}
                onChange={(e) => setPin(e.target.checked)}
              />
              <span>
                Festa dagsetningar ({date(range.from)} – {date(range.to)})
                <small>
                  Annars uppfærist tímabilið þegar nýjar sölur bætast við.
                </small>
              </span>
            </label>
          )}
          <label className="field-label" htmlFor="share-link">
            Tengill
          </label>
          <div className="share-row">
            <input id="share-link" ref={link} readOnly value={u.link} />
            <button onClick={() => copy("link", u.link)}>
              {copied === "link" ? <Check size={15} /> : <Copy size={15} />}
              {copied === "link" ? "Afritað" : "Afrita"}
            </button>
          </div>
          <label className="field-label" htmlFor="share-embed">
            Ívafskóði (iframe)
          </label>
          <div className="share-row">
            <textarea id="share-embed" readOnly rows={3} value={iframe!} />
            <button onClick={() => copy("embed", iframe!)}>
              {copied === "embed" ? <Check size={15} /> : <Copy size={15} />}
              {copied === "embed" ? "Afritað" : "Afrita"}
            </button>
          </div>
          <p className="share-links">
            <a href={u.embed} target="_blank" rel="noopener">
              Forskoða spjald
            </a>
            <a href={u.image} target="_blank" rel="noopener">
              Opna mynd (PNG)
            </a>
            {typeof navigator.share === "function" && (
              <button
                className="text-link"
                onClick={() =>
                  navigator
                    .share({ title: `${title} · Fasteign`, url: u.link })
                    .catch(() => {})
                }
              >
                Deila með…
              </button>
            )}
          </p>
          <p className="micro">
            Spjöld sýna tímabil, fjölda kaupsamninga og dagsetningu gagna. Færri
            en 5 sölur: verð er ekki birt.
          </p>
          <span className="visually-hidden" aria-live="polite">
            {copied ? "Afritað á klippiborð" : ""}
          </span>
        </div>
      )}
    </div>
  );
}
