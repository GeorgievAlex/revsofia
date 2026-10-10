// Builds and sends the Discord announcement for a newly approved meet.
// Used by scripts/announce.mjs from the GitHub Action; the webhook URL only
// ever comes from the DISCORD_WEBHOOK_URL Actions secret.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { eventEndMs } = require("../../packages/revsofia/plan/event.js");

const clip = (text, max) => (text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text);

export function shouldAnnounce(event, now) {
  return event.example !== true && eventEndMs(event) >= now;
}

export function buildDiscordMessage(event, club, siteUrl) {
  // Discord renders <t:…> in each reader's own time zone.
  const unix = Math.floor(Date.parse(event.start) / 1000);
  const where = event.destination ? `${event.meeting_point} → ${event.destination}` : event.meeting_point;
  const cars = event.cars.length ? event.cars.map((c) => (c.car ? `${c.who}: ${c.car}` : c.who)).join("\n") : null;
  const lines = [
    `🗓 <t:${unix}:F> (<t:${unix}:R>)`,
    `📍 ${where}`,
    event.description,
    cars && `**Who's coming**\n${cars}`,
    `[Add to calendar](${siteUrl}ics/${event.id}.ics) · [All meets](${siteUrl})`,
  ].filter(Boolean);
  return {
    content: `New ${club.short} meet on RevSofia`,
    // Event text comes from people's chats: never let it ping anyone.
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: clip(event.title, 256),
        url: `${siteUrl}#club=${club.id}`,
        color: parseInt(club.accent.replace("#", ""), 16),
        description: clip(lines.join("\n\n"), 4096),
        footer: { text: club.name },
      },
    ],
  };
}

export async function postToDiscord(webhookUrl, payload, fetchImpl = fetch) {
  const res = await fetchImpl(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Discord rejected the announcement (${res.status})`);
}
