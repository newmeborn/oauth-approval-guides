/**
 * The live generator: plan -> fetch -> write -> check. Server-only.
 *
 * 1. Plan (Gemini, no tools): which official pages should exist for this provider.
 * 2. Fetch (plain code): those pages, each docs host's llms.txt index, and relevant links found on
 *    them. Code decides what counts as read: only pages that came back with real text.
 * 3. Write (Gemini, JSON against the Draft schema): the guide, citing only the fetched pages.
 * 4. Check (code): assemble() pins sources to fetched pages with code-decided kinds; repair()
 *    downgrades over-claimed evidence; Guide + checkIntegrity confirm the result.
 *
 * Why the model doesn't search or browse itself (tested 2026-10-28 with a new free-tier key):
 * Gemini 2.5 Flash is closed to new users, Gemini 3 models refuse Google Search on the free tier
 * (429), and Gemini's URL-context reader failed on 13 of 15 pages that plain fetch() loaded fine.
 */
import { GoogleGenAI } from "@google/genai";
import { Guide } from "@/lib/guide/schema";
import { checkIntegrity } from "@/lib/guide/tiers";
import { verdictSentence } from "@/lib/guide/format";
import { loadLibrary } from "@/lib/guide/library";
import { Draft, Plan, assemble, checkCoverage, checkRestrictedScopes, repair, verifyQuotes, type RetrievedSource } from "./draft";
import { coversReview, englishUrl, fetchPage, isPublicHttpUrl, pool, relevantLinks, siteOf, type Page } from "./fetch";
import { toGeminiSchema } from "./geminiSchema";
import { PLAN_SYSTEM, STRUCTURE_SYSTEM, planInput, structureInput } from "./prompts";

// Free-tier models are often overloaded (503), so each call falls back down a list. Measured
// 2026-10-28: 3.6 Flash and 3.5 Flash-Lite answered in 9-14 s; 3.8 Flash hung until timeout,
// so it is left out by default.
const models = (env: string | undefined, fallback: string[]) => (env ? env.split(",").map((m) => m.trim()) : fallback);
export const PLAN_MODELS = models(process.env.GEMINI_PLAN_MODELS, ["gemini-3.6-flash", "gemini-3.5-flash-lite"]);
// 3.6 Flash writes noticeably fuller guides than Flash-Lite, so it gets a second try first.
export const WRITE_MODELS = models(process.env.GEMINI_WRITE_MODELS, ["gemini-3.6-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"]);
// Writing a full guide on an overloaded free model can take minutes; the whole request must
// still fit Vercel's 300-second function limit.
const PLAN_REQUEST = { timeout: 45_000, maxRetries: 0 };
const WRITE_REQUEST = { timeout: 230_000, maxRetries: 0 };
const FAST = { thinking_level: "low" } as const;
// The writer maps claims to pages and quotes them, which benefits from a little more thought.
const CAREFUL = { thinking_level: "medium" } as const;
const MAX_SEEDS = 21;
const MAX_FOLLOW = 8;
const MAX_PAGES = 12;
const MAX_INPUT_CHARS = 120_000;

/**
 * Policy pages code always reads for known providers: they decide the tier and a planner easily
 * misses them (Google's restricted-scope rules; Slack's 2025 rate limits for apps not approved
 * for its Marketplace). A team would grow this registry as guides get hand-checked.
 */
const POLICY_PAGES: Record<string, string[]> = {
  "google.com": [
    "https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification",
    "https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification",
  ],
  "slack.com": ["https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps"],
  "slack.dev": ["https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps"],
  // Product scope pages that list scopes under "Sensitive" / "Restricted" headings (read by checkRestrictedScopes).
  gmail: ["https://developers.google.com/workspace/gmail/api/auth/scopes"],
  "google-drive": ["https://developers.google.com/workspace/drive/api/guides/api-specific-auth"],
  googledrive: ["https://developers.google.com/workspace/drive/api/guides/api-specific-auth"],
};

