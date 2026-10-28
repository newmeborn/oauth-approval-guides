# Test log: Instagram via Composio-managed auth (end-user side)

- **Date:** 2026-10-28
- **Who:** the author, acting as an end user. A human did every login and clicked Allow.
- **What:** connected a test Instagram account to Composio's managed Instagram OAuth app from the Composio dashboard.
- **Not covered:** registering our own Meta developer app. That is the developer side, and it was not run for this submission.

## Flow observed

| # | Screen | Screenshot | What it shows |
|---|---|---|---|
| 1 | Composio Connect Link | `2026-10-28-01-composio-connect-link.png` | "Composio wants to connect to your Instagram". The end user sees Composio's branding first. |
| 2 | Meta reCAPTCHA | not published | Meta's login anti-bot check: part of login security, not an approval gate. Only a human can pass it. |
| 3 | Instagram email code | not published (shows account details) | Login verification code sent to the account's email. Also login security. |
| 4 | Instagram consent screen | not captured | "Composio-IG is requesting access to: [account]". Permissions: view profile and access media (required); comments, messages, publish content, insights (each can be switched off by the user). |
| 5 | Composio dashboard | `2026-10-28-05-composio-connected-account.png` | Connected account shown as "In use". Toolkit description: "Only supports Instagram Business and Creator accounts, not…" (truncated). |

## Findings (evidence label: tested, unless stated)

1. **The managed app is branded as Composio twice:** once on Composio's Connect Link, and again as "Composio-IG" on Instagram's own consent screen. This is the main reason to go custom.
2. **Composio's managed app requested publish, messaging, comments and insights permissions from an account with no role on the app.** At first we inferred that Composio had passed App Review for all of these (`unverified`). Composio's toolkit page later corrected that: some permissions aren't approved on the managed app, and "an owned Meta app is the current unblock path for production usage".
3. **Users can switch off every permission except basic profile.** A connection can succeed while publishing is off, so an agent has to check which permissions were actually granted before it tries to post.
4. **The Composio toolkit page says only Business and Creator accounts are supported** (`documented`, seen in the dashboard).
5. **The captcha and the email code are login security, not approval.** Mark these steps as end-user-only in any guide.

## Open from this run

- Publishing through the managed connection was not tested, because it would post publicly to a real account.
- What a personal (non-professional) account sees at the consent step was not tested.
