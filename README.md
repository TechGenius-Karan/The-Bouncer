# The Bouncer 🚪

A daily word puzzle where you have to figure out the rule before you can follow it.

## Why this exists

I've always liked the daily-puzzle genre — Wordle, Connections, that whole family of "one puzzle a day, compare notes with friends tomorrow" games. What I hadn't seen anywhere was one built around pure induction: you're not guessing letters or finding a category you're told exists, you're watching a handful of examples and quietly building a theory in your head about *why* they're sorted the way they are. That "wait... I think I see it" moment is the whole game. Everything else — the lives, the sorting animation, the door theme — exists to protect that one feeling.

So that's The Bouncer: you're standing at the door, watching who gets let in and who gets turned away, until you can spot the rule for yourself. Then it's your turn to work the door.

## How it plays

1. **Study the evidence.** You're shown a few words already sorted into IN and OUT. Somewhere in there is a rule — maybe it's about spelling, maybe it's about meaning.
2. **Work the door.** A fresh batch of words shows up. Swipe each one IN or OUT based on your best guess at the rule.
3. **Find out immediately.** Every swipe is checked on the spot. Get it wrong and the card auto-corrects to where it belongs — but it costs you one of your **3 lives**.
4. **See how you did.** Once you've sorted everyone (or run out of lives), the rule is revealed along with your score, ready to share — without spoiling the answer for friends who haven't played yet.

Three wrong swipes and the round ends early, so brute-forcing your way through isn't a viable strategy — you actually have to reason it out.

## What's built so far

- **The core game loop** — evidence, sorting, live per-swipe feedback, the 3-life system, and the reveal screen, all server-checked so scores and lives can't be faked from the browser.
- **A puzzle content engine** — a rule taxonomy (both spelling-based rules like "contains a doubled letter" and meaning-based rules like "is a fruit"), a word bank, and a generator that automatically builds new puzzles, checks they're logically fair, and deliberately plants tricky "trap" words to keep things interesting.
- **A human approval pipeline** — every generated puzzle goes through a review queue before it ever reaches a player, plus scheduling tools to line puzzles up for future dates and pull one back if something needs a second look.
- **Difficulty tiers** — a standard difficulty for most days and a harder "Spicy Saturday" with subtler rules and more traps.
- **Local play history and sharing** — your past results are saved on your device (no account needed), and finishing a puzzle gives you a spoiler-safe result you can share in a chat.
- **An admin dashboard** — internal tools for keeping an eye on the puzzle buffer, generating new batches, and reviewing stats, all behind a login.
- **Installable app support** — it works as a installable, offline-friendly app on your phone or desktop, and updates never interrupt a puzzle you're mid-way through.

## What's coming next

- **More puzzle variety** — expanding the meaning-based rule set (categories, shared properties) beyond the spelling-based rules that came first.
- **Visual and copy polish** — leaning further into the "you are the bouncer" framing and refining the look and feel.
- **A steady content pipeline** — building up a real multi-week buffer of approved puzzles so there's always a comfortable runway ahead.
- **Deployment and performance tuning** — making sure the game feels fast and reliable in production, not just in local development.
- **Open questions we're still chewing on:** whether Sunday should be a gentler "cooldown" day after Spicy Saturday, whether accounts/cross-device history are worth adding, and whether a themed-images version of the game (sorting pictures instead of words) is worth building down the line.

None of the above changes the core rules of the game — 3 lives, no partial credit for guessing the rule without playing it out, and never spoiling the answer on a shared result. Those are locked in for good.

## Under the hood

For anyone poking around the code: this is a Vite + React frontend, a Netlify Functions backend, and MongoDB for storage, with a completely separate offline content-engine (word bank, rule taxonomy, generator, validator) that produces puzzles ahead of time rather than on the fly. See [`CLAUDE.md`](./CLAUDE.md) for the full architecture breakdown, [`planning.md`](./planning.md) for the full game design spec, and [`build-plan.md`](./build-plan.md) for how it was built in phases.

### Running it locally

```
npm install
npm run dev              # frontend only, no backend
npm run dev:functions    # frontend + backend + local API together
npm test                 # run the test suite
```

### License

Not yet decided — treat this as source-available for now, not open for reuse.
