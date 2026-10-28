/**
 * The sample of guidance we checked against real sources or setup attempts, and what came of it.
 * Rendered at /checks. Update a row when a hands-on run settles it.
 */

export type CheckMethod = "hands_on" | "source" | "generator";
export type CheckResult = "confirmed" | "discovered" | "corrected" | "unverifiable" | "pending";

export interface Check {
  app: string;
  claim: string;
  method: CheckMethod;
  result: CheckResult;
  detail: string;
  links: { label: string; href: string }[];
}

export const METHOD_TEXT: Record<CheckMethod, string> = {
  hands_on: "Hands-on test",
  source: "Checked against the source",
  generator: "Live generator run",
};

export const RESULT_TEXT: Record<CheckResult, string> = {
  confirmed: "Confirmed",
  discovered: "Found by testing",
  corrected: "Corrected",
  unverifiable: "Couldn't verify",
  pending: "Pending hands-on run",
};

export const CHECKS: Check[] = [
  // Caught in a pre-submission review of the live site; each fix is in code, then the guide was regenerated.
  {
    app: "Gmail (generated)",
    claim: "Reading and modifying email is Light review.",
    method: "source",
    result: "corrected",
    detail:
      "Caught in a pre-submission review. Google's Gmail scope page lists gmail.readonly and gmail.modify under \"Restricted scopes\", and Google says apps reaching restricted data through a third-party server \"must undergo an annual security assessment by a Google-approved third party.\" A code check now reads scope pages' headings and adds the security-review gate itself; the regenerated guide rates both levels Security review.",
    links: [
      { label: "Gmail API scopes", href: "https://developers.google.com/workspace/gmail/api/auth/scopes" },
      { label: "Google: restricted scope verification", href: "https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification" },
    ],
  },
  {
    app: "Slack (generated)",
    claim: "Reading message history is self-serve.",
    method: "source",
    result: "corrected",
    detail:
      "Caught in a pre-submission review and confirmed in Slack's changelog: since May 29, 2025, commercially distributed apps not approved for the Slack Marketplace get 1 request per minute and at most 15 objects from conversations.history and conversations.replies. The generator now always reads that page for Slack, and the regenerated guide rates reading history Light review (Marketplace approval).",
    links: [{ label: "Slack changelog", href: "https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps" }],
  },
  {
    app: "X (generated)",
    claim: "\"You can launch your X integration immediately\", in a guide whose badges said Gated.",
    method: "generator",
    result: "corrected",
    detail:
      "The model wrote both the summary and the gates, and they disagreed. Now code writes the verdict sentence from the computed tiers and the model adds only the key point, so a summary can't contradict its badges. X's pricing page is also always read, because pricing decides X's tier.",
    links: [{ label: "X pricing", href: "https://docs.x.com/x-api/getting-started/pricing" }],
  },
  {
    app: "Zoom (generated)",
    claim: "A Self-serve badge while the \"no review\" claim was Unverified.",
    method: "generator",
    result: "corrected",
    detail:
      "The badge looked more certain than its evidence. It now reads \"Self-serve · unconfirmed\" whenever no page about app review was read. The same review found the fetcher had received some Google pages in Korean and Hindi; it now asks for English, and the rerun read Zoom's publishing pages and rated managing meetings Light review.",
    links: [],
  },
  {
    app: "Instagram",
    claim: "Composio's managed app shows Composio's branding to your users, which is the main reason to bring your own app.",
    method: "hands_on",
    result: "confirmed",
    detail: "Connecting a real account showed Composio's connect page, then \"Composio-IG is requesting access\" on Instagram's own consent screen: branded twice.",
    links: [
      { label: "Test log", href: "/evidence/instagram/2026-10-28-managed-connect.md" },
      { label: "Screenshot", href: "/evidence/instagram/2026-10-28-01-composio-connect-link.png" },
    ],
  },
  {
    app: "Instagram",
    claim: "End users can switch off individual permissions on the consent screen.",
    method: "hands_on",
    result: "discovered",
    detail: "Not in the docs I read. Everything except basic profile had a toggle, so a connection can succeed with publishing off. The guide now tells you to check granted permissions before posting.",
    links: [{ label: "Test log", href: "/evidence/instagram/2026-10-28-managed-connect.md" }],
  },
  {
    app: "Instagram",
    claim: "My inference: Composio's managed app has passed Meta App Review for publishing and messaging.",
    method: "source",
    result: "corrected",
    detail: "Composio's own toolkit page says some permissions (e.g. replying to comments) aren't approved on the managed app and that \"an owned Meta app is the current unblock path for production usage.\" The guide now says so.",
    links: [{ label: "Composio Instagram toolkit", href: "https://docs.composio.dev/toolkits/instagram" }],
  },
  {
    app: "Instagram",
    claim: "Only Business and Creator accounts can connect.",
    method: "source",
    result: "confirmed",
    detail: "Stated in Composio's toolkit page and its dashboard, and consistent with Meta's overview (professional accounts only).",
    links: [
      { label: "Dashboard screenshot", href: "/evidence/instagram/2026-10-28-05-composio-connected-account.png" },
      { label: "Meta overview", href: "https://developers.facebook.com/documentation/instagram-platform/overview" },
    ],
  },
  {
    app: "Discord",
    claim: "Privileged-intent review starts at 100 servers.",
    method: "source",
    result: "corrected",
    detail: "Discord changed the threshold on 2026-06-10 to more than 10,000 users, with annual reapplication. Most third-party guides still say 100 servers, so an agent that trusts blogs gets this wrong.",
    links: [{ label: "Discord guide", href: "/guides/discord" }],
  },
  {
    app: "Google Calendar",
    claim: "Which Calendar write scopes are sensitive vs restricted.",
    method: "source",
    result: "unverifiable",
    detail: "Google's scope page doesn't say, and vendor guides disagree (one calls calendar.events restricted, which would add a paid security assessment). The Cloud Console shows it when you add a scope, but no portal run was done for this submission, so the guide keeps it as its top open question.",
    links: [{ label: "Google Calendar guide", href: "/guides/google-calendar" }],
  },
  {
    app: "Google Calendar",
    claim: "Verification takes 3-5 business days.",
    method: "source",
    result: "unverifiable",
    detail: "That is Google's stated typical time, but developers report reviews stalled for 8+ weeks in 2026. The guide shows the wait as open-ended (\"3+ days\") rather than a tidy range.",
    links: [
      { label: "Google: sensitive scope verification", href: "https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification" },
      { label: "Forum report", href: "https://discuss.google.dev/t/oauth-data-access-verification-stuck-under-review-for-8-weeks-sensitive-scope-only-spreadsheets-no-trust-safety-contact/375352" },
    ],
  },
  {
    app: "All apps",
    claim: "The redirect URI to register with each provider.",
    method: "source",
    result: "unverifiable",
    detail: "Composio's docs disagree across versions (/api/v1/auth-apps/add vs v3 callback paths). Guides tell you to copy it from the auth config screen rather than trusting either doc; no portal run confirmed which one it shows.",
    links: [],
  },
  {
    app: "Notion (generated)",
    claim: "Marketplace listing review takes 5-10 days.",
    method: "generator",
    result: "confirmed",
    detail: "Notion's page says \"expect to hear back from our team within 5-10 business days.\" The generator's listed rejection reasons (brand/trademark, quality, baseline criteria) also match the page.",
    links: [{ label: "Notion: marketplace listing", href: "https://developers.notion.com/guides/get-started/marketplace-listing" }],
  },
  {
    app: "X (generated)",
    claim: "X's API is self-serve.",
    method: "generator",
    result: "corrected",
    detail: "The first run never fetched the pricing page and missed paid access entirely. After changing how the crawler picks links (topics take turns, so a pricing page always gets a slot), the next run found pay-per-use credits and rated X Gated.",
    links: [{ label: "X pricing", href: "https://docs.x.com/x-api/getting-started/pricing" }],
  },
  {
    app: "Zoom (generated)",
    claim: "No approval wait before launch.",
    method: "generator",
    result: "corrected",
    detail: "Zoom's developer site reset most connections, so no page about publishing was read, yet the generator labelled \"no wait\" as Documented. A new code check now marks such claims Unverified and adds an open question when no review page was read.",
    links: [],
  },
  {
    app: "Generator",
    claim: "Quotes behind Documented claims appear on the cited page.",
    method: "generator",
    result: "confirmed",
    detail: "Code looks for each quote word for word in the fetched page: 64 of 69 matched across five runs; the other 5 were downgraded to Unverified automatically, including a planted fake quote in testing.",
    links: [],
  },
  {
    app: "Gemini (the generator's own stack)",
    claim: "Gemini 2.5 Flash offers free Google Search grounding.",
    method: "hands_on",
    result: "corrected",
    detail: "Google's pricing page says so, but a new key gets \"no longer available to new users\"; newer models refuse search on the free tier, and Gemini's page reader failed on 13 of 15 pages. So code fetches pages itself and the model only reads them.",
    links: [{ label: "Gemini pricing", href: "https://ai.google.dev/gemini-api/docs/pricing" }],
  },
];

