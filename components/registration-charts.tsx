"use client";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { date, num, numberIS } from "@/lib/format";

const axis = { fontSize: "0.875rem", fill: "var(--muted)" };
const grid = (
  <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="var(--line)" />
);

export function LagHistogram({
  data,
}: {
  data: { label: string; count: number; share: number }[];
}) {
  return (
    <div
      className="chart"
      role="img"
      aria-label="Dreifing biðtíma frá undirritun til þinglýsingar. Tafla fylgir."
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          {grid}
          <XAxis
            dataKey="label"
            tick={axis}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <YAxis
            width={40}
            tick={axis}
            tickFormatter={(v) => `${num(v)}%`}
            axisLine={false}
            tickLine={false}
            dataKey="share"
          />
          <Tooltip
            cursor={{ fill: "var(--soft)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const r = payload[0].payload as (typeof data)[number];
              return (
                <div className="chart-tooltip">
                  <strong>{r.label} dagar</strong>
                  <p>
                    {numberIS(r.share, 1)}% · {num(r.count)} samningar
                  </p>
                </div>
              );
            }}
          />
          <Bar
            dataKey="share"
            fill="var(--accent)"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LagTrend({
  data,
}: {
  data: {
    month: string;
    count: number;
    median: number | null;
    p90: number | null;
  }[];
}) {
  return (
    <div
      className="chart"
      role="img"
      aria-label="Miðgildi og 90. hundraðshluti biðtíma eftir þinglýsingarmánuði. Tafla fylgir."
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
          <YAxis width={40} tick={axis} axisLine={false} tickLine={false} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const r = payload[0].payload as (typeof data)[number];
              return (
                <div className="chart-tooltip">
                  <strong>Þinglýst {String(label)}</strong>
                  <p>
                    Miðgildi:{" "}
                    {r.median === null
                      ? "ófullnægjandi gögn"
                      : `${num(r.median)} dagar`}
                  </p>
                  <p>
                    90. hundraðshluti:{" "}
                    {r.p90 === null
                      ? "ófullnægjandi gögn"
                      : `${num(r.p90)} dagar`}
                  </p>
                  <small>{num(r.count)} samningar</small>
                </div>
              );
            }}
          />
          <Line
            dataKey="median"
            stroke="var(--series-a)"
            strokeWidth={2.5}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            dataKey="p90"
            stroke="var(--series-b)"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ObservedPerDay({
  data,
}: {
  data: { date: string; count: number }[];
}) {
  return (
    <div
      className="chart chart-short"
      role="img"
      aria-label="Fjöldi nýrra færslna eftir degi sem Fasteign sá þær fyrst"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          {grid}
          <XAxis
            dataKey="date"
            tick={axis}
            tickFormatter={(s) => s.slice(5).replace("-", "/")}
            minTickGap={30}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            width={40}
            tick={axis}
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--soft)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const r = payload[0].payload as (typeof data)[number];
              return (
                <div className="chart-tooltip">
                  <strong>Fyrst séð {date(r.date)}</strong>
                  <p>{num(r.count)} nýjar sölur</p>
                </div>
              );
            }}
          />
          <Bar
            dataKey="count"
            fill="var(--accent)"
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
