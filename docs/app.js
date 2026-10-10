import { formatWhen } from "./sofia-time.js";
import { isUpcoming, googleCalendarUrl } from "./meets.js";

const chipsEl = document.getElementById("chips");
const headerEl = document.getElementById("club-header");
const meetsEl = document.getElementById("meets");
let site = null;

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
  if (!items.length) {
    meetsEl.replaceChildren(
      el("p", { class: "empty" }, "No upcoming meets here yet. ", el("a", { href: "plan.html", text: "Plan one from your group chat" }), "."),
    );
    return;
  }
  meetsEl.replaceChildren(...items.map((ev) => meetCard(ev, clubsById)));
}

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
}

start();
