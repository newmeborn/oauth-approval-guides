# Discord: predicted path (before hands-on run)

Written 2026-10-28 from docs and web research only. Machine-readable version: [guides/discord.prediction.json](../guides/discord.prediction.json). This is what a docs-only agent concludes. Your run checks it, and the difference between the two is the first data point for the evaluation write-up.

## The prediction

**Hypothesis: Discord is self-serve for a post-only agent at launch, and the hard part is a usage threshold, not an approval.** You can register an app, add a bot, connect it through Composio and post to a team channel the same day, with no review. The wall is app verification at 100 servers. Every team that connects adds the bot to one more server, so for a team app that means about 100 teams. Past that point the team owner has to pass a Stripe government-ID check through a Developer Team, and no turnaround time is published.

**Why this matters.** Posting to a channel is not something a user OAuth token can do. The `DISCORD` toolkit has 28 actions and none of them sends a message. Posting needs a bot (`DISCORDBOT`), and a bot changes three things the developer has to know:

- **Who connects.** Only someone allowed to add apps to the server can install the bot, so a team admin or captain connects the team, not each player. This shapes a team app's onboarding.
- **What the server shows.** With Composio-managed auth, the bot sitting in the team's member list probably carries Composio's name. That is a stronger reason to go custom than a consent screen you see once (inference, still to test).
- **When the cap applies.** The 100-server limit counts servers the bot is in, not users, so it arrives earlier than people expect.

**What changed recently.** On 2026-06-10 Discord moved privileged-intent review from a 100-server threshold to more than 10,000 users, and made it annual. Most third-party guides still describe the old rule, so a live generator that trusts blogs will get this wrong. A post-only agent doesn't need Message Content. The intent only controls *receiving* message content, so it stays off.

| Access level | At launch | At scale | Active effort | Wait to launch |
|---|---|---|---|---|
| Sign in / identify | Self-serve | Self-serve | 15–45 min (unverified) | none (documented) |
| **Post to team channel** | Self-serve | Light review at 100 servers | 0.5–2 h (unverified) | none (documented) |
| Read channel messages | Self-serve | Light review at 100 servers; intent review above 10k users | 1–3 h (unverified) | none (documented) |

## What to do in the hands-on run (stop at the first real gate)

Do all logins, term acceptances and the Authorize click yourself. Screenshot each item into `evidence/discord/` and name each file after the step.

1. **Create the app** at discord.com/developers/applications. Check for a terms screen, and whether a verified email or phone is required. Time this step.
2. **OAuth2 page.** Find where the client ID, secret and Redirects are. Don't paste a redirect yet.
3. **Bot page.** Check whether Public Bot is on by default, find the three privileged-intent toggles, and see if they show the new 10,000-user wording.
4. **App Verification page.** Screenshot the eligibility checklist even though you aren't eligible. *This is the highest-value screenshot*: it turns the "unverified" requirements (privacy policy URL? terms URL?) into tested facts.
5. **Composio dashboard.** Start a DISCORDBOT auth config with your own credentials. Record which fields it asks for (bot token?) and the exact redirect URI it shows (v3 callback or legacy v1). Then register that URI in Discord.
6. **Test install.** Install into a server you own using `https://discord.com/oauth2/authorize?client_id=<ID>&scope=bot&permissions=3072`. Note what permission the install screen requires, then send one message via `DISCORDBOT_CREATE_MESSAGE`.
7. **Managed comparison (5 min).** Install via Composio-managed DISCORDBOT in the same server and screenshot the bot's name and avatar in the member list.
8. **API check.** Run `composio.toolkits.get("discordbot").composio_managed_auth_schemes` and `("discord")`, and save the output as a test log.

Don't create a team or start verification: the brief says stop at the first real gate, and moving an app to a team can't be undone.

## Prediction vs reality

**Not run for this submission.** The hands-on portal run was not done, so the guide stays docs-only (for Instagram, only the end-user side is tested). The table lists what a run would check.

| Claim | Predicted | Observed | Match? |
|---|---|---|---|
| No review before launch for posting | Yes | | |
| Install requires Manage Server | Likely | | |
| DISCORDBOT auth config asks for bot token | Unknown | | |
| Redirect URI shown by Composio | v3 or legacy v1 | | |
| Managed bot shows Composio branding | Likely | | |
| Verification checklist items | Team + Stripe ID; others unknown | | |
| Intent toggles mention 10k-user rule | Likely | | |
| Active effort to first message | 0.5–2 h | | |

## Open questions only Discord can answer

The guide's `openQuestions` lists all eight. Your run can't settle two of them. First, does posting through an incoming webhook (`webhook.incoming` scope, created per channel, no bot user) avoid the 100-server bot cap? If it does, that is a no-verification path for post-only agents, worth one line in the guide even unconfirmed. Second, how long does verification take in 2026? No official figure exists, so this stays "unknown" rather than an invented range.
