import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const plan = require("../packages/revsofia/plan/index.js");

const env = {
  DO_INFERENCE_KEY: "test-key", MODEL: "gemma-4-31B-it", ALLOWED_ORIGIN: "https://georgievalex.github.io",
  TURNSTILE_SECRET: "ts-secret", TURNSTILE_HOSTNAME: "georgievalex.github.io",
};
const now = Date.parse("2026-10-10T09:00:00Z");

// Answers Turnstile siteverify (recorded in fn.verifies) and inference
// (recorded in fn.calls) the way the real endpoints would.
function fakeFetch(content, { status = 200, verify = { success: true, hostname: "georgievalex.github.io" } } = {}) {
  const calls = [];
  const verifies = [];
  const fn = async (url, init) => {
    if (url.includes("/turnstile/v0/siteverify")) {
      verifies.push(Object.fromEntries(new URLSearchParams(init.body)));
      if (verify instanceof Error) throw verify;
      return { ok: true, status: 200, json: async () => verify };
    }
    calls.push({ url, init: { ...init, body: JSON.parse(init.body) } });
    return { ok: status >= 200 && status < 300, status, json: async () => ({ choices: [{ message: { content } }] }) };
  };
  fn.calls = calls;
  fn.verifies = verifies;
  return fn;
}

const draft = {
  title: "Sunday run", club: "bmw", club_reason: "all BMWs", start: "2026-10-18T09:30", end: null,
  meeting_point: "OMV", destination: "Vitosha", description: null,
  cars: [{ who: "Ivo", car: "E92" }], open_questions: ["Coffee stop?"], announcement: "Sunday 09:30 at OMV",
};
const req = (body, ip = "203.0.113.7") => ({ method: "POST", rawBody: JSON.stringify({ turnstile: "tok", ...body }), ip });

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
  process.env.TURNSTILE_SECRET = "ts-secret";
  const body = Buffer.from(JSON.stringify({ chat: "   " })).toString("base64");
  const res = await plan.main({ __ow_method: "post", __ow_body: body });
  // "Paste a chat first" (not "Body must be valid JSON") proves the body decoded
  // and parsed; an empty chat returns before any network call.
  assert.equal(res.statusCode, 400);
  assert.match(JSON.parse(res.body).error, /Paste a chat first/);
  delete process.env.DO_INFERENCE_KEY;
  delete process.env.TURNSTILE_SECRET;
});

test("buildMessages: gives the current Sofia time and picks the announcement language", () => {
  const evening = Date.parse("2026-10-10T18:40:00Z"); // 21:40 in Sofia
  const en = plan.buildMessages("Maria: drive saturday morning?", null, evening)[1].content;
  assert.match(en, /Today is Saturday, 2026-10-10 \(Europe\/Sofia\), and the time now is 21:40\./);
  assert.match(en, /Write the announcement in English\./);
  const bg = plan.buildMessages("Ники: Кой е за Витоша в неделя? ok", null, evening)[1].content;
  assert.match(bg, /Write the announcement in Bulgarian\./);
});

test("handle: a start that is already in the past is flagged, not silently accepted", async () => {
  const evening = Date.parse("2026-10-10T18:40:00Z");
  const f = fakeFetch(JSON.stringify({ ...draft, start: "2026-10-10T09:30" }));
  const res = await plan.handle(req({ chat: "x" }), { env, fetchImpl: f, now: evening });
  assert.equal(res.status, 200);
  assert.ok(res.body.missing.includes("start"));
  assert.match(res.body.open_questions[0], /already passed/);
});

test("buildMessages: a Bulgarian Discord paste with Latin usernames, links and models is still Bulgarian", () => {
  const chat = [
    "ivo_bmw_e46: Хайде в неделя на Витоша, тръгваме от OMV Simeonovsko",
    "maria.gti_mk7: аз съм вътре с голфа https://maps.app.goo.gl/AbCdEfGhIjKlMnOp",
    "stoyan_e39_530d: не мога тази седмица",
    "niki_w205_c200: 9:30 става ли",
  ].join("\n");
  assert.match(plan.buildMessages(chat, null, now)[1].content, /Write the announcement in Bulgarian\./);
});

test("turnstile: a missing token is refused before any network call", async () => {
  const f = fakeFetch(JSON.stringify(draft));
  const res = await plan.handle({ method: "POST", rawBody: JSON.stringify({ chat: "x" }) }, { env, fetchImpl: f, now });
  assert.equal(res.status, 403);
  assert.equal(f.verifies.length + f.calls.length, 0);
});

test("turnstile: the token is verified with the secret and visitor IP before inference", async () => {
  const f = fakeFetch(JSON.stringify(draft));
  const res = await plan.handle(req({ chat: "x" }), { env, fetchImpl: f, now });
  assert.equal(res.status, 200);
  assert.deepEqual(f.verifies, [{ secret: "ts-secret", response: "tok", remoteip: "203.0.113.7" }]);
  assert.equal(f.calls.length, 1);
});

test("turnstile: failed, foreign-hostname or unreachable verification never reaches the model", async () => {
  for (const [verify, status] of [
    [{ success: false, "error-codes": ["timeout-or-duplicate"] }, 403],
    [{ success: true, hostname: "evil.example" }, 403],
    [new Error("ECONNRESET"), 502],
  ]) {
    const f = fakeFetch(JSON.stringify(draft), { verify });
    const res = await plan.handle(req({ chat: "x" }), { env, fetchImpl: f, now });
    assert.equal(res.status, status, JSON.stringify(verify));
    assert.equal(f.calls.length, 0);
  }
});

test("turnstile: fails closed when the secret isn't configured", async () => {
  const f = fakeFetch(JSON.stringify(draft));
  const res = await plan.handle(req({ chat: "x" }), { env: { ...env, TURNSTILE_SECRET: "" }, fetchImpl: f, now });
  assert.equal(res.status, 500);
  assert.equal(f.verifies.length + f.calls.length, 0);
});

test("clientIp: first address in x-forwarded-for", () => {
  assert.equal(plan.clientIp({ __ow_headers: { "x-forwarded-for": "198.51.100.4, 10.0.0.1" } }), "198.51.100.4");
  assert.equal(plan.clientIp({}), "");
});
