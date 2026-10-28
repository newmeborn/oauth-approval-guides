/**
 * The library: hand-checked guides shipped as guides/*.json. Server-only (reads the filesystem).
 * A docs-only prediction stands in for an app until its hand-verified guide replaces it.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Guide } from "./schema";

const DIR = path.join(process.cwd(), "guides");

export function loadLibrary(): Guide[] {
  const bySlug = new Map<string, Guide>();
  for (const file of readdirSync(DIR).filter((f) => f.endsWith(".json")).sort()) {
    const guide = Guide.parse(JSON.parse(readFileSync(path.join(DIR, file), "utf8")));
    const existing = bySlug.get(guide.app.slug);
    const upgrades = existing?.provenance.generatedBy === "agent" && guide.provenance.generatedBy === "human_verified";
    if (!existing || upgrades) bySlug.set(guide.app.slug, guide);
  }
  return [...bySlug.values()].sort((a, b) => a.app.name.localeCompare(b.app.name));
}

export function findInLibrary(slug: string): Guide | undefined {
  return loadLibrary().find((g) => g.app.slug === slug);
}
