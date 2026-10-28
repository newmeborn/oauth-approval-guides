import { generateGuide, type GenEvent } from "@/lib/generate/pipeline";
import { parseQuery } from "@/lib/generate/query";
import { findInLibrary } from "@/lib/guide/library";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Free-tier Google Search grounding allows 500 requests a day; stay well under it. */
const DAILY_CAP = 150;
/** Reuse a guide generated in the last two weeks unless the caller asks for a fresh one. */
const CACHE_DAYS = 14;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { query?: unknown; fresh?: unknown } | null;
  const parsed = parseQuery(body?.query);
  if (!parsed) return Response.json({ error: "Enter an app name or website (2 to 80 characters)." }, { status: 400 });
  if (!process.env.GEMINI_API_KEY)
    return Response.json({ error: "The generator is not configured yet (no GEMINI_API_KEY)." }, { status: 503 });
  const store = getStore();
  if (!store) return Response.json({ error: "Guide storage is not configured (no Supabase)." }, { status: 503 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: GenEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        const library = findInLibrary(parsed.slug);
        if (library) emit({ t: "library", path: `/guides/${library.app.slug}`, name: library.app.name });

        if (body?.fresh !== true) {
          const cached = await store.latestFor(parsed.slug, CACHE_DAYS);
          if (cached) {
            emit({ t: "cached", path: `/g/${cached.id}`, createdAt: cached.createdAt });
            return;
          }
        }
        if ((await store.countSince(24)) >= DAILY_CAP) {
          emit({ t: "error", message: "Today's free generation quota is used up. Try again tomorrow, or browse the library." });
          return;
        }

        const { guide, trace } = await generateGuide(parsed.label, parsed.slug, emit);
        emit({ t: "stage", stage: "save", message: "Saving a shareable link" });
        const id = await store.save({ slug: parsed.slug, query: parsed.label, guide, trace, model: trace.models.structure });
        emit({ t: "done", path: `/g/${id}` });
      } catch (err) {
        emit({ t: "error", message: friendly(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}

function friendly(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(msg)) return "Gemini's free-tier rate limit was hit. Wait a minute and try again.";
  if (/API key not valid|PERMISSION_DENIED|\b401\b|\b403\b/i.test(msg)) return "The Gemini API key was rejected. Check GEMINI_API_KEY.";
  return msg;
}
