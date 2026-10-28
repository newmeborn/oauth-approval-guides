// Emits schema/guide.schema.json from the Zod source of truth.
import { mkdirSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { Guide, SCHEMA_VERSION } from "../lib/guide/schema";

const jsonSchema = z.toJSONSchema(Guide, { target: "draft-2020-12" });
const out = {
  ...jsonSchema,
  $id: `https://composio-oauth-guides/schema/guide-${SCHEMA_VERSION}.json`,
  title: "OAuth app setup & approval guide",
};

mkdirSync("schema", { recursive: true });
writeFileSync("schema/guide.schema.json", JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote schema/guide.schema.json (v${SCHEMA_VERSION})`);
