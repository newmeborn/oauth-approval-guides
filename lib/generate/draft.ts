/**
 * What the structuring model is asked to write, and how a draft becomes a Guide.
 *
 * The model never writes URLs, dates or provenance. Sources come only from what the research
 * step actually retrieved (numbered s1..sN), and the server fills in their titles and links.
 * After assembly, repair() enforces the evidence rules by downgrading over-claimed labels,
 * so a weaker model can't make a guide look better-sourced than it is.
 */
import { z } from "zod";
import { Guide, SCHEMA_VERSION, SourceKind, type Evidence, type Gate } from "@/lib/guide/schema";

export const DraftSource = z.strictObject({
  id: z.string().describe("One of the source ids you were given, e.g. 's3'. Never invent ids or URLs."),
  kind: SourceKind.exclude(["screenshot", "test_log"]).describe(
    "provider_doc: the provider's own developer docs or help center. provider_console: a page inside the provider's developer console. composio_doc: docs.composio.dev or composio.dev. community: anything else (forums, blogs, Stack Overflow, Reddit, news).",
  ),
});

export const Draft = Guide.omit({ schemaVersion: true, provenance: true, sources: true }).extend({
  summary: z.string().describe("Two sentences: overall verdict and the single most important thing to know."),
  sources: z.array(DraftSource).describe("Every source id you cite anywhere, with its kind."),
});
export type Draft = z.infer<typeof Draft>;

/** What the planning call returns: where the crawler should start. */
export const Plan = z.strictObject({
  appName: z.string().describe("The provider's official product name."),
  website: z.string().describe("Main website, as an https URL."),
  developerPortalUrl: z.string().describe("Where developers register apps, as an https URL."),
  providerDomains: z
    .array(z.string())
    .describe("Registrable domains the provider owns for its site and docs, e.g. ['notion.com', 'notion.so']."),
  docsHosts: z.array(z.string()).describe("Hostnames of the developer docs, e.g. ['developers.notion.com']."),
  composioSlug: z.string().describe("Best guess at the lowercase Composio toolkit slug, e.g. 'notion' or 'googlecalendar'."),
  candidates: z
    .array(z.strictObject({ url: z.string(), topic: z.string().describe("What this page should answer, in a few words.") }))
    .describe("Up to 12 official pages, most useful first."),
});
export type Plan = z.infer<typeof Plan>;

export interface RetrievedSource {
  id: string; // s1..sN
  url: string;
  title: string;
  /** Decided by code from the domain, so the model can't pass a blog off as official docs. */
  kind: "provider_doc" | "composio_doc" | "community";
}

const today = () => new Date().toISOString().slice(0, 10);

/** Draft + what was actually fetched -> a Guide the schema accepts. The model's own source kinds are ignored. */
export function assemble(draft: Draft, retrieved: RetrievedSource[], slug: string): Guide {
  const { summary, sources: listed, ...rest } = draft;

  const cited = new Set<string>(listed.map((s) => s.id));
  walkEvidence(rest, (e) => e.sourceIds.forEach((id) => cited.add(id)));

  const sources = retrieved
    .filter((s) => cited.has(s.id))
    .map((s) => ({ id: s.id, kind: s.kind, title: s.title, location: s.url, accessedOn: today() }));

  return {
    schemaVersion: SCHEMA_VERSION,
    app: { ...rest.app, slug },
    provenance: { generatedBy: "agent", lastChecked: today(), summary },
    accessLevels: rest.accessLevels,
    prerequisites: rest.prerequisites,
    steps: rest.steps,
    gates: rest.gates,
    fallbackWhilePending: rest.fallbackWhilePending,
    composio: rest.composio,
    sources,
    openQuestions: rest.openQuestions,
  };
}

const DOCUMENTED = new Set(["provider_doc", "provider_console", "composio_doc", "composio_api"]);

/**
 * "No approval wait" is a claim about something not existing, so a quote can't prove it. If no
 * page about review or publishing was read, the claim is downgraded and the gap becomes an
 * open question, instead of the guide sounding easier than it may be.
 */
