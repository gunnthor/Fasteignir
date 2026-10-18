import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SalesHistory } from "@/components/sales-history";
import { lookupHistory } from "@/lib/history-lookup";
import { getProperties } from "@/lib/server";
import { findProperty, withUnit } from "@/lib/properties";
import { siblingsOf } from "@/lib/units";

type Props = { params: Promise<{ fastnum: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const h = await lookupHistory((await params).fastnum).catch(() => null);
  return h
    ? {
        title: `Sölusaga · ${h.address}, ${h.postcode}`,
        description: `Skráðir kaupsamningar fyrir ${h.address} (fastanúmer ${h.propertyId}) úr kaupskrá HMS: dagsetningar, kaupverð og verð á m².`,
      }
    : { title: "Sölusaga eignar" };
}
// Other properties at the same staðfang, so a unit can be told apart from its
// neighbours. Missing when the property index is unavailable.
async function units(id: string) {
  try {
    const rows = await getProperties(),
      p = findProperty(rows, id);
    if (!p) return null;
    return {
      ...withUnit(rows, p),
      siblings: siblingsOf(rows, p).slice(0, 120),
    };
  } catch {
    return null;
  }
}
export default async function PropertyHistoryPage({ params }: Props) {
  const id = (await params).fastnum,
    [history, unit] = await Promise.all([lookupHistory(id), units(id)]);
  if (!history) notFound();
  return <SalesHistory history={history} unit={unit} />;
}
