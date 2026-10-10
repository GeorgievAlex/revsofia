---
title: "RevSofia, a Car Meetup app that people will love to use"
cover_image: https://georgievalex.github.io/revsofia/media/cover.png
published: true
tags: devchallenge, hf26challenge, ai, opensource
ai_disclosure_level: ai_assisted
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05)*

## What I Built

Car meets in Sofia almost always start the same way: a group chat.

"Sunday?" "Can't before 10." "Bringing the E92." "Ring Mall parking like last time?" "Coffee after or just park and chat?" Forty messages later the meet is technically decided, but nobody can tell you when, where, or who's actually coming without scrolling back up and reading the whole thing again.

I'm based in Sofia, and my last DEV challenge entry was a repair assistant for a friend's BMW E90, which [won Best Use of DigitalOcean](https://dev.to/devteam/congrats-to-the-hacktoberfest-weekend-challenge-build-for-a-friend-winners-pgc). This one is about the step after the car's fixed: actually getting out and driving it with other people.

So I built **[RevSofia](https://georgievalex.github.io/revsofia/)**, a meet board for Sofia car people:

- **General meets** for everyone, whatever you drive.
- **Club meets** for the brand crowds: BMW, Mercedes-Benz, and Audi/VW Group (VW, Skoda, Seat, Cupra and Porsche count too).
- Every meet has an **Add to calendar** button, so the plan ends up on your phone and you end up on the road.
- A month **calendar** behind a button in the top nav, with a dot per meet in the club's colour.
- No chat built in. That happens on [our Discord](https://discord.gg/epUkNA99a), and every club page links there instead of pretending to replace it.
- When a meet is approved, it's **posted to the Discord automatically**, with the time shown in each reader's own time zone.
- **Upcoming and Past** views. Once a meet has happened it doesn't vanish, it moves to Past.
- **Dark by default**, with a light theme one tap away.

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

![The RevSofia meets page with the month calendar open](https://georgievalex.github.io/revsofia/media/meets-calendar.png)

Paste the chat, tick the "I'm human" box, hit **Draft the meet**:

![The planner with a Bulgarian group chat pasted in](https://georgievalex.github.io/revsofia/media/planner-chat.png)

And this is what came back from Gemma in one of my test runs (real output, recorded from the live function):

![The draft meet and a Bulgarian Discord announcement generated from the chat](https://georgievalex.github.io/revsofia/media/planner-draft.png)

Here's one of my test chats. I wrote it in Bulgarian, because that's how a lot of these threads actually look:

```plaintext
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

```plaintext
browser ── GitHub Pages (static site) + Cloudflare Turnstile
   │  POST the pasted chat + a one-time "I'm human" token
   ▼
DigitalOcean Function  (holds the model key)
   │  checks the token with Cloudflare first
   ▼
DigitalOcean Serverless Inference → gemma-4-31B-it
```

- **The meets are JSON files in the repo.** A tiny Node build script validates them and spits out the site's data plus one `.ics` calendar file per meet. Approving a meet is literally merging a file.
- **One DigitalOcean Function does the AI part.** It exists so the model key never touches the browser. It caps the chat at 8,000 characters, never forwards upstream errors to the client, and runs the model's JSON through the same validation module the build uses. So a model hallucinating a club called "porsche" gets clamped to General instead of breaking anything.
- **Gemma 4 runs on DigitalOcean Serverless Inference.** It's an OpenAI-compatible endpoint, so there's no GPU to babysit. The model is one line of config.
- **The logo is hand-drawn SVG.** It's a rev gauge sweeping into the redline, with the Vitosha ridge underneath, because every Sofia meet ends up driving towards that mountain anyway. It's generated with a few lines of trig so the ticks and arcs land on exact angles.
- **Approved meets announce themselves.** A GitHub Action watches `data/events/`. When a new meet file lands on `main`, it posts an embed to the club Discord through a webhook kept in Actions secrets. Mentions are switched off, so an `@everyone` hiding in someone's chat text can't ping the whole server. Example meets and meets that are already over never get posted.
- **Time zones get their own tests.** Bulgaria switches from summer to winter time on 25 Oct. A meet at 10:00 that day is UTC+2, not UTC+3, and the calendar file has to say 08:00Z. There are tests for exactly that, because "the meet's an hour off" is the kind of bug that leaves people standing in an empty parking lot.

57 tests, all `node:test`, no test framework either.

**Show your work.** It's all in the repo: the [design spec](https://github.com/GeorgievAlex/revsofia/blob/main/design/2026-10-10-revsofia-design.md) and [build plan](https://github.com/GeorgievAlex/revsofia/blob/main/design/2026-10-10-revsofia-plan.md) written before any code, the [three logo concepts](https://github.com/GeorgievAlex/revsofia/tree/main/design/logo) that came before the final one, and a [commit history](https://github.com/GeorgievAlex/revsofia/commits/main) where every bug in the next section has its own fix commit.

## What I got wrong on the way

The first real run against the live model taught me more than the unit tests did.

**"Saturday morning" became a Saturday that had already passed.** I ran the tests on a Saturday evening. The model knew the date but not the time, so "foliage drive saturday morning" became *that same morning*, which was over by then. Its own announcement said "tomorrow" next to today's date. The fix had two parts: the prompt now gets the current Sofia time, and the function flags any start in the past as unresolved. That way even if the model gets it wrong again, the organiser sees a red field instead of a meet that already happened.

**An English chat got a Bulgarian announcement.** I'd told the model to "use the language most of the chat is in." It didn't, at least not reliably. Now the function decides the language itself and tells the model which one to write in. My first version just counted Cyrillic vs Latin letters, and a code review caught that a normal Bulgarian Discord paste fails it: usernames like `ivo_bmw_e46`, map links and car models are all Latin. So it strips usernames and links first, and calls it Bulgarian once about a third of what's left is Cyrillic. That's a boring, deterministic rule, and I trust it more than a vibe.

**The deploy broke CORS in a way no local test could catch.** The browser refused every request because the response said `Access-Control-Allow-Origin: *, https://georgievalex.github.io`. That's two values, which isn't allowed. DigitalOcean's gateway adds `*` on its own, and my function added the real origin on top. One annotation in `project.yml` (`web-custom-options: true`) hands CORS fully to the function, which also keeps the origin locked to my site.

**I almost shipped an endpoint anyone could run up a bill on.** CORS only stops browsers. Anyone with `curl` could hit the function in a loop, and every call costs Gemma tokens plus function time. The AI part is prepaid on DigitalOcean, so with auto-reload off the worst case is the balance running dry. Functions are billed after the fact, though, and a loop would also just take the planner down for real users. So the planner now has a Cloudflare Turnstile check. The function only calls the model if the request carries a fresh, single-use token, checked against the visitor's IP and my hostname. A forged token gets a `403` in about 0.3 seconds, before a single token is spent.

**It still invents a little.** In one test chat a guy just said "E-series Sunday?" without naming his car, and the model listed him as driving an "E-series". It's minor, but it's exactly why there's a human review step before anything goes live.

## Why Does Open Innovation Matter?

- **It's people's private chat.** A club's group chat is full of names, plans, and sometimes where people live. With an open-weight model I pick where it runs. I'm not handing the chat to whichever closed API is cheapest this month.
- **It costs almost nothing to run.** Gemma 4 on DigitalOcean is about $0.18 per million input tokens. A whole season of meets costs pocket change, and a club could run it without anyone paying a subscription.
- **Swapping the model is a config change.** If a smaller open model handles Bulgarian slang better next month, I change one string. Nothing else in the project knows or cares which model answers.
- **The whole thing is forkable.** Plovdiv, Varna, a JDM crowd, a classic-car club: change `clubs.json`, deploy one function, done.

## Prize Categories

- **Best Use of DigitalOcean:** a DigitalOcean Function hosts the backend, and DigitalOcean Serverless Inference serves the open-weight model. The spend ceiling is the prepaid Inference balance with auto-reload off.
- **Best Use of Gemma:** `gemma-4-31B-it` does the actual work of reading a messy multi-person chat and turning it into a structured, dated, located meet, in two languages.

## What's next

The four meets on the board are examples. The next step is replacing them with real ones from our Discord and seeing how Gemma handles a proper 200-message thread, slang, typos and all. After that: suggesting a route for the drive, and a small news section for each club.

**Got a car in Sofia?** [Join the RevSofia Discord](https://discord.gg/epUkNA99a), drop your next meet in the chat, and let Gemma do the planning.
