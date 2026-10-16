"use client";
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  LineChart,
  Line,
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
