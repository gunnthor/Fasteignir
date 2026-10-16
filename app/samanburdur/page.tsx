import type { Metadata } from "next";
import { Compare } from "@/components/compare";
import { areaOptions, compare } from "@/lib/compare";
import { date, num, ppm } from "@/lib/format";
import { getSnapshot } from "@/lib/server";
import {
  param,
  parseArea,
  parseFilterState,
  periodLabel,
  type AreaRef,
  type ParamSource,
} from "@/lib/share";
type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
function parse(params: ParamSource) {
  return {
    a:
      parseArea(param(params, "a")) ??
      ({ kind: "postcode", id: "107" } as AreaRef),
    b:
      parseArea(param(params, "b")) ??
      ({ kind: "postcode", id: "200" } as AreaRef),
    filters: {
      ...parseFilterState(params),
      municipality: "",
      postcode: "",
      district: "",
    },
  };
}
// Link previews name both areas and their medians, with the same suppression as the page.
export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const fallback = {
    title: "Samanburður svæða",
    description:
      "Berðu saman þinglýst söluverð á m², fjölda kaupsamninga og samsetningu seldra eigna á tveimur svæðum.",
  };
  try {
    const { a, b, filters } = parse(await searchParams),
      { rows } = await getSnapshot(),
      c = compare(rows, filters, a, b, new Date().toISOString().slice(0, 10)),
      side = (s: typeof c.a) =>
        `${s.name} ${s.summary.ppm === null ? "of fáar sölur" : ppm(s.summary.ppm)} (${num(s.summary.count)} sölur)`;
    const title = `${c.a.name} og ${c.b.name} · Samanburður`,
      description = `Miðgildi söluverðs á m², ${periodLabel(filters).toLocaleLowerCase("is")} (${date(c.from)} – ${date(c.to)}): ${side(c.a)}; ${side(c.b)}. Þinglýst kaupverð úr Kaupskrá HMS.`;
    return { title, description, openGraph: { title, description } };
  } catch {
    return fallback;
  }
}
export default async function ComparePage({ searchParams }: Props) {
  const initial = parse(await searchParams);
  const options = await getSnapshot()
    .then(({ rows }) => areaOptions(rows))
    .catch(() => []);
  return <Compare options={options} initial={initial} />;
}
