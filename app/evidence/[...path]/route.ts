/**
 * Serves the repo's evidence/ folder (screenshots and test logs), so a claim marked Tested links
 * to the proof itself. Read-only, image and markdown files only, no path escapes.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(process.cwd(), "evidence");
const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".md": "text/plain; charset=utf-8",
};

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const rel = (await params).path.join("/");
  const file = path.resolve(ROOT, rel);
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type || !file.startsWith(ROOT + path.sep)) return new Response("Not found", { status: 404 });
  try {
    const body = await readFile(file);
    return new Response(body, { headers: { "Content-Type": type, "Cache-Control": "public, max-age=3600" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
