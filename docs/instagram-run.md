# Instagram: Meta portal run checklist

The guide is [guides/instagram.json](../guides/instagram.json). The end-user side is already tested (Composio's managed app). This run covers the developer side, up to the first real wall.

**Prediction:** Gated. Serving anyone else's account needs Advanced Access, which "requires App Review and Business Verification" (Meta overview). Before that, your own and your team's accounts work under Standard Access.

Do every login and acceptance yourself. Screenshot into `evidence/instagram/`, numbering from 06 and naming each file `2026-10-28-NN-what-it-shows.png`.

1. **Save screenshot 04 first**: the consent screen from the earlier test ("Composio-IG is requesting access to…").
2. **Create the app** at developers.facebook.com/apps. Record which use case and app type it asks for, and whether it makes you connect a business now or later.
3. **Add Instagram → API setup with Instagram login.** Screenshot the permissions it lists and whether each shows Standard or Advanced access.
4. **Business login settings.** Screenshot the fields: redirect URI, deauthorize callback, data deletion. Paste the redirect URI from Composio's INSTAGRAM "use your own credentials" auth config, and note whether it's v1 or v3.
5. **App settings → Basic.** Screenshot what's required (privacy policy URL, data deletion URL or callback, icon, category).
6. **App Review → Permissions and features.** Screenshot the request form for `instagram_business_content_publish`: what it asks for (screencast, instructions, API call count). **Don't submit.**
7. **Business Verification.** Open it and screenshot what it asks for. Stop there; don't upload documents.
8. Optional: connect your own professional account through the custom auth config under Standard Access, and note the consent screen (your app's name instead of "Composio-IG").

## Prediction vs reality

**Not run for this submission.** The hands-on portal run was not done, so the guide stays docs-only (for Instagram, only the end-user side is tested). The table lists what a run would check.

| Claim | Predicted | Observed | Match? |
|---|---|---|---|
| Advanced Access needs App Review + Business Verification | Yes (documented) | | |
| Business can be connected later, before publishing | Likely | | |
| Data deletion: instructions URL vs callback | Open | | |
| App Review asks for a screencast per permission | Yes (documented) | | |
| At least 1 successful API call before requesting | Yes (documented) | | |
| Redirect URI Composio shows | v1 or v3 | | |
