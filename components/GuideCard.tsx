import Link from "next/link";
import type { Guide } from "@/lib/guide/schema";
import { tierUnconfirmed, whenText } from "@/lib/guide/format";
import { verdictFor } from "@/lib/guide/tiers";
import { TierPill } from "./Pills";

/** A guide at a glance: per-level tiers, with where they change at scale. */
export function GuideCard({ guide, href, tag, foot }: { guide: Guide; href: string; tag: "human" | "docs" | "generated"; foot: string }) {
  const tagText = { human: "Hand-checked", docs: "Docs only", generated: "Agent-generated" }[tag];
  return (
    <Link href={href} className="card">
      <div className="card-head">
        <h3>{guide.app.name}</h3>
        <span className={`prov-tag ${tag === "human" ? "prov-human" : "prov-agent"}`}>{tagText}</span>
      </div>
      <p className="card-summary">{guide.provenance.summary}</p>
      <ul className="card-levels">
        {guide.accessLevels.map((l) => {
          const v = verdictFor(guide, l);
          return (
            <li key={l.id}>
              <span className="card-level-name">{l.name}</span>
              <span className="card-level-tiers">
                <TierPill tier={v.tierAtLaunch} unconfirmed={tierUnconfirmed(l, v)} />
                {v.tierAtScale !== v.tierAtLaunch && (
                  <>
                    <span className="tier-arrow" aria-hidden="true">
                      →
                    </span>
                    <TierPill tier={v.tierAtScale} suffix={whenText(v.scaleGates.map((x) => x.threshold))} />
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <span className="card-foot">{foot}</span>
    </Link>
  );
}
