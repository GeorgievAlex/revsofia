// Posts newly approved meets to Discord. Run by .github/workflows/announce.yml.
// Usage: node scripts/announce.mjs [--force] [--dry-run] data/events/<id>.json ...
//   --force    announce even example or already-past meets (for testing)
//   --dry-run  print the Discord payload instead of sending it
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { buildDiscordMessage, shouldAnnounce, postToDiscord } from "./lib/announce.mjs";
import { SITE_URL } from "./build.mjs";

const require = createRequire(import.meta.url);
const { validatePublishedEvent } = require("../packages/revsofia/plan/event.js");

const args = process.argv.slice(2);
const force = args.includes("--force");
const dryRun = args.includes("--dry-run");
const files = args.filter((a) => !a.startsWith("--"));
const webhook = process.env.DISCORD_WEBHOOK_URL;
if (!dryRun && !webhook) throw new Error("DISCORD_WEBHOOK_URL is not set");

const clubs = JSON.parse(await readFile("data/clubs.json", "utf8"));
for (const file of files) {
  // Only meet files in this repo; the path can come from a manual workflow input.
  if (!/^data\/events\/[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(file)) throw new Error(`not a meet file: ${file}`);
  const event = validatePublishedEvent(JSON.parse(await readFile(file, "utf8")));
  if (!force && !shouldAnnounce(event, Date.now())) {
    console.log(`skip ${file}: example or already over`);
    continue;
  }
  const club = clubs.find((c) => c.id === event.club);
  const payload = buildDiscordMessage(event, club, SITE_URL);
  if (dryRun) console.log(JSON.stringify(payload, null, 2));
  else {
    await postToDiscord(webhook, payload);
    console.log(`announced ${file}`);
  }
}
