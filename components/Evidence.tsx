"use client";

import { createContext, useContext, useId, useState } from "react";
import type { Evidence as EvidenceT } from "@/lib/guide/schema";
import { EVIDENCE_TEXT } from "@/lib/guide/format";

/** Source id -> footnote number, so every claim can point at the Sources list. */
export const SourceNumbers = createContext<Map<string, number>>(new Map());

/** The inline evidence tag: label, footnote links, and the caveat note on demand. */
export function Evidence({ evidence }: { evidence: EvidenceT }) {
  const numbers = useContext(SourceNumbers);
  const [open, setOpen] = useState(false);
  const noteId = useId();
  const refs = evidence.sourceIds.map((id) => ({ id, n: numbers.get(id) })).filter((r) => r.n !== undefined);
  const label = EVIDENCE_TEXT[evidence.label];

  return (
    <span className="evidence">
      {evidence.note ? (
        <button
          type="button"
          className={`pill ev ev-${evidence.label} ev-button`}
          aria-expanded={open}
          aria-controls={noteId}
          title={`${label.meaning} Click for the caveat.`}
          onClick={() => setOpen((o) => !o)}
        >
          {label.label}
          <span aria-hidden="true" className="ev-caret">{open ? "−" : "+"}</span>
        </button>
      ) : (
        <span className={`pill ev ev-${evidence.label}`} title={label.meaning}>
          {label.label}
        </span>
      )}
      {refs.length > 0 && (
        <span className="ev-refs">
          {refs.map((r) => (
            <a key={r.id} href={`#src-${r.id}`} aria-label={`Source ${r.n}`}>
              [{r.n}]
            </a>
          ))}
        </span>
      )}
      {evidence.note && open && (
        <span id={noteId} className="ev-note" role="note">
          {evidence.note}
        </span>
      )}
    </span>
  );
}
