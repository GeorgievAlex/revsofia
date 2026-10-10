import { test } from "node:test";
import assert from "node:assert/strict";
import { toIcs } from "../scripts/lib/ics.mjs";

const base = {
  id: "2026-10-25-bmw-coffee-and-cars", title: "Coffee, cars; and, more", club: "bmw",
  start: "2026-10-25T10:00:00+02:00", end: null, meeting_point: "Ring Mall parking",
  destination: null, description: "Line one\nLine two", cars: [], example: true,
};

test("toIcs: UTC times across the DST switch, default 3h end", () => {
  const ics = toIcs(base, { siteUrl: "https://example.test/" });
  assert.match(ics, /\r\nDTSTART:20261025T080000Z\r\n/);
  assert.match(ics, /\r\nDTEND:20261025T110000Z\r\n/);
});

test("toIcs: escapes text and uses CRLF only", () => {
  const ics = toIcs(base, { siteUrl: "https://example.test/" });
  assert.match(ics, /SUMMARY:Coffee\\, cars\\; and\\, more/);
  assert.match(ics, /DESCRIPTION:Line one\\nLine two/);
  assert.equal(ics.replace(/\r\n/g, "").includes("\n"), false);
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
});

test("toIcs: folds long Cyrillic lines without splitting characters", () => {
  const ics = toIcs({ ...base, title: "Неделна разходка до Златните мостове ".repeat(4) }, { siteUrl: "https://example.test/" });
  const enc = new TextEncoder();
  for (const line of ics.split("\r\n")) assert.ok(enc.encode(line).length <= 75, line);
  assert.equal(ics.includes("\uFFFD"), false);
  const unfolded = ics.replace(/\r\n /g, "");
  assert.match(unfolded, /SUMMARY:(Неделна разходка до Златните мостове ){3}/);
});
