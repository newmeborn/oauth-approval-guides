/** Turn what the developer typed ("Notion", "notion.so", "https://www.notion.so") into a label and slug. */
export interface ParsedQuery {
  label: string; // what we tell the researcher
  slug: string; // cache and URL key
}

export function parseQuery(raw: unknown): ParsedQuery | null {
  if (typeof raw !== "string") return null;
  const q = raw.replace(/[\r\n\t]+/g, " ").trim();
  if (q.length < 2 || q.length > 80) return null;

  let host: string | null = null;
  const looksLikeUrl = /^https?:\/\//i.test(q) || (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(q) && !q.includes(" "));
  if (looksLikeUrl) {
    try {
      host = new URL(/^https?:\/\//i.test(q) ? q : `https://${q}`).hostname.replace(/^www\./, "");
    } catch {
      host = null;
    }
  }
  const base = host ? (host.split(".").slice(-2, -1)[0] ?? host) : q;
  const slug = base
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) return null;
  return { label: host ? `${base} (${host})` : q, slug };
}
