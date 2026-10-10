// DOM-free helpers shared by the meets page and the planner.
export const DEFAULT_DURATION_MS = 3 * 60 * 60 * 1000;

export function endMs(ev) {
  return ev.end ? Date.parse(ev.end) : Date.parse(ev.start) + DEFAULT_DURATION_MS;
}

export function isUpcoming(ev, now) {
  return endMs(ev) >= now;
}

const utcStamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function googleCalendarUrl(ev) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${utcStamp(Date.parse(ev.start))}/${utcStamp(endMs(ev))}`,
    location: ev.meeting_point || "",
    details: [ev.description, ev.destination && `Destination: ${ev.destination}`].filter(Boolean).join("\n\n"),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

// File name / id for a submitted meet: Sofia date + ASCII slug of the title.
export function meetId(startIso, title) {
  const slug = String(title || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/, "");
  return `${startIso.slice(0, 10)}-${slug || "meet"}`;
}

// One person per line, "who: car". Only the first colon splits.
export function parseCarsText(text) {
  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf(":");
      return i === -1 ? { who: line, car: "" } : { who: line.slice(0, i).trim(), car: line.slice(i + 1).trim() };
    });
}

export function carsToText(cars) {
  return (cars || []).map((c) => (c.car ? `${c.who}: ${c.car}` : c.who)).join("\n");
}
