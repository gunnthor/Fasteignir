"use client";
import { useRouter } from "next/navigation";
import { PropertyLookup } from "./property-lookup";
export function HistoryLookup() {
  const router = useRouter();
  return (
    <PropertyLookup onSelect={(p) => router.push(`/eign/${p.propertyId}`)} />
  );
}
