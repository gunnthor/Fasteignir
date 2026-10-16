import type { Metadata } from "next";
import { Budget } from "@/components/budget";
import {
  param,
  parseBudget,
  parseFilterState,
  question,
  type ParamSource,
} from "@/lib/share";
type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
function parse(params: ParamSource) {
  return {
    budget: parseBudget(param(params, "budget")) ?? 75_000_000,
    filters: { ...parseFilterState(params), district: "" },
  };
}
export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const { budget, filters } = parse(await searchParams),
    title = question(filters, budget),
    description =
      "Sjáðu hvar íbúðir hafa í raun selst innan þíns verðs: fjöldi kaupsamninga, stærðir og hlutfall eftir svæðum. Söguleg gögn, ekki eignir til sölu.";
  return { title, description, openGraph: { title, description } };
}
export default async function BudgetPage({ searchParams }: Props) {
  return <Budget initial={parse(await searchParams)} />;
}
