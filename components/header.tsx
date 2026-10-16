"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, House, Moon, Sun } from "lucide-react";
import { strings } from "@/lib/format";
export function Header() {
  const path = usePathname(),
    [dark, setDark] = useState(false),
    header = useRef<HTMLElement>(null);
  // Below 900px the header wraps to its content; publish its real height so
  // layouts sized from --header fit the viewport. Wider, the CSS value is used.
  useEffect(() => {
    const el = header.current,
      root = document.documentElement.style,
      narrow = matchMedia("(max-width: 900px)");
    if (!el) return;
    const update = () =>
      narrow.matches
        ? root.setProperty("--header", `${el.offsetHeight}px`)
        : root.removeProperty("--header");
    const observer = new ResizeObserver(update);
    observer.observe(el);
    narrow.addEventListener("change", update);
    return () => {
      observer.disconnect();
      narrow.removeEventListener("change", update);
    };
  }, []);
  useEffect(() => {
    const d =
      localStorage.getItem("theme") === "dark" ||
      (!localStorage.getItem("theme") &&
        matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(d);
    document.documentElement.dataset.theme = d ? "dark" : "light";
  }, []);
  // The mobile nav scrolls sideways; keep the current page's link visible.
  useEffect(() => {
    document
      .querySelector(".header nav [aria-current=page]")
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [path]);
  function toggle() {
    const d = !dark;
    setDark(d);
    localStorage.setItem("theme", d ? "dark" : "light");
    document.documentElement.dataset.theme = d ? "dark" : "light";
  }
  return (
    <header className="header" ref={header}>
      <Link href="/" className="brand">
        <span className="brand-icon">
          <House size={21} />
        </span>
        <span>
          Fasteign<small>fasteign.gunnthor.is</small>
        </span>
      </Link>
      <nav aria-label="Aðalvalmynd">
        {[
          ["/", strings.map],
          ["/markadur", strings.market],
          ["/samanburdur", strings.compare],
          ["/verdmat", strings.estimate],
          ["/um-gognin", strings.about],
        ].map(([href, label]) => (
          <Link
            aria-current={path === href ? "page" : undefined}
            key={href}
            href={href}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="header-actions">
        <button
          className="icon-button"
          onClick={toggle}
          aria-label={dark ? "Nota ljóst útlit" : "Nota dökkt útlit"}
        >
          {dark ? <Sun size={19} /> : <Moon size={19} />}
        </button>
        <Link className="header-cta" href="/verdmat">
          Hvað er eignin mín verðmæt? <ArrowUpRight size={16} />
        </Link>
      </div>
    </header>
  );
}
