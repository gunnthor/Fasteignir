import type { MetadataRoute } from "next";
import { getSnapshot } from "@/lib/server";
import { profileList } from "@/lib/profiles";

const BASE = "https://fasteign.gunnthor.is";
const PAGES = [
  "/",
  "/markadur",
  "/svaedi",
  "/samanburdur",
  "/samsetning",
  "/kaupgeta",
  "/verdmat",
  "/eign",
  "/nyskrad",
  "/um-gognin",
];

// Static pages plus area profiles with enough sales to be useful.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = PAGES.map((p) => ({
    url: BASE + p,
    changeFrequency: "daily" as const,
  }));
  try {
    const { rows, report } = await getSnapshot();
    return [
      ...pages,
      ...profileList(rows, report.latestRegistration)
        .filter((p) => p.listed)
        .map((p) => ({
          url: `${BASE}/svaedi/${p.slug}`,
          lastModified: report.generatedAt,
          changeFrequency: "daily" as const,
        })),
    ];
  } catch {
    return pages;
  }
}
