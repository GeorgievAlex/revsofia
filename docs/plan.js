import { FUNCTION_URL } from "./config.js";
import { toSofiaIso, toLocalInputValue } from "./sofia-time.js";
import { meetId, parseCarsText, carsToText, validateDraft, reviewIssueUrl } from "./meets.js";

const $ = (id) => document.getElementById(id);
const FIELD_INPUT = { title: "d-title", start: "d-start", meeting_point: "d-meeting" };

function setStatus(node, text, isError = false) {
  node.textContent = text;
  node.classList.toggle("error", isError);
}

function option(value, label) {
  const o = document.createElement("option");
  o.value = value;
  o.textContent = label;
  return o;
}

async function loadClubs() {
  try {
    const res = await fetch("data/site.json");
    const { clubs } = await res.json();
    for (const c of clubs) {
      $("club-hint").append(option(c.id, c.name));
      $("d-club").append(option(c.id, c.name));
    }
  } catch {
    for (const [id, name] of [["general", "General meets"], ["bmw", "BMW"], ["mercedes", "Mercedes-Benz"], ["audi-vag", "Audi / VW Group"]]) {
      $("club-hint").append(option(id, name));
      $("d-club").append(option(id, name));
    }
  }
}

function markMissing(missing) {
  for (const [key, id] of Object.entries(FIELD_INPUT)) $(id).classList.toggle("missing", missing.includes(key));
}

function showDraft(data) {
  const ev = data.event;
  $("d-title").value = ev.title || "";
  $("d-club").value = ev.club;
  $("d-start").value = toLocalInputValue(ev.start);
  $("d-end").value = toLocalInputValue(ev.end);
  $("d-meeting").value = ev.meeting_point || "";
  $("d-destination").value = ev.destination || "";
  $("d-description").value = ev.description || "";
  $("d-cars").value = carsToText(ev.cars);
  $("club-reason").textContent = data.club_reason ? `Club: ${data.club_reason}` : "";
  $("questions").replaceChildren(
    ...data.open_questions.map((q) => {
      const li = document.createElement("li");
      li.textContent = q;
      return li;
    }),
  );
  $("questions-box").hidden = data.open_questions.length === 0;
  $("announcement").value = data.announcement;
  markMissing(data.missing);
  setStatus($("draft-status"), data.missing.length ? "Fill in the highlighted fields. The chat didn't settle them." : "");
  $("result").hidden = false;
  $("result").scrollIntoView({ behavior: "smooth", block: "start" });
}

function collectDraft() {
  const start = toSofiaIso($("d-start").value);
  const end = toSofiaIso($("d-end").value);
  const title = $("d-title").value.trim();
  return {
    id: start ? meetId(start, title) : "",
    title,
    club: $("d-club").value,
    start,
    end: end && start && Date.parse(end) > Date.parse(start) ? end : null,
    meeting_point: $("d-meeting").value.trim(),
    destination: $("d-destination").value.trim() || null,
    description: $("d-description").value.trim() || null,
    cars: parseCarsText($("d-cars").value),
  };
}

$("chat-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = $("status");
  if (!FUNCTION_URL) return setStatus(status, "The planner isn't connected yet (no function URL configured).", true);
  const chat = $("chat").value.trim();
  if (!chat) return setStatus(status, "Paste a chat first.", true);
  $("generate").disabled = true;
  setStatus(status, "Reading the chat… this takes a few seconds.");
  try {
    // text/plain keeps this a CORS "simple request": no preflight round trip.
    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ chat, club_hint: $("club-hint").value }),
    });
    const data = await res.json().catch(() => ({ error: `Unexpected response (${res.status}).` }));
    if (!res.ok) return setStatus(status, data.error || `Something went wrong (${res.status}).`, true);
    setStatus(status, "");
    showDraft(data);
  } catch {
    setStatus(status, "Couldn't reach the planner. Check your connection and try again.", true);
  } finally {
    $("generate").disabled = false;
  }
});

$("draft").addEventListener("submit", (event) => {
  event.preventDefault();
  const draft = collectDraft();
  const missing = validateDraft(draft);
  markMissing(missing);
  if (missing.length) return setStatus($("draft-status"), "Fill in the highlighted fields first.", true);
  setStatus($("draft-status"), "Opening GitHub in a new tab…");
  window.open(reviewIssueUrl(draft), "_blank", "noopener");
});

$("copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("announcement").value);
    $("copy").textContent = "Copied";
  } catch {
    $("announcement").select();
    $("copy").textContent = "Press Ctrl/Cmd+C";
  }
  setTimeout(() => ($("copy").textContent = "Copy"), 2000);
});

loadClubs();
