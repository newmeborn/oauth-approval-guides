"use client";

import { useEffect, useRef, useState } from "react";

/** The guide's permanent link, with Copy (and the phone's share sheet where available). */
export function ShareBar({ path, note }: { path: string; note?: string }) {
  // The origin is only known in the browser; render the path first so server and client agree.
  const [url, setUrl] = useState(path);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUrl(new URL(path, window.location.origin).toString());
    setCanShare(typeof navigator.share === "function");
  }, [path]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      input.current?.select(); // clipboard blocked: leave it selected for Ctrl+C
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="share-bar" role="group" aria-label="Share this guide">
      <span className="share-label">Share this guide</span>
      <div className="share-row">
        <input ref={input} readOnly value={url} aria-label="Link to this guide" onFocus={(e) => e.currentTarget.select()} />
        <button type="button" onClick={copy}>
          {copied ? "Copied" : "Copy link"}
        </button>
        {canShare && (
          <button type="button" className="secondary" onClick={() => navigator.share({ url }).catch(() => {})}>
            Share…
          </button>
        )}
      </div>
      {note && <p className="share-note">{note}</p>}
      <span className="visually-hidden" aria-live="polite">
        {copied ? "Link copied" : ""}
      </span>
    </div>
  );
}
