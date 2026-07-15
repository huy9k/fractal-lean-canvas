#!/usr/bin/env node
import { createRequire } from "node:module";
import { markdownFromPath } from "./markdown/fromPath.js";
import { validateEcosystem } from "./validate/ecosystem.js";

const { version } = createRequire(import.meta.url)("../package.json") as {
  version: string;
};

const HELP = `Usage: flc <command>

Commands:
  validate <path>  Validate an FLC ecosystem
                   <path> is a directory containing root.json, or root.json itself
                   Recommended: ./recommended with nested bare JSON under ./recommended/nodes/
  markdown <path>  Render a canvas JSON file or ecosystem as markdown (stdout)

Options:
  -h, --help       Show help
  -v, --version    Show version
`;

/** Print help to stdout and exit 0. */
function printHelp(): never {
  console.log(HELP.trimEnd());
  process.exit(0);
}

/** Print version to stdout and exit 0. */
function printVersion(): never {
  console.log(version);
  process.exit(0);
}

/**
 * CLI entry: `flc validate|markdown <path>`
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printHelp();
  }
  if (args.includes("--version") || args.includes("-v")) {
    printVersion();
  }

  const [command, target] = args;

  if (!target || (command !== "validate" && command !== "markdown")) {
    console.error(HELP.trimEnd());
    process.exit(2);
  }

  if (command === "markdown") {
    const result = await markdownFromPath(target);
    if (!result.ok) {
      console.error(result.message);
      process.exit(1);
    }
    process.stdout.write(result.markdown);
    return;
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
