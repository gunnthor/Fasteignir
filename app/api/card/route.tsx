import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { buildCard, cacheHeaders, notModified, sparkPath } from "@/lib/card";
import { parseView } from "@/lib/share";
import { num } from "@/lib/format";
export const runtime = "nodejs";

const ink = "#223a33",
  muted = "#53665d",
  accent = "#2e715c",
  line = "#dfe6e0";

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams,
    view = parseView(source);
  let headers, card;
  try {
    headers = await cacheHeaders(view, source);
    const cached = notModified(request, headers);
    if (cached) return cached;
    card = await buildCard(view);
  } catch (e) {
    console.error(e);
    return new Response("Ekki tókst að búa til mynd", { status: 400 });
  }
  const spark = sparkPath(card.trend, 400, 150),
    stat = (label: string, value: string) => (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 22, color: muted }}>{label}</span>
        <span style={{ fontSize: 34, color: ink }}>{value}</span>
      </div>
    );
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#f3f5f1",
        padding: "48px 60px 40px",
        color: ink,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 22,
          color: muted,
          letterSpacing: 2,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: accent,
              display: "flex",
            }}
          />
          <span style={{ color: ink, letterSpacing: 0, fontSize: 28 }}>
            Fasteign
          </span>
        </div>
        <span>ÞINGLÝST KAUPVERÐ · HMS</span>
      </div>
      <div style={{ display: "flex", marginTop: 26, gap: 40 }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <span style={{ fontSize: 56, lineHeight: 1.1 }}>{card.area}</span>
          <span style={{ fontSize: 26, color: muted, marginTop: 10 }}>
            {[...card.filters, card.period].join(" · ")}
          </span>
          <span style={{ fontSize: 24, color: muted, marginTop: 4 }}>
            {`${card.range} · nýjasti samningur ${card.latestSale}`}
          </span>
          <span style={{ fontSize: 24, color: muted, marginTop: 26 }}>
            Miðgildi söluverðs á m²
          </span>
          <span
            style={{
              fontSize: card.ppm ? 80 : 40,
              color: card.ppm ? accent : ink,
              lineHeight: 1.1,
              marginTop: 4,
            }}
          >
            {card.ppm ?? card.notes.suppressed}
          </span>
        </div>
        {spark && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              width: 400,
            }}
          >
            <svg width="400" height="150" viewBox="-4 -4 408 158">
              <path
                d={spark}
                fill="none"
                stroke={accent}
                strokeWidth="4"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
            <span style={{ fontSize: 20, color: muted, marginTop: 10 }}>
              {`3 mánaða hlaupandi miðgildi · ${card.trendRange}`}
            </span>
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          gap: 60,
          marginTop: 24,
          paddingTop: 18,
          borderTop: `2px solid ${line}`,
        }}
      >
        {stat("Gildar sölur", num(card.count))}
        {card.price && stat("Miðgildi kaupverðs", card.price)}
        {card.change && stat("Breyting frá fyrra tímabili", card.change)}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: "auto",
          paddingTop: 16,
          fontSize: 19,
          color: muted,
          gap: 4,
        }}
      >
        {card.status === "sparse" && (
          <span style={{ color: ink }}>{card.notes.sparse}</span>
        )}
        <span>{card.notes.caveat}</span>
        <span>
          {`${card.notes.source} · Gögn sótt ${card.updated} · fasteign.gunnthor.is`}
        </span>
      </div>
    </div>,
    { width: 1200, height: 630, headers },
  );
}
