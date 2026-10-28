// Validates every guides/*.json against the schema and the integrity rules, and prints each verdict.
import { readdirSync, readFileSync } from "node:fs";
import { Guide } from "../lib/guide/schema";
import { checkIntegrity, TIER_LABEL, verdictFor } from "../lib/guide/tiers";
import { whenText } from "../lib/guide/format";

let failed = false;
for (const file of readdirSync("guides").filter((f) => f.endsWith(".json"))) {
  const parsed = Guide.safeParse(JSON.parse(readFileSync(`guides/${file}`, "utf8")));
  if (!parsed.success) {
    failed = true;
    console.error(`✗ ${file}: schema errors\n${parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n")}`);
    continue;
  }
  const problems = checkIntegrity(parsed.data);
  if (problems.length) {
    failed = true;
    console.error(`✗ ${file}: integrity problems\n${problems.map((p) => `  ${p}`).join("\n")}`);
    continue;
  }
  console.log(`✓ ${file}`);
  for (const level of parsed.data.accessLevels) {
    const v = verdictFor(parsed.data, level);
    const scale = v.tierAtScale !== v.tierAtLaunch ? ` → ${TIER_LABEL[v.tierAtScale]} ${whenText(v.scaleGates.map((g) => g.threshold))}` : "";
    console.log(`    ${level.name}: ${TIER_LABEL[v.tierAtLaunch]}${scale}`);
  }
}
process.exit(failed ? 1 : 0);
