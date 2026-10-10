import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const plan = require("../packages/revsofia/plan/index.js");

const env = { DO_INFERENCE_KEY: "test-key", MODEL: "gemma-4-31B-it", ALLOWED_ORIGIN: "https://georgievalex.github.io" };
const now = Date.parse("2026-10-10T09:00:00Z");

function fakeFetch(content, { status = 200 } = {}) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init: { ...init, body: JSON.parse(init.body) } });
    return { ok: status >= 200 && status < 300, status, json: async () => ({ choices: [{ message: { content } }] }) };
  };
  fn.calls = calls;
  return fn;
}

const draft = {
  title: "Sunday run", club: "bmw", club_reason: "all BMWs", start: "2026-10-18T09:30", end: null,
  meeting_point: "OMV", destination: "Vitosha", description: null,
  cars: [{ who: "Ivo", car: "E92" }], open_questions: ["Coffee stop?"], announcement: "Sunday 09:30 at OMV",
};
const req = (body) => ({ method: "POST", rawBody: JSON.stringify(body) });

test("handle: fenced JSON from the model becomes a normalised draft", async () => {
  const f = fakeFetch("Here you go:\n```json\n" + JSON.stringify(draft) + "\n```");
  const res = await plan.handle(req({ chat: "who's in sunday" }), { env, fetchImpl: f, now });
  assert.equal(res.status, 200);
  assert.equal(res.body.event.start, "2026-10-18T09:30:00+03:00");
  assert.equal(res.body.event.club, "bmw");
  assert.deepEqual(res.body.missing, []);
  assert.deepEqual(res.body.open_questions, ["Coffee stop?"]);
  assert.equal(f.calls[0].init.headers.Authorization, "Bearer test-key");
  assert.equal(f.calls[0].init.body.model, "gemma-4-31B-it");
  assert.equal(f.calls[0].init.body.max_tokens, 900);
});

test("handle: tells the model today's Sofia date and weekday", async () => {
  const f = fakeFetch(JSON.stringify(draft));
  await plan.handle(req({ chat: "x" }), { env, fetchImpl: f, now });
  assert.match(f.calls[0].init.body.messages[1].content, /Today is Saturday, 2026-10-10/);
});

test("handle: unknown club clamps to general; club hint overrides the model", async () => {
  let res = await plan.handle(req({ chat: "x" }), { env, fetchImpl: fakeFetch(JSON.stringify({ ...draft, club: "porsche" })), now });
  assert.equal(res.body.event.club, "general");
  res = await plan.handle(req({ chat: "x", club_hint: "mercedes" }), { env, fetchImpl: fakeFetch(JSON.stringify(draft)), now });
  assert.equal(res.body.event.club, "mercedes");
  assert.equal(res.body.club_reason, "Chosen by the organiser.");
});

test("handle: undecided chat returns nulls and a missing list", async () => {
  const f = fakeFetch(JSON.stringify({ ...draft, title: null, start: null, meeting_point: null }));
  const res = await plan.handle(req({ chat: "x" }), { env, fetchImpl: f, now });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.missing, ["title", "start", "meeting_point"]);
});

test("handle: input validation", async () => {
  const f = fakeFetch("{}");
  const cases = [
    [{ method: "GET", rawBody: "" }, 405],
    [{ method: "POST", rawBody: "not json" }, 400],
    [req({ chat: "   " }), 400],
    [req({ chat: "x".repeat(8001) }), 400],
    [req({ chat: "x", club_hint: "porsche" }), 400],
  ];
  for (const [r, status] of cases) assert.equal((await plan.handle(r, { env, fetchImpl: f, now })).status, status);
  assert.equal(f.calls.length, 0);
});

test("handle: upstream failure and unusable output are 502 without leaking upstream", async () => {
  let res = await plan.handle(req({ chat: "x" }), { env, fetchImpl: fakeFetch("secret upstream text", { status: 500 }), now });
  assert.equal(res.status, 502);
  assert.equal(JSON.stringify(res.body).includes("secret"), false);
  res = await plan.handle(req({ chat: "x" }), { env, fetchImpl: fakeFetch("I can't help with that"), now });
  assert.equal(res.status, 502);
  res = await plan.handle(req({ chat: "x" }), { env, fetchImpl: async () => { throw new Error("ECONNRESET"); }, now });
  assert.equal(res.status, 502);
});

test("handle: missing key is a 500 and makes no call", async () => {
  const f = fakeFetch("{}");
  const res = await plan.handle(req({ chat: "x" }), { env: {}, fetchImpl: f, now });
  assert.equal(res.status, 500);
  assert.equal(f.calls.length, 0);
});

test("main: OPTIONS preflight and CORS header", async () => {
  process.env.ALLOWED_ORIGIN = "https://georgievalex.github.io";
  const res = await plan.main({ __ow_method: "options" });
  assert.equal(res.statusCode, 204);
  assert.equal(res.headers["Access-Control-Allow-Origin"], "https://georgievalex.github.io");
});

test("main: decodes a base64 raw body", async () => {
  process.env.DO_INFERENCE_KEY = "test-key";
  const body = Buffer.from(JSON.stringify({ chat: "   " })).toString("base64");
  const res = await plan.main({ __ow_method: "post", __ow_body: body });
  // "Paste a chat first" (not "Body must be valid JSON") proves the body decoded
  // and parsed; an empty chat returns before any network call.
  assert.equal(res.statusCode, 400);
  assert.match(JSON.parse(res.body).error, /Paste a chat first/);
  delete process.env.DO_INFERENCE_KEY;
});
