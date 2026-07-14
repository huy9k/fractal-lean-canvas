#!/usr/bin/env node
import { validateEcosystem } from "./validate/ecosystem.js";

/**
 * CLI entry: `flc validate <path>`
 */
async function main(): Promise<void> {
  const [, , command, target] = process.argv;

  if (command !== "validate" || !target) {
    console.error("Usage: flc validate <path>");
    console.error(
      "  <path> is a directory containing root.json, or root.json itself",
    );
    process.exit(2);
  }

  const result = await validateEcosystem(target);

  if (!result.ok) {
    for (const issue of result.issues) {
      const loc = issue.path ? `${issue.file}:${issue.path}` : issue.file;
      console.error(`${loc} — ${issue.message}`);
    }
    if (result.filesChecked > 0) {
      console.error(
        `\n${result.issues.length} issue(s) in ${result.filesChecked} file(s)`,
      );
    }
    process.exit(1);
  }

  console.log(`OK — ${result.filesChecked} file(s) validated`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