/** One row per live-generator run during development, from evidence/generator/. */
export const RUNS = [
  { run: "Notion 1", pages: 10, quotes: "not checked yet", outcome: "Right verdict; access levels muddled (Marketplace listed as a level)" },
  { run: "Notion 2", pages: 10, quotes: "25 matched, 1 downgraded", outcome: "Read and Write levels; Marketplace as an optional review" },
  { run: "X 1", pages: 6, quotes: "14 matched, 3 downgraded", outcome: "Found the AI-reply approval rule; missed paid access" },
  { run: "X 2", pages: 7, quotes: "23 matched, 1 downgraded", outcome: "Gated: pay-per-use credits detected" },
  { run: "Zoom 1", pages: 4, quotes: "15 matched", outcome: "Wrongly Documented \"no wait\"; led to the coverage check" },
  { run: "Zoom 2", pages: 9, quotes: "16 matched", outcome: "\"No wait\" marked Unverified; asks about publishing review" },
  // Final runs, after the fixes from the pre-submission review.
  { run: "Gmail (final)", pages: 17, quotes: "32 matched, 3 downgraded", outcome: "Security review at launch: restricted scopes" },
  { run: "Slack (final)", pages: 16, quotes: "13 matched", outcome: "Reading history needs Marketplace approval (rate limits)" },
  { run: "Zoom (final)", pages: 12, quotes: "27 matched, 2 downgraded", outcome: "Publishing review found; managing meetings is Light review" },
  { run: "X (final)", pages: 10, quotes: "22 matched, 2 downgraded", outcome: "Gated: credit purchase; AI-reply approval for posting" },
  { run: "Notion (final)", pages: 12, quotes: "21 matched", outcome: "Self-serve; Light review only if listed on the Marketplace" },
];
