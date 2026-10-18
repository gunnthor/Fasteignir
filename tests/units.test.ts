import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compareUnits,
  decodeUnitCode,
  formatUnitCode,
  locationNote,
  siblingsOf,
  unitLabel,
  unitStatus,
} from "../lib/units";
import {
  buildPropertyIndex,
  findProperty,
  searchProperties,
  withUnit,
} from "../lib/properties";
import { buildHistoryIndex, describeHistory } from "../lib/history";
import { normalizeSale } from "../lib/data";
import { sale } from "./fixtures/sales";

test("six-digit FEPILOG decodes into matshluti, floor number and position", () => {
  assert.deepEqual(decodeUnitCode("010201"), {
    code: "010201",
    building: "01",
    floor: "02",
    position: "01",
  });
  assert.equal(formatUnitCode(decodeUnitCode(" 020003 ")!), "02-0003");
  assert.equal(unitLabel("010302"), "Merking 01-0302 · hæðarnúmer 03, rými 02");
});

test("non-standard or missing codes are shown verbatim and never interpreted", () => {
  for (const raw of ["02", "99B99", "01-0101", "0101", "1234567", "abcdef"])
    assert.equal(decodeUnitCode(raw), null, raw);
  assert.equal(
    unitLabel("99B99"),
    "Merking „99B99“ (ekki á stöðluðu formi; ekki túlkuð)",
  );
  assert.equal(unitLabel(""), "Einingarmerking vantar");
  assert.equal(unitLabel(undefined), "Einingarmerking vantar");
});

const rec = (
  propertyId: string,
  unitCode: string,
  heinum = "1001",
  area = 80,
) => ({
  propertyId,
  unitCode,
  heinum,
  address: "Prófgata 5",
  postcode: "105",
  municipalityName: "Reykjavík",
  area,
  rooms: 3,
  built: 1980,
  type: "apartment" as const,
  recordedAt: "2025-01-01",
});

test("multiple apartments at one address are told apart and listed in register order", () => {
  const rows = [
    rec("2000003", "010201"),
    rec("2000001", "010101"),
    rec("2000004", "99B99"),
    rec("2000002", "010102"),
    rec("2000009", "010101", "2002"),
  ];
  const p = findProperty(rows, "2000003")!,
    sib = siblingsOf(rows, p);
  assert.deepEqual(
    sib.map((s) => s.propertyId),
    ["2000001", "2000002", "2000003", "2000004"],
  );
  assert.equal(unitStatus(p, sib), "unique");
  // Same code at another address is not a conflict.
  assert.equal(unitStatus(rows[1], siblingsOf(rows, rows[1])), "unique");
  assert.equal(withUnit(rows, p).addressUnits, 4);
  assert.ok([...rows].sort(compareUnits).at(-1)!.unitCode === "99B99");
});

test("a code shared by two properties at one address is reported as ambiguous, not forced", () => {
  const rows = [
    rec("2000001", "010101"),
    rec("2000002", "010101"),
    rec("2000003", "010102"),
  ];
  assert.equal(unitStatus(rows[0], siblingsOf(rows, rows[0])), "shared_code");
  assert.equal(unitStatus(rows[2], siblingsOf(rows, rows[2])), "unique");
  assert.equal(unitStatus(rec("2000005", ""), []), "missing");
  assert.equal(unitStatus(rec("2000006", "02"), []), "uninterpretable");
});

test("records from older snapshots without HEINUM degrade to no sibling information", () => {
  const old = { ...rec("2000001", "010101"), heinum: undefined };
  assert.deepEqual(siblingsOf([old], old), [old]);
  assert.equal(withUnit([old], old).addressUnits, null);
});

test("property index keeps source FEPILOG and HEINUM; duplicate FASTNUM rows resolve to the latest", () => {
  const a = sale("2015-03-01", { propertyId: "2100001", heinum: "1001" }),
    b = sale("2024-06-01", { propertyId: "2100001", heinum: "1001", area: 92 }),
    c = sale("2020-01-01", { propertyId: "2100002", heinum: "1001" });
  const idx = buildPropertyIndex(
    [a, b, c],
    [{ fepilog: "010101" }, { fepilog: "010201" }, { fepilog: "010101" }],
  );
  const p = idx.find((x) => x.propertyId === "2100001")!;
  assert.equal(p.unitCode, "010201");
  assert.equal(p.area, 92);
  assert.equal(p.heinum, "1001");
  // The other unit still has 010101: no conflict now that the first was re-coded.
  assert.equal(unitStatus(p, siblingsOf(idx, p)), "unique");
  const result = searchProperties(idx, "Prófgata").properties;
  assert.ok(result.every((r) => "unitStatus" in r));
});

test("historical identifier changes and inconsistent metadata mark a history uncertain", () => {
  const rows = [
    sale("2012-01-01", { propertyId: "2200001", price: 30_000_000 }),
    sale("2019-01-01", { propertyId: "2200001", price: 45_000_000 }),
    sale("2025-01-01", {
      propertyId: "2200001",
      price: 60_000_000,
      type: "house",
    }),
  ];
  const [h] = buildHistoryIndex(rows, [
    { fepilog: "010101" },
    { fepilog: "010201" },
    { fepilog: "010201" },
  ]);
  const d = describeHistory(h);
  assert.equal(d.status, "uncertain");
  const diffs = d.steps.flatMap((s) => s.previous?.differences ?? []);
  assert.ok(diffs.includes("unit"));
  assert.ok(diffs.includes("type"));
  // Source codes are kept verbatim, never overwritten.
  assert.deepEqual(
    h.sales.map((s) => s.unitCode),
    ["010101", "010201", "010201"],
  );
});

test("FEPILOG is normalized onto sales without guessing", () => {
  const base = {
    faerslunumer: "1",
    fastnum: "2000001",
    utgdag: "2025-01-01",
    kaupverd: "50000",
    einflm: "80",
    tegund: "Fjölbýli",
    fullbuid: "1",
    onothaefur_samningur: "0",
    svfn: "0",
  };
  assert.equal(
    normalizeSale({ ...base, fepilog: " 010101 " }, "2026-10-18").unitCode,
    "010101",
  );
  assert.equal(normalizeSale(base, "2026-10-18").unitCode, "");
});

test("location notes describe address points, not unit positions, and unmapped sales stay listed", () => {
  const located = locationNote({
    coordinates: [-21.9, 64.1],
    coordinateQuality: "reviewed",
    pointType: 2,
    accuracy: 5,
  });
  assert.match(located, /ekki staðsetning einstakrar íbúðar/);
  assert.match(located, /megininngangur mannvirkis/);
  assert.match(located, /yfirfarin hnit/);
  assert.match(located, /áætluð skekkjumörk 5 m/);
  const plain = locationNote({
    coordinates: [-21.9, 64.1],
    coordinateQuality: "official_unreviewed",
    pointType: null,
    accuracy: null,
  });
  assert.doesNotMatch(plain, /skekkjumörk|punktur:/);
  assert.match(plain, /ekki merkt yfirfarin/);
  assert.match(
    locationNote({
      coordinates: null,
      coordinateQuality: "ambiguous_or_rejected",
    }),
    /fleiri en eitt hnit/,
  );
  assert.match(
    locationNote({ coordinates: null, coordinateQuality: "unmatched" }),
    /fannst ekki/,
  );
});
