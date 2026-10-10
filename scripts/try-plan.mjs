// Live check: posts each fixture chat to the deployed function and saves the
// result. Usage: node scripts/try-plan.mjs
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { FUNCTION_URL } from "../docs/config.js";

if (!FUNCTION_URL) throw new Error("Set FUNCTION_URL in docs/config.js first");
await mkdir("fixtures/results", { recursive: true });
for (const file of (await readdir("fixtures/chats")).sort()) {
  const chat = await readFile(`fixtures/chats/${file}`, "utf8");
  const started = Date.now();
  const res = await fetch(FUNCTION_URL, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ chat, club_hint: "auto" }) });
  const body = await res.json();
  const ms = Date.now() - started;
  await writeFile(`fixtures/results/${file.replace(".txt", ".json")}`, JSON.stringify({ status: res.status, ms, body }, null, 2) + "\n");
  console.log(`${file}: ${res.status} in ${ms}ms club=${body.event?.club} start=${body.event?.start} missing=${JSON.stringify(body.missing)}`);
}
