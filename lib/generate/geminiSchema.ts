/**
 * Zod -> the JSON Schema subset Gemini's structured output accepts.
 * Gemini wants nullable fields as type arrays (["string", "null"]) rather than anyOf, which
 * also keeps the schema's branching low enough to avoid "too complex" 400s.
 */
import { z } from "zod";

type Json = Record<string, unknown>;

export function toGeminiSchema(schema: z.ZodType): Json {
  return clean(z.toJSONSchema(schema, { target: "draft-2020-12" })) as Json;
}

function clean(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(clean);
  if (!node || typeof node !== "object") return node;
  const out: Json = {};
  for (const [k, v] of Object.entries(node as Json)) {
    if (k === "$schema" || k === "$id" || k === "pattern") continue;
    if (k === "const") {
      out.enum = [v];
      continue;
    }
    out[k] = clean(v);
  }
  const anyOf = out.anyOf as Json[] | undefined;
  if (anyOf?.length === 2 && anyOf.some((s) => s.type === "null")) {
    const other = anyOf.find((s) => s.type !== "null")!;
    if (typeof other.type === "string") {
      const { anyOf: _drop, ...rest } = out;
      return { ...rest, ...other, type: [other.type, "null"] };
    }
  }
  return out;
}
