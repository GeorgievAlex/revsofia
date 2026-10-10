import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import * as st from "../docs/sofia-time.js";
import * as meets from "../docs/meets.js";
const require = createRequire(import.meta.url);
const shared = require("../packages/revsofia/plan/event.js");

test("sofia-time.js matches the server's toSofiaIso", () => {
  const inputs = ["2026-10-18T09:30", "2026-10-25T03:30", "2026-10-25T10:00", "2026-03-29T03:30",
    "2026-11-01T17:00:00Z", "2026-02-30T10:00", "nonsense", ""];
  for (const v of inputs) assert.equal(st.toSofiaIso(v), shared.toSofiaIso(v), v);
});

test("toLocalInputValue round-trips through toSofiaIso", () => {
  assert.equal(st.toLocalInputValue("2026-10-25T10:00:00+02:00"), "2026-10-25T10:00");
  assert.equal(st.toSofiaIso(st.toLocalInputValue("2026-10-18T09:30:00+03:00")), "2026-10-18T09:30:00+03:00");
  assert.equal(st.toLocalInputValue(null), "");
});

test("formatWhen shows Sofia wall time", () => {
  assert.match(st.formatWhen("2026-10-18T06:30:00Z"), /Sun.*18 Oct.*09:30/);
});

test("isUpcoming: hides ended meets, keeps ones in progress", () => {
  const ev = { start: "2026-10-18T09:30:00+03:00", end: null };
  const start = Date.parse(ev.start);
  assert.equal(meets.isUpcoming(ev, start - 1), true);
  assert.equal(meets.isUpcoming(ev, start + 2 * 3600e3), true);
  assert.equal(meets.isUpcoming(ev, start + 3 * 3600e3 + 1), false);
});

test("googleCalendarUrl uses UTC dates and default duration", () => {
  const url = new URL(meets.googleCalendarUrl({ title: "Run", start: "2026-10-25T10:00:00+02:00", end: null, meeting_point: "Ring Mall" }));
  assert.equal(url.searchParams.get("dates"), "20261025T080000Z/20261025T110000Z");
  assert.equal(url.searchParams.get("text"), "Run");
});

test("meetId: slug from title, falls back for Cyrillic-only titles", () => {
  assert.equal(meets.meetId("2026-10-18T09:30:00+03:00", "Sunday run to Zlatnite Mostove!"), "2026-10-18-sunday-run-to-zlatnite-mostove");
  assert.equal(meets.meetId("2026-10-18T09:30:00+03:00", "Неделна разходка"), "2026-10-18-meet");
  assert.equal(meets.meetId("2026-10-25T23:30:00+02:00", "Late"), "2026-10-25-late");
});

test("parseCarsText / carsToText round-trip", () => {
  const cars = [{ who: "Ivo", car: "E92 335i" }, { who: "Maria", car: "" }];
  assert.deepEqual(meets.parseCarsText(meets.carsToText(cars)), cars);
  assert.deepEqual(meets.parseCarsText("  \nNiki: W205: C200\n"), [{ who: "Niki", car: "W205: C200" }]);
});
