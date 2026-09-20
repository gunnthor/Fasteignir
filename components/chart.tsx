"use client";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { num } from "@/lib/format";
export function TrendChart({
  data,
  kind = "ppm",
}: {
  data: object[];
  kind?: "ppm" | "volume" | "area";
}) {
  const chart = (
    <>
      <CartesianGrid
        strokeDasharray="3 4"
        vertical={false}
        stroke="var(--line)"
      />
      <XAxis
        dataKey="month"
        tick={{ fontSize: "0.875rem", fill: "var(--muted)" }}
        tickFormatter={(s) => s.slice(2).replace("-", "/")}
        minTickGap={40}
        axisLine={false}
        tickLine={false}
      />
      <YAxis
        width={54}
        tick={{ fontSize: "0.875rem", fill: "var(--muted)" }}
        tickFormatter={(v) => num(kind === "ppm" ? v / 1000 : v)}
        axisLine={false}
        tickLine={false}
        domain={kind === "volume" ? [0, "auto"] : ["auto", "auto"]}
      />
      <Tooltip
        content={({ active, payload, label }) => {
          if (!active || !payload?.length) return null;
          const row = payload[0].payload;
          const value = row[kind];
          return (
            <div className="chart-tooltip">
              <strong>{String(label)}</strong>
              <p>
                {value === null
                  ? "Ófullnægjandi gögn"
                  : `${num(kind === "ppm" ? value / 1000 : value)} ${kind === "ppm" ? "þ.kr./m²" : kind === "area" ? "m²" : "sölur"}`}
              </p>
              <small>
                {kind === "volume"
                  ? `${num(row.volume)} sölur í mánuði`
                  : `${num(row.count)} sölur í 3 mánaða glugga`}
              </small>
            </div>
          );
        }}
      />
    </>
  );
  return (
    <div
      className="chart"
      role="img"
      aria-label={
        kind === "volume"
          ? "Fjöldi kaupsamninga eftir mánuði"
          : "Þriggja mánaða hlaupandi miðgildi; úrtaksstærð birtist við snertingu"
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        {kind === "volume" ? (
          <BarChart data={data}>
            {chart}
            <Bar
              dataKey="volume"
              fill="var(--accent)"
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        ) : (
          <AreaChart data={data}>
            {chart}
            <defs>
              <linearGradient
                id={`gradient-${kind}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor="#388e7d" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#388e7d" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey={kind}
              stroke="#388e7d"
              fill={`url(#gradient-${kind})`}
              strokeWidth={2.5}
              connectNulls={false}
              isAnimationActive={false}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
