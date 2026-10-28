# Test log: building the live generator on Gemini's free tier

- **Date:** 2026-10-28
- **Who:** Claude Code (the coding agent used to build this project), with a free-tier Gemini API key created in AI Studio the same day. The key never appears in this log.
- **Why free tier:** the project was built under a zero-spend constraint. Claude via the Anthropic API was the original plan.

## What the docs said vs what the key could do

| Plan from docs | Docs said | Tested with a new key | Label |
|---|---|---|---|
| Research with Gemini 2.5 Flash + Google Search | Free, 500 grounded requests/day ([pricing page](https://ai.google.dev/gemini-api/docs/pricing)) | 404: "no longer available to new users". 2.5 Flash-Lite: the same. | tested |
| Search with Gemini 3 models instead | Grounding "Not available" in the free tier | 429 on 3.8 Flash, 3.6 Flash and 3.5 Flash-Lite with `google_search` | tested |
| Let Gemini read pages (URL context tool) | Supported, combinable with search | Works, but unreliable: 13 of 15 pages failed in one Notion run, including pages that loaded in an earlier probe | tested |
| Plain `fetch()` from the app's server | — | 8 of 8 provider pages loaded (Notion, Composio, Google, Discord, Meta), with redirects followed | tested |
| Write the guide with 3.8 Flash | Free | Hung until a 150 s timeout with no response; 3.6 Flash and 3.5 Flash-Lite answered in 9 to 14 s | tested |

**Lesson for the write-up.** Even for an LLM API, documentation and reality diverged three times in one afternoon. That is the brief's own thesis, so the generator is built not to trust model tools: code fetches the pages, and the model only reads what code hands it.

## Resulting design (`lib/generate/pipeline.ts`)

1. **Plan:** the model lists the official pages it believes exist, plus the docs hosts.
2. **Fetch:** plain code fetches those pages and each docs host's `llms.txt` index, then follows links that look relevant. Only pages that returned real text count as read. Duplicate HTML/Markdown copies are merged.
3. **Write:** the model drafts the guide as JSON against the schema, citing only page ids s1..sN.
4. **Check:** code decides each source's kind from its domain, downgrades over-claimed labels, and fixes references.

The fallback order is 3.6 Flash, then 3.5 Flash-Lite, on 503, 429, timeout or "no longer available".

## First successful run: Notion (36 s)

- 10 pages fetched (9 Notion, 1 Composio), 5 unreadable (404s for guessed URLs, and one JavaScript-rendered page). 23 claims: 21 documented, 2 unverified. The checker had nothing to correct.
- **Spot check:** the guide says Marketplace review takes "5–10 days" (documented, s4). Notion's marketplace-listing page says: "expect to hear back from our team within 5-10 business days". **Matched.** Its listed rejection reasons (brand/trademark, quality, baseline criteria) also match the page.
- **Weaknesses:**
  - Both access levels are typed "write", and there is no separate read-only level.
  - "Listed on Marketplace" is a distribution choice, not an access level.
  - Only 4 steps.
  - "days" loses "business".

## Quality pass (same day): what each failure taught, and the fix

| Run | Pages read | Quotes matched / downgraded | What happened | Fix it led to |
|---|---|---|---|---|
| Notion 1 | 10 | not checked | Verdict right; access levels wrong (two "write", Marketplace listed as a level); 4 steps | Prompt: levels = how much data, never distribution; optional programs become "if you ..." scale gates; full step sequence |
| Notion 2 | 10 | 25 / 1 | Read and Write levels; Marketplace as an optional gate; 6 steps. The gate was not attached to any level | Code: a gate no level claims is applied to every level (can only make a verdict stricter) |
| X 1 | 6 | 14 / 3 | Caught "AI-powered reply apps need prior approval" (developer guidelines). **Missed paid API access**: the pricing page was never fetched | Code: link picking takes turns across topics (connect, review, cost, rules, limits); nested llms.txt indexes are opened |
| X 2 | 7 | 23 / 1 | **Gated (paid_access) detected**: pay-per-use credits, a card on file blocks setup, a free-credit incentive. Missed the AI-reply rule this time, because the planner guessed the wrong docs host | Code: always try docs./developers./developer.<domain>/llms.txt *(not yet re-run)* |
| Zoom 1 | 4 | 15 / 0 | developers.zoom.us reset most connections from this machine. Writer stream ended empty (fixed: now falls back). Guide claimed "no approval wait" as **Documented** with no review page read | Code: coverage check. If no page about review or publishing was read, a zero wait becomes Unverified and an open question is added |
| Zoom 2 | 9 | 16 / 0 | Coverage check fired: 2 "no wait" claims marked Unverified; open questions ask about publishing review | — |

**What the code now verifies, beyond the schema:**
1. Every source is a page the code fetched; the model can't cite anything else.
2. Each source's kind is decided from its domain.
3. Each Documented or Reported claim's quote must appear word for word on the page it cites (64 of 69 checked quotes matched across the runs above).
4. "No wait" claims need a review page to have been read.
5. Gates and ids are consistent.

**Still weak:**
- Free-tier capacity often pushes the writer down to Flash-Lite, which produces thinner guides (fewer steps, empty scopes).
- Page discovery depends on the planner's URL guesses.
- Sites that block bots (Zoom from this connection) starve the guide. It now says so instead of guessing.
