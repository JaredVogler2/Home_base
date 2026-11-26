# The planning helper (optional AI)

HOMEBASE works completely without it. The planning helper is an **optional, off-by-default, grown-ups-only**
assistant that can draft a few kinds of plan using a large language model from **Anthropic** or **OpenAI**, with an
API key that the person who runs the server supplies.

## What it is, and what it is not

It **is**: a handful of narrow jobs on the parents' page _Family → The planning helper_. Each job is a short form;
each answer is a **draft** that a parent reads and either applies (all of it or the ticked parts) or puts aside.

It is **not**:

- a chat box. There is no "ask anything" and nothing on the wall. A wall — even one unlocked with a parent's PIN — is
  refused by every `/api/ai/*` route (`requireGuardianSession`);
- able to change anything by itself. The model only proposes. It cannot move stars, approve or decline rewards,
  delete data, buy anything, contact anyone, open links, fetch anything or call tools — the requests carry no
  tools at all;
- a source of facts about your children. It makes no diagnoses and no developmental or medical claims, never ranks
  or compares children, and every number it shows comes from HOMEBASE's own counts with what it is out of.

**"How long until…?"** — the reward simulation at the top of the page — is worked out by HOMEBASE itself with no
model at all (`server/ai/economist.ts`), and is there whether the helper is on or off, for parents and helpers.

## Turning it on

1. Whoever runs the server sets one or both of these environment variables (see `.env.example`) and restarts it:

   | Variable                      | What it is                                                                  |
   | ----------------------------- | --------------------------------------------------------------------------- |
   | `ANTHROPIC_API_KEY`           | An API key from the Anthropic Console (console.anthropic.com)               |
   | `OPENAI_API_KEY`              | An API key from the OpenAI platform (platform.openai.com)                   |
   | `HOMEBASE_AI_ANTHROPIC_MODEL` | Optional. Default `claude-haiku-5-5`                                        |
   | `HOMEBASE_AI_OPENAI_MODEL`    | Optional. Default `gpt-6-luna`                                              |
   | `HOMEBASE_AI_PRICE_ANTHROPIC` | Optional. `"input,output"` US$ per million tokens for the Anthropic model   |
   | `HOMEBASE_AI_PRICE_OPENAI`    | Optional. The same for the OpenAI model                                     |

   **A ChatGPT Plus/Pro or Claude Pro/Max chat subscription is not an API key** and does not include API use. API
   use is billed separately by the provider, per token.

2. A parent opens _The planning helper_, chooses the provider (only providers the server has a key for are offered;
   with none, the page names the variable to set), ticks what may be sent, checks the limits, and switches it on.

The kill switch is any of: the household's switch off (`settings.ai.enabled`, the default), no key for the chosen
provider, or `HOMEBASE_OFFLINE=1` on the server. Then nothing is ever sent.

## What is sent

Nothing until a parent ticks a category (`settings.ai.share`, default empty). Each job needs certain categories and
is refused — before anything is built or sent — if they are not ticked.

| Category      | Used by                          | What it sends                                                                                                                                                                                 |
| ------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routines      | Routine architect, weekly review | The sentence the parent typed (scrubbed, ≤ 300 characters), each chosen child's age band, weekly counts of routines started/finished/help asked, routine titles (scrubbed, ≤ 40 characters) |
| Missions      | Weekly review                    | Weekly counts of missions handed out/done/left/handed back/helped, with the titles of up to five missions a hand was asked for most (scrubbed, ≤ 60 characters)                             |
| To buy        | Shopping tidy                    | Up to 60 items still to buy: their words (scrubbed, ≤ 60 characters), aisle, picture, quantity and unit                                                                                      |
| Rewards       | Reward explanation               | Reward titles (scrubbed) and prices, stars to spend now, and HOMEBASE's own weekly rates and weeks-to-save                                                                                    |
| Calendar      | —                                | Nothing yet: no job that uses it is built                                                                                                                                                      |
| Academy       | —                                | Nothing yet: no job that uses it is built                                                                                                                                                      |

How it is sent (`server/ai/anonymise.ts`):

- Children are **Child A, Child B…** for that one request; the server maps the labels back to real ids when the
  reply comes in. A child's nickname typed into a sentence or a list item is replaced by its label.
- Missions, routines, items and rewards are short references (`M1`, `R2`, `I3`, `W1`), checked against that
  request's own table on the way back.
- Every piece of text a person wrote is scrubbed of web addresses, e-mail addresses, phone numbers, markup and
  control characters, cut short, and sent inside a `<household_data>` fence that the instructions call data.
- The whole user message is capped at 16,000 characters; a job that would need more is refused, not truncated.

**Never sent:** names, photos, voice, e-mail addresses, the household's name, the location, calendar events, notes,
links or shops on list items, who added an item, device names, the star ledger's lines, or any key or secret.

