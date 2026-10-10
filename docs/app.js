import { formatWhen, sofiaToday } from "./sofia-time.js";
import { isUpcoming, googleCalendarUrl, monthGrid, addMonths, meetsByDay } from "./meets.js";

const chipsEl = document.getElementById("chips");
const headerEl = document.getElementById("club-header");
const meetsEl = document.getElementById("meets");
const calendarEl = document.getElementById("calendar");
let site = null;
const todayKey = sofiaToday();
let shown = { year: Number(todayKey.slice(0, 4)), month: Number(todayKey.slice(5, 7)) };
const monthName = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const dayLabel = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

function openMeet(id) {
  const card = document.getElementById(`meet-${id}`);
  if (!card) return;
  card.querySelector("details").open = true;
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  card.classList.remove("flash");
  void card.offsetWidth; // restart the highlight animation
  card.classList.add("flash");
}

function renderCalendar(items, clubsById) {
  const byDay = meetsByDay(items);
  const nav = (label, delta, text) =>
    el("button", { class: "cal-nav", type: "button", "aria-label": label, text, "data-delta": String(delta) });
  const head = el(
    "div",
    { class: "cal-head" },
    nav("Previous month", -1, "‹"),
    el("h2", { text: monthName.format(new Date(Date.UTC(shown.year, shown.month - 1, 1))) }),
    nav("Next month", 1, "›"),
  );
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => el("div", { class: "cal-weekday", "aria-hidden": "true", text: d }));
  const cells = monthGrid(shown.year, shown.month).flat().map((cell) => {
    const dayMeets = byDay.get(cell.date) || [];
    const classes = ["cal-day", cell.inMonth ? "" : "outside", cell.date === todayKey ? "today" : "", cell.date < todayKey ? "past" : ""]
      .filter(Boolean)
      .join(" ");
    if (!dayMeets.length) return el("div", { class: classes, text: String(cell.day) });
    const label = `${dayLabel.format(new Date(cell.date + "T00:00:00Z"))}: ${dayMeets.map((m) => m.title).join(", ")}`;
    return el(
      "button",
      { class: `${classes} has-meet`, type: "button", "aria-label": label, title: label, "data-meet": dayMeets[0].id },
      el("span", { text: String(cell.day) }),
      el("span", { class: "dots" }, ...dayMeets.map((m) => el("i", { style: `--accent:${clubsById[m.club].accent}` }))),
    );
  });
  calendarEl.replaceChildren(head, el("div", { class: "cal-grid" }, ...weekdays, ...cells));
}

calendarEl.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.dataset.delta) {
    shown = addMonths(shown.year, shown.month, Number(target.dataset.delta));
    render();
  } else if (target.dataset.meet) {
    openMeet(target.dataset.meet);
  }
});

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "style") node.style.cssText = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) if (child) node.append(child);
  return node;
}

function selectedClub() {
  const m = /club=([a-z-]+)/.exec(location.hash);
  return m && site.clubs.some((c) => c.id === m[1]) ? m[1] : "all";
}

function renderChips(current) {
  const chips = [{ id: "all", short: "All meets" }, ...site.clubs].map((c) =>
    el("a", {
      class: "chip",
      href: c.id === "all" ? "#" : `#club=${c.id}`,
      "aria-current": c.id === current ? "true" : null,
      style: c.accent ? `--accent:${c.accent}` : null,
      text: c.short,
    }),
  );
  chipsEl.replaceChildren(...chips);
}

function renderClubHeader(club) {
  if (!club) {
    headerEl.hidden = true;
    return;
  }
  headerEl.hidden = false;
  headerEl.style.setProperty("--accent", club.accent);
  headerEl.replaceChildren(
    el("h2", { text: club.name }),
    el("p", { text: club.blurb }),
    club.discord_url ? el("a", { class: "button", href: club.discord_url, rel: "noopener", text: "Join the Discord" }) : null,
  );
}

function meetCard(ev, clubsById) {
  const club = clubsById[ev.club];
  const where = ev.destination ? `${ev.meeting_point} → ${ev.destination}` : ev.meeting_point;
  const cars = ev.cars.length
    ? el("ul", { class: "cars" }, ...ev.cars.map((c) => el("li", { text: c.car ? `${c.who}: ${c.car}` : c.who })))
    : el("p", { class: "muted", text: "No one has listed a car yet." });
  return el(
    "article",
    { class: "meet", style: `--accent:${club.accent}`, id: `meet-${ev.id}` },
    el("p", { class: "when", text: formatWhen(ev.start) }),
    el("h3", { text: ev.title }),
    el(
      "p",
      { class: "badges" },
      el("a", { class: "badge", href: `#club=${club.id}`, text: club.short }),
      ev.example ? el("span", { class: "badge example", title: "Sample data, not a real meet", text: "Example meet" }) : null,
    ),
    el("p", { class: "where", text: where }),
    el(
      "details",
      {},
      el("summary", { text: "Details and who's coming" }),
      ev.description ? el("p", { text: ev.description }) : null,
      cars,
      el(
        "p",
        { class: "actions" },
        el("a", { class: "button", href: `ics/${ev.id}.ics`, download: `${ev.id}.ics`, text: "Add to calendar (.ics)" }),
        el("a", { class: "button ghost", href: googleCalendarUrl(ev), rel: "noopener", target: "_blank", text: "Google Calendar" }),
      ),
    ),
  );
}

function render() {
  const current = selectedClub();
  const clubsById = Object.fromEntries(site.clubs.map((c) => [c.id, c]));
  renderChips(current);
  renderClubHeader(clubsById[current]);
  const now = Date.now();
  const items = site.events.filter((ev) => isUpcoming(ev, now) && (current === "all" || ev.club === current));
  renderCalendar(items, clubsById);
  if (!items.length) {
    meetsEl.replaceChildren(
      el("p", { class: "empty" }, "No upcoming meets here yet. ", el("a", { href: "plan.html", text: "Plan one from your group chat" }), "."),
    );
    return;
  }
  meetsEl.replaceChildren(...items.map((ev) => meetCard(ev, clubsById)));
}

// The calendar stays out of the way until asked for, from the nav button or
// a link like ./?calendar from the other pages.
const calendarToggle = document.getElementById("calendar-toggle");

function setCalendarOpen(open) {
  calendarEl.hidden = !open;
  calendarToggle.setAttribute("aria-expanded", String(open));
  if (open) calendarEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

calendarToggle.addEventListener("click", () => setCalendarOpen(calendarEl.hidden));

async function start() {
  try {
    const res = await fetch("data/site.json");
    if (!res.ok) throw new Error(String(res.status));
    site = await res.json();
  } catch {
    meetsEl.replaceChildren(el("p", { class: "empty", text: "Couldn't load the meets. Refresh to try again." }));
    return;
  }
  render();
  addEventListener("hashchange", render);
  if (new URLSearchParams(location.search).has("calendar")) setCalendarOpen(true);
}

start();
