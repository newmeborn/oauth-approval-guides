import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuideView } from "@/components/GuideView";
import { getStore, type StoredGuide } from "@/lib/store";

export const dynamic = "force-dynamic";

async function load(id: string): Promise<StoredGuide | null> {
  return (await getStore()?.get(id)) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const stored = await load((await params).id);
  return stored
    ? { title: `${stored.guide.app.name}: OAuth app setup and approval (generated)`, description: stored.guide.provenance.summary }
    : { title: "Guide not found" };
}

export default async function GeneratedGuidePage({ params }: { params: Promise<{ id: string }> }) {
  const stored = await load((await params).id);
  if (!stored) notFound();
  return <GuideView guide={stored.guide} appendix={<HowItWasMade stored={stored} />} />;
}

/** The research trail, so a reader can judge the guide by how it was made. */
function HowItWasMade({ stored }: { stored: StoredGuide }) {
  const { trace } = stored;
  const regenerate = `/generate?app=${encodeURIComponent(trace.query)}&fresh=1`;
  return (
    <section id="how" aria-labelledby="how-h">
      <h2 id="how-h">How this guide was made</h2>
      <p className="sec-q">
        Generated {stored.createdAt.slice(0, 10)} from &ldquo;{trace.query}&rdquo; in {Math.round(trace.durationMs / 1000)} seconds.{" "}
        {trace.models.research} chose which official pages to read; code fetched them and followed their links; {trace.models.structure}{" "}
        wrote the guide from those pages only; then code checked every claim against the evidence rules.{" "}
        <a href={regenerate}>Generate a fresh version</a>.
      </p>
      <div className="how-grid">
        <div className="item">
          <p className="k">Pages read in full ({trace.reads.length})</p>
          <ul className="claims">
            {trace.reads.map((u, i) => (
              <li key={i}>
                <a href={u} target="_blank" rel="noreferrer">
                  {u.replace(/^https?:\/\/(www\.)?/, "")}
                </a>
              </li>
            ))}
          </ul>
          {(trace.unreadable ?? []).length > 0 && (
            <>
              <p className="k">Tried but couldn&apos;t load ({trace.unreadable.length})</p>
              <ul className="claims unreadable-list">
                {trace.unreadable.map((u, i) => (
                  <li key={i}>{u.replace(/^https?:\/\/(www\.)?/, "")}</li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div className="item">
          <p className="k">What the checker corrected</p>
          {trace.repairs.length === 0 ? (
            <p className="muted">Nothing; every label matched its sources.</p>
          ) : (
            <ul className="claims">
              {trace.repairs.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
          {trace.problems.length > 0 && (
            <>
              <p className="k">Still inconsistent</p>
              <ul className="claims">
                {trace.problems.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
