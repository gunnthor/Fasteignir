"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUpRight, House, Moon, Sun } from "lucide-react";
import { strings } from "@/lib/format";
export function Header() {
  const path = usePathname(),
    [dark, setDark] = useState(false);
  useEffect(() => {
    const d =
      localStorage.getItem("theme") === "dark" ||
      (!localStorage.getItem("theme") &&
        matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(d);
    document.documentElement.dataset.theme = d ? "dark" : "light";
  }, []);
  function toggle() {
    const d = !dark;
    setDark(d);
    localStorage.setItem("theme", d ? "dark" : "light");
    document.documentElement.dataset.theme = d ? "dark" : "light";
  }
  return (
    <header className="header">
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
