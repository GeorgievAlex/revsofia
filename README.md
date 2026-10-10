# RevSofia

Car meets in Sofia, Bulgaria. General meets are open to every car fan, and club meets are for the brand crowds (BMW, Mercedes-Benz, Audi/VW Group). Every meet can go straight into your phone's calendar. The site has no chat; each club links to its own Discord.

**Site:** https://georgievalex.github.io/revsofia/

## The AI part: paste the group chat, get a meet

Meets get organised in chat threads: "Sunday?", "can't before 10", "bringing the E92", "Ring Mall parking like last time?". The [planner](https://georgievalex.github.io/revsofia/plan.html) takes that thread, in any language, and asks **Gemma 4** (`gemma-4-31B-it`, an open-weight model) to turn it into a draft meet. The draft has:

- title, date and time (relative days like "Sunday" resolved against today in Sofia)
- meeting point and destination
- who's coming and in what
- which club it belongs to, and why
- what the chat never settled
- an announcement ready to post back in Discord

The organiser edits the draft, then sends it for review as a GitHub issue. Nothing is published automatically.

## Architecture

```
browser ── GitHub Pages (static: docs/)
   │  POST text/plain {chat, club_hint}
   ▼
DigitalOcean Function  revsofia/plan   (holds the model access key)
   │  OpenAI-compatible chat completion
   ▼
DigitalOcean Serverless Inference → gemma-4-31B-it
```

- **The site is static.** Meets are JSON files in `data/events/`. `scripts/build.mjs` (no dependencies) validates them and writes `docs/data/site.json` plus one `.ics` file per meet.
- **The function exists so the key never reaches the browser.** It computes "today" in Europe/Sofia itself, caps input at 8,000 characters, never forwards the upstream error body, and validates the model's JSON with the same module the build uses (`packages/revsofia/plan/event.js`).
- **The browser sends `text/plain`,** so the call is a CORS simple request with no preflight.
- **Spend ceiling:** the DigitalOcean prepaid Inference balance, with auto-reload off. CORS only stops browsers, so the balance is the real limit.
- **Theme:** dark by default. The light theme is a per-browser choice.

## How a meet goes live

1. Someone drafts it in the planner and clicks **Send for review**. That opens a GitHub issue containing the event JSON.
2. A maintainer saves the JSON as `data/events/<id>.json`.
3. They run `npm run build` and push.

The four meets in `data/events/` are examples (`"example": true`), and the site shows them with an "Example meet" badge.

## Local development

Requires Node 18+. There's no `npm install`; there are no dependencies.

```bash
npm test                              # node:test, all suites
npm run build                         # data/ -> docs/data/site.json + docs/ics/
python3 -m http.server 8765 -d docs   # then open http://localhost:8765/
```

## Deploying the function

```bash
doctl auth init
doctl serverless install && doctl serverless connect
echo 'DO_INFERENCE_KEY=<your model access key>' > .env   # git-ignored
doctl serverless deploy .
doctl serverless functions get revsofia/plan --url       # put this in docs/config.js
node scripts/try-plan.mjs                                # live check against fixtures/chats/
```

## License

MIT
