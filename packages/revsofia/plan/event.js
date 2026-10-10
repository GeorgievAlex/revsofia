"use strict";
// Event model shared by the DO Function (lenient: normalises a model draft)
// and scripts/build.mjs (strict: validates published events). CommonJS so the
// function deploys to DigitalOcean without a bundler.

const CLUB_IDS = ["general", "bmw", "mercedes", "audi-vag"];
const TIME_ZONE = "Europe/Sofia";
const DEFAULT_DURATION_MS = 3 * 60 * 60 * 1000;
const LIMITS = { title: 120, place: 160, description: 2000, who: 60, car: 80, cars: 30 };
const REQUIRED = ["title", "start", "meeting_point"];
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const HAS_OFFSET_RE = /(?:Z|[+-]\d{2}:\d{2})$/;

const offsetFormat = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, timeZoneName: "longOffset" });

function sofiaOffsetMinutes(utcMs) {
  const part = offsetFormat.formatToParts(new Date(utcMs)).find((p) => p.type === "timeZoneName");
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(part ? part.value : "");
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

function formatOffset(minutes) {
  const abs = Math.abs(minutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${minutes < 0 ? "-" : "+"}${hh}:${mm}`;
}

function isoAtSofia(utcMs) {
  const offset = sofiaOffsetMinutes(utcMs);
  const wall = new Date(utcMs + offset * 60000).toISOString().slice(0, 19);
  return wall + formatOffset(offset);
}

// "2026-10-18T09:30" is read as Sofia wall-clock time; anything carrying Z or
// an offset is taken as an instant. Returns ISO with the Sofia offset of that
// instant, or null when the value isn't a real date-time.
function toSofiaIso(value) {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (HAS_OFFSET_RE.test(v)) {
    const ms = Date.parse(v);
    return Number.isNaN(ms) ? null : isoAtSofia(ms);
  }
  const m = LOCAL_RE.exec(v);
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map((x) => Number(x || 0));
  if (h > 23 || mi > 59 || s > 59) return null;
  const wallAsUtc = Date.UTC(y, mo - 1, d, h, mi, s);
  const check = new Date(wallAsUtc);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  // Guess the offset, then correct once in case the guess crossed a DST switch.
  let utcMs = wallAsUtc - sofiaOffsetMinutes(wallAsUtc) * 60000;
  utcMs = wallAsUtc - sofiaOffsetMinutes(utcMs) * 60000;
  return isoAtSofia(utcMs);
}

function cleanText(value, max, { multiline = false } = {}) {
  if (typeof value !== "string") return null;
  const t = multiline
    ? value.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()
    : value.replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max).trimEnd() : t;
}

function normalizeEvent(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const start = toSofiaIso(src.start);
  let end = toSofiaIso(src.end);
  if (end && (!start || Date.parse(end) <= Date.parse(start))) end = null;
  const cars = (Array.isArray(src.cars) ? src.cars : [])
    .map((c) => ({ who: cleanText(c && c.who, LIMITS.who) || "", car: cleanText(c && c.car, LIMITS.car) || "" }))
    .filter((c) => c.who || c.car)
    .slice(0, LIMITS.cars);
  const event = {
    title: cleanText(src.title, LIMITS.title),
    club: CLUB_IDS.includes(src.club) ? src.club : "general",
    start,
    end,
    meeting_point: cleanText(src.meeting_point, LIMITS.place),
    destination: cleanText(src.destination, LIMITS.place),
    description: cleanText(src.description, LIMITS.description, { multiline: true }),
    cars,
  };
  const missing = REQUIRED.filter((k) => !event[k]);
  return { event, missing };
}

function validatePublishedEvent(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const { event, missing } = normalizeEvent(src);
  const problems = [];
  if (typeof src.id !== "string" || !ID_RE.test(src.id)) problems.push(`id must be a lowercase slug, got ${JSON.stringify(src.id)}`);
  if (!CLUB_IDS.includes(src.club)) problems.push(`club must be one of ${CLUB_IDS.join(", ")}, got ${JSON.stringify(src.club)}`);
  for (const k of missing) problems.push(`${k} is missing or invalid`);
  if (src.example !== undefined && typeof src.example !== "boolean") problems.push("example must be true or false");
  if (problems.length) throw new Error(problems.join("; "));
  return { id: src.id, ...event, example: src.example === true };
}

function eventEndMs(event) {
  return event.end ? Date.parse(event.end) : Date.parse(event.start) + DEFAULT_DURATION_MS;
}

module.exports = {
  CLUB_IDS, TIME_ZONE, DEFAULT_DURATION_MS,
  sofiaOffsetMinutes, toSofiaIso, cleanText, normalizeEvent, validatePublishedEvent, eventEndMs,
};
