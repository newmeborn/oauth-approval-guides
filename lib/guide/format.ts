/** Display wording for schema enums and estimates. Pure, safe on server and client. */
import type { AccessLevel, Estimate, EvidenceLabel, GateKind, Guide } from "./schema";
import { TIER_LABEL, verdictFor, type Tier, type Verdict } from "./tiers";

export const EVIDENCE_TEXT: Record<EvidenceLabel, { label: string; meaning: string }> = {
  tested: { label: "Tested", meaning: "We did it ourselves; screenshot or test log attached." },
  documented: { label: "Documented", meaning: "An official provider or Composio page says so." },
  reported: { label: "Reported", meaning: "Community sources: forums, blogs, Stack Overflow." },
  unverified: { label: "Unverified", meaning: "Inference, or a source we could not read. Check before relying on it." },
};

export const TIER_MEANING: Record<Tier, string> = {
  self_serve: "Register and go live. No one reviews you.",
  light_review: "Someone checks your brand, domain, identity or use case. Usually days.",
  security_review: "A formal security assessment. Often weeks, sometimes paid.",
  gated: "Partner program, paid tier or business verification that can refuse you.",
};

export const ACTOR_TEXT = {
  agent: { label: "Agent can do", meaning: "An agent with access to your code and the provider's API can do this end to end." },
  agent_prepares: { label: "Agent prepares, you submit", meaning: "An agent drafts it; a human signs in, accepts terms or clicks submit." },
  developer: { label: "Only you can do", meaning: "Needs your identity, account, payment or judgment." },
} as const;

export const ACCESS_KIND_TEXT: Record<AccessLevel["kind"], string> = {
  sign_in: "Sign in",
  read: "Read data",
  write: "Write / act for the user",
};

export const PHASE_TEXT = {
  development: "Before you can test",
  launch: "Before launch",
  scale: "At scale",
} as const;

export const SOURCE_KIND_TEXT = {
  provider_doc: "Provider docs",
  provider_console: "Provider console",
  composio_doc: "Composio docs",
  composio_api: "Composio API",
  community: "Community",
  screenshot: "Screenshot",
  test_log: "Test log",
} as const;

const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ""));
const unitFor = (n: number, unit: Estimate["unit"]) => (n === 1 ? unit.replace(/s$/, "") : unit);

/** A range in the unit a developer plans in. Unknown stays "Unknown"; we never fill a gap with a guess. */
export function formatEstimate(e: Estimate): string {
  const { min, max, unit } = e;
  if (min === null && max === null) return "Unknown";
  if (min === 0 && max === 0) return "None";
  if (min !== null && max !== null) {
    if (min === max) return `${fmtNum(min)} ${unitFor(min, unit)}`;
    return `${fmtNum(min)}–${fmtNum(max)} ${unitFor(max, unit)}`;
  }
  if (min !== null) return `${fmtNum(min)}+ ${unitFor(min, unit)}`;
  return `Up to ${fmtNum(max!)} ${unitFor(max!, unit)}`;
}

/** When scale gates bite: "at 100 servers", "if you list on the Marketplace". Bare thresholds get "at". */
export function whenText(thresholds: (string | null)[]): string {
  const parts = thresholds.filter((t): t is string => !!t).map((t) => (/^(at|if|when|once|above|over|past|after|beyond|only)\b/i.test(t) ? t : `at ${t}`));
  return parts.length ? parts.join(", ") : "at scale";
}

/**
 * A "Self-serve" badge claims no one reviews you. When the guide couldn't confirm that (its
 * "no wait" claim is unverified), the badge must say so rather than look certain.
 */
export function tierUnconfirmed(level: AccessLevel, verdict: Verdict): boolean {
  return verdict.tierAtLaunch === "self_serve" && level.calendarWaitToLaunch.evidence.label === "unverified";
}

/**
 * The verdict as one sentence, written from the computed tiers, so a guide's summary can never
 * contradict its own badges. Generated guides put this in front of the writer's key point.
 */
export function verdictSentence(guide: Guide): string {
  const tails = guide.accessLevels.map((level) => {
    const v = verdictFor(guide, level);
    const why = v.bindingGates.filter((g) => g.kind !== "registration").map((g) => g.name);
    let tail = `${TIER_LABEL[v.tierAtLaunch]}${tierUnconfirmed(level, v) ? " (unconfirmed: no page about app review was read)" : ""} at launch`;
    if (why.length) tail += ` (${why.join(", ")})`;
    if (v.tierAtScale !== v.tierAtLaunch) tail += `, ${TIER_LABEL[v.tierAtScale]} ${whenText(v.scaleGates.map((g) => g.threshold))}`;
    return { name: level.name, tail };
  });
  if (!tails.length) return "";
  if (tails.every((t) => t.tail === tails[0].tail)) return `${tails.length > 1 ? "Every access level" : tails[0].name}: ${tails[0].tail}.`;
  return tails.map((t) => `${t.name}: ${t.tail}`).join(". ") + ".";
}

export function sourceNumbers(guide: Guide): Map<string, number> {
  return new Map(guide.sources.map((s, i) => [s.id, i + 1]));
}

/** Just the site, for link text that must fit a phone screen. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** "Hostname" for compact source display; falls back to the raw location for repo paths. */
export function shortLocation(location: string): string {
  try {
    const u = new URL(location);
    return u.hostname.replace(/^www\./, "") + (u.pathname === "/" ? "" : u.pathname);
  } catch {
    return location;
  }
}

export const GATE_KIND_TEXT: Record<GateKind, string> = {
  registration: "Registration",
  account_security: "Account security",
  policy_urls: "Policy URLs",
  domain_verification: "Domain verification",
  brand_verification: "Brand verification",
  identity_verification: "Identity verification",
  use_case_review: "Use-case review",
  security_assessment: "Security assessment",
  business_verification: "Business verification",
  paid_access: "Paid access",
  partner_program: "Partner program",
};

export const RESOLVE_TEXT = {
  test: "Test it",
  ask_provider: "Ask the provider",
  community: "Check community reports",
  ask_composio: "Ask Composio",
} as const;