/** Try each model in turn while the failure is capacity, not a real error. */
async function withFallback<T>(list: string[], run: (model: string) => Promise<T>): Promise<{ model: string; result: T }> {
  let last: unknown;
  for (const [i, model] of list.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, 2000)); // brief backoff before the next try
    try {
      return { model, result: await run(model) };
    } catch (err) {
      last = err;
      // Capacity and per-model quota errors: another model may still have room.
      if (!/503|429|RESOURCE_EXHAUSTED|quota|high demand|overloaded|UNAVAILABLE|timed? ?out|no longer available|Empty response/i.test(String(err)))
        throw err;
    }
  }
  throw last;
}

/** Progress events streamed to the browser, one JSON object per line. */
export type GenEvent =
  | { t: "stage"; stage: "research" | "structure" | "check" | "save"; message: string }
  | { t: "plan"; urls: string[] }
  | { t: "read"; urls: string[] }
  | { t: "unreadable"; urls: string[] }
  | { t: "sources"; sources: { url: string; title: string }[] }
  | { t: "writing"; chars: number }
  | { t: "check"; repairs: string[]; problems: string[] }
  | { t: "library"; path: string; name: string }
  | { t: "cached"; path: string; createdAt: string }
  | { t: "done"; path: string }
  | { t: "error"; message: string };

export interface Trace {
  query: string;
  models: { research: string; structure: string };
  planned: string[];
  reads: string[];
  /** "url — reason" */
  unreadable: string[];
  sources: RetrievedSource[];
  repairs: string[];
  problems: string[];
  tokens: { research: number | null; structure: number | null };
  durationMs: number;
}

