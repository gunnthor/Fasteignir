import { Explorer } from "@/components/explorer";
import { shareMetadata } from "@/lib/card";
import { parseView } from "@/lib/share";
type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
export async function generateMetadata({ searchParams }: Props) {
  return shareMetadata(await searchParams, "Markaðurinn");
}
export default async function Market({ searchParams }: Props) {
  return <Explorer dashboard initialView={parseView(await searchParams)} />;
}
