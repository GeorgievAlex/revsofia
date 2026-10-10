// Validates data/ and writes the static site's data: docs/data/site.json and
// docs/ics/<id>.ics. No dependencies. Run: npm run build
import { readFile, readdir, writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { toIcs } from "./lib/ics.mjs";

const require = createRequire(import.meta.url);
const { validatePublishedEvent, CLUB_IDS } = require("../packages/revsofia/plan/event.js");

export const SITE_URL = "https://georgievalex.github.io/revsofia/";

export async function build(root) {
  const clubs = JSON.parse(await readFile(path.join(root, "data/clubs.json"), "utf8"));
  const clubIds = clubs.map((c) => c.id).sort();
  if (JSON.stringify(clubIds) !== JSON.stringify([...CLUB_IDS].sort())) {
    throw new Error(`data/clubs.json ids [${clubIds}] must be exactly [${CLUB_IDS}]`);
  }

  const dir = path.join(root, "data/events");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  const events = [];
  for (const file of files) {
    const where = `data/events/${file}`;
    let event;
    try {
      event = validatePublishedEvent(JSON.parse(await readFile(path.join(dir, file), "utf8")));
    } catch (err) {
      throw new Error(`${where}: ${err.message}`);
    }
    if (`${event.id}.json` !== file) throw new Error(`${where}: id "${event.id}" must match the file name`);
    events.push(event);
  }
  events.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));

  const out = path.join(root, "docs");
  await rm(path.join(out, "ics"), { recursive: true, force: true });
  await mkdir(path.join(out, "ics"), { recursive: true });
  await mkdir(path.join(out, "data"), { recursive: true });
  for (const event of events) {
    await writeFile(path.join(out, "ics", `${event.id}.ics`), toIcs(event, { siteUrl: SITE_URL }));
  }
  await writeFile(path.join(out, "data/site.json"), JSON.stringify({ clubs, events }, null, 2) + "\n");
  return { clubs, events };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  build(root)
    .then(({ events }) => console.log(`built ${events.length} events`))
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
