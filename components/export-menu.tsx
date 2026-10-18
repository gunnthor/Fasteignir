"use client";
import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import type { Theme } from "@/lib/export-svg";

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Rasterizes a standalone SVG at twice its size. Web fonts are not available
// inside an <img>, so the SVG names Arial/Helvetica as fallbacks.
async function png(svg: string) {
  const img = new Image(),
    url = URL.createObjectURL(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    );
  try {
    await new Promise((ok, fail) => {
      img.onload = ok;
      img.onerror = fail;
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth * 2;
    canvas.height = img.naturalHeight * 2;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(2, 2);
    ctx.drawImage(img, 0, 0);
    return await new Promise<Blob>((ok, fail) =>
      canvas.toBlob((b) => (b ? ok(b) : fail(Error("PNG"))), "image/png"),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

// One compact "Sækja" menu per chart or table: image (PNG/SVG, in the page's
// current theme) and the aggregated numbers as CSV.
export function ExportMenu({
  name,
  svg,
  csv,
  label = "Sækja",
}: {
  // File name for an extension, e.g. ext => `fasteign-107-ppm.${ext}`.
  name: (ext: string) => string;
  svg?: (theme: Theme) => string | null;
  csv?: () => string;
  label?: string;
}) {
  const root = useRef<HTMLDetailsElement>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const outside = (e: MouseEvent) =>
        !el.contains(e.target as Node) && (el.open = false),
      escape = (e: KeyboardEvent) => {
        if (e.key === "Escape" && el.open) {
          el.open = false;
          el.querySelector("summary")?.focus();
        }
      };
    document.addEventListener("mousedown", outside);
    el.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", outside);
      el.removeEventListener("keydown", escape);
    };
  }, []);
  const theme = (): Theme =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  async function run(kind: "png" | "svg" | "csv") {
    setError("");
    try {
      if (kind === "csv")
        save(
          new Blob([csv!()], { type: "text/csv;charset=utf-8" }),
          name("csv"),
        );
      else {
        const s = svg!(theme());
        if (!s) throw Error("Engin mynd: of fáar sölur til að birta myndrit.");
        save(
          kind === "svg"
            ? new Blob([s], { type: "image/svg+xml;charset=utf-8" })
            : await png(s),
          name(kind),
        );
      }
      if (root.current) root.current.open = false;
    } catch (e) {
      setError(
        e instanceof Error && e.message.startsWith("Engin")
          ? e.message
          : "Ekki tókst að búa til skrána.",
      );
    }
  }
  return (
    <details className="export-menu" ref={root}>
      <summary aria-label={`${label}: mynd eða gögn`}>
        <Download size={15} /> {label}
      </summary>
      <div className="export-options" role="group" aria-label="Sniðmát">
        {svg && (
          <>
            <button onClick={() => run("png")}>Mynd (PNG)</button>
            <button onClick={() => run("svg")}>Mynd (SVG)</button>
          </>
        )}
        {csv && <button onClick={() => run("csv")}>Gögn (CSV)</button>}
        <small>Með heimild, tímabili, síum og úrtaksstærð.</small>
        {error && (
          <small className="export-error" role="alert">
            {error}
          </small>
        )}
      </div>
    </details>
  );
}
