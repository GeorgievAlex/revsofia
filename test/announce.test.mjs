import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDiscordMessage, shouldAnnounce, postToDiscord } from "../scripts/lib/announce.mjs";

const club = { id: "bmw", name: "BMW Club Sofia", short: "BMW", accent: "#3b82f6" };
const ev = {
  id: "2026-10-25-bmw-coffee-and-cars", title: "BMW coffee and cars", club: "bmw",
  start: "2026-10-25T10:00:00+02:00", end: null, meeting_point: "Ring Mall parking", destination: "Vitosha",
  description: "Static meet.", cars: [{ who: "Alex", car: "E90 325i" }, { who: "Stoyan", car: "" }], example: false,
};
const site = "https://georgievalex.github.io/revsofia/";

test("buildDiscordMessage: embed with Discord timestamps, club colour, links, no pings", () => {
  const msg = buildDiscordMessage(ev, club, site);
  const e = msg.embeds[0];
  const unix = Date.parse(ev.start) / 1000;
  assert.equal(e.title, "BMW coffee and cars");
  assert.equal(e.color, 0x3b82f6);
  assert.equal(e.url, `${site}#club=bmw`);
  assert.match(e.description, new RegExp(`<t:${unix}:F> \\(<t:${unix}:R>\\)`));
  assert.match(e.description, /Ring Mall parking → Vitosha/);
  assert.match(e.description, /Alex: E90 325i/);
  assert.match(e.description, /\[Add to calendar\]\(https:\/\/georgievalex\.github\.io\/revsofia\/ics\/2026-10-25-bmw-coffee-and-cars\.ics\)/);
  assert.deepEqual(msg.allowed_mentions, { parse: [] });
  assert.match(msg.content, /New BMW meet/);
});

test("buildDiscordMessage: @everyone in user text can't ping, and length stays in Discord limits", () => {
  const msg = buildDiscordMessage({ ...ev, title: "@everyone " + "x".repeat(400), description: "y".repeat(5000) }, club, site);
  assert.deepEqual(msg.allowed_mentions, { parse: [] });
  assert.ok(msg.embeds[0].title.length <= 256);
  assert.ok(msg.embeds[0].description.length <= 4096);
});

test("shouldAnnounce: skips example and already-past meets", () => {
  const now = Date.parse("2026-10-20T12:00:00Z");
  assert.equal(shouldAnnounce(ev, now), true);
  assert.equal(shouldAnnounce({ ...ev, example: true }, now), false);
  assert.equal(shouldAnnounce({ ...ev, start: "2026-10-01T10:00:00+03:00" }, now), false);
});

test("postToDiscord: posts JSON, throws on failure without echoing the webhook URL", async () => {
  const calls = [];
  const ok = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 204 }; };
  await postToDiscord("https://discord.com/api/webhooks/1/secret", { content: "hi" }, ok);
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers["Content-Type"], "application/json");
  const bad = async () => ({ ok: false, status: 404, text: async () => "Unknown Webhook" });
  await assert.rejects(postToDiscord("https://discord.com/api/webhooks/1/secret", {}, bad), (err) => {
    assert.match(err.message, /404/);
    assert.equal(err.message.includes("secret"), false);
    return true;
  });
});
