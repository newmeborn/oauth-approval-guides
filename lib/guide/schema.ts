/**
 * The one guide schema shared by hand-verified library guides and live agent-generated guides.
 *
 * Source of truth: these Zod definitions. The TypeScript types are inferred from them and
 * schema/guide.schema.json is emitted from them (npm run schema), so the three never drift.
 *
 * Constraints, so the JSON schema works as a Claude structured-output / strict tool schema:
 * every object is strict (additionalProperties: false), every field is required (absent
 * values are null or []), no recursion, no numeric or string-length constraints. Anything
 * the JSON schema can't express (id references, evidence rules) lives in tiers.ts.
 *
 * Tier is deliberately NOT a field. Authors (human or agent) record the observable gates;
 * tiers.ts derives the tier from them, so the verdict can't be gut feel.
 */
import { z } from "zod";

export const SCHEMA_VERSION = "1.0.0";

const id = z.string().describe("Stable kebab-case id, unique within the guide, e.g. 'bot-verification'.");
const idRefs = (of: string) => z.array(z.string()).describe(`Ids of ${of} defined elsewhere in this guide.`);
const isoDate = z.iso.date().describe("ISO date, YYYY-MM-DD.");

// ---------- Evidence ----------

export const EvidenceLabel = z
  .enum(["tested", "documented", "reported", "unverified"])
  .describe(
    "tested: we did it ourselves (needs a screenshot or test_log source). " +
      "documented: an official provider or Composio page says so. " +
      "reported: community sources (forums, blogs, Stack Overflow). " +
      "unverified: inference or a source we could not read.",
  );

export const Evidence = z
  .strictObject({
    label: EvidenceLabel,
    sourceIds: idRefs("sources").describe("Sources backing the claim. May be empty only when label is unverified."),
    note: z.string().nullable().describe("Caveats, e.g. 'page blocked automated fetch; seen via search excerpt'."),
  })
  .describe("Shown inline next to every claim.");

export const Claim = z.strictObject({ text: z.string(), evidence: Evidence });

export const SourceKind = z.enum([
  "provider_doc",
  "provider_console", // something seen in the provider's portal UI
  "composio_doc",
  "composio_api", // e.g. toolkits.get(...).composio_managed_auth_schemes
  "community",
  "screenshot", // repo-relative path to an image we captured
  "test_log", // repo-relative path to notes from a hands-on run
]);

export const Source = z.strictObject({
  id,
  kind: SourceKind,
  title: z.string(),
  location: z.string().describe("URL, or repo-relative path for screenshots and test logs."),
  accessedOn: isoDate,
});

// ---------- Time ----------

export const TimeUnit = z.enum(["minutes", "hours", "days", "weeks", "months"]);

export const Estimate = z
  .strictObject({
    min: z.number().nullable().describe("Null when unknown. Never invent a number to fill it."),
    max: z.number().nullable().describe("Null when unknown or open-ended."),
    unit: TimeUnit,
    evidence: Evidence,
  })
  .describe("A range, never a point estimate. Use the unit a developer would plan in.");

// ---------- Gates (the observable walls that determine tier) ----------

export const GateKind = z
  .enum([
    "registration", // create the app in the provider portal, accept developer terms
    "account_security", // e.g. 2FA or a verified developer account
    "policy_urls", // privacy policy / terms URLs must exist and be reachable
    "domain_verification",
    "brand_verification", // name, logo, homepage reviewed
    "identity_verification", // a person's government ID checked
    "use_case_review", // a human reviews your use case, screencast or data handling
    "security_assessment", // formal third-party audit or assessment
    "business_verification", // legal-entity documents; reviewer can refuse
    "paid_access", // a paid plan or API tier is required
    "partner_program", // allowlist or partnership; no self-serve path
  ])
  .describe("Pick the kind by what the provider actually checks, not by what the provider calls it.");

export const GatePhase = z
  .enum(["development", "launch", "scale"])
  .describe(
    "development: before even you can test. launch: before real users outside a test list can connect. " +
      "scale: only after a usage threshold (put it in threshold).",
  );

export const RejectionReason = z.strictObject({
  reason: z.string(),
  fix: z.string(),
  evidence: Evidence,
});

export const Gate = z.strictObject({
  id,
  kind: GateKind,
  name: z.string().describe("The provider's own name for it, e.g. 'App Verification'."),
  phase: GatePhase,
  threshold: z.string().nullable().describe("For scale gates, e.g. '100 servers'. Otherwise null."),
  description: z.string(),
  startUrl: z.string().nullable().describe("Where the developer starts this gate."),
  typicalWait: Estimate.nullable().describe("Calendar wait for a decision. Null if the gate is instant."),
  cost: Claim.nullable().describe("Money cost, if any."),
  reviewerChecks: z.array(Claim),
  rejectionReasons: z.array(RejectionReason),
  evidence: Evidence,
});

// ---------- Access levels (difficulty varies by what you ask for) ----------

export const AccessKind = z.enum(["sign_in", "read", "write"]);

