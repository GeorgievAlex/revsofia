import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { eventEndMs } = require("../../packages/revsofia/plan/event.js");

const encoder = new TextEncoder();

function icsDate(ms) {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeText(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// RFC 5545 3.1: lines over 75 octets continue on a new line starting with a
// space. Count bytes, not characters, and never split a multibyte character.
function fold(line) {
  if (encoder.encode(line).length <= 75) return line;
  const out = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    if (bytes + size > 75) {
      out.push(current);
      current = " " + ch;
      bytes = 1 + size;
    } else {
      current += ch;
      bytes += size;
    }
  }
  out.push(current);
  return out.join("\r\n");
}

export function toIcs(event, { siteUrl }) {
  const start = Date.parse(event.start);
  const details = [event.description, event.destination && `Destination: ${event.destination}`, siteUrl]
    .filter(Boolean)
    .join("\n\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//RevSofia//Meets//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@revsofia`,
    // DTSTAMP is required; using the start keeps builds byte-for-byte stable.
    `DTSTAMP:${icsDate(start)}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(eventEndMs(event))}`,
    `SUMMARY:${escapeText(event.title)}`,
    `LOCATION:${escapeText(event.meeting_point)}`,
    `DESCRIPTION:${escapeText(details)}`,
    `URL:${siteUrl}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
