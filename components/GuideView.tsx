"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { AccessLevel, Claim, Gate, Guide } from "@/lib/guide/schema";
import {
  ACCESS_KIND_TEXT,
  ACTOR_TEXT,
  GATE_KIND_TEXT,
  PHASE_TEXT,
  RESOLVE_TEXT,
  SOURCE_KIND_TEXT,
  formatEstimate,
  hostOf,
  shortLocation,
  sourceNumbers,
  whenText,
} from "@/lib/guide/format";
import { GATE_TIER, verdictFor } from "@/lib/guide/tiers";
import { Evidence, SourceNumbers } from "./Evidence";
import { ActorPill, TierPill } from "./Pills";

const PHASE_ORDER = { development: 0, launch: 1, scale: 2 } as const;

/**
 * One guide, organised around the developer's questions. Picking an access level filters
 * prerequisites, steps, gates and toolkits to what that level actually needs.
 */
export function GuideView({ guide, appendix }: { guide: Guide; appendix?: React.ReactNode }) {
  const [focusId, setFocusId] = useState<string | null>(null);
  const numbers = useMemo(() => sourceNumbers(guide), [guide]);
  const verdicts = useMemo(() => new Map(guide.accessLevels.map((l) => [l.id, verdictFor(guide, l)])), [guide]);
  const levelName = useMemo(() => new Map(guide.accessLevels.map((l) => [l.id, l.name])), [guide]);
  const gateName = useMemo(() => new Map(guide.gates.map((g) => [g.id, g.name])), [guide]);

  const focus = guide.accessLevels.find((l) => l.id === focusId) ?? null;
  const applies = (ids: string[]) => !focus || ids.length === 0 || ids.includes(focus.id);
  const forLevels = (ids: string[]) =>
    !focus && ids.length > 0 ? <span className="for-levels">For: {ids.map((id) => levelName.get(id) ?? id).join(", ")}</span> : null;

  const prerequisites = guide.prerequisites.filter((p) => applies(p.accessLevelIds));
  const steps = guide.steps.filter((s) => applies(s.accessLevelIds));
  const gates = guide.gates
    .filter((g) => !focus || focus.gateIds.includes(g.id))
    .sort((a, b) => PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase]);
  const toolkits = guide.composio.toolkits.filter((t) => applies(t.accessLevelIds));
  const actorCounts = (["agent", "agent_prepares", "developer"] as const).map((a) => ({
    actor: a,
    n: steps.filter((s) => s.actor === a).length,
  }));

  return (
    <SourceNumbers.Provider value={numbers}>
      <article className="guide">
        <header className="guide-head">
          <p className="crumb">
            <Link href="/#library">Library</Link> / {guide.app.name}
          </p>
          <h1>{guide.app.name}</h1>
          <Provenance guide={guide} />
          <p className="lede">{guide.provenance.summary}</p>
          <p className="head-links">
            <a href={guide.app.developerPortalUrl} target="_blank" rel="noreferrer">
              Developer portal ↗
            </a>
            <a href={guide.app.website} target="_blank" rel="noreferrer">
              {shortLocation(guide.app.website)} ↗
            </a>
          </p>
        </header>

        <section id="verdict" aria-labelledby="verdict-h">
          <h2 id="verdict-h">
            <span className="sec-n">1</span> Verdict
          </h2>
          <p className="sec-q">How hard is it, and how long until real users can connect? It depends on what your agent needs.</p>

          <div className="focus-bar" role="group" aria-label="Filter the guide by access level">
            <span className="focus-label">What does your agent need?</span>
            <button type="button" className="chip" aria-pressed={!focus} onClick={() => setFocusId(null)}>
              Show everything
            </button>
            {guide.accessLevels.map((l) => (
              <button key={l.id} type="button" className="chip" aria-pressed={focusId === l.id} onClick={() => setFocusId(l.id)}>
                {l.name}
              </button>
            ))}
          </div>

          <div className="levels">
            {guide.accessLevels.map((l) => (
              <LevelCard
                key={l.id}
                level={l}
                verdict={verdicts.get(l.id)!}
                focused={focusId === l.id}
                dimmed={!!focus && focusId !== l.id}
              />
            ))}
          </div>
        </section>

        <section id="before" aria-labelledby="before-h">
          <h2 id="before-h">
            <span className="sec-n">2</span> Before you start
          </h2>
          <p className="sec-q">What you need in hand first. Blocking items stop you outright.</p>
          {prerequisites.length === 0 ? (
            <p className="empty">Nothing beyond a developer account.</p>
          ) : (
            <ul className="items">
              {prerequisites.map((p) => (
                <li key={p.id} className="item">
                  <div className="item-head">
                    <span className={`pill flag ${p.blocking ? "flag-block" : "flag-soft"}`}>{p.blocking ? "Blocking" : "Needed later"}</span>
                    <span className="pill who">{p.whoNeedsIt === "developer" ? "You" : "Your end users"}</span>
                    {forLevels(p.accessLevelIds)}
                  </div>
                  <p>{p.description}</p>
                  <Evidence evidence={p.evidence} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="steps" aria-labelledby="steps-h">
          <h2 id="steps-h">
            <span className="sec-n">3</span> Steps
          </h2>
          <p className="sec-q">In order. Each step says whether an agent can do it or you have to.</p>
          <p className="actor-summary">
            {actorCounts.map(({ actor, n }) => (
              <span key={actor}>
                <strong>{n}</strong> {ACTOR_TEXT[actor].label.toLowerCase()}
              </span>
            ))}
          </p>
          <ol className="steps">
            {steps.map((s) => (
              <li key={s.id} className="step">
                <div className="item-head">
                  <h3>{s.title}</h3>
                  <ActorPill actor={s.actor} />
                  {forLevels(s.accessLevelIds)}
                </div>
                <p>{s.detail}</p>
                <div className="step-foot">
                  {s.url && (
                    <a href={s.url} target="_blank" rel="noreferrer">
                      Open {hostOf(s.url)} ↗
                    </a>
                  )}
                  {s.gateId && (
                    <a href={`#gate-${s.gateId}`} className="gate-ref">
                      Gate: {gateName.get(s.gateId) ?? s.gateId}
                    </a>
                  )}
                  <Evidence evidence={s.evidence} />
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="approval" aria-labelledby="approval-h">
          <h2 id="approval-h">
            <span className="sec-n">4</span> Approval &amp; blockers
          </h2>
          <p className="sec-q">Every wall between you and real users: what reviewers check, why apps get rejected, and how to fix it.</p>
          <div className="gates">
            {gates.map((g) => (
              <GateCard key={g.id} gate={g} />
            ))}
          </div>

          {guide.fallbackWhilePending.length > 0 && (
            <div className="fallback">
              <h3>While you wait or if you&apos;re blocked</h3>
              <ClaimList claims={guide.fallbackWhilePending} />
            </div>
          )}
        </section>

        <section id="composio" aria-labelledby="composio-h">
          <h2 id="composio-h">
            <span className="sec-n">5</span> Composio hookup
          </h2>
          <p className="sec-q">Whether Composio&apos;s managed app covers you, and what to paste where when you bring your own.</p>
          <div className="toolkits">
            {toolkits.map((t) => (
              <div key={t.slug} className="toolkit">
                <div className="item-head">
                  <code className="slug">{t.slug}</code>
                  <span className={`pill managed managed-${String(t.managedAuthAvailable)}`}>
                    {t.managedAuthAvailable === null
                      ? "Managed auth: unknown"
                      : t.managedAuthAvailable
                        ? "Managed auth available"
                        : "No managed auth"}
                  </span>
                  {t.authScheme && <span className="pill who">{t.authScheme}</span>}
                  {forLevels(t.accessLevelIds)}
                </div>
                {t.customCredentials.length > 0 && (
                  <p>
                    <span className="k">Your own app needs:</span> {t.customCredentials.join(", ")}
                  </p>
                )}
                {t.whyGoCustom.length > 0 && (
                  <>
                    <p className="k">Why switch from managed to your own app</p>
                    <ClaimList claims={t.whyGoCustom} />
                  </>
                )}
                <Evidence evidence={t.evidence} />
              </div>
            ))}
          </div>
          {guide.composio.redirectUri && (
            <div className="redirect">
              <p className="k">Redirect URI to register with the provider</p>
              <ClaimList claims={[guide.composio.redirectUri]} code />
            </div>
          )}
          {guide.composio.notes.length > 0 && <ClaimList claims={guide.composio.notes} />}
        </section>

        <section id="sources" aria-labelledby="sources-h">
          <h2 id="sources-h">
            <span className="sec-n">6</span> Evidence &amp; sources
          </h2>
          <p className="sec-q">
            Last checked {guide.provenance.lastChecked}. Every bracketed number above points here.
          </p>
          <ol className="sources">
            {guide.sources.map((s) => {
              // Repo evidence (screenshots, test logs) is served by /evidence/[...path].
              const href = /^https?:\/\//.test(s.location) ? s.location : s.location.startsWith("evidence/") ? `/${s.location}` : null;
              return (
                <li key={s.id} id={`src-${s.id}`}>
                  <span className="src-kind">{SOURCE_KIND_TEXT[s.kind]}</span>{" "}
                  {href ? (
                    <a href={href} target="_blank" rel="noreferrer">
                      {s.title}
                    </a>
                  ) : (
                    <span>{s.title}</span>
                  )}{" "}
                  <span className="src-meta">
                    {shortLocation(s.location)} · {s.kind === "screenshot" || s.kind === "test_log" ? "captured" : "accessed"} {s.accessedOn}
                  </span>
                  {s.kind === "screenshot" && href && (
                    <a href={href} target="_blank" rel="noreferrer" className="shot">
                      {/* eslint-disable-next-line @next/next/no-img-element -- evidence is shown as captured, unoptimised */}
                      <img src={href} alt={s.title} loading="lazy" />
                    </a>
                  )}
                </li>
              );
            })}
          </ol>

          {guide.openQuestions.length > 0 && (
            <>
              <h3>Still uncertain</h3>
              <ul className="items">
                {guide.openQuestions.map((q, i) => (
                  <li key={i} className="item">
                    <p>
                      <strong>{q.question}</strong>
                    </p>
                    <p className="muted">{q.whyItMatters}</p>
                    <span className="pill who">How to settle it: {RESOLVE_TEXT[q.howToResolve]}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        {appendix}
      </article>
    </SourceNumbers.Provider>
  );
}

function Provenance({ guide }: { guide: Guide }) {
  const agent = guide.provenance.generatedBy === "agent";
  return (
    <p className={`provenance ${agent ? "prov-agent" : "prov-human"}`}>
      <strong>{agent ? "Agent-generated" : "Hand-checked"}</strong>
      {agent
        ? " from provider docs and community sources. Nothing here was tried by hand, so nothing is marked Tested."
        : " Claims marked Tested were done by hand and link to a screenshot or test log; the rest come from the provider's docs and community reports, labelled as such."}{" "}
      Last checked {guide.provenance.lastChecked}.
    </p>
  );
}

function LevelCard({
  level,
  verdict,
  focused,
  dimmed,
}: {
  level: AccessLevel;
  verdict: ReturnType<typeof verdictFor>;
  focused: boolean;
  dimmed: boolean;
}) {
  const when = whenText(verdict.scaleGates.map((g) => g.threshold));
  const changesAtScale = verdict.tierAtScale !== verdict.tierAtLaunch;
  return (
    <div className={`level ${focused ? "is-focused" : ""} ${dimmed ? "is-dimmed" : ""}`}>
      <p className="level-kind">{ACCESS_KIND_TEXT[level.kind]}</p>
      <h3>{level.name}</h3>
      <div className="tiers">
        <span className="tier-when">At launch</span>
        <TierPill tier={verdict.tierAtLaunch} />
        {changesAtScale && (
          <>
            <span className="tier-arrow" aria-hidden="true">
              →
            </span>
            <span className="tier-when">{when}</span>
            <TierPill tier={verdict.tierAtScale} />
          </>
        )}
      </div>
      <dl className="stats">
        <div>
          <dt>Your active work</dt>
          <dd>{formatEstimate(level.activeEffort)}</dd>
          <Evidence evidence={level.activeEffort.evidence} />
        </div>
        <div>
          <dt>Approval wait to launch</dt>
          <dd>{formatEstimate(level.calendarWaitToLaunch)}</dd>
          <Evidence evidence={level.calendarWaitToLaunch.evidence} />
        </div>
      </dl>
      <p className="recommendation">{level.recommendation}</p>
      <details className="mechanism">
        <summary>How it works</summary>
        <p>{level.mechanism}</p>
        {level.scopes.length > 0 && (
          <p className="scopes">
            {level.scopes.map((s) => (
              <code key={s}>{s}</code>
            ))}
          </p>
        )}
        {level.composioToolkit && (
          <p>
            Composio toolkit: <code>{level.composioToolkit}</code>
          </p>
        )}
        <Evidence evidence={level.evidence} />
      </details>
    </div>
  );
}

function GateCard({ gate }: { gate: Gate }) {
  return (
    <div className="gate" id={`gate-${gate.id}`}>
      <div className="item-head">
        <h3>{gate.name}</h3>
        <TierPill tier={GATE_TIER[gate.kind]} />
        <span className="pill who">
          {PHASE_TEXT[gate.phase]}
          {gate.threshold ? `: ${gate.threshold}` : ""}
        </span>
        <span className="pill who">{GATE_KIND_TEXT[gate.kind]}</span>
      </div>
      <p>{gate.description}</p>
      <dl className="stats compact">
        {gate.typicalWait && (
          <div>
            <dt>Typical wait</dt>
            <dd>{formatEstimate(gate.typicalWait)}</dd>
            <Evidence evidence={gate.typicalWait.evidence} />
          </div>
        )}
        {gate.cost && (
          <div>
            <dt>Cost</dt>
            <dd>{gate.cost.text}</dd>
            <Evidence evidence={gate.cost.evidence} />
          </div>
        )}
      </dl>
      {gate.reviewerChecks.length > 0 && (
        <>
          <p className="k">What reviewers check</p>
          <ClaimList claims={gate.reviewerChecks} />
        </>
      )}
      {gate.rejectionReasons.length > 0 && (
        <>
          <p className="k">Why apps get rejected, and the fix</p>
          <ul className="rejections">
            {gate.rejectionReasons.map((r, i) => (
              <li key={i}>
                <p>
                  <strong>{r.reason}</strong>
                </p>
                <p>Fix: {r.fix}</p>
                <Evidence evidence={r.evidence} />
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="step-foot">
        {gate.startUrl && (
          <a href={gate.startUrl} target="_blank" rel="noreferrer">
            Start at {hostOf(gate.startUrl)} ↗
          </a>
        )}
        <Evidence evidence={gate.evidence} />
      </div>
    </div>
  );
}

function ClaimList({ claims, code = false }: { claims: Claim[]; code?: boolean }) {
  return (
    <ul className="claims">
      {claims.map((c, i) => (
        <li key={i}>
          {code ? <code className="block">{c.text}</code> : <span>{c.text}</span>} <Evidence evidence={c.evidence} />
        </li>
      ))}
    </ul>
  );
}
