# Google Calendar: predicted path (before hands-on run)

Written 2026-10-28 from Google's and Composio's docs. Machine-readable version: [guides/google-calendar.prediction.json](../guides/google-calendar.prediction.json).

## The prediction

**Hypothesis: sign-in is self-serve, but any Calendar access is "Light review" with an open-ended wait.**
- **Verification:** reading events is a sensitive scope (Google uses it as its own example). Before anyone outside your test users can connect, Google wants:
  - a domain you own, verified in Search Console
  - a privacy policy on that domain
  - a justification per scope
  - a demo video
- **Wait:** Google says verification "typically takes 3-5 business days". Forum reports describe stalls of eight weeks or more.
- **While you wait:** up to 100 test users, whose Calendar tokens expire every 7 days.

**The one thing the docs can't tell us.** Google's scope page doesn't say which Calendar *write* scopes are sensitive and which are restricted. One vendor guide calls `calendar.events` restricted; restricted means a paid security assessment and weeks more. The Cloud Console shows the classification when you add a scope. That screenshot settles the biggest open question in this guide.

## What to do in the run (stop at the first real gate)

Do every login and acceptance yourself. Screenshot into `evidence/google-calendar/`, naming each file `2026-10-28-NN-what-it-shows.png`.

1. **Create a project** in console.cloud.google.com and enable the Google Calendar API. Note any billing or terms prompts.
2. **Google Auth Platform → Get started.** Your product name, External audience. Screenshot each wizard page.
3. **Data Access → Add scopes.** Add `calendar.events.readonly`, `calendar.events.owned`, `calendar.app.created` and `calendar.events`. **Screenshot the table showing which are sensitive or restricted.** This is the highest-value screenshot of the run.
4. **Clients → Create OAuth client** (Web application). Before saving, open Composio's GOOGLECALENDAR "use your own credentials" auth config and copy its redirect URI exactly. Note whether it's `/api/v1/auth-apps/add` or a v3 callback. Don't paste the client secret anywhere we save.
5. **Audience page.** Screenshot the test-user limit and the Testing/In production status.
6. **Verification Center.** Open it and screenshot what it asks for (domain, privacy policy, video). **Don't submit**: without a live, verified domain it would only fail.
7. Optional: connect your own Google account through the custom auth config, and note the consent screen (your app name, and the "unverified app" warning).

## Prediction vs reality

**Not run for this submission.** The hands-on portal run was not done, so the guide stays docs-only (for Instagram, only the end-user side is tested). The table lists what a run would check.

| Claim | Predicted | Observed | Match? |
|---|---|---|---|
| Read scope is labelled sensitive | Yes (documented) | | |
| `calendar.events` classification | Unknown: sensitive or restricted | | |
| `calendar.app.created` classification | Unknown | | |
| Test user limit | 100 | | |
| Redirect URI Composio shows | v1 or v3 | | |
| Verification asks for domain, policy, video | Yes | | |
| Active effort to working test connection | 30–60 min | | |
