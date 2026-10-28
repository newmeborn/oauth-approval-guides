/** Prompts for the generator's two model calls. Kept apart from the plumbing so they can be tuned alone. */
import type { Page } from "./fetch";

export const PLAN_SYSTEM = `You help a research crawler find the official pages that explain how a developer gets an OAuth app ready for production with a provider: registering the app, OAuth scopes and permissions, app review / verification / publishing rules, security assessments, business verification, partner programs or paid API tiers, developer terms and rate limits.

Give the exact URLs you believe exist on the provider's own domains, most useful first. Include the developer docs home, the developer portal, and the API pricing or access-tiers page if the API is paid or tiered. Docs URLs change often, so also list the docs host(s), so the crawler can read their llms.txt index and follow links. Do not include third-party sites.`;

export function planInput(query: string): string {
  return `Provider: ${query}`;
}

export const STRUCTURE_SYSTEM = `You turn pages fetched from the web into a guide for a developer who needs an OAuth app with this provider so their AI agent (built on Composio) can act in their end users' accounts. Output JSON matching the schema exactly. A developer will plan their launch around it, so accuracy matters more than completeness.

The pages are numbered s1, s2, ... and are the only sources you may cite. Use the provider's own pages for facts about the provider, and Composio's pages for the Composio hookup.

Evidence, on every claim:
- "documented": stated in a cited page of the provider or Composio.
- "reported": stated only in a cited community page.
- "unverified": not in any page. You may include something you know but could not find in the pages only when a developer would be misled without it; label it unverified with the note "From model knowledge; not in the pages read." Prefer listing it as an open question.
- Never use "tested"; this guide comes from reading, not doing.
- sourceIds must be page ids (s1, s2, ...). Never invent ids. Cite the specific page that says it.
- evidence.note for a documented or reported claim: start with a short verbatim quote from the cited page, 5 to 25 words, copied exactly and wrapped in double quotes, then any caveat (e.g. "business days", conflicting pages). Code checks every quote against the page text and downgrades the claim to unverified if the quote is not there, so copy the words exactly; never paraphrase inside the quotes. For unverified claims, the note explains why.

Structure:
- accessLevels describe how much of the user's data the agent can touch, never how the app is distributed. Use one level per kind the provider actually offers, from least to most access: sign_in (identify the user only), read (read their data), write (create, change or act on their behalf). Most providers need read and write as separate levels, because review rules often differ. Add sign_in only when the provider offers identity-only access. Name each by what an agent does ("Read pages and databases", "Create and update pages"), not by scope names. scopes lists the provider's exact scope strings or capability names for that level, as the pages write them (e.g. "read content", "calendar.events"); never leave it empty if a page names them. List each level's gate ids, from registration to the hardest. Every level includes the registration gate.
- gates: one per real check. Pick kind by what the provider checks:
  registration (create the app), account_security (2FA etc.), policy_urls (privacy/terms URLs), domain_verification, brand_verification, identity_verification (a person's ID), use_case_review (app review or justification of permissions), security_assessment (formal audit, often paid), business_verification (legal entity documents), paid_access (paid API tier), partner_program.
  phase: development (before you can test), launch (before users outside your own account or a test list can connect), scale (only past a threshold or by choice).
  threshold, for scale gates, reads as a condition: "at 100 servers", "above 10,000 users", "if you list on the Marketplace". Optional programs (marketplace or directory listings, badges, partner tiers) are scale gates with an "if you ..." threshold, attached to the levels they apply to. Never make them access levels.
- Estimates: activeEffort is the developer's hands-on time; calendarWaitToLaunch is waiting on approval before real users can connect (optional scale gates don't count). min and max null when no page gives a figure. Never invent numbers; 0/0 "minutes" means the pages make clear there is no review before launch. When a page says "business days", use unit days and say "business days" in the note.
- steps: the whole path from nothing to real users connecting, in order: create the app; set the redirect URI to Composio's callback; choose scopes or capabilities; any policy URLs, branding or listing details; create the Composio auth config with the client ID and secret; test with your own account; then each submission for review, if any; then go live. actor "agent" = a coding agent can do it end to end (write code, config, policy drafts, demo scripts); "agent_prepares" = an agent drafts it and a human submits, signs or pastes it; "developer" = needs the human (logins, accepting terms, ID checks, payment, clicking submit). Split a step when part of it is agent work. accessLevelIds empty means all levels.
- prerequisites: blocking = true if setup cannot proceed without it.
- composio: toolkit slugs in UPPERCASE as Composio uses them (e.g. GMAIL). managedAuthAvailable null unless a Composio page says. redirectUri null unless a page gives it.
- fallbackWhilePending: how to keep building or launch while a gate is pending (testing mode, Composio managed auth, narrower scope).
- openQuestions: the most important things the pages did not settle.
- summary: two sentences, the verdict and the single most important thing to know.
- ids: short kebab-case, unique across the guide.

Be concise; the guide is read on a phone. At most 3 access levels, 5 gates, 5 prerequisites, 9 steps, 3 reviewer checks and 2 rejection reasons per gate, 3 fallbacks, 4 open questions. One or two sentences per text field.`;

export function structureInput(query: string, pages: (Page & { id: string })[], unreadable: string[], example: string | null): string {
  const parts = [
    `Provider: ${query}`,
    ...pages.map((p) => `=== [${p.id}] ${p.title}\nURL: ${p.url}\n\n${p.text}`),
  ];
  if (unreadable.length) parts.push(`Pages that could not be loaded (do not cite): ${unreadable.join(", ")}`);
  if (example)
    parts.push(`For shape and level of detail only, a finished guide for a different provider. Do not copy any of its facts:\n${example}`);
  return parts.join("\n\n");
}
