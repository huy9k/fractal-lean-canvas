#!/usr/bin/env node
import { createRequire } from "node:module";
import { VersionedFractalEnvelope } from "../shared/schema/envelope.js";
import {
  htmlTableFromPath,
  jsonFromPath,
  markdownFromPath,
} from "../node/fromPath/index.js";
import { validateEcosystem } from "../node/ecosystem/index.js";
import { runInit } from "./init.js";

const { version } = createRequire(import.meta.url)("../../package.json") as {
  version: string;
};

const HELP = `Usage: fractal-lean-canvas <command>

Commands:
  validate <path>              Validate an FLC ecosystem
                               <path> is a directory containing root.flc.json, or root.flc.json itself
                               Recommended: ./recommended with nested bare JSON under ./recommended/nodes/
  init <path>                  Create a blank bare .flc.json canvas
  init --root <path>           Create a blank versioned root envelope
                               Directory path → <dir>/root.flc.json
  markdown <path> [-r]         Render list/heading markdown (stdout)
  html-table <path> [-r]       Render classic Lean Canvas as pure HTML (stdout)
  json <path> [-r]             Print versioned FLC JSON (with -r, inline nodes)
  schema                       Print the raw JSON Schema of the envelope (stdout)

Options:
  -r, --recursive  Follow node ids (markdown/html: extra docs; json: inline tree)
  --force          Overwrite existing file (init)
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

/** Parse init flags: --root <path> or positional path, plus --force. */
function parseInitArgs(args: string[]): {
  path: string;
  root: boolean;
  force: boolean;
} {
  const force = args.includes("--force");
  const rootIdx = args.indexOf("--root");
  if (rootIdx !== -1) {
    const path = args[rootIdx + 1];
    if (!path || path.startsWith("-")) {
      console.error("init --root requires a path");
      process.exit(2);
    }
    return { path, root: true, force };
  }

  const positional = args.filter(
    (a) => a !== "--force" && a !== "-r" && a !== "--recursive",
  );
  const path = positional[0];
  if (!path || path.startsWith("-")) {
    console.error("init requires a path");
    process.exit(2);
  }
  return { path, root: false, force };
}

/**
 * CLI entry: `fractal-lean-canvas validate|init|markdown|html-table|json <path>`
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
  const positional = args.filter(
    (a) =>
      a !== "-r" && a !== "--recursive" && a !== "--force" && a !== "--root",
  );

  // Drop the value that follows --root from positional command detection
  const rootIdx = args.indexOf("--root");
  const rootValue = rootIdx !== -1 ? args[rootIdx + 1] : undefined;
  const commandArgs = positional.filter((a) => a !== rootValue);
  const [command, target] = commandArgs;

  if (command === "schema") {
    process.stdout.write(
      JSON.stringify(VersionedFractalEnvelope, null, 2) + "\n",
    );
    return;
  }

  if (command === "init") {
    const initArgs = args.slice(1);
    const options = parseInitArgs(initArgs);
    const written = await runInit(options);
    console.log(`Wrote ${written}`);
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
