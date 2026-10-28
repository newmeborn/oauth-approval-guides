/**
 * Tier rules and the integrity checks the JSON schema can't express.
 *
 * Tier = the hardest gate an access level must pass, by a fixed table. Two tiers are
 * reported per access level: at launch (development + launch gates) and at scale (all gates),
 * because several providers are self-serve until a usage threshold and then are not.
 */
import type { AccessLevel, Evidence, Gate, GateKind, Guide } from "./schema";

export const TIERS = ["self_serve", "light_review", "security_review", "gated"] as const;
export type Tier = (typeof TIERS)[number];

export const TIER_LABEL: Record<Tier, string> = {
  self_serve: "Self-serve",
  light_review: "Light review",
  security_review: "Security review",
  gated: "Gated",
};

/** The whole rule. Changing a tier means changing this table, visibly, not a prompt. */
export const GATE_TIER: Record<GateKind, Tier> = {
  registration: "self_serve",
  account_security: "self_serve",
  policy_urls: "self_serve",
  domain_verification: "light_review",
  brand_verification: "light_review",
  identity_verification: "light_review",
  use_case_review: "light_review",
  security_assessment: "security_review",
  business_verification: "gated",
  paid_access: "gated",
  partner_program: "gated",
};

const rank = (t: Tier) => TIERS.indexOf(t);

export function tierOf(gates: Gate[]): Tier {
  return gates.reduce<Tier>((worst, g) => {
    const t = GATE_TIER[g.kind];
    return rank(t) > rank(worst) ? t : worst;
  }, "self_serve");
}

export interface Verdict {
  accessLevelId: string;
  tierAtLaunch: Tier;
  tierAtScale: Tier;
  /** Gates that only bite past a threshold, so the UI can say "self-serve until 100 servers". */
  scaleGates: Gate[];
  /** The gates that set tierAtLaunch, for "why this tier?" */
  bindingGates: Gate[];
}

export function verdictFor(guide: Guide, level: AccessLevel): Verdict {
  const gates = level.gateIds.map((gid) => guide.gates.find((g) => g.id === gid)).filter((g): g is Gate => !!g);
  const launchGates = gates.filter((g) => g.phase !== "scale");
  const tierAtLaunch = tierOf(launchGates);
  return {
    accessLevelId: level.id,
    tierAtLaunch,
    tierAtScale: tierOf(gates),
    scaleGates: gates.filter((g) => g.phase === "scale"),
    bindingGates: launchGates.filter((g) => GATE_TIER[g.kind] === tierAtLaunch),
  };
}

// ---------- Integrity ----------

const TESTED_KINDS = new Set(["screenshot", "test_log"]);
const DOCUMENTED_KINDS = new Set(["provider_doc", "provider_console", "composio_doc", "composio_api"]);

/** Returns human-readable problems; empty means the guide is internally consistent. */
export function checkIntegrity(guide: Guide): string[] {
  const problems: string[] = [];

  const ids = new Map<string, string>();
  const register = (kind: string, xs: { id: string }[]) =>
    xs.forEach((x) => {
      if (ids.has(x.id)) problems.push(`Duplicate id '${x.id}' (${ids.get(x.id)} and ${kind}).`);
      ids.set(x.id, kind);
    });
  register("source", guide.sources);
  register("gate", guide.gates);
  register("access level", guide.accessLevels);
  register("prerequisite", guide.prerequisites);
  register("step", guide.steps);

  const expect = (where: string, ref: string, kind: string) => {
    if (ids.get(ref) !== kind) problems.push(`${where}: '${ref}' is not a known ${kind}.`);
  };

  const sourcesById = new Map(guide.sources.map((s) => [s.id, s]));
  const checkEvidence = (where: string, e: Evidence) => {
    e.sourceIds.forEach((s) => expect(where, s, "source"));
    const kinds = e.sourceIds.map((s) => sourcesById.get(s)?.kind).filter(Boolean) as string[];
    if (e.label === "tested") {
      if (guide.provenance.generatedBy === "agent")
        problems.push(`${where}: agent-generated guides cannot claim 'tested'.`);
      if (!kinds.some((k) => TESTED_KINDS.has(k))) problems.push(`${where}: 'tested' needs a screenshot or test_log source.`);
    }
    if (e.label === "documented" && !kinds.some((k) => DOCUMENTED_KINDS.has(k)))
      problems.push(`${where}: 'documented' needs a provider or Composio source.`);
    if (e.label === "reported" && kinds.length === 0) problems.push(`${where}: 'reported' needs at least one source.`);
  };
  const checkEstimate = (where: string, est: { min: number | null; max: number | null; evidence: Evidence }) => {
    if (est.min !== null && est.max !== null && est.min > est.max) problems.push(`${where}: min > max.`);
    checkEvidence(where, est.evidence);
  };

  for (const g of guide.gates) {
    const w = `gate ${g.id}`;
    checkEvidence(w, g.evidence);
    if (g.phase === "scale" && !g.threshold) problems.push(`${w}: scale gates need a threshold.`);
    if (g.typicalWait) checkEstimate(`${w}.typicalWait`, g.typicalWait);
    if (g.cost) checkEvidence(`${w}.cost`, g.cost.evidence);
    g.reviewerChecks.forEach((c, i) => checkEvidence(`${w}.reviewerChecks[${i}]`, c.evidence));
    g.rejectionReasons.forEach((r, i) => checkEvidence(`${w}.rejectionReasons[${i}]`, r.evidence));
  }
  for (const a of guide.accessLevels) {
    const w = `access level ${a.id}`;
    checkEvidence(w, a.evidence);
    a.gateIds.forEach((g) => expect(w, g, "gate"));
    if (!a.gateIds.some((g) => guide.gates.find((x) => x.id === g)?.kind === "registration"))
      problems.push(`${w}: every access level should include a registration gate.`);
    checkEstimate(`${w}.activeEffort`, a.activeEffort);
    checkEstimate(`${w}.calendarWaitToLaunch`, a.calendarWaitToLaunch);
  }
  for (const p of guide.prerequisites) {
    checkEvidence(`prerequisite ${p.id}`, p.evidence);
    p.accessLevelIds.forEach((a) => expect(`prerequisite ${p.id}`, a, "access level"));
  }
  for (const s of guide.steps) {
    checkEvidence(`step ${s.id}`, s.evidence);
    s.accessLevelIds.forEach((a) => expect(`step ${s.id}`, a, "access level"));
    if (s.gateId) expect(`step ${s.id}`, s.gateId, "gate");
  }
  guide.fallbackWhilePending.forEach((c, i) => checkEvidence(`fallbackWhilePending[${i}]`, c.evidence));
  for (const t of guide.composio.toolkits) {
    checkEvidence(`composio ${t.slug}`, t.evidence);
    t.accessLevelIds.forEach((a) => expect(`composio ${t.slug}`, a, "access level"));
    t.whyGoCustom.forEach((c, i) => checkEvidence(`composio ${t.slug}.whyGoCustom[${i}]`, c.evidence));
  }
  if (guide.composio.redirectUri) checkEvidence("composio.redirectUri", guide.composio.redirectUri.evidence);
  guide.composio.notes.forEach((c, i) => checkEvidence(`composio.notes[${i}]`, c.evidence));

  return problems;
}
