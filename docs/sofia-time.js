// Browser copy of the Sofia time logic in packages/revsofia/plan/event.js
// (CommonJS, so it can't be imported here). test/browser-modules.test.mjs
// checks the two stay identical.
const TIME_ZONE = "Europe/Sofia";
const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const HAS_OFFSET_RE = /(?:Z|[+-]\d{2}:\d{2})$/;
const offsetFormat = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, timeZoneName: "longOffset" });
const whenFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

function sofiaOffsetMinutes(utcMs) {
  const part = offsetFormat.formatToParts(new Date(utcMs)).find((p) => p.type === "timeZoneName");
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(part ? part.value : "");
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

function formatOffset(minutes) {
  const abs = Math.abs(minutes);
  return `${minutes < 0 ? "-" : "+"}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

function isoAtSofia(utcMs) {
  const offset = sofiaOffsetMinutes(utcMs);
  return new Date(utcMs + offset * 60000).toISOString().slice(0, 19) + formatOffset(offset);
}

export function toSofiaIso(value) {
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
  let utcMs = wallAsUtc - sofiaOffsetMinutes(wallAsUtc) * 60000;
  utcMs = wallAsUtc - sofiaOffsetMinutes(utcMs) * 60000;
  return isoAtSofia(utcMs);
}

// ISO instant -> value for <input type="datetime-local">, in Sofia wall time.
export function toLocalInputValue(iso) {
  if (typeof iso !== "string") return "";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  return isoAtSofia(ms).slice(0, 16);
}

export function formatWhen(iso) {
  return whenFormat.format(new Date(iso));
}
