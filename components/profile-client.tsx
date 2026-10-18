"use client";
import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import type { FilterState } from "@/lib/share";
import {
  fileName,
  trendCsv,
  trendSvg,
  type ExportContext,
  type TrendKind,
  type TrendRow,
} from "@/lib/exports";
import { ExportMenu } from "./export-menu";
import { PriceDistribution } from "./price-distribution";

const TrendChart = dynamic(() => import("./chart").then((m) => m.TrendChart), {
  ssr: false,
  loading: () => <div className="chart skeleton" />,
});

export function ProfileCharts({
  trend,
  ctx,
}: {
  trend: TrendRow[];
  ctx: ExportContext;
}) {
  return (
    <div className="market-charts profile-charts">
      {(
        [
          [
            "ppm",
            "Söluverð á fermetra",
            "3 mánaða hlaupandi miðgildi, þ.kr./m²",
          ],
          ["volume", "Fjöldi kaupsamninga", "Gildar sölur í hverjum mánuði"],
        ] as [TrendKind, string, string][]
      ).map(([kind, title, caption]) => (
        <article className="panel" key={kind}>
          <div className="chart-head">
            <h3>{title}</h3>
            <ExportMenu
              name={(ext) =>
                fileName(ctx, kind === "volume" ? "fjoldi" : "verd-m2", ext)
              }
              svg={(theme) => trendSvg(trend, kind, ctx, theme)}
              csv={() => trendCsv(trend, ctx)}
            />
          </div>
          <p className="caption">{caption}</p>
          <TrendChart data={trend} kind={kind} />
        </article>
      ))}
    </div>
  );
}

export function ProfileDistribution({ filters }: { filters: FilterState }) {
  const [metric, setMetric] = useState<"price" | "ppm">("ppm"),
    [value, setValue] = useState("");
  const change = useCallback((m: "price" | "ppm", v: string) => {
    setMetric(m);
    setValue(v);
  }, []);
  return (
    <PriceDistribution
      filters={filters}
      q=""
      metric={metric}
      value={value}
      onChange={change}
    />
  );
}
