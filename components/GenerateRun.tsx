"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { GenEvent } from "@/lib/generate/pipeline";

const STAGES = [
  { key: "research", label: "Research", idle: "Read the provider's developer docs, review rules and Composio's toolkit page" },
  { key: "structure", label: "Write", idle: "Turn the findings into the standard guide" },
  { key: "check", label: "Check", idle: "Hold every claim to the evidence rules" },
  { key: "save", label: "Share", idle: "Save a link you can send to your team" },
] as const;

/** Watches the agent work: streams /api/generate and shows each search, page and correction as it happens. */
export function GenerateRun() {
  const params = useSearchParams();
  const router = useRouter();
  const query = (params.get("app") ?? "").trim();
  const fresh = params.get("fresh") === "1";
  const [events, setEvents] = useState<GenEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    // Start once, even under React's dev double-invoke; the request outlives the first effect.
    if (started.current || !query) return;
    started.current = true;
    (async () => {
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, fresh }),
        });
        if (!res.ok || !res.body) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(body?.error ?? `The request failed (${res.status}).`);
          return;
        }
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value;
          let nl: number;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line) continue;
            const ev = JSON.parse(line) as GenEvent;
            setEvents((prev) => [...prev, ev]);
            if (ev.t === "error") setError(ev.message);
            if (ev.t === "done") setTimeout(() => router.push(ev.path), 1500);
          }
        }
      } catch {
        setError("The connection dropped before the guide was finished. Try again.");
      } finally {
        setFinished(true);
      }
    })();
  }, [query, fresh, router]);

  if (!query) {
    return (
      <section className="gen">
        <h1>Generate a guide</h1>
        <p>
          Type an app name on the <Link href="/">home page</Link> to start.
        </p>
      </section>
    );
  }

  const plan = events.find((e) => e.t === "plan");
  const reads = events.flatMap((e) => (e.t === "read" ? e.urls : []));
  const unreadable = events.flatMap((e) => (e.t === "unreadable" ? e.urls : []));
  const sources = events.findLast((e) => e.t === "sources");
  const writing = events.findLast((e) => e.t === "writing");
  const check = events.findLast((e) => e.t === "check");
  const library = events.find((e) => e.t === "library");
  const cached = events.find((e) => e.t === "cached");
  const done = events.find((e) => e.t === "done");
  const current = events.findLast((e) => e.t === "stage");
  const currentIndex = done ? STAGES.length : current ? STAGES.findIndex((s) => s.key === current.stage) : -1;
  const retry = `/generate?app=${encodeURIComponent(query)}&fresh=1`;

  return (
    <section className="gen" aria-live="polite">
      <p className="crumb">
        <Link href="/">Library</Link> / Generate
      </p>
      <h1>{query}</h1>
      <p className="provenance prov-agent">
        <strong>Live agent research.</strong> The agent reads the provider&apos;s own pages as you watch, and every claim cites the
        page it came from. Nothing in it is tested by hand, so it never says Tested.
      </p>

      {library?.t === "library" && (
        <p className="gen-note">
          There&apos;s a hand-checked guide for this app: <Link href={library.path}>{library.name}</Link>.
          {cached ? "" : " The one below is generated fresh, so you can compare the two."}
        </p>
      )}

      {cached?.t === "cached" && (
        <div className="gen-note">
          <p>
            A guide for this app was generated on {cached.createdAt.slice(0, 10)}.{" "}
            <Link href={cached.path}>Open it</Link>, or{" "}
            <a href={retry}>generate a fresh one</a> to watch the agent work.
          </p>
        </div>
      )}

      {!cached && (
        <ol className="stages">
          {STAGES.map((s, i) => {
            const state = error && i === currentIndex ? "failed" : i < currentIndex ? "done" : i === currentIndex ? "active" : "pending";
            return (
              <li key={s.key} className={`stage stage-${state}`}>
                <div className="stage-head">
                  <span className="stage-dot" aria-hidden="true" />
                  <strong>{s.label}</strong>
                  <span className="stage-msg">
                    {state === "active" && current?.t === "stage" ? current.message : s.idle}
                  </span>
                </div>

                {s.key === "research" && (plan || reads.length > 0 || unreadable.length > 0) && (
                  <div className="stage-body">
                    {plan?.t === "plan" && (
                      <p className="muted">
                        The agent picked {plan.urls.length} official pages to start from; code fetches them and follows relevant links.
                      </p>
                    )}
                    {reads.length > 0 && (
                      <>
                        <p className="k">
                          Fetched: {reads.length} page{reads.length === 1 ? "" : "s"}
                        </p>
                        <ul className="reads">
                          {reads.map((u, j) => (
                            <li key={j}>{shortUrl(u)}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    {unreadable.length > 0 && (
                      <>
                        <p className="k">Couldn&apos;t load: {unreadable.length}</p>
                        <ul className="reads unreadable">
                          {unreadable.map((u, j) => {
                            const [url, reason] = u.split(" — ");
                            return (
                              <li key={j} title={reason}>
                                {shortUrl(url)}
                                {reason ? <span className="why"> ({reason})</span> : null}
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    )}
                    {sources?.t === "sources" && (
                      <p className="muted">{sources.sources.length} pages go to the writer; nothing else may be cited.</p>
                    )}
                  </div>
                )}

                {s.key === "structure" && writing?.t === "writing" && (
                  <div className="stage-body">
                    <p className="muted">{writing.chars.toLocaleString()} characters written</p>
                  </div>
                )}

                {s.key === "check" && check?.t === "check" && (
                  <div className="stage-body">
                    {check.repairs.length === 0 ? (
                      <p className="muted">No corrections needed.</p>
                    ) : (
                      <>
                        <p className="k">What the checker corrected</p>
                        <ul className="claims">
                          {check.repairs.map((r, j) => (
                            <li key={j}>{r}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    {check.problems.length > 0 && (
                      <p className="muted">{check.problems.length} remaining integrity issue(s), listed on the guide.</p>
                    )}
                  </div>
                )}

                {s.key === "save" && done?.t === "done" && (
                  <div className="stage-body">
                    <p>
                      Done. Opening <Link href={done.path}>your guide</Link>…
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {error && (
        <div className="gen-error" role="alert">
          <p>{error}</p>
          <a href={retry}>Try again</a>
        </div>
      )}
      {finished && !error && !done && !cached && <p className="muted">The stream ended without a result. Try again.</p>}
    </section>
  );
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "") + (u.pathname.length > 1 ? u.pathname : "");
  } catch {
    return url;
  }
}
