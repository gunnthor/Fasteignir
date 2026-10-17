import { test } from "node:test";
import assert from "node:assert/strict";
import {
  observe,
  fingerprint,
  parseState,
  serializeState,
  recentObservations,
  MassRemovalError,
  TOMBSTONE_DAYS,
  type State,
} from "../lib/observations";

const row = (
  id: string,
  fastnum: string,
  extra: Record<string, string> = {},
) => ({
  faerslunumer: id,
  fastnum,
  emnr: "411",
  skjalanumer: `X-${id}`,
  utgdag: "2026-09-01 00:00:00.0",
  thinglystdags: "2026-09-08 10:00:00.0",
  kaupverd: "70000",
  einflm: "80",
  fasteignamat_gildandi: "60000",
  ...extra,
});
const base = [row("1", "2000001"), row("2", "2000002"), row("3", "2000003")];

test("bootstrap marks every existing row as baseline, never as new", () => {
  const { state, summary } = observe(null, base, "2026-09-20");
  assert.equal(summary.bootstrap, true);
  assert.equal(summary.new, 0);
  assert.equal(summary.unchanged, 3);
  assert.equal(state.trackingSince, "2026-09-20");
  for (const e of state.rows.values()) assert.equal(e.firstSeen, null);
  assert.equal(recentObservations(state, "2026-09-20").rows.length, 0);
});

test("classifies new, modified, removed and unchanged rows", () => {
  const { state: s0 } = observe(null, base, "2026-09-20");
  const next = [
    base[0],
    row("2", "2000002", { kaupverd: "71000" }),
    row("4", "2000004"),
  ];
  const { state, summary } = observe(s0, next, "2026-09-21");
  assert.deepEqual(
    [summary.new, summary.modified, summary.removed, summary.unchanged],
    [1, 1, 1, 1],
  );
  assert.equal(state.rows.get("4|2000004")!.firstSeen, "2026-09-21");
  assert.equal(state.rows.get("2|2000002")!.firstSeen, null);
  assert.equal(state.rows.get("2|2000002")!.changedAt, "2026-09-21");
  assert.equal(state.rows.get("3|2000003")!.removedAt, "2026-09-21");
  const recent = recentObservations(state, "2026-09-21");
  assert.deepEqual(recent.rows.map((r) => r.id).sort(), ["2", "4"]);
  assert.equal(recent.removed, 1);
});

test("current-register columns do not count as edits", () => {
  const a = row("1", "2000001"),
    b = { ...a, fasteignamat_gildandi: "99999", fyrirhugad_fasteignamat: "1" };
  assert.equal(fingerprint(a), fingerprint(b));
  assert.notEqual(fingerprint(a), fingerprint({ ...a, kaupverd: "1" }));
});

test("reruns on the same day and source are idempotent", () => {
  const { state: s0 } = observe(null, base, "2026-09-20");
  const next = [...base, row("4", "2000004")];
  const { state: s1 } = observe(s0, next, "2026-09-21");
  const { state: s2, summary } = observe(s1, next, "2026-09-21");
  assert.equal(summary.new, 0);
  assert.equal(serializeState(s1), serializeState(s2));
  // A later retry still reports the row's original first observation.
  const { state: s3 } = observe(s2, next, "2026-09-23");
  assert.equal(s3.rows.get("4|2000004")!.firstSeen, "2026-09-21");
});

test("a corrected FASTNUM on a known contract is a revision, not a new sale", () => {
  const { state: s0 } = observe(null, base, "2026-09-20");
  const { state, summary } = observe(
    s0,
    [base[0], base[1], row("3", "2000099")],
    "2026-09-21",
  );
  assert.equal(summary.new, 0);
  assert.equal(summary.revised, 1);
  assert.equal(summary.removed, 0);
  assert.equal(state.rows.has("3|2000003"), false);
  assert.equal(state.rows.get("3|2000099")!.firstSeen, null);
  // A garage added to a known contract inherits the contract's observation.
  const { summary: s2 } = observe(
    state,
    [base[0], base[1], row("3", "2000099"), row("1", "2000555")],
    "2026-09-22",
  );
  assert.equal(s2.new, 0);
  assert.equal(s2.revised, 1);
});

test("removed rows that reappear are restored with their first observation", () => {
  const { state: s0 } = observe(null, base, "2026-09-20");
  const { state: s1 } = observe(s0, base.slice(0, 2), "2026-09-21");
  const { state: s2, summary } = observe(s1, base, "2026-09-22");
  assert.equal(summary.restored, 1);
  assert.equal(summary.new, 0);
  assert.equal(s2.rows.get("3|2000003")!.removedAt, null);
  // Tombstones expire.
  const late = new Date(+new Date("2026-09-21") + (TOMBSTONE_DAYS + 1) * 864e5)
    .toISOString()
    .slice(0, 10);
  const { state: s3 } = observe(s1, base.slice(0, 2), late);
  assert.equal(s3.rows.has("3|2000003"), false);
});

test("a truncated download cannot silently wipe the state", () => {
  const many = Array.from({ length: 2000 }, (_, i) =>
    row(String(i + 10), String(3000000 + i)),
  );
  const { state } = observe(null, many, "2026-09-20");
  assert.throws(
    () => observe(state, many.slice(0, 1000), "2026-09-21"),
    MassRemovalError,
  );
  const { summary } = observe(state, many.slice(0, 1000), "2026-09-21", {
    allowMassRemoval: true,
  });
  assert.equal(summary.removed, 1000);
});

test("state round-trips and rejects corruption", () => {
  const { state: s0 } = observe(null, base, "2026-09-20");
  const { state } = observe(s0, [...base, row("4", "2000004")], "2026-09-21");
  const text = serializeState(state);
  assert.equal(serializeState(parseState(text)), text);
  const bad = (t: string) => assert.throws(() => parseState(t));
  bad("");
  bad("#fasteign-observations\tv2\ttrackingSince=2026-09-20\n");
  bad(text.replace("2026-09-21", "2026-13-xx"));
  bad(text + "1|2000001\tabc\t-\t-\t-\n");
  const lines = text.trim().split("\n");
  bad([...lines, lines[1]].join("\n"));
  bad(text.slice(0, text.length - 10));
});

test("duplicate source keys stop the run", () => {
  assert.throws(() => observe(null, [base[0], base[0]], "2026-09-20"));
});

test("state survives an interrupted run: the previous file is untouched", () => {
  const { state: s0 } = observe(null, base, "2026-09-20");
  const before = serializeState(s0);
  assert.throws(() => observe(s0, [base[0], base[0]], "2026-09-21"));
  assert.equal(serializeState(s0), before);
  const copy: State = parseState(before);
  assert.equal(copy.rows.size, 3);
});
