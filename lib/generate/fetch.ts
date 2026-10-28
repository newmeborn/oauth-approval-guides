/**
 * Plain-code page fetching for the generator. Code, not the model, decides what was read:
 * a page counts as a source only if this fetch got a 200 and real text back.
 */

export interface Page {
  url: string; // where it ended up after redirects
  title: string;
  text: string;
  links: { href: string; text: string }[];
}

export type FetchResult = { ok: true; page: Page } | { ok: false; url: string; reason: string };

const UA = "Mozilla/5.0 (compatible; OAuthApprovalGuides/0.1; take-home prototype)";
const MAX_BYTES = 3_000_000;
const MAX_TEXT = 12_000;

/** The URLs come from a model and from users, so never let them reach private networks. */
export function isPublicHttpUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  if (u.port && u.port !== "80" && u.port !== "443") return false;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return false;
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return false;
  if (h.includes(":") || /^\d+\.\d+\.\d+\.\d+$/.test(h)) return false; // no IP literals at all
  return h.includes(".");
}

/**
 * Ask for English explicitly. Without it, Google's docs answered in Korean and Hindi depending
 * on where the request came from, and links carrying ?hl=pt-br pinned other languages.
 */
export function englishUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.searchParams.has("hl")) u.searchParams.set("hl", "en");
    return u.toString();
  } catch {
    return url;
  }
}

export async function fetchPage(rawUrl: string, retried = false): Promise<FetchResult> {
  const url = englishUrl(rawUrl);
  if (!isPublicHttpUrl(url)) return { ok: false, url, reason: "not a public web address" };
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,text/plain,text/markdown;q=0.9,*/*;q=0.5",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { ok: false, url, reason: `HTTP ${res.status}` };
    if (!isPublicHttpUrl(res.url)) return { ok: false, url, reason: "redirected off the public web" };
    const type = res.headers.get("content-type") ?? "";
    if (!/text\/(html|plain|markdown)|application\/xhtml/.test(type)) return { ok: false, url, reason: `not a web page (${type.split(";")[0] || "unknown type"})` };
    const body = (await res.text()).slice(0, MAX_BYTES);
    const page = /html/.test(type) ? fromHtml(body, res.url) : fromText(body, res.url);
    if (page.text.split(/\s+/).length < 40) return { ok: false, url, reason: "almost no text (probably rendered by JavaScript)" };
    return { ok: true, page };
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") return { ok: false, url, reason: "timed out" };
    // Some docs sites reset connections intermittently (seen with developers.zoom.us); one retry.
    if (!retried) {
      await new Promise((r) => setTimeout(r, 1000));
      return fetchPage(url, true);
    }
    return { ok: false, url, reason: "connection refused or reset" };
  }
}

function fromText(body: string, url: string): Page {
  const links = [...body.matchAll(/\[([^\]]{1,200})\]\((https?:\/\/[^)\s]+)\)/g)].map((m) => ({ text: m[1], href: m[2] }));
  const title = body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? new URL(url).hostname;
  return { url, title, text: body.slice(0, MAX_TEXT), links };
}

function fromHtml(html: string, url: string): Page {
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim() || new URL(url).hostname;
  let body = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|iframe|template)\b[\s\S]*?<\/\1>/gi, " ");
  // Prefer the main content; docs sites wrap it in <main> or <article>.
  const main = largest(body, /<main\b[\s\S]*?<\/main>/gi) ?? largest(body, /<article\b[\s\S]*?<\/article>/gi);
  if (main) body = main;
  body = body.replace(/<(nav|header|footer|aside|form)\b[\s\S]*?<\/\1>/gi, " ");

  const links: Page["links"] = [];
  for (const m of body.matchAll(/<a\b[^>]*href=["']([^"'#]+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      links.push({ href: new URL(decode(m[1]), url).toString(), text: decode(m[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim() });
    } catch {
      /* skip malformed links */
    }
  }

  const text = decode(
    body
      .replace(/<(h[1-6])\b[^>]*>/gi, "\n\n## ")
      .replace(/<li\b[^>]*>/gi, "\n- ")
      .replace(/<(br|hr)\b[^>]*>/gi, "\n")
      .replace(/<\/(p|div|section|tr|table|pre|blockquote|h[1-6]|ul|ol|dl|dd|dt)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim()
    .slice(0, MAX_TEXT);
  return { url, title, text, links };
}

function largest(html: string, re: RegExp): string | null {
  let best: string | null = null;
  for (const m of html.matchAll(re)) if (!best || m[0].length > best.length) best = m[0];
  return best;
}

function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

/** Registrable-ish domain: "developers.notion.com" -> "notion.com". Good enough to tell the provider's pages apart. */
export function siteOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").split(".").slice(-2).join(".");
  } catch {
    return "";
  }
}

/** Does any fetched page look like it is about app review / publishing? Judged by URL and title. */
export function coversReview(pages: Page[]): boolean {
  return pages.some((p) => new RegExp(TOPICS[1].source, "i").test(`${p.url} ${p.title}`));
}

/** The questions a guide must answer, each with the words that give its pages away. */
const TOPICS: RegExp[] = [
  /oauth|authori[sz]|\bauth\b|redirect|consent|scope|permission|public.?(integration|connection|app)/gi, // how to connect
  /review|verif|approv|publish|submi|listing|marketplace|distribut|directory|go.?live|production/gi, // what gets checked
  /pricing|price|\bplans?\b|tiers?\b|billing|credits?\b|\bcost|\bpaid\b|subscription|access.?levels?|getting.?access|enterprise/gi, // what it costs
  /terms|polic|guideline|security|assessment|compliance|data.?(use|deletion|protection)|partner/gi, // rules
  /rate.?limit|quota|\blimits\b/gi, // limits
];

/**
 * Pick links that answer our questions. Topics take turns, so a pricing page gets a slot even
 * when a docs site has fifty auth pages that would outscore it on raw keyword hits.
 */
export function relevantLinks(links: Page["links"], allowedSites: Set<string>, seen: Set<string>): string[] {
  const byTopic = TOPICS.map(() => new Map<string, number>());
  for (const { href, text } of links) {
    const clean = href.split("#")[0];
    if (seen.has(clean) || !allowedSites.has(siteOf(clean)) || !isPublicHttpUrl(clean)) continue;
    const hay = `${clean} ${text}`;
    TOPICS.forEach((re, i) => {
      const hits = (hay.match(re) ?? []).length;
      if (hits) byTopic[i].set(clean, Math.max(byTopic[i].get(clean) ?? 0, hits));
    });
  }
  const ranked = byTopic.map((m) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([u]) => u));
  const out: string[] = [];
  for (let round = 0; ranked.some((r) => r.length > round); round++)
    for (const r of ranked) if (r[round] && !out.includes(r[round])) out.push(r[round]);
  return out;
}

/** Run tasks with a small concurrency limit, reporting each result as it lands. */
export async function pool<T, R>(items: T[], limit: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await run(items[i]);
      }
    }),
  );
  return out;
}
