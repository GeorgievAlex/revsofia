# RevSofia: design

Date: 2026-10-10. Target: DEV Hacktoberfest Open-Source AI Challenge, Week 1 "Touch Grass" (due 2026-10-11 23:59 PDT).

## What it is

A car-meet site for Sofia, Bulgaria. There are general meets open to every car fan, plus club pages for brand communities (BMW, Mercedes-Benz, Audi/VW Group), each with its own events and a link to that club's Discord. The site has no chat of its own; Discord is the chat.

The open-weight AI feature is **chat-to-meet**. An organiser pastes a messy group-chat thread (Discord, Viber, any language, Bulgarian included). Gemma 4 turns it into a structured meet draft (title, date/time, meeting point, destination, attendees with their cars, the suggested club, unresolved questions) plus a ready-to-post announcement. The organiser edits the draft and submits it for review, and once approved it appears on the calendar. Every meet has an "Add to calendar" (.ics) link, so the plan ends up on a phone and people end up on a road.

Why the AI is load-bearing: turning free-form multi-person chat into a dated, located event is the actual chore of organising a meet, and rules or forms can't do it.

## Non-goals (this week)

Built-in chat, news section, user accounts, a database, route planning or maps, a multilingual UI (the UI is English; the model accepts any input language), and automated issue-to-event publishing.

## Architecture

```
browser ── GitHub Pages (static: docs/)
   │  POST text/plain {chat, club_hint, today}
   ▼
DigitalOcean Function  revsofia/plan   (holds the model access key)
   │  OpenAI-compatible chat completion
   ▼
DigitalOcean Serverless Inference → gemma-4-31B-it
```

The model id is reused from bmw-repair-assistant, where it was verified against `/v1/models` on 2026-10-02; re-check it before deploying.

- The browser sends `Content-Type: text/plain` so the request is a CORS "simple request" with no preflight. The function still returns `Access-Control-Allow-Origin` restricted to the Pages origin.
- Spend ceiling: the DigitalOcean prepaid Inference balance with auto-reload off, the same as the BMW project. Input is capped at 8,000 chars and `max_tokens` at 900.
- The function timeout is raised to 60s in `project.yml`, because the default is too short for a 31B model call.

## Repo layout

```
data/clubs.json          # club id, name, brands[], discord_url, accent colour
data/events/*.json       # one file per meet (schema below)
scripts/build.mjs        # data/ -> docs/data/site.json + docs/ics/<id>.ics (no deps)
scripts/lib/event.mjs    # shared validation/normalisation (used by build + function tests)
docs/                    # Pages root: index.html, plan.html, app.js, plan.js, style.css
packages/revsofia/plan/index.js   # DO Function
project.yml              # DO Functions project config
test/*.test.mjs          # node:test
```

## Event schema

```json
{
  "id": "2026-10-18-vitosha-sunday-run",
  "title": "Vitosha Sunday run",
  "club": "general | bmw | mercedes | audi-vag",
  "start": "2026-10-18T09:30:00+03:00",
  "end": "2026-10-18T13:00:00+03:00",
  "meeting_point": "OMV, Simeonovsko shose",
  "destination": "Zlatnite Mostove, Vitosha",
  "description": "free text",
  "cars": [{ "who": "Ivo", "car": "E92 335i" }],
  "example": true
}
```

- `end` is optional; for the .ics and Google Calendar link it defaults to `start` + 3h.
- `example: true` marks seed events. The UI shows an "Example meet" badge, so the site never presents invented meets as real.

## Function contract

Request (text/plain body, JSON): `{ "chat": string, "club_hint": "auto"|club id, "today": "YYYY-MM-DD" }`.

Response 200:

```json
{
  "event": "<event schema, minus id/example>",
  "club_reason": "all cars mentioned are BMW",
  "open_questions": ["Nobody confirmed the coffee stop"],
  "announcement": "post-ready text"
}
```

Errors: `400` for bad input, with a message; `502` when inference fails or returns output that can't be parsed or validated. The upstream body is never forwarded.

Behaviour:

- The prompt passes today's date and weekday in the Europe/Sofia timezone, so "this Sunday" resolves.
- The model must return JSON only; the function strips code fences and parses it.
- Validation runs through `scripts/lib/event.mjs`: club is clamped to known ids (else `general`), start must parse as a date, strings are trimmed and length-capped, `cars` is capped at 30.
- When the model can't determine a field, it returns `null` and adds an open question; the UI shows that field empty and highlighted.
- Pasted chat is untrusted. Its output is only a draft, rendered with `textContent` (never `innerHTML`), and a human reviews it before publishing.

## Site

- **Home:** upcoming meets (past ones hidden), filter chips (All / General / BMW / Mercedes / Audi-VAG), and cards with date, time, club, meeting point and destination. Each card opens a detail panel with the attendee cars, an Add-to-calendar (.ics) link and a Google Calendar link.
- **Club view (`#club=bmw`):** the same list filtered, plus a club header and a "Join the Discord" button. `discord_url` is a placeholder until real invites exist, and the button is hidden when empty.
- **Plan a meet (plan.html):**
  1. A textarea for the chat, a club select (auto plus the clubs), and a Generate button.
  2. The draft appears as an editable form, with open questions and the announcement (with a Copy button).
  3. "Submit for review" opens a prefilled GitHub new-issue URL (title plus the event JSON in the body, label `meet`).
  4. The maintainer adds the file to `data/events/` and runs the build.

## Testing

- `node --test`: event validation/normalisation, .ics generation (escaping, UTC conversion, CRLF), and the build output shape.
- A function unit test with `fetch` stubbed: fenced JSON, invalid club, missing fields, and an upstream 500 mapped to 502.
- Live check after deploy: three fixture chats (BMW-only English, mixed-brand, Bulgarian-language) through the deployed function. The results are recorded for the post.

## Deploy prerequisites (user)

- `doctl auth init` (with a DO API token), then `doctl serverless install` / `connect`.
- A DigitalOcean model access key in `.env` as `DO_INFERENCE_KEY` (git-ignored). `project.yml` reads `${DO_INFERENCE_KEY}`.
- A new GitHub repo `GeorgievAlex/revsofia`, with Pages serving `/docs` from `main`.
