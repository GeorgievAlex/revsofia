import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, readdir, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../scripts/build.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function fixture(events) {
  const root = await mkdtemp(path.join(tmpdir(), "revsofia-"));
  await mkdir(path.join(root, "data/events"), { recursive: true });
  await cp(path.join(repo, "data/clubs.json"), path.join(root, "data/clubs.json"));
  for (const [name, body] of Object.entries(events)) {
    await writeFile(path.join(root, "data/events", name), JSON.stringify(body));
  }
  return root;
}

const good = {
  id: "2026-11-08-b", title: "B", club: "audi-vag", start: "2026-11-08T10:00", meeting_point: "Boyana",
};

test("build: sorts events, writes site.json and one .ics per event", async () => {
  const root = await fixture({
    "2026-11-08-b.json": good,
    "2026-10-18-a.json": { ...good, id: "2026-10-18-a", title: "A", start: "2026-10-18T09:30" },
  });
  await build(root);
  const site = JSON.parse(await readFile(path.join(root, "docs/data/site.json"), "utf8"));
  assert.deepEqual(site.events.map((e) => e.id), ["2026-10-18-a", "2026-11-08-b"]);
  assert.equal(site.events[1].start, "2026-11-08T10:00:00+02:00");
  assert.equal(site.clubs.length, 4);
  assert.deepEqual((await readdir(path.join(root, "docs/ics"))).sort(), ["2026-10-18-a.ics", "2026-11-08-b.ics"]);
});

test("build: names the bad file and refuses an id that doesn't match its file name", async () => {
  const root = await fixture({ "2026-11-08-wrong.json": good });
  await assert.rejects(build(root), /2026-11-08-wrong\.json.*must match the file name/);
});

test("build: invalid event fails the whole build with the file name", async () => {
  const root = await fixture({ "x.json": { ...good, id: "x", club: "porsche" } });
  await assert.rejects(build(root), /data\/events\/x\.json: club must be one of/);
});

test("build: the real repo data builds", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "revsofia-real-"));
  await cp(path.join(repo, "data"), path.join(root, "data"), { recursive: true });
  const { events } = await build(root);
  assert.ok(events.length >= 4);
  assert.ok(events.every((e) => e.example === true));
});
