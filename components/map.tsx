"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, ExpressionSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { AreaStats, Exploration } from "@/lib/types";
import { districtName, money, ppm, num, percent, date } from "@/lib/format";
import {
  breaks,
  palette,
  metricValue,
  metricFormat,
  type Metric,
} from "./map-config";
export default function SalesMap({
  data,
  metric,
  selected,
  onSelect,
  showPoints,
  focusKey,
  level,
  municipality,
}: {
  data: Exploration | null;
  metric: Metric;
  selected: string;
  onSelect: (id: string) => void;
  showPoints: boolean;
  focusKey: string;
  level: "postcode" | "district";
  municipality: string;
}) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    geo = useRef<GeoJSON.FeatureCollection | null>(null),
    select = useRef(onSelect);
  select.current = onSelect;
  useEffect(() => {
    if (!container.current) return;
    let disposed = false;
    const pop = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
    });
    let m: maplibregl.Map;
    try {
      maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      m = new maplibregl.Map({
        container: container.current,
        center: [-21.89, 64.12],
        zoom: window.innerWidth < 600 ? 10 : 10.8,
        minZoom: 8,
        maxZoom: 18,
        style: process.env.NEXT_PUBLIC_MAP_STYLE_URL || {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution:
                '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | Mörk: Reykjavíkurborg / LUKR · Byggt á gögnum frá Byggðastofnun.',
            },
          },
          layers: [
            {
              id: "base",
              type: "raster",
              source: "osm",
              paint: { "raster-saturation": -0.9, "raster-opacity": 0.72 },
            },
          ],
        },
        attributionControl: false,
      });
      map.current = m;
      m.addControl(
        new maplibregl.AttributionControl({ compact: false }),
        "bottom-left",
      );
      m.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "bottom-right",
      );
      m.on("error", (e) => {
        console.warn("MapLibre:", e.error.message);
        setError(
          "Ekki tókst að hlaða öllum kortagögnum. Svæðalistinn er áfram aðgengilegur.",
        );
      });
      m.on("idle", () => {
        if (container.current && m.getLayer("district-fill")) {
          const features = m.queryRenderedFeatures({
            layers: ["district-fill"],
          });
          container.current.dataset.renderedDistricts = String(features.length);
          container.current.dataset.renderedPostcodes = [
            ...new Set(
              features
                .filter((f) => f.properties.kind === "postcode")
                .map((f) => f.properties.id),
            ),
          ].join(",");
        }
      });
      m.on("load", async () => {
        try {
          const response = await fetch("/data/areas.geojson");
          if (!response.ok) throw Error();
          const geometry = await response.json();
          if (disposed) return;
          geo.current = geometry;
          m.addSource("districts", {
            type: "geojson",
            data: geometry,
            promoteId: "id",
          });
          m.addLayer({
            id: "district-fill",
            type: "fill",
            source: "districts",
            paint: { "fill-color": "#b1c9c0", "fill-opacity": 0.53 },
          });
          m.addLayer({
            id: "district-border",
            type: "line",
            source: "districts",
            paint: { "line-color": "#fff", "line-width": 1.5 },
          });
          m.addLayer({
            id: "district-hover",
            type: "line",
            source: "districts",
            filter: ["==", ["get", "id"], ""],
            paint: { "line-color": "#447d67", "line-width": 2 },
          });
          m.addLayer({
            id: "district-selected",
            type: "line",
            source: "districts",
            filter: ["==", ["get", "id"], ""],
            paint: { "line-color": "#173f36", "line-width": 3 },
          });
          m.addSource("sales", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
            cluster: true,
            clusterRadius: 45,
            clusterMaxZoom: 13,
          });
          m.addLayer({
            id: "clusters",
            type: "circle",
            source: "sales",
            filter: ["has", "point_count"],
            paint: {
              "circle-color": "#235c4e",
              "circle-radius": [
                "step",
                ["get", "point_count"],
                17,
                25,
                23,
                100,
                29,
              ],
              "circle-stroke-width": 3,
              "circle-stroke-color": "#ffffff",
            },
          });
          m.addLayer({
            id: "sale-points",
            type: "circle",
            source: "sales",
            filter: ["!", ["has", "point_count"]],
            minzoom: 12,
            paint: {
              "circle-color": "#235c4e",
              "circle-radius": 6,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#fff",
            },
          });
          setReady(true);
          m.on("mousemove", "district-fill", (e) => {
            m.getCanvas().style.cursor = "pointer";
            const p = e.features?.[0]?.properties;
            if (!p) return;
            m.setFilter("district-hover", ["==", ["get", "id"], p.id]);
            const el = document.createElement("div");
            const strong = document.createElement("strong");
            strong.textContent = districtName(p.name);
            const detail = document.createElement("div");
            detail.textContent = p.caption ?? "Engar sölur";
            el.append(strong, detail);
            pop.setLngLat(e.lngLat).setDOMContent(el).addTo(m);
          });
          m.on("mouseleave", "district-fill", () => {
            m.getCanvas().style.cursor = "";
            m.setFilter("district-hover", ["==", ["get", "id"], ""]);
            pop.remove();
          });
          m.on("click", "district-fill", (e) => {
            const id = e.features?.[0]?.properties?.id;
            if (
              id &&
              !m.queryRenderedFeatures(e.point, {
                layers: ["sale-points", "clusters"],
              }).length
            )
              select.current(String(id));
          });
          m.on("click", "clusters", async (e) => {
            const f = e.features?.[0];
            if (!f) return;
            const zoom = await (
              m.getSource("sales") as GeoJSONSource
            ).getClusterExpansionZoom(Number(f.properties?.cluster_id));
            m.easeTo({
              center: (f.geometry as GeoJSON.Point).coordinates as [
                number,
                number,
              ],
              zoom,
            });
          });
          m.on("click", "sale-points", (e) => {
            const f = e.features?.[0],
              p = f?.properties;
            if (!f || !p) return;
            pop.remove();
            const el = document.createElement("div");
            el.className = "sale-popup";
            const title = document.createElement("strong");
            title.textContent = p.address;
            el.append(title);
            for (const line of [
              money(p.price),
              `${num(p.area)} m² · ${num(p.rooms)} herb. · ${p.type === "house" ? "Sérbýli" : "Fjölbýli"}`,
              ppm(p.ppm),
              `Kaupsamningur ${date(p.date)}`,
              `Byggt ${p.built ?? "—"} · Fasteignamat ${money(p.valuation)}`,
              `Kaupverð / mat: ${p.valuation ? percent((p.price / p.valuation - 1) * 100) : "—"}`,
              p.quality === "reviewed"
                ? "Hnit yfirfarin í Staðfangaskrá"
                : "Opinber hnit — ekki merkt yfirfarin",
              "Heimild: HMS Kaupskrá fasteigna",
            ]) {
              const div = document.createElement("div");
              div.textContent = line;
              el.append(div);
            }
            new maplibregl.Popup()
              .setLngLat(
                (f.geometry as GeoJSON.Point).coordinates as [number, number],
              )
              .setDOMContent(el)
              .addTo(m);
          });
        } catch {
          setError("Kortagögn vantar. Veldu svæði úr listanum.");
        }
      });
    } catch {
      setError("Vafrinn styður ekki kortabirtingu. Veldu svæði úr listanum.");
    }
    return () => {
      disposed = true;
      pop.remove();
      m?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !geo.current || !data) return;
    const areas = level === "postcode" ? data.postcodes : data.areas;
    m.setFilter("district-fill", ["==", ["get", "kind"], level]);
    m.setFilter("district-border", ["==", ["get", "kind"], level]);
    m.setFilter("district-hover", ["==", ["get", "id"], ""]);
    const thresholds = breaks(areas, metric),
      byId = new Map(areas.map((a) => [a.id, a]));
    const features = geo.current.features.map((f) => {
      const a = byId.get(String(f.properties?.id)),
        value = a ? metricValue(a, metric) : null;
      return {
        ...f,
        properties: {
          ...f.properties,
          value,
          caption: a
            ? `${metricFormat(value, metric)} · ${num(a.count)} sölur${a.sparse ? " · fáar sölur" : ""}`
            : "Engar sölur á valda tímabilinu",
        },
      };
    });
    (m.getSource("districts") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features,
    });
    const color: ExpressionSpecification = [
      "case",
      ["==", ["get", "value"], null],
      "#bec7c4",
      ["<=", ["get", "value"], thresholds[0]],
      palette[0],
      ["<=", ["get", "value"], thresholds[1]],
      palette[1],
      ["<=", ["get", "value"], thresholds[2]],
      palette[2],
      ["<=", ["get", "value"], thresholds[3]],
      palette[3],
      palette[4],
    ];
    m.setPaintProperty("district-fill", "fill-color", color);
    m.setPaintProperty("district-fill", "fill-opacity", [
      "case",
      ["==", ["get", "id"], selected],
      0.75,
      0.5,
    ]);
    m.setFilter("district-selected", ["==", ["get", "id"], selected]);
    (m.getSource("sales") as GeoJSONSource).setData(
      showPoints ? data.points : { type: "FeatureCollection", features: [] },
    );
  }, [ready, data, metric, selected, showPoints, level]);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    let coordinates: number[][] = [];
    if (focusKey && data?.points.features.length) {
      coordinates = data.points.features.map(
        (f) => (f.geometry as GeoJSON.Point).coordinates,
      );
    } else if (geo.current) {
      const features = geo.current.features.filter(
        (f) =>
          f.properties?.kind === level &&
          (selected
            ? f.properties?.id === selected
            : municipality
              ? f.properties?.municipalityCodes?.includes(municipality)
              : false),
      );
      for (const feature of features) {
        const visit = (v: unknown) => {
          if (!Array.isArray(v)) return;
          if (typeof v[0] === "number") {
            coordinates.push(v as number[]);
          } else v.forEach(visit);
        };
        visit((feature.geometry as GeoJSON.Polygon).coordinates);
      }
    }
    if (!coordinates.length) return;
    const bounds = new maplibregl.LngLatBounds();
    for (const p of coordinates) bounds.extend(p as [number, number]);
    const mobile = window.innerWidth <= 900;
    m.fitBounds(bounds, {
      padding: mobile
        ? { left: 25, right: 25, top: 80, bottom: 60 }
        : { left: 330, right: 420, top: 100, bottom: 150 },
      maxZoom: focusKey ? 15 : 13,
      duration: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : 600,
    });
  }, [selected, focusKey, ready, data?.points, level, municipality]);
  return (
    <>
      <div
        ref={container}
        className="map-canvas"
        data-rendered-districts="0"
        role="region"
        aria-label="Gagnvirkt kort af höfuðborgarsvæðinu"
      />
      {error && (
        <div className="map-error" role="status">
          {error}
        </div>
      )}
    </>
  );
}