A real (synthetic) request body, for _Tidy the list_ with only "To buy" ticked, a child called Robin, and an item
"oat milk" with the note "the blue carton" (the system prompt and schema are shortened here):

```json
{
  "model": "claude-haiku-5-5",
  "max_tokens": 2500,
  "system": "You are the planning helper inside HOMEBASE, a family's home screen. You write drafts for the family's grown-ups. A grown-up reads every draft and decides; nothing you write is applied by itself.\n\nYou…",
  "messages": [
    {
      "role": "user",
      "content": "The items on the list:\n<household_data name=\"shopping_items\">\n[{\"ref\":\"I1\",\"text\":\"bananas\",\"category\":\"produce\",\"picture\":\"banana\",\"quantity\":null,\"unit\":null},{\"ref\":\"I2\",\"text\":\"oat milk\",\"category\":\"other\",\"picture\":\"other\",\"quantity\":null,\"unit\":null},{\"ref\":\"I3\",\"text\":\"cake for Child A\",\"category\":\"other\",\"picture\":\"other\",\"quantity\":null,\"unit\":null}]\n</household_data>"
    }
  ],
  "output_config": {
    "format": { "type": "json_schema", "schema": "…" },
    "effort": "low"
  }
}
```

The note, the household, Robin's name and the parent's e-mail address are not in it. The tests search every captured
request body for exactly these things (`tests/server/ai.test.ts`, _what is sent_).

## Costs

Prices live in one table, `server/ai/pricing.ts`, with their sources and the date they were read (2026-11-26):

| Model (default in bold) | Input $/M tokens | Output $/M tokens | Source                                                            |
| ----------------------- | ---------------- | ----------------- | ----------------------------------------------------------------- |
| **`claude-haiku-5-5`**  | 0.10             | 0.50              | claude-api skill model table (cached 2026-11-03) → Anthropic pricing page; $0.50/$2.50 above 100K-token prompts |
| **`gpt-6-luna`**        | 0.10             | 0.50              | developers.openai.com/api/docs/pricing and /models/gpt-6-luna      |
| others in the table     | …                | …                 | same pages                                                         |

A model that is not in the table and has no `HOMEBASE_AI_PRICE_*` override is priced at the **dearest** known rate
(currently $10 / $50), so a limit can never be under-counted.

Worked examples at the default models (approximate: actual token counts depend on the household's data):

| Job                  | Output cap | Typical tokens (in / out) | Typical cost | Worst case checked before sending |
| -------------------- | ---------- | ------------------------- | ------------ | --------------------------------- |
| Routine architect    | 1,500      | ~1,800 / ~500             | ≈ $0.0004    | ≈ $0.001                          |
| Weekly review        | 2,000      | ~3,000 / ~700             | ≈ $0.0007    | ≈ $0.0015                         |
| Shopping tidy (60)   | 2,500      | ~3,500 / ~900             | ≈ $0.0008    | ≈ $0.002                          |
| Reward explanation   | 1,000      | ~1,500 / ~400             | ≈ $0.0004    | ≈ $0.0008                         |

(For example the routine architect: 1,800 × $0.10/M + 500 × $0.50/M = $0.00018 + $0.00025 ≈ $0.0004.) At an
unknown model priced at the dearest rate, the same routine run's worst case is about 9 cents.

**Limits** (per household, in Settings, defaults $0.50 a day and $5.00 a month; **$0.00 means never**):

- Before every request the dearest it could be (input estimated generously at one token per three characters, plus
  the whole output cap) is added to what has been spent today and this month; if either limit would be passed, the
  request is not made (`server/ai/budget.ts`).
- That check is made holding the household's lock, and a request that passes **sets its dearest cost aside at
  once** as a `reserved` line in `ai_usage`. A second request — from another phone, or on another server
  instance — counts it as already spent, so the limits hold however many requests arrive together. When the
  request's real cost is written down, the amount set aside is given back in the same transaction (a `released`
  line, the same amount negative). If the server dies in between, the amount stays set aside: the request may
  have been billed. `ai_usage` is only ever added to; its sum is what has been spent plus what is still away.
- Every attempt is written to `ai_usage` afterwards — successes, provider errors, unreadable or wrong-shaped
  replies, refusals and time-outs — in thousandths of a cent. A timed-out request is counted at its worst case,
  because the provider may still bill it; a request the provider answered with an error status is counted at 0.
- Each request has an output-token cap, a 30-second time limit, and at most one more try, only after a 429 or a
  5xx, and only if the limits still allow (the second try sets its cost aside again, under the lock). Runs are
  limited to 4 a minute per household (counted in the database, so across instances), and one at a time on any
  one server.

## Provider terms and retention

Requests go to the chosen provider and are subject to **that provider's own terms and data-retention policy**.
HOMEBASE makes no promise about what the provider keeps or for how long, and does not claim zero retention. The
OpenAI request sets `store: false` (OpenAI's documentation says this stops the response being stored for later
retrieval; abuse-monitoring logs are separate). Read the providers' own pages:

