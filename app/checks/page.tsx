import type { Metadata } from "next";
import Link from "next/link";
import { CHECKS, METHOD_TEXT, RESULT_TEXT, RUNS, type CheckResult } from "@/lib/checks";

export const metadata: Metadata = {
  title: "How we checked the guides",
  description: "A sample of the guidance checked against real sources and setup attempts: what held up, what we corrected, and what we couldn't verify.",
};

const ORDER: CheckResult[] = ["corrected", "discovered", "confirmed", "unverifiable", "pending"];

export default function ChecksPage() {
  const counts = ORDER.map((r) => ({ r, n: CHECKS.filter((c) => c.result === r).length })).filter((x) => x.n);
  const sorted = [...CHECKS].sort((a, b) => ORDER.indexOf(a.result) - ORDER.indexOf(b.result));
  return (
    <article className="checks">
      <header className="guide-head">
        <p className="crumb">
          <Link href="/#library">Library</Link> / Checks
        </p>
        <h1>How we checked the guides</h1>
        <p className="lede">
          We tested what we could by hand, held the rest to its sources, and ran the live agent until its mistakes stopped
          surprising us. Here is a sample of claims we checked, including the ones we got wrong.
        </p>
        <p className="check-counts">
          {counts.map(({ r, n }) => (
            <span key={r} className={`pill res res-${r}`}>
              {n} {RESULT_TEXT[r].toLowerCase()}
            </span>
          ))}
        </p>
      </header>

      <section aria-labelledby="sample-h">
        <h2 id="sample-h">Sampled claims</h2>
        <ul className="items">
          {sorted.map((c, i) => (
            <li key={i} className="item">
              <div className="item-head">
                <span className={`pill res res-${c.result}`}>{RESULT_TEXT[c.result]}</span>
                <span className="pill who">{c.app}</span>
                <span className="for-levels">{METHOD_TEXT[c.method]}</span>
              </div>
              <p>
                <strong>{c.claim}</strong>
              </p>
              <p>{c.detail}</p>
              {c.links.length > 0 && (
                <p className="step-foot">
                  {c.links.map((l) => (
                    <a key={l.href} href={l.href} target={l.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
                      {l.label}
                      {l.href.startsWith("http") ? " ↗" : ""}
                    </a>
                  ))}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="runs-h">
        <h2 id="runs-h">The live agent, run by run</h2>
        <p className="sec-q">
          Every fix to the generator came from watching it get something wrong. Pages read are pages our code actually fetched;
          quotes are checked word for word against them.
        </p>
        <div className="table-wrap">
          <table className="runs">
            <thead>
              <tr>
                <th>Run</th>
                <th>Pages read</th>
                <th>Quotes</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {RUNS.map((r) => (
                <tr key={r.run}>
                  <td>{r.run}</td>
                  <td>{r.pages}</td>
                  <td>{r.quotes}</td>
                  <td>{r.outcome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="limits-h">
        <h2 id="limits-h">What we couldn&apos;t verify</h2>
        <ul className="claims">
          <li>Approval wait times. Providers publish typical figures (Google: 3-5 business days; Notion: 5-10) or none (Meta, Discord); developers report much longer stalls. Guides show open-ended ranges and label the source of each figure.</li>
          <li>Anything past the first approval wall. We registered apps up to the point of submitting for review and did not wait for approvals, as the brief allows.</li>
          <li>Sites that block automated reading. Zoom&apos;s developer site reset most connections from our machine, so its generated guide says what it couldn&apos;t read instead of guessing.</li>
        </ul>
      </section>
    </article>
  );
}
