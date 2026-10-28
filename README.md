# OAuth Approval Guides

Guides that tell a developer building an AI agent how hard it is to get an OAuth app ready with a provider, how long it takes (their own work vs waiting for approval), what can block approval, and which steps an agent can do for them. Look up an app in the library, or type any app and watch an agent research it and write a shareable guide in about a minute.

**Live:** _link added on deploy_ · **How we checked the guides:** `/checks` on the live site

## The problem, and the scope we chose

Composio gives developers managed OAuth apps, so prototypes work immediately. Production is different: to show your own brand on the consent screen, use custom scopes or get dedicated rate limits, you register your own OAuth app with each provider. Some providers then review it. That step is where developers stall, because the hard part isn't the console clicks (Composio's existing guides cover those). It's not knowing whether you face an hour of setup or weeks of review, and what will get you rejected.

So the scope is **the approval path, not the console walkthrough**:

1. **One guide format, organised around the developer's questions:**
   - Verdict
   - Before you start
   - Steps
   - Approval & blockers
   - Composio hookup
   - Evidence

   The provider's own step order doesn't set the structure. Library and generated guides share the exact same schema.
2. **Difficulty per access level, not per app.** "Sign in with Google" is self-serve; "read their calendar" needs verification. Each guide gives a verdict for each level, at launch and at scale. Picking a level filters the whole guide to what it needs.
3. **Evidence on every claim**, shown inline: Tested, Documented, Reported or Unverified, with a numbered source.
4. **A live generator** for apps outside the library. It is built so that code, not the model, decides what counts as evidence.

## What's in it

| | |
|---|---|
| **Library** | Discord (self-serve, then light review at 100 servers), Google Calendar (sensitive-scope verification), Instagram (gated: App Review plus Business Verification). The Instagram end-user flow was tested by hand; the rest is from provider docs. |
| **Live generator** | Type an app name or website. Progress streams live: which pages it planned, fetched or couldn't load, and what the checker corrected. The result is saved at a shareable `/g/<id>` link. |
| **Checks page** | A sample of claims checked against sources and setup attempts: what held up, what we corrected, what we couldn't verify, plus a run-by-run record of the generator. |

## Key decisions

- **Tiers come from gates, not from model judgement.** A guide lists the checks a provider applies: registration, policy URLs, domain, brand or identity verification, use-case review, security assessment, business verification, paid access, partner program. A fixed table maps each kind of check to a tier (Self-serve, Light review, Security review, Gated), and an access level's tier is its hardest gate. Changing a tier means changing that table in `lib/guide/tiers.ts`, visibly.
- **Time is split into your work vs the provider's wait, as ranges.** Unknown stays "Unknown"; an open-ended wait shows as "3+ days". Each number carries its source.
- **The generator is code-led.** Its pipeline:
  - **Plan:** the model suggests which official pages should exist.
  - **Fetch:** plain code fetches them, reads each docs site's `llms.txt` index and follows relevant links.
  - **Write:** the model writes the guide citing only pages code fetched (`s1..sN`).
  - **Check:** code checks the result.

  We started with the model's own search and page-reading tools. Testing showed they were unavailable or unreliable on the free tier (see Checks), so code took over everything that can be verified.
- **Code checks the agent's evidence:**
  - Every source must be a page our code actually fetched.
  - Code decides each source's kind (provider docs, Composio docs or community) from its domain.
  - Every Documented or Reported claim must quote its page, and code finds the quote word for word or downgrades the claim.
  - "No approval wait" can't be Documented unless a page about review or publishing was read.
  - Agent-written guides can never say Tested.
- **Steps say who does them:** Agent can do / Agent prepares, you submit / Only you can do.
- **Zero-cost stack.** Gemini's free tier, with automatic fallback between models when one is overloaded. Generated guides are cached for 14 days, and there's a daily cap.

## What was tested, what sources support, what's uncertain

- **Tested by hand:** connecting a real Instagram account through Composio's managed app (screenshots and a test log in `evidence/instagram/`). It showed Composio's branding twice and per-permission toggles on Meta's consent screen, which the docs we read don't mention.
- **Tested on the generator:** six runs across Notion, X and Zoom, each failure leading to a fix (`evidence/generator/`). 64 of 69 checked quotes matched their pages word for word.
- **From sources:** everything else, labelled Documented (provider or Composio page) or Reported (community), with links and access dates.
- **Uncertain**, and shown as open questions in the guides:
  - real approval wait times (providers publish typical figures or none);
  - which Google Calendar write scopes are sensitive vs restricted;
  - the exact Composio callback URL (doc versions disagree).

## Limitations

- **No developer-portal runs for Discord, Google or Meta.** Those guides are docs-only; checklists for the runs are in `docs/`. No provider approvals were completed.
- **Free-tier capacity varies.** When the stronger model is overloaded, a lighter one writes the guide, and those guides are thinner (fewer steps, missing scope names). A generation takes about 30–90 seconds.
- **Page discovery depends on the model's URL guesses** plus `llms.txt` indexes. Sites that block automated requests or render docs with JavaScript starve the guide. It then says what it couldn't read instead of guessing.
- **Generated guides aren't reviewed by a human** before they're shown; the checks above are the guardrail.

## Path to 100 apps

1. Generate first drafts for the 100 most requested toolkits. Composio's tool-request board and toolkit usage are the demand signal.
2. Rank by tier. Self-serve apps can ship as generated. Light review, Security review and Gated apps get a hand-checked portal run up to the first wall, because that's where developers lose weeks.
3. Re-run the generator on a schedule and diff against the stored guide. A changed threshold (like Discord's June 2026 intent-review change) becomes an alert, not a stale page.
4. Let developers report what actually happened ("approved in 4 days"), stored as Reported evidence, to replace guessed wait times with real ones.

## Run it locally

Requires Node 20+.

```bash
npm install
cp .env.example .env.local   # add GEMINI_API_KEY (free from aistudio.google.com)
npm run dev                  # http://localhost:3000
```

- Without Supabase, generated guides save to `.data/` locally.
- To store them in Supabase, run `supabase/oauth_guides.sql` in the SQL Editor and set `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. The table has row-level security with no policies, so only the server can read or write it.
- `npm run validate` checks every library guide against the schema and the evidence rules, and prints each verdict.
- `npm run schema` regenerates `schema/guide.schema.json` from the Zod source of truth.

**Deploy (Vercel):** import the repo and set `GEMINI_API_KEY`, `SUPABASE_URL` and `SUPABASE_SECRET_KEY` as environment variables. The generator route needs up to 300 seconds.

## Repository map

| Path | What |
|---|---|
| `lib/guide/schema.ts` | The guide schema (Zod); TypeScript types and the JSON schema derive from it |
| `lib/guide/tiers.ts` | Gate → tier table, per-level verdicts, integrity checks |
| `lib/generate/` | Live generator: plan, fetch, write, check (`pipeline.ts`, `fetch.ts`, `draft.ts`, `prompts.ts`) |
| `guides/` | Library guides (JSON) |
| `evidence/` | Screenshots and test logs behind every Tested claim; served at `/evidence/...` |
| `lib/checks.ts` | The sampled checks shown at `/checks` |
| `docs/` | Predicted paths and hands-on checklists per app |
| `app/`, `components/` | The Next.js site |
