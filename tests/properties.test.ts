import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPropertyIndex, searchProperties } from "../lib/properties";
import { comparableWeight } from "../lib/analytics";
import type { Sale } from "../lib/types";
const sale = {
  propertyId: "2000001",
  address: "Þórsgata 1",
  postcode: "200",
  municipalityName: "Kópavogur",
  capital: true,
  residential: true,
  usable: true,
  type: "apartment",
  date: "2026-01-01",
  area: 90,
  rooms: 3,
  built: 1980,
  reasons: [],
  id: "test",
  municipality: "1000",
  heinum: "1",
  registered: null,
  year: 2026,
  month: "2026-01",
  price: 90000000,
  valuation: null,
  age: 46,
  warnings: [],
  ppm: 1000000,
  coordinates: null,
  coordinateQuality: "unmatched",
  district: null,
} satisfies Sale;
test("lookup keeps apartments distinct and uses the latest record for each property", () => {
  const rows = buildPropertyIndex(
    [
      sale,
      { ...sale, propertyId: "2000002", area: 110 },
      { ...sale, date: "2026-02-01", area: 95 },
      { ...sale, propertyId: "bad" },
    ],
    [{ fepilog: "010101" }, { fepilog: "010102" }, { fepilog: "010101" }, {}],
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].area, 95);
  assert.equal(rows[1].unitCode, "010102");
  assert.equal(searchProperties(rows, "thorsgata 200").total, 2);
  assert.equal(searchProperties(rows, "2000002").properties[0].area, 110);
  assert.equal(searchProperties(rows, "Þórsgata", 1).hasMore, true);
  assert.equal(searchProperties(rows, "óþekkt").total, 0);
});
test("a selected apartment cannot become its own comparable", () => {
  const subject = {
    propertyId: sale.propertyId,
    postcode: "200",
    type: "apartment" as const,
    area: 90,
    rooms: 3,
    built: 1980,
  };
  assert.equal(comparableWeight(sale, subject, "2026-09-19"), 0);
  assert.ok(
    comparableWeight(
      { ...sale, propertyId: "2000002" },
      subject,
      "2026-09-19",
    ) > 0,
  );
});
