import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const ev = require("../packages/revsofia/plan/event.js");

test("toSofiaIso: summer wall clock gets +03:00", () => {
  assert.equal(ev.toSofiaIso("2026-10-18T09:30"), "2026-10-18T09:30:00+03:00");
});

test("toSofiaIso: DST switch day 10:00 gets +02:00", () => {
  assert.equal(ev.toSofiaIso("2026-10-25T10:00"), "2026-10-25T10:00:00+02:00");
});

test("toSofiaIso: offset input is re-expressed in Sofia time", () => {
  assert.equal(ev.toSofiaIso("2026-11-01T17:00:00Z"), "2026-11-01T19:00:00+02:00");
});

test("toSofiaIso: rejects garbage and impossible dates", () => {
  for (const bad of ["", "Sunday", "2026-02-30T10:00", "2026-10-18T25:00", null, 42]) {
    assert.equal(ev.toSofiaIso(bad), null, String(bad));
  }
});

test("normalizeEvent: clamps unknown club, trims, drops end before start, caps cars", () => {
  const cars = Array.from({ length: 40 }, (_, i) => ({ who: `p${i}`, car: "E90" }));
  const { event, missing } = ev.normalizeEvent({
    title: "  Sunday   run ",
    club: "porsche",
    start: "2026-10-18T09:30",
    end: "2026-10-18T08:00",
    meeting_point: "OMV",
    cars: [...cars, { who: "", car: "" }, null],
  });
  assert.equal(event.title, "Sunday run");
  assert.equal(event.club, "general");
  assert.equal(event.end, null);
  assert.equal(event.cars.length, 30);
  assert.deepEqual(missing, []);
});

test("normalizeEvent: reports missing required fields", () => {
  const { event, missing } = ev.normalizeEvent({ title: null, start: "next week", meeting_point: "" });
  assert.equal(event.start, null);
  assert.deepEqual(missing, ["title", "start", "meeting_point"]);
});

test("normalizeEvent: tolerates non-object input", () => {
  assert.deepEqual(ev.normalizeEvent(null).missing, ["title", "start", "meeting_point"]);
});

test("validatePublishedEvent: accepts a complete event", () => {
  const out = ev.validatePublishedEvent({
    id: "2026-10-18-vitosha-sunday-run", title: "Vitosha run", club: "general",
    start: "2026-10-18T09:30:00+03:00", meeting_point: "OMV", example: true,
  });
  assert.equal(out.id, "2026-10-18-vitosha-sunday-run");
  assert.equal(out.example, true);
});

test("validatePublishedEvent: strict about club, id and required fields", () => {
  assert.throws(() => ev.validatePublishedEvent({ id: "Bad Id", title: "x", club: "porsche", start: "x", meeting_point: "" }),
    /id.*club.*start.*meeting_point/s);
});

test("eventEndMs: defaults to start + 3h", () => {
  const start = "2026-10-18T09:30:00+03:00";
  assert.equal(ev.eventEndMs({ start, end: null }), Date.parse(start) + 3 * 3600 * 1000);
});