export async function generateGuide(
  query: string,
  slug: string,
  emit: (e: GenEvent) => void,
): Promise<{ guide: Guide; trace: Trace }> {
  const started = Date.now();
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // ---------- 1. Plan ----------
  emit({ t: "stage", stage: "research", message: `Working out which of ${query}'s official pages to read` });
  const { model: planModel, result: planned } = await withFallback(PLAN_MODELS, (model) =>
    ai.interactions.create(
      {
        model,
        system_instruction: PLAN_SYSTEM,
        input: planInput(query),
        response_format: { type: "text", mime_type: "application/json", schema: toGeminiSchema(Plan) },
        generation_config: FAST,
      },
      PLAN_REQUEST,
    ),
  );
  const plan = Plan.safeParse(safeJson(planned.output_text));
  if (!plan.success) throw new Error("The planning step returned something unusable. Try again.");
  const p = plan.data;

  const providerSites = new Set(
    [p.website, p.developerPortalUrl, ...p.providerDomains.map(asUrl), ...p.docsHosts.map(asUrl)].map(siteOf).filter(Boolean),
  );
  const composioSlug = p.composioSlug.toLowerCase().replace(/[^a-z0-9_-]/g, "") || slug;
  const fromQuery = query.match(/\(([^)\s]+\.[^)\s]+)\)$/)?.[1];
  if (fromQuery) providerSites.add(siteOf(asUrl(fromQuery)));
  // Providers often own several domains (zoom.us and zoom.com, notion.so and notion.com); a domain
  // named after the app counts as the provider's even if the plan didn't list it.
  const ownDomain = (site: string) => providerSites.has(site) || site.split(".")[0] === slug.split("-")[0];
  const kindOf = (url: string): RetrievedSource["kind"] =>
    siteOf(url) === "composio.dev" ? "composio_doc" : ownDomain(siteOf(url)) ? "provider_doc" : "community";

  // The model's docs-host guesses vary between runs, so code also tries the usual docs hosts
  // for the provider's main domain; a 404 costs one cheap request.
  const mainSite = siteOf(p.website) || siteOf(p.developerPortalUrl);
  const conventionalIndexes = mainSite ? ["docs", "developers", "developer"].map((sub) => `https://${sub}.${mainSite}/llms.txt`) : [];
  const policyPages = unique([...providerSites, slug, slug.split("-")[0]].flatMap((key) => POLICY_PAGES[key] ?? []));
  const seeds = unique([
    ...(fromQuery ? [asUrl(fromQuery)] : []),
    ...policyPages,
    ...p.candidates.map((c) => c.url),
    p.developerPortalUrl,
    ...p.docsHosts.map((h) => `${asUrl(h).replace(/\/+$/, "")}/llms.txt`),
    ...conventionalIndexes,
    `https://docs.composio.dev/toolkits/${composioSlug}`,
    p.website,
  ])
    .filter(isPublicHttpUrl)
    .slice(0, MAX_SEEDS);
  emit({ t: "plan", urls: seeds });

  // ---------- 2. Fetch ----------
  emit({ t: "stage", stage: "research", message: `Fetching ${seeds.length} pages, then following the relevant links on them` });
  // Keyed without a trailing .md: many docs sites serve the same page as HTML and as Markdown
  // (llms.txt links to the .md). Keep one, preferring the Markdown, which has no navigation clutter.
  const pages = new Map<string, Page>();
  const keyOf = (url: string) => url.replace(/\.md$/, "").replace(/\/$/, "");
  const indexes: Page[] = []; // llms.txt files: used for links, not cited
  const unreadable: string[] = [];
  const tried = new Set<string>();

  const fetchAll = async (urls: string[]) => {
    await pool(urls, 6, async (url) => {
      tried.add(url);
      const r = await fetchPage(url);
      if (!r.ok) {
        unreadable.push(`${url} — ${r.reason}`);
        emit({ t: "unreadable", urls: [`${url} — ${r.reason}`] });
        return;
      }
      tried.add(r.page.url);
      if (/\/llms\.txt$/.test(new URL(r.page.url).pathname)) {
        indexes.push(r.page);
        return;
      }
      const key = keyOf(r.page.url);
      const existing = pages.get(key);
      if (existing && (existing.url.endsWith(".md") || !r.page.url.endsWith(".md"))) return;
      pages.set(key, r.page);
      if (!existing) emit({ t: "read", urls: [r.page.url] });
    });
  };

  await fetchAll(seeds);
  // Big docs sites split llms.txt into sub-indexes (docs.x.com links x-api/llms.txt, 370+ pages).
  const nested = unique(
    indexes.flatMap((ix) => ix.links.map((l) => l.href)).filter((h) => /\/llms\.txt$/.test(h) && providerSites.has(siteOf(h))),
  )
    .filter((h) => !tried.has(h))
    .slice(0, 3);
  if (nested.length) await fetchAll(nested);
  const linkPool = [...indexes, ...[...pages.values()].filter((pg) => kindOf(pg.url) === "provider_doc")].flatMap((pg) => pg.links);
  const follow = relevantLinks(linkPool, providerSites, tried)
    .filter((u) => !pages.has(keyOf(u)))
    .slice(0, MAX_FOLLOW);
  if (follow.length) {
    emit({ t: "stage", stage: "research", message: `Following ${follow.length} relevant links from the docs` });
    await fetchAll(follow);
  }

  // Registry policy pages first, then provider pages, then Composio, then anything else; within budget.
  const rank = { provider_doc: 1, composio_doc: 2, community: 3 } as const;
  const isPolicy = (url: string) => policyPages.some((u) => keyOf(englishUrl(u)) === keyOf(url));
  const order = (pg: Page) => (isPolicy(pg.url) ? 0 : rank[kindOf(pg.url)]);
  const chosen: (Page & { id: string })[] = [];
  let budget = MAX_INPUT_CHARS;
  for (const pg of [...pages.values()].sort((a, b) => order(a) - order(b))) {
    if (chosen.length >= MAX_PAGES || pg.text.length > budget) continue;
    budget -= pg.text.length;
    chosen.push({ ...pg, id: `s${chosen.length + 1}` });
  }
  if (chosen.length === 0)
    throw new Error(`Couldn't load any pages about ${query}. Check the spelling, or enter the app's website instead.`);
  const sources: RetrievedSource[] = chosen.map((pg) => ({ id: pg.id, url: pg.url, title: pg.title, kind: kindOf(pg.url) }));
  emit({ t: "sources", sources: sources.map(({ url, title }) => ({ url, title })) });

  // ---------- 3. Write ----------
  emit({ t: "stage", stage: "structure", message: `Writing the guide from ${chosen.length} pages` });
  const example = loadLibrary().find((g) => g.app.slug !== slug);
  const input = structureInput(query, chosen, unreadable, example ? JSON.stringify(example) : null);
  // The whole stream runs inside the fallback: free-tier streams sometimes end early with no text
  // and no error, and that should move on to the next model like any other capacity failure.
  const { model: writeModel, result: written } = await withFallback(WRITE_MODELS, async (model) => {
    const stream = await ai.interactions.create(
      {
        model,
        system_instruction: STRUCTURE_SYSTEM,
        input,
        response_format: { type: "text", mime_type: "application/json", schema: toGeminiSchema(Draft) },
        generation_config: CAREFUL,
        stream: true,
      },
      WRITE_REQUEST,
    );
    let json = "";
    let tokens: number | null = null;
    let lastEmit = 0;
    let status = "unknown";
    const t0 = Date.now();
    for await (const ev of stream) {
      if (ev.event_type === "error") throw new Error(ev.error?.message ?? "The writing step failed.");
      if (ev.event_type === "step.delta" && ev.delta.type === "text") {
        json += ev.delta.text;
        if (json.length - lastEmit > 2000) {
          lastEmit = json.length;
          emit({ t: "writing", chars: json.length });
        }
      }
      if (ev.event_type === "step.stop") tokens = ev.usage?.total_tokens ?? tokens;
      if (ev.event_type === "interaction.completed" || ev.event_type === "interaction.status_update")
        status = "interaction" in ev ? ev.interaction.status : ev.status;
    }
    const parsed = safeJson(json);
    if (parsed === null) {
      const why = `${model} stopped after ${json.length.toLocaleString()} characters (status ${status}, ${Math.round((Date.now() - t0) / 1000)}s)`;
      // Nothing at all is a capacity hiccup worth another model; a half-written guide is not.
      throw new Error(json.length === 0 ? `Empty response: ${why}` : `The guide was cut off: ${why}. Try again.`);
    }
    return { parsed, tokens };
  });
  const writeTokens = written.tokens;

  // ---------- 4. Check ----------
  emit({ t: "stage", stage: "check", message: "Checking every claim's evidence against the pages actually fetched" });
  const parsedJson = written.parsed;
  const draft = Draft.safeParse(parsedJson);
  if (!draft.success) {
    const first = draft.error.issues[0];
    throw new Error(`The draft didn't match the guide format (${first?.path.join(".") || "JSON"}: ${first?.message}). Try again.`);
  }
  const guide = assemble(draft.data, sources, slug);
  const providerPages = chosen.filter((pg) => kindOf(pg.url) === "provider_doc");
  const repairs = [
    ...verifyQuotes(guide, new Map(chosen.map((pg) => [pg.id, pg.text]))),
    ...checkCoverage(guide, coversReview(chosen)),
    ...checkRestrictedScopes(guide, providerPages, sources),
    ...repair(guide),
  ];
  // Code writes the verdict from the final gates; the model's sentence is the key point after it.
  guide.provenance.summary = `${verdictSentence(guide)} ${guide.provenance.summary}`.trim();
  const final = Guide.parse(guide);
  const problems = checkIntegrity(final);
  emit({ t: "check", repairs, problems });

  return {
    guide: final,
    trace: {
      query,
      models: { research: planModel, structure: writeModel },
      planned: seeds,
      reads: [...pages.values()].map((pg) => pg.url),
      unreadable,
      sources,
      repairs,
      problems,
      tokens: { research: planned.usage?.total_tokens ?? null, structure: writeTokens },
      durationMs: Date.now() - started,
    },
  };
}

function safeJson(text: string | undefined): unknown {
  try {
    return JSON.parse(text ?? "");
  } catch {
    return null;
  }
}

function asUrl(hostOrUrl: string): string {
  return /^https?:\/\//i.test(hostOrUrl) ? hostOrUrl : `https://${hostOrUrl.replace(/^\/+/, "")}`;
}

function unique(xs: string[]): string[] {
  return [...new Set(xs.filter(Boolean).map((x) => x.trim()))];
}
