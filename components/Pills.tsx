import type { Actor, EvidenceLabel } from "@/lib/guide/schema";
import { ACTOR_TEXT, EVIDENCE_TEXT, TIER_MEANING } from "@/lib/guide/format";
import { TIER_LABEL, type Tier } from "@/lib/guide/tiers";

export function TierPill({ tier, suffix, unconfirmed = false }: { tier: Tier; suffix?: string; unconfirmed?: boolean }) {
  const title = unconfirmed
    ? `${TIER_MEANING[tier]} Unconfirmed: no page about app review could be read, so a review may still exist.`
    : TIER_MEANING[tier];
  return (
    <span className={`pill tier tier-${tier}${unconfirmed ? " tier-unconfirmed" : ""}`} title={title}>
      {TIER_LABEL[tier]}
      {unconfirmed ? <span className="pill-suffix"> · unconfirmed</span> : null}
      {suffix ? <span className="pill-suffix"> {suffix}</span> : null}
    </span>
  );
}

export function ActorPill({ actor }: { actor: Actor }) {
  return (
    <span className={`pill actor actor-${actor}`} title={ACTOR_TEXT[actor].meaning}>
      {ACTOR_TEXT[actor].label}
    </span>
  );
}

export function EvidencePill({ label }: { label: EvidenceLabel }) {
  return (
    <span className={`pill ev ev-${label}`} title={EVIDENCE_TEXT[label].meaning}>
      {EVIDENCE_TEXT[label].label}
    </span>
  );
}
