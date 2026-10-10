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

export const REPO = "GeorgievAlex/revsofia";
const REQUIRED = ["title", "start", "meeting_point"];

// A meet in the past can't go to review, even if the field is filled in.
export function validateDraft(draft, now = Date.now()) {
  const missing = REQUIRED.filter((key) => !draft[key]);
  if (draft.start && !missing.includes("start") && Date.parse(draft.start) <= now) missing.push("start");
  return missing;
}

// GitHub rejects very long new-issue URLs, and Cyrillic is percent-encoded at
// six characters per letter. Past this length the JSON goes to the clipboard
// and the issue body just asks for it to be pasted.
export const MAX_ISSUE_URL_LENGTH = 7500;

export function reviewIssueLink(draft) {
  const title = `Meet: ${draft.title} (${draft.start.slice(0, 10)})`;
  const issueUrl = (body) => `https://github.com/${REPO}/issues/new?${new URLSearchParams({ title, labels: "meet", body })}`;
  const json = JSON.stringify(draft, null, 2);
  const intro = `A meet drafted with the RevSofia planner. Review it, then save the JSON below as\n\`data/events/${draft.id}.json\` and run \`npm run build\`.`;
  const full = issueUrl(`${intro}\n\n\`\`\`json\n${json}\n\`\`\``);
  if (full.length <= MAX_ISSUE_URL_LENGTH) return { url: full, json, pasteJson: false };
  const short = issueUrl(`${intro}\n\nThe planner copied the meet JSON to your clipboard. Paste it below in a json code block.\n\n`);
  return { url: short, json, pasteJson: true };
}

// Calendar helpers. Dates are plain "YYYY-MM-DD" strings in Sofia time, and
// the arithmetic runs in UTC so the viewer's own time zone never shifts a day.
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

export function addMonths(year, month, delta) {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

// Weeks start on Monday, as calendars do in Bulgaria.
export function monthGrid(year, month) {
  const first = Date.UTC(year, month - 1, 1);
  const lead = (new Date(first).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = Math.ceil((lead + daysInMonth) / 7) * 7;
  const weeks = [];
  for (let i = 0; i < cells; i++) {
    const ms = first + (i - lead) * 86400000;
    const d = new Date(ms);
    if (i % 7 === 0) weeks.push([]);
    weeks.at(-1).push({ date: isoDay(ms), day: d.getUTCDate(), inMonth: d.getUTCMonth() === month - 1 });
  }
  return weeks;
}

// Stored starts are always Sofia wall time, so the first 10 characters are
// the Sofia date.
export function meetsByDay(events) {
  const byDay = new Map();
  for (const ev of events) {
    const key = ev.start.slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(ev);
  }
  return byDay;
}