- Anthropic: https://www.anthropic.com/legal/commercial-terms and https://www.anthropic.com/legal/privacy
- OpenAI: https://openai.com/policies/ and https://developers.openai.com/api/docs/guides/your-data

The parents' page names the provider and says this in plain words; it links to nothing (it is the grown-ups' side
only, and a plain mention of where to read the terms is enough).

**HOMEBASE's own keeping:** nothing of a prompt or reply is stored unless the parent switches on "keep what was sent
and what came back", in which case it is kept in `ai_proposals.transcript` with that draft and nowhere else. Prompts,
replies and keys are never logged; a failure logs only its kind (`[ai] anthropic routine_architect: http 500`).

## Safety design

- **Allow-list.** A draft can only ever hold `routine.create`, `task.create` or `shopping.edit`, and each job a
  subset of those (`server/ai/envelope.ts`, `shared/ai.ts` `AI_ALLOWED_OPS`). Nothing in `ledger.*`,
  `redemption.*`, `reward.*`, `profile.*`, `member.*`, `device.*`, `household.*`, `history.*` or `media.*` can
  survive, whatever the reply says. The allow-list is checked again when a draft is applied.
- **Deterministic validation.** Every change is completed by the server (fresh ids), checked against that
  operation's schema in `shared/ops.ts`, children mapped back from labels (unknown ones dropped), pictures checked
  against the registry (unknown ones dropped), stars clamped to at most 5, hazards found by `hazardsIn` forced to
  "with a grown-up" with a safety flag, new missions always `verification: 'guardian'`, web addresses and markup
  stripped from titles, a list item's own words never changed, and the number of changes capped. Everything dropped
  is listed in the draft with its reason. If nothing usable remains, the run fails cleanly and no draft is stored.
- **Evidence is HOMEBASE's.** A weekly-review observation must name one count (metric, child label, week, or a
  mission/routine reference); the server looks the count and its denominator up itself and drops observations it
  cannot find. Sentences that compare two children or use clinical words are removed.
- **Applying** goes through the normal operation runner (`server/ops/run.ts`) as the parent who taps, with its
  permission checks, validation, idempotency (operation ids derived from the draft's id and the change's index, so
  applying twice does it once) and audit (`ai.applied` in the audit log).
- **Untrusted text** is scrubbed and fenced, and the system prompt says it is data — but the defence is the
  validator above, which an injected instruction cannot get past.
- **One way out.** Both providers are called with a plain HTTPS request through the server's one injected `fetch`
  (`server/ai/provider.ts`), not through the providers' SDKs. That is a deliberate departure from the providers'
  own advice to prefer their SDKs: it keeps every outbound request on a single seam that tests replace and that
  `HOMEBASE_OFFLINE` closes, adds no dependency to a feature most households will never switch on, and pins the
  API by version header (`anthropic-version: 2026-10-21`). The price is that keeping up with the providers' APIs
  is this file's job; swapping either adapter for its SDK is a change to that one file.

Tests: `tests/server/ai.test.ts` (off by default, no key, wall and unlocked wall, helper/caregiver, categories,
what is sent, caps, usage recording for every outcome, invalid JSON, wrong shape, time out, one retry on 429,
prompt injection that tries `ledger.bonus`/`redemption.decide`/`member.role`, hazards, unknown pictures, apply
idempotency, dismissing, transcripts, other households, both providers' request shapes, the economist) and
`tests/server/ai-units.test.ts` (pricing, budget, anonymising, the envelope gate).

## The brief's eight jobs

| Job                          | State                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| Routine architect            | Built (`routine_architect`)                                                                 |
| Weekly reflection            | Built (`weekly_reflection`); experiments may come with a new routine or mission draft      |
| Shopping intelligence        | Built in part (`shopping_tidy`: aisles, pictures, quantities, possible duplicates); staples from history not built |
| Reward economist             | Built: deterministic simulation always; model explanation and price ideas in words only   |
| Schedule-aware mission planner | Not built                                                                                 |
| Learning bridge              | Not built                                                                                   |
| Family briefing              | Not built                                                                                   |
| Story/illustration scripts   | Not built                                                                                   |

## Verified / not verified

| What                                                                                 | State                                     |
| ------------------------------------------------------------------------------------ | ----------------------------------------- |
| All of the above behaviour, with both providers' HTTP APIs faked in tests            | Verified (automated tests)                |
| Anthropic request shape (Messages API, `output_config.format` json_schema, headers)  | Checked against the claude-api skill docs, 2026-11-26 |
| OpenAI request shape (Responses API, `text.format` json_schema strict, `store`)      | Checked against developers.openai.com docs, 2026-11-26 |
| A real, paid call to either provider                                                 | **Not run** — no key was available, and none was attempted |
| Whether each provider accepts every schema exactly as built (`anyOf`, enums)         | Not verified against a live API           |