export const AccessLevel = z.strictObject({
  id,
  kind: AccessKind,
  name: z.string().describe("Plain-language capability, e.g. 'Post messages to a team's channel'."),
  mechanism: z
    .string()
    .describe("How access is granted, e.g. 'user OAuth token', 'bot added to server', 'incoming webhook'."),
  scopes: z.array(z.string()).describe("Provider scope or permission strings."),
  gateIds: idRefs("gates").describe("Every gate this access level must pass, including registration."),
  activeEffort: Estimate.describe("Hands-on developer time to reach launch, excluding waiting."),
  calendarWaitToLaunch: Estimate.describe("Waiting on the provider before real users can connect."),
  recommendation: z.string().describe("One line, e.g. 'Start verification now; launch with test users meanwhile.'"),
  composioToolkit: z.string().nullable().describe("Composio toolkit slug that serves this level, e.g. 'DISCORDBOT'."),
  evidence: Evidence,
});

// ---------- Prerequisites and steps ----------

export const PrerequisiteKind = z.enum([
  "legal_entity",
  "privacy_policy_url",
  "terms_url",
  "verified_domain",
  "paid_plan",
  "developer_account",
  "admin_account",
  "end_user_account",
  "end_user_permission",
  "other",
]);

export const Prerequisite = z.strictObject({
  id,
  kind: PrerequisiteKind,
  description: z.string(),
  whoNeedsIt: z.enum(["developer", "end_user"]),
  blocking: z.boolean().describe("True if you cannot proceed at all without it."),
  accessLevelIds: idRefs("access levels").describe("Empty means it applies to every access level."),
  evidence: Evidence,
});

export const Actor = z
  .enum(["agent", "agent_prepares", "developer"])
  .describe(
    "agent: an agent can do it end to end. agent_prepares: an agent drafts it, the developer submits. " +
      "developer: only the developer can (logins, ID checks, accepting terms, payments).",
  );

export const Step = z.strictObject({
  id,
  title: z.string(),
  detail: z.string(),
  actor: Actor,
  url: z.string().nullable(),
  accessLevelIds: idRefs("access levels").describe("Empty means the step applies to every access level."),
  gateId: z.string().nullable().describe("The gate this step satisfies, if any."),
  evidence: Evidence,
});

// ---------- Composio hookup ----------

export const ComposioToolkit = z.strictObject({
  slug: z.string(),
  accessLevelIds: idRefs("access levels"),
  managedAuthAvailable: z.boolean().nullable().describe("Null if not checked."),
  authScheme: z.string().nullable().describe("e.g. 'OAUTH2'."),
  customCredentials: z.array(z.string()).describe("What the developer pastes into the auth config, e.g. 'client_id'."),
  whyGoCustom: z.array(Claim).describe("What the developer gets from their own app over Composio's managed one."),
  evidence: Evidence,
});

export const ComposioHookup = z.strictObject({
  toolkits: z.array(ComposioToolkit),
  redirectUri: Claim.nullable().describe("The callback to register in the provider portal."),
  notes: z.array(Claim),
});

// ---------- The guide ----------

export const OpenQuestion = z.strictObject({
  question: z.string(),
  whyItMatters: z.string(),
  howToResolve: z.enum(["test", "ask_provider", "community", "ask_composio"]),
});

export const Guide = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  app: z.strictObject({
    name: z.string(),
    slug: z.string(),
    website: z.string(),
    developerPortalUrl: z.string(),
  }),
  provenance: z.strictObject({
    generatedBy: z
      .enum(["agent", "human_verified"])
      .describe("agent: docs and web research only. human_verified: a person walked the flow."),
    lastChecked: isoDate,
    summary: z.string().describe("Two sentences: overall verdict and the single most important thing to know."),
  }),
  // 1. Verdict (tier per level is derived from gates in tiers.ts)
  accessLevels: z.array(AccessLevel),
  // 2. Before you start
  prerequisites: z.array(Prerequisite),
  // 3. Steps
  steps: z.array(Step),
  // 4. Approval & blockers
  gates: z.array(Gate),
  fallbackWhilePending: z.array(Claim).describe("How to keep building or launch while a gate is pending."),
  // 5. Composio hookup
  composio: ComposioHookup,
  // 6. Evidence & sources
  sources: z.array(Source),
  openQuestions: z.array(OpenQuestion),
});

export type EvidenceLabel = z.infer<typeof EvidenceLabel>;
export type Evidence = z.infer<typeof Evidence>;
export type Claim = z.infer<typeof Claim>;
export type Source = z.infer<typeof Source>;
export type Estimate = z.infer<typeof Estimate>;
export type GateKind = z.infer<typeof GateKind>;
export type GatePhase = z.infer<typeof GatePhase>;
export type Gate = z.infer<typeof Gate>;
export type AccessLevel = z.infer<typeof AccessLevel>;
export type Prerequisite = z.infer<typeof Prerequisite>;
export type Actor = z.infer<typeof Actor>;
export type Step = z.infer<typeof Step>;
export type ComposioToolkit = z.infer<typeof ComposioToolkit>;
export type Guide = z.infer<typeof Guide>;
