/**
 * Where generated guides live so their links can be shared. Supabase when configured;
 * a local folder in development so the generator works before Supabase is set up.
 */
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Guide } from "@/lib/guide/schema";
import type { Trace } from "@/lib/generate/pipeline";

export interface StoredGuide {
  id: string;
  slug: string;
  query: string;
  guide: Guide;
  trace: Trace;
  model: string;
  createdAt: string;
}

type NewGuide = Omit<StoredGuide, "id" | "createdAt">;

export interface GuideStore {
  save(row: NewGuide): Promise<string>;
  get(id: string): Promise<StoredGuide | null>;
  latestFor(slug: string, maxAgeDays: number): Promise<StoredGuide | null>;
  countSince(hours: number): Promise<number>;
  /** Newest guide per app, newest first. */
  recent(limit: number): Promise<StoredGuide[]>;
}

const newestPerSlug = (rows: StoredGuide[], limit: number) => {
  const seen = new Set<string>();
  return rows
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter((r) => !seen.has(r.slug) && seen.add(r.slug))
    .slice(0, limit);
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const since = (ms: number) => new Date(Date.now() - ms).toISOString();

export function getStore(): GuideStore | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (url && key) return supabaseStore(url, key);
  if (!process.env.VERCEL) return localStore();
  return null;
}

type Row = { id: string; slug: string; query: string; guide: Guide; trace: Trace; model: string; created_at: string };
const fromRow = (r: Row): StoredGuide => ({ ...r, createdAt: r.created_at });

function supabaseStore(url: string, key: string): GuideStore {
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const table = () => db.from("oauth_guides");
  return {
    async save(row) {
      const { data, error } = await table()
        .insert({ slug: row.slug, query: row.query, guide: row.guide, trace: row.trace, model: row.model })
        .select("id")
        .single();
      if (error) throw new Error(`Saving the guide failed: ${error.message}`);
      return data.id as string;
    },
    async get(id) {
      if (!UUID.test(id)) return null;
      const { data, error } = await table().select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? fromRow(data as Row) : null;
    },
    async latestFor(slug, maxAgeDays) {
      const { data, error } = await table()
        .select("*")
        .eq("slug", slug)
        .gte("created_at", since(maxAgeDays * 86_400_000))
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? fromRow(data as Row) : null;
    },
    async countSince(hours) {
      const { count, error } = await table()
        .select("id", { count: "exact", head: true })
        .gte("created_at", since(hours * 3_600_000));
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    async recent(limit) {
      const { data, error } = await table().select("*").order("created_at", { ascending: false }).limit(limit * 4);
      if (error) throw new Error(error.message);
      return newestPerSlug((data as Row[]).map(fromRow), limit);
    },
  };
}

function localStore(): GuideStore {
  const dir = path.join(process.cwd(), ".data", "generated");
  mkdirSync(dir, { recursive: true });
  const all = (): StoredGuide[] =>
    readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")) as StoredGuide);
  return {
    async save(row) {
      const id = randomUUID();
      const stored: StoredGuide = { ...row, id, createdAt: new Date().toISOString() };
      writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(stored, null, 2));
      return id;
    },
    async get(id) {
      if (!UUID.test(id)) return null;
      try {
        return JSON.parse(readFileSync(path.join(dir, `${id}.json`), "utf8")) as StoredGuide;
      } catch {
        return null;
      }
    },
    async latestFor(slug, maxAgeDays) {
      const cutoff = since(maxAgeDays * 86_400_000);
      return (
        all()
          .filter((g) => g.slug === slug && g.createdAt >= cutoff)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
      );
    },
    async countSince(hours) {
      const cutoff = since(hours * 3_600_000);
      return all().filter((g) => g.createdAt >= cutoff).length;
    },
    async recent(limit) {
      return newestPerSlug(all(), limit);
    },
  };
}
