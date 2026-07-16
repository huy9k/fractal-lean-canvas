#!/usr/bin/env node
import { createRequire } from "node:module";
import { VersionedFractalEnvelope } from "../shared/schema/envelope.js";
import {
  htmlTableFromPath,
  jsonFromPath,
  markdownFromPath,
} from "../node/fromPath/index.js";
import { validateEcosystem } from "../node/ecosystem/index.js";

const { version } = createRequire(import.meta.url)("../../package.json") as {
  version: string;
};

const HELP = `Usage: fractal-lean-canvas <command>

Commands:
  validate <path>              Validate an FLC ecosystem
                               <path> is a directory containing root.flc.json, or root.flc.json itself
                               Recommended: ./recommended with nested bare JSON under ./recommended/nodes/
  markdown <path> [-r]         Render list/heading markdown (stdout)
  html-table <path> [-r]       Render classic Lean Canvas as pure HTML (stdout)
  json <path> [-r]             Print versioned FLC JSON (with -r, inline nodes)
  schema                       Print the raw JSON Schema of the envelope (stdout)

Options:
  -r, --recursive  Follow node ids (markdown/html: extra docs; json: inline tree)
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
 * CLI entry: `fractal-lean-canvas validate|markdown|html-table|json <path>`
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printHelp();
  }
  if (args.includes("--version") || args.includes("-v")) {
    printVersion();
  }

  const recursive = args.includes("-r") || args.includes("--recursive");
  const positional = args.filter((a) => a !== "-r" && a !== "--recursive");
  const [command, target] = positional;

  if (command === "schema") {
    process.stdout.write(
      JSON.stringify(VersionedFractalEnvelope, null, 2) + "\n",
    );
    return;
  }

  const renderCommands = new Set(["markdown", "html-table", "json"]);
  if (
    !target ||
    (command !== "validate" && !renderCommands.has(command ?? ""))
  ) {
    console.error(HELP.trimEnd());
    process.exit(2);
  }

  if (command === "markdown") {
    const result = await markdownFromPath(target, { recursive });
    if (!result.ok) {
      console.error(result.message);
      process.exit(1);
    }
    process.stdout.write(result.markdown);
    return;
  }

  if (command === "html-table") {
    const result = await htmlTableFromPath(target, { recursive });
    if (!result.ok) {
      console.error(result.message);
      process.exit(1);
    }
    process.stdout.write(result.output);
    return;
  }

  if (command === "json") {
    const result = await jsonFromPath(target, { recursive });
    if (!result.ok) {
      console.error(result.message);
      process.exit(1);
    }
    process.stdout.write(result.output);
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
