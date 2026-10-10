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

test("validateDraft lists empty required fields", () => {
  assert.deepEqual(meets.validateDraft({ title: "", start: null, meeting_point: "OMV" }), ["title", "start"]);
  assert.deepEqual(meets.validateDraft({ title: "x", start: "2026-10-18T09:30:00+03:00", meeting_point: "OMV" }), []);
});

test("reviewIssueLink carries the event JSON", () => {
  const draft = { id: "2026-10-18-run", title: "Run", club: "bmw", start: "2026-10-18T09:30:00+03:00", end: null,
    meeting_point: "OMV", destination: null, description: null, cars: [] };
  const url = new URL(meets.reviewIssueLink(draft).url);
  assert.equal(url.origin + url.pathname, "https://github.com/GeorgievAlex/revsofia/issues/new");
  assert.equal(url.searchParams.get("title"), "Meet: Run (2026-10-18)");
  const body = url.searchParams.get("body");
  const json = JSON.parse(body.split("```json\n")[1].split("\n```")[0]);
  assert.deepEqual(json, draft);
  assert.match(body, /data\/events\/2026-10-18-run\.json/);
});

test("validateDraft rejects a start that has already passed", () => {
  const now = Date.parse("2026-10-10T15:00:00Z");
  const d = { title: "x", meeting_point: "OMV" };
  assert.deepEqual(meets.validateDraft({ ...d, start: "2026-10-10T10:00:00+03:00" }, now), ["start"]);
  assert.deepEqual(meets.validateDraft({ ...d, start: "2026-10-11T10:00:00+03:00" }, now), []);
});

test("reviewIssueLink falls back to pasting when the URL would be too long", () => {
  const base = { id: "2026-10-18-meet", title: "Неделна разходка", club: "general", start: "2026-10-18T09:30:00+03:00",
    end: null, meeting_point: "Симеоновско шосе", destination: null, cars: [] };
  const short = meets.reviewIssueLink({ ...base, description: "кратко" });
  assert.equal(short.pasteJson, false);
  assert.match(new URL(short.url).searchParams.get("body"), /```json/);
  const long = meets.reviewIssueLink({ ...base, description: "дълго описание ".repeat(140) });
  assert.equal(long.pasteJson, true);
  assert.ok(long.url.length <= meets.MAX_ISSUE_URL_LENGTH);
  assert.match(new URL(long.url).searchParams.get("body"), /paste/i);
});

test("monthGrid: Monday-first weeks covering the whole month", () => {
  const oct = meets.monthGrid(2026, 10);
  assert.equal(oct.length, 5);
  assert.ok(oct.every((w) => w.length === 7));
  assert.deepEqual(oct[0][0], { date: "2026-09-28", day: 28, inMonth: false });
  assert.deepEqual(oct[0][3], { date: "2026-10-01", day: 1, inMonth: true });
  assert.deepEqual(oct[4][6], { date: "2026-11-01", day: 1, inMonth: false });
  const feb = meets.monthGrid(2026, 2); // starts on a Sunday
  assert.equal(feb[0][6].date, "2026-02-01");
  assert.equal(feb.at(-1).at(-1).date, "2026-03-01");
});

test("addMonths wraps years both ways", () => {
  assert.deepEqual(meets.addMonths(2026, 12, 1), { year: 2027, month: 1 });
  assert.deepEqual(meets.addMonths(2026, 1, -1), { year: 2025, month: 12 });
});

test("meetsByDay groups by the Sofia date of the start, including the DST day", () => {
  const evs = [
    { id: "a", start: "2026-10-25T10:00:00+02:00" },
    { id: "b", start: "2026-10-25T23:30:00+02:00" },
    { id: "c", start: "2026-10-18T09:30:00+03:00" },
  ];
  const byDay = meets.meetsByDay(evs);
  assert.deepEqual(byDay.get("2026-10-25").map((e) => e.id), ["a", "b"]);
  assert.deepEqual(byDay.get("2026-10-18").map((e) => e.id), ["c"]);
});

test("sofiaToday uses Sofia's date, not UTC's", () => {
  assert.equal(st.sofiaToday(Date.parse("2026-10-10T22:30:00Z")), "2026-10-11");
  assert.equal(st.sofiaToday(Date.parse("2026-10-10T20:59:00Z")), "2026-10-10");
});
