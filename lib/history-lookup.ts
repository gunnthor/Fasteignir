// Server-only: one property's described sales history, or null.
import { getHistory } from "./server";
import { describeHistory, unpackHistory, type PackedHistory } from "./history";

export async function lookupHistory(propertyId: string) {
  if (!/^\d{7}$/.test(propertyId)) return null;
  const line = (await getHistory()).get(propertyId);
  return line
    ? describeHistory(unpackHistory(JSON.parse(line) as PackedHistory))
    : null;
}
