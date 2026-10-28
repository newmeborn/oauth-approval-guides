"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** The entry point for apps outside the library. */
export function GenerateBox() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const valid = query.trim().length >= 2;

  return (
    <form
      className="gen-box"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) router.push(`/generate?app=${encodeURIComponent(query.trim())}`);
      }}
    >
      <label htmlFor="gen-q">Not in the library? Generate a guide for any app</label>
      <div className="gen-row">
        <input
          id="gen-q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="App name or website, e.g. Notion or hubspot.com"
          maxLength={80}
          autoComplete="off"
        />
        <button type="submit" disabled={!valid}>
          Generate guide
        </button>
      </div>
      <p className="gen-hint">
        An agent reads the provider&apos;s docs and community reports live, in about one to three minutes, and gives you a link
        to share. Generated guides cite their sources but nothing in them is tested by hand.
      </p>
    </form>
  );
}
