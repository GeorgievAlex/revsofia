---
title: "Car meets in Sofia get planned in chaos, so I made an open model read the chat for us"
published: false
tags: devchallenge, hf26challenge, ai, opensource
ai_disclosure_level: ai_assisted
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05)*

## What I Built

Every car meet I've been to in Sofia started the same way: a group chat.

"Sunday?" "Can't before 10." "Bringing the E92." "Ring Mall parking like last time?" "Coffee after or just park and chat?" Forty messages later the meet is technically decided, but nobody can tell you when, where, or who's actually coming without scrolling back up and reading the whole thing again.

<!-- TODO(Alex): one or two real sentences about your own meets / your E90 here. Keep it true. -->

So I built **[RevSofia](https://georgievalex.github.io/revsofia/)**, a meet board for Sofia car people:

- **General meets** for everyone, whatever you drive.
- **Club meets** for the brand crowds: BMW, Mercedes-Benz, and Audi/VW Group (VW, Skoda, Seat, Cupra and Porsche count too).
- Every meet has an **Add to calendar** button, so the plan ends up on your phone and you end up on the road.
- No chat built in. The clubs already live on Discord, so each club page links there instead of pretending to replace it.

The part that makes it work is the **planner**. You paste the group chat, in English or Bulgarian, and an open-weight model (Gemma 4) turns it into a draft meet:

- the date and time, with "Sunday" resolved against today in Sofia
- the meeting point and the destination
- who's coming and in what car
- which club it belongs to, and why
- a list of what the chat **never actually settled**
- an announcement ready to paste back into Discord

You fix whatever it got wrong, hit **Send for review**, and it becomes a GitHub issue. Nothing gets published until a human approves it.

That's the touch grass part. The screen time is about thirty seconds. The rest is Vitosha.

## Demo

**Live site:** https://georgievalex.github.io/revsofia/
**Planner:** https://georgievalex.github.io/revsofia/plan.html

<!-- TODO(Alex): screenshot or GIF of the planner: paste chat, then the draft and the announcement. -->

Here's a real chat I used for testing (it's in Bulgarian, which is how a lot of these actually look):

```
Ники: Кой е за Витоша в неделя сутринта?
Мария: Аз! Идвам с голфа
Иво: и аз, с 335-ицата. В колко?
Ники: 9:30 на бензиностанцията на Симеоновско шосе
Мария: окей, после кафе на Златните мостове
Стоян: тази неделя не мога, следващия път
```

On the live site that came back in about 5.4 seconds as:

- **Start:** Sunday 11 Oct, 09:30 (Sofia time)
- **Meeting point:** the petrol station on Simeonovsko shose
- **Destination:** Zlatnite Mostove
- **Coming:** Niki, Maria (Golf), Ivo (BMW 335i). Stoyan said he can't make it, so he's correctly not on the list.
- **Club:** General, because it's mixed brands
- **Still undecided:** what time it ends
- **Announcement:** in Bulgarian, ready to paste

The four meets on the board right now are marked **Example meet**. They're sample data so the site isn't empty. I didn't want a fresh site pretending real meets exist.

## Code

{% embed https://github.com/GeorgievAlex/revsofia %}

## How I Built It

Same "deliberately boring" rule as my last project: no framework, no database, no npm dependencies.

```
browser ── GitHub Pages (static site)
   │  POST the pasted chat
   ▼
DigitalOcean Function  (holds the model key)
   │
   ▼
DigitalOcean Serverless Inference → gemma-4-31B-it
```

- **The meets are JSON files in the repo.** A tiny Node build script validates them and spits out the site's data plus one `.ics` calendar file per meet. Approving a meet is literally merging a file.
- **One DigitalOcean Function does the AI part.** It exists so the model key never touches the browser. It caps the chat at 8,000 characters, never forwards upstream errors to the client, and runs the model's JSON through the same validation module the build uses. So a model hallucinating a club called "porsche" gets clamped to General instead of breaking anything.
- **Gemma 4 runs on DigitalOcean Serverless Inference.** It's an OpenAI-compatible endpoint, so there's no GPU to babysit. The model is one line of config.
- **Time zones get their own tests.** Bulgaria switches from summer to winter time on 25 Oct. A meet at 10:00 that day is UTC+2, not UTC+3, and the calendar file has to say 08:00Z. There are tests for exactly that, because "the meet's an hour off" is the kind of bug that leaves people standing in an empty parking lot.

39 tests, all `node:test`, no test framework either.

## What I got wrong on the way

The first real run against the live model taught me more than the unit tests did.

**"Saturday morning" became a Saturday that had already passed.** I ran the tests on a Saturday evening. The model knew the date but not the time, so "foliage drive saturday morning" became *that same morning*, which was over by then. Its own announcement said "tomorrow" next to today's date. The fix had two parts: the prompt now gets the current Sofia time, and the function flags any start in the past as unresolved. That way even if the model gets it wrong again, the organiser sees a red field instead of a meet that already happened.

**An English chat got a Bulgarian announcement.** I'd told the model to "use the language most of the chat is in." It didn't, at least not reliably. Now the function counts Cyrillic vs Latin letters and tells the model which language to write in. That's a boring, deterministic rule, and I trust it more than a vibe.

**The deploy broke CORS in a way no local test could catch.** The browser refused every request because the response said `Access-Control-Allow-Origin: *, https://georgievalex.github.io`. That's two values, which isn't allowed. DigitalOcean's gateway adds `*` on its own, and my function added the real origin on top. One annotation in `project.yml` (`web-custom-options: true`) hands CORS fully to the function, which also keeps the origin locked to my site.

**It still invents a little.** In one test chat a guy just said "E-series Sunday?" without naming his car, and the model listed him as driving an "E-series". It's minor, but it's exactly why there's a human review step before anything goes live.

## Why Does Open Innovation Matter?

<!-- TODO(Alex): check these are things you actually believe; trim to the ones that land. -->

- **It's people's private chat.** A club's group chat is full of names, plans, and sometimes where people live. With an open-weight model I pick where it runs. I'm not handing the chat to whichever closed API is cheapest this month.
- **It costs almost nothing to run.** Gemma 4 on DigitalOcean is about $0.18 per million input tokens. A whole season of meets costs pocket change, and a club could run it without anyone paying a subscription.
- **Swapping the model is a config change.** If a smaller open model handles Bulgarian slang better next month, I change one string. Nothing else in the project knows or cares which model answers.
- **The whole thing is forkable.** Plovdiv, Varna, a JDM crowd, a classic-car club: change `clubs.json`, deploy one function, done.

## Prize Categories

- **Best Use of DigitalOcean:** a DigitalOcean Function hosts the backend, and DigitalOcean Serverless Inference serves the open-weight model. The spend ceiling is the prepaid Inference balance with auto-reload off.
- **Best Use of Gemma:** `gemma-4-31B-it` does the actual work of reading a messy multi-person chat and turning it into a structured, dated, located meet, in two languages.

<!-- TODO(Alex): if you take it to a real meet this weekend (bonus points: "take it outside, use it, and tell us how it went"), add a short section here with what happened. -->
