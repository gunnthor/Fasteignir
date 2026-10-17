import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SalesHistory } from "@/components/sales-history";
import { lookupHistory } from "@/lib/history-lookup";

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
export default async function PropertyHistoryPage({ params }: Props) {
  const history = await lookupHistory((await params).fastnum);
  if (!history) notFound();
  return <SalesHistory history={history} />;
}
