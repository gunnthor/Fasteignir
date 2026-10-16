import { Explorer } from "@/components/explorer";
import { shareMetadata } from "@/lib/card";
import { parseView } from "@/lib/share";
type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
export async function generateMetadata({ searchParams }: Props) {
  return shareMetadata(await searchParams);
}
export default async function Home({ searchParams }: Props) {
  return <Explorer initialView={parseView(await searchParams)} />;
}