export function checkCoverage(guide: Guide, readReviewPage: boolean): string[] {
  if (readReviewPage) return [];
  let n = 0;
  for (const level of guide.accessLevels) {
    const w = level.calendarWaitToLaunch;
    if (w.min === 0 && w.max === 0 && w.evidence.label !== "unverified") {
      w.evidence.label = "unverified";
      w.evidence.note = "Checker: none of the pages read covers app review or publishing, so a zero wait isn't confirmed.";
      n++;
    }
  }
  const asked = guide.openQuestions.some((q) => /review|publish|approv/i.test(q.question));
  if (!asked)
    guide.openQuestions.unshift({
      question: `Does ${guide.app.name} review or approve apps before users outside your own account can connect?`,
      whyItMatters: "No page about app review or publishing could be read, and a review would add calendar time before launch.",
      howToResolve: "ask_provider",
    });
  return n ? [`Marked ${n} "no approval wait" claim(s) Unverified: no page about app review or publishing was read.`] : [];
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * The writer must open each documented or reported note with a verbatim quote from the cited page.
 * Code looks for that quote in the text it fetched; a quote that isn't there means the claim isn't
 * supported by its citation, so the claim is downgraded to unverified. Claims with no quote are
 * counted but left alone.
 */
export function verifyQuotes(guide: Guide, textById: Map<string, string>): string[] {
  const pages = new Map([...textById].map(([id, text]) => [id, norm(text)]));
  let verified = 0;
  let notFound = 0;
  let unquoted = 0;
  walkEvidence(guide, (e) => {
    if (e.label !== "documented" && e.label !== "reported") return;
    const quote = e.note?.match(/["“]([^"”]{12,500})["”]/)?.[1];
    if (!quote) {
      unquoted++;
      return;
    }
    // Allow elided quotes ("a ... b"): every fragment of 3+ words must appear on one cited page.
    const parts = quote
      .split(/\.\.\.|…/)
      .map(norm)
      .filter((p) => p.split(" ").length >= 3);
    const onPage = (id: string) => parts.every((p) => pages.get(id)?.includes(p));
    if (parts.length && e.sourceIds.some(onPage)) {
      verified++;
      return;
    }
    notFound++;
    e.note = `${e.note} (Checker: these words are not on the cited page.)`;
    e.label = "unverified";
  });
  const notes = [`Matched ${verified} quote(s) word for word against the pages they cite.`];
  if (notFound) notes.push(`Downgraded ${notFound} claim(s) to Unverified: the quoted words are not on the cited page.`);
  if (unquoted) notes.push(`${unquoted} cited claim(s) gave no quote to check.`);
  return notes;
}

/**
 * Make the guide pass checkIntegrity by fixing, never by inventing. Returns what it changed,
 * shown to the reader as "what the checker corrected".
 */
export function repair(guide: Guide): string[] {
  const notes: string[] = [];
  const kinds = new Map(guide.sources.map((s) => [s.id, s.kind]));
  const tally = { droppedRefs: 0, testedDown: 0, documentedDown: 0, reportedDown: 0 };

  walkEvidence(guide, (e) => {
    const known = e.sourceIds.filter((id) => kinds.has(id));
    tally.droppedRefs += e.sourceIds.length - known.length;
    e.sourceIds = known;
    const ks = known.map((id) => kinds.get(id)!);
    const downgrade = (to: Evidence["label"], why: string) => {
      e.note = e.note ? `${e.note} (Checker: ${why})` : `Checker: ${why}`;
      e.label = to;
    };
    if (e.label === "tested") {
      tally.testedDown++;
      downgrade(ks.some((k) => DOCUMENTED.has(k)) ? "documented" : ks.length ? "reported" : "unverified", "an agent cannot claim tested.");
    }
    if (e.label === "documented" && !ks.some((k) => DOCUMENTED.has(k))) {
      tally.documentedDown++;
      downgrade(ks.length ? "reported" : "unverified", "no official provider or Composio source cited.");
    }
    if (e.label === "reported" && ks.length === 0) {
      tally.reportedDown++;
      downgrade("unverified", "no source cited.");
    }
  });
  if (tally.droppedRefs) notes.push(`Removed ${tally.droppedRefs} citation(s) to sources the research never retrieved.`);
  if (tally.testedDown) notes.push(`Downgraded ${tally.testedDown} claim(s) labelled Tested: an agent only reads, it doesn't test.`);
  if (tally.documentedDown) notes.push(`Downgraded ${tally.documentedDown} claim(s) from Documented: they cited no official page.`);
  if (tally.reportedDown) notes.push(`Downgraded ${tally.reportedDown} claim(s) from Reported to Unverified: no source cited.`);

  // Unique ids across the guide (the model sometimes reuses an id across sections).
  const seen = new Set(guide.sources.map((s) => s.id));
  const renames = new Map<string, string>();
  const dedupe = (xs: { id: string }[], prefix: string) =>
    xs.forEach((x) => {
      if (seen.has(x.id)) {
        const next = `${prefix}-${x.id}`;
        renames.set(x.id, next);
        x.id = next;
      }
      seen.add(x.id);
    });
  dedupe(guide.gates, "gate");
  dedupe(guide.accessLevels, "level");
  dedupe(guide.prerequisites, "pre");
  dedupe(guide.steps, "step");
  if (renames.size) notes.push(`Renamed ${renames.size} duplicate id(s).`);

  const gateIds = new Set(guide.gates.map((g) => g.id));
  const levelIds = new Set(guide.accessLevels.map((a) => a.id));
  let dangling = 0;
  const keep = (ids: string[], valid: Set<string>) => {
    const ok = ids.filter((id) => valid.has(id));
    dangling += ids.length - ok.length;
    return ok;
  };
  guide.accessLevels.forEach((a) => (a.gateIds = keep(a.gateIds, gateIds)));
  guide.prerequisites.forEach((p) => (p.accessLevelIds = keep(p.accessLevelIds, levelIds)));
  guide.steps.forEach((s) => {
    s.accessLevelIds = keep(s.accessLevelIds, levelIds);
    if (s.gateId && !gateIds.has(s.gateId)) {
      s.gateId = null;
      dangling++;
    }
  });
  guide.composio.toolkits.forEach((t) => (t.accessLevelIds = keep(t.accessLevelIds, levelIds)));
  if (dangling) notes.push(`Dropped ${dangling} reference(s) to ids that don't exist.`);

  // Every access level starts with registering the app; the tier rule depends on it.
  let registration = guide.gates.find((g) => g.kind === "registration");
  const missing = guide.accessLevels.filter((a) => !a.gateIds.some((id) => guide.gates.find((g) => g.id === id)?.kind === "registration"));
  if (missing.length) {
    if (!registration) {
      registration = {
        id: "register-app",
        kind: "registration",
        name: "Register the OAuth app",
        phase: "development",
        threshold: null,
        description: "Create the app in the provider's developer portal to get a client ID and secret.",
        startUrl: guide.app.developerPortalUrl || null,
        typicalWait: null,
        cost: null,
        reviewerChecks: [],
        rejectionReasons: [],
        evidence: { label: "unverified", sourceIds: [], note: "Checker: added because every OAuth app starts with registration." },
      } satisfies Gate;
      guide.gates.unshift(registration);
    }
    missing.forEach((a) => a.gateIds.unshift(registration!.id));
    notes.push(`Linked the registration gate to ${missing.length} access level(s) that skipped it.`);
  }

  // A gate no level claims would never reach a verdict. Attach it everywhere: that can only make
  // a verdict stricter, never more optimistic.
  const claimed = new Set(guide.accessLevels.flatMap((a) => a.gateIds));
  const orphans = guide.gates.filter((g) => !claimed.has(g.id));
  if (orphans.length && guide.accessLevels.length) {
    guide.accessLevels.forEach((a) => a.gateIds.push(...orphans.map((g) => g.id)));
    notes.push(`Applied ${orphans.length} gate(s) that no access level referenced to every level, to stay on the safe side.`);
  }

  guide.gates.forEach((g) => {
    if (g.phase === "scale" && !g.threshold) g.threshold = "usage threshold not stated";
  });

  walkEstimates(guide, (est) => {
    if (est.min !== null && est.max !== null && est.min > est.max) [est.min, est.max] = [est.max, est.min];
  });

  return notes;
}

/** Visit every Evidence object, wherever it sits in the guide. */
function walkEvidence(node: unknown, fn: (e: Evidence) => void): void {
  if (Array.isArray(node)) return node.forEach((n) => walkEvidence(n, fn));
  if (!node || typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  if (typeof o.label === "string" && Array.isArray(o.sourceIds) && "note" in o) {
    fn(o as unknown as Evidence);
    return;
  }
  Object.values(o).forEach((v) => walkEvidence(v, fn));
}

function walkEstimates(node: unknown, fn: (e: { min: number | null; max: number | null }) => void): void {
  if (Array.isArray(node)) return node.forEach((n) => walkEstimates(n, fn));
  if (!node || typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  if ("min" in o && "max" in o && "unit" in o) fn(o as { min: number | null; max: number | null });
  Object.values(o).forEach((v) => walkEstimates(v, fn));
}
