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
  LineChart,
  Line,
  ReferenceLine,
} from "recharts";
import { num, numberIS } from "@/lib/format";

const axis = { fontSize: "0.875rem", fill: "var(--muted)" };
const grid = (
  <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="var(--line)" />
);
type Pair = {
  a: number | null;
  b: number | null;
  aCount: number;
  bCount: number;
};
const sides = ["a", "b"] as const;

// Two areas' rolling median price per m²; colours follow the A/B identity.
export function CompareTrendChart({
  data,
  names,
}: {
  data: ({ month: string } & Pair)[];
  names: [string, string];
}) {
  return (
    <div
      className="chart"
      role="img"
      aria-label={`Þriggja mánaða hlaupandi miðgildi á m², ${names[0]} og ${names[1]}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          {grid}
          <XAxis
            dataKey="month"
            tick={axis}
            tickFormatter={(s) => s.slice(2).replace("-", "/")}
            minTickGap={40}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            width={54}
            tick={axis}
            tickFormatter={(v) => num(v / 1000)}
            axisLine={false}
            tickLine={false}
            domain={["auto", "auto"]}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as Pair;
              return (
                <div className="chart-tooltip">
                  <strong>{String(label)}</strong>
                  {sides.map((k, i) => (
                    <p key={k}>
                      <span className={`swatch swatch-${k}`} />
                      {names[i]}:{" "}
                      {row[k] === null
                        ? "ófullnægjandi gögn"
                        : `${num(row[k]! / 1000)} þ.kr./m²`}{" "}
                      <small>({num(row[`${k}Count`])} sölur)</small>
                    </p>
                  ))}
                </div>
              );
            }}
          />
          {sides.map((k) => (
            <Line
              key={k}
              dataKey={k}
              type="monotone"
              stroke={`var(--series-${k})`}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: "var(--panel)", strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Share of each area's sales in shared price-per-m² bins (þ.kr./m²).
export function DistributionChart({
  data,
  names,
}: {
  data: ({ label: string } & Pair)[];
  names: [string, string];
}) {
  return (
    <div
      className="chart"
      role="img"
      aria-label={`Dreifing söluverðs á m²: hlutfall kaupsamninga í ${names[0]} og ${names[1]}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={2} barCategoryGap="18%">
          {grid}
          <XAxis
            dataKey="label"
            tick={axis}
            interval="preserveStartEnd"
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            width={44}
            tick={axis}
            tickFormatter={(v) => `${num(v)}%`}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--soft)" }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as Pair;
              return (
                <div className="chart-tooltip">
                  <strong>{String(label)} þ.kr./m²</strong>
                  {sides.map((k, i) => (
                    <p key={k}>
                      <span className={`swatch swatch-${k}`} />
                      {names[i]}: {numberIS(row[k] ?? 0, 1)}%{" "}
                      <small>({num(row[`${k}Count`])} sölur)</small>
                    </p>
                  ))}
                </div>
              );
            }}
          />
          {sides.map((k) => (
            <Bar
              key={k}
              dataKey={k}
              fill={`var(--series-${k})`}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Share of historical sales at or below each budget level, chosen budget marked.
export function BudgetCurveChart({
  data,
  budget,
}: {
  data: { budget: number; share: number | null }[];
  budget: number;
}) {
  return (
    <div
      className="chart"
      role="img"
      aria-label="Hlutfall seldra eigna á eða undir hverri fjárhæð"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          {grid}
          <defs>
            <linearGradient id="gradient-budget" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#388e7d" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#388e7d" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="budget"
            type="number"
            domain={["dataMin", "dataMax"]}
            tick={axis}
            tickFormatter={(v) => num(v / 1e6)}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            width={44}
            tick={axis}
            domain={[0, 100]}
            tickFormatter={(v) => `${num(v)}%`}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as (typeof data)[number];
              return (
                <div className="chart-tooltip">
                  <strong>Allt að {num(row.budget / 1e6)} m.kr.</strong>
                  <p>
                    {row.share === null
                      ? "Ófullnægjandi gögn"
                      : `${numberIS(row.share, 1)}% seldra eigna`}
                  </p>
                </div>
              );
            }}
          />
          <ReferenceLine
            x={budget}
            stroke="var(--text)"
            strokeDasharray="4 3"
            strokeWidth={1.5}
          />
          <Area
            type="monotone"
            dataKey="share"
            stroke="#388e7d"
            fill="url(#gradient-budget)"
            strokeWidth={2}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SizeChart({
  data,
}: {
  data: { label: string; count: number }[];
}) {
  return (
    <div
      className="chart"
      role="img"
      aria-label="Stærð seldra eigna innan fjárhæðar"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          {grid}
          <XAxis
            dataKey="label"
            tick={axis}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            width={44}
            tick={axis}
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--soft)" }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="chart-tooltip">
                  <strong>{String(label)} m²</strong>
                  <p>{num(payload[0].payload.count)} sölur</p>
                </div>
              );
            }}
          />
          <Bar
            dataKey="count"
            fill="var(--accent)"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
