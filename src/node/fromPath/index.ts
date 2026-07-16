import {
  basename,
  dirname,
  join,
  normalize,
  relative,
  resolve,
} from "node:path";
import { readdir, readFile, stat } from "node:fs/promises";
import type { FractalLeanCanvas } from "../../shared/schema/canvas.js";
import { DEFAULT_SCHEMA_URI } from "../../shared/schema/envelope.js";
import {
  ROOT_FILE_NAME,
  isEnvelope,
  unwrapCanvas,
  validateCanvasStructural,
  validateStructural,
} from "../../shared/validate/structural.js";
import { collectCanvasSlots } from "../../shared/validate/semantic.js";
import { markdownCanvas, markdownEcosystem } from "../../shared/markdown/render.js";
import { leanHtmlCanvas, leanHtmlEcosystem } from "../../shared/markdown/leanHtml.js";
import { jsonCanvas } from "../../shared/json/inline.js";

export type RenderFormat = "markdown" | "html-table" | "json";

export type RenderFromPathOptions = {
  /** Follow node ids and render linked canvases (default: false). */
  recursive?: boolean;
  /** Output format (default: markdown). */
  format?: RenderFormat;
};

export type RenderFromPathResult =
  | { ok: true; output: string; filesRendered: number }
  | { ok: false; message: string };

export type MarkdownFromPathResult =
  | { ok: true; markdown: string; filesRendered: number }
  | { ok: false; message: string };

/**
 * Recursively list .json files under a directory.
 */
async function collectJsonFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectJsonFiles(full)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".json")) files.push(full);
  }
  return files;
}

/**
 * Walk parents until a directory containing root.json is found.
 */
async function findEcosystemRoot(
  startDir: string,
): Promise<string | undefined> {
  let dir = resolve(startDir);
  for (;;) {
    try {
      await stat(join(dir, ROOT_FILE_NAME));
      return dir;
    } catch {
      const parent = dirname(dir);
      if (parent === dir) return undefined;
      dir = parent;
    }
  }
}

type LoadedCanvas = {
  canvas: FractalLeanCanvas;
  $schema: string;
};

type LoadedEcosystem = LoadedCanvas & {
  byId: Map<string, FractalLeanCanvas>;
};

/**
 * Load every canvas under an ecosystem search root (requires root.json).
 */
async function loadEcosystem(
  searchRoot: string,
): Promise<LoadedEcosystem | { message: string }> {
  const rootFile = join(searchRoot, ROOT_FILE_NAME);
  const byId = new Map<string, FractalLeanCanvas>();
  let root: FractalLeanCanvas | undefined;
  let $schema = DEFAULT_SCHEMA_URI;
  const files = await collectJsonFiles(searchRoot);
  const rootAbsolute = normalize(resolve(rootFile));

  for (const file of files) {
    const abs = normalize(resolve(file));
    const label = relative(process.cwd(), abs) || abs;
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(abs, "utf8")) as unknown;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { message: `${label}: failed to parse JSON: ${message}` };
    }

    if (abs === rootAbsolute) {
      const issues = validateStructural(parsed);
      if (issues.length > 0) {
        return {
          message: `${label}: ${issues.map((i) => i.message).join("; ")}`,
        };
      }
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "$schema" in parsed &&
        typeof parsed.$schema === "string"
      ) {
        $schema = parsed.$schema;
      }
      root = unwrapCanvas(parsed);
      byId.set(root.id, root);
      continue;
    }

    const issues = validateCanvasStructural(parsed);
    if (issues.length > 0) {
      return {
        message: `${label}: ${issues.map((i) => i.message).join("; ")}`,
      };
    }
    const canvas = parsed as FractalLeanCanvas;
    if (byId.has(canvas.id)) {
      return { message: `${label}: duplicate canvas id "${canvas.id}"` };
    }
    byId.set(canvas.id, canvas);
  }

  if (!root) return { message: `Failed to load ${ROOT_FILE_NAME}` };
  return { canvas: root, byId, $schema };
}

/** Parse a single JSON file into a canvas. */
async function loadSingleCanvas(
  absolute: string,
): Promise<LoadedCanvas | { message: string }> {
  const label = relative(process.cwd(), absolute) || absolute;
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(absolute, "utf8")) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { message: `${label}: failed to parse JSON: ${message}` };
  }

  if (isEnvelope(parsed)) {
    const issues = validateStructural(parsed);
    if (issues.length > 0) {
      return {
        message: `${label}: ${issues.map((i) => i.message).join("; ")}`,
      };
    }
    return {
      canvas: unwrapCanvas(parsed),
      $schema:
        typeof parsed.$schema === "string"
          ? parsed.$schema
          : DEFAULT_SCHEMA_URI,
    };
  }

  const issues = validateCanvasStructural(parsed);
  if (issues.length > 0) {
    return {
      message: `${label}: ${issues.map((i) => i.message).join("; ")}`,
    };
  }
  return {
    canvas: parsed as FractalLeanCanvas,
    $schema: DEFAULT_SCHEMA_URI,
  };
}

/** Count canvases reachable from start via node ids. */
function reachableCount(
  start: FractalLeanCanvas,
  byId: Map<string, FractalLeanCanvas>,
): number {
  const visited = new Set<string>();
  const walk = (canvas: FractalLeanCanvas): void => {
    if (visited.has(canvas.id)) return;
    visited.add(canvas.id);
    for (const { slot } of collectCanvasSlots(canvas, "")) {
      const child = byId.get(slot.id);
      if (child) walk(child);
    }
  };
  walk(start);
  return visited.size;
}

/** Project one or many canvases for the chosen format. */
function project(
  format: RenderFormat,
  start: FractalLeanCanvas,
  byId: Map<string, FractalLeanCanvas> | undefined,
  recursive: boolean,
  $schema: string,
): { output: string; filesRendered: number } {
  if (format === "json") {
    if (recursive && byId) {
      return {
        output: jsonCanvas(start, { byId, $schema }),
        filesRendered: reachableCount(start, byId),
      };
    }
    return {
      output: jsonCanvas(start, { $schema }),
      filesRendered: 1,
    };
  }

  if (recursive && byId) {
    const output =
      format === "html-table"
        ? leanHtmlEcosystem(start, byId)
        : markdownEcosystem(start, byId);
    return { output, filesRendered: reachableCount(start, byId) };
  }

  const output =
    format === "html-table" ? leanHtmlCanvas(start) : markdownCanvas(start);
  return { output, filesRendered: 1 };
}

/**
 * Render a canvas file or ecosystem directory to markdown, Lean Canvas HTML, or JSON.
 *
 * Default: only the targeted canvas (directory → root.json only).
 * `recursive: true`: follow node ids (markdown/html as separate docs;
 * json inlines child canvases into one tree).
 */
export async function renderFromPath(
  targetPath: string,
  options: RenderFromPathOptions = {},
): Promise<RenderFromPathResult> {
  const recursive = options.recursive === true;
  const format: RenderFormat = options.format ?? "markdown";
  const absolute = resolve(targetPath);

  let info;
  try {
    info = await stat(absolute);
  } catch {
    return { ok: false, message: `Path not found: ${targetPath}` };
  }

  if (info.isDirectory()) {
    const loaded = await loadEcosystem(absolute);
    if ("message" in loaded) return { ok: false, message: loaded.message };
    return {
      ok: true,
      ...project(format, loaded.canvas, loaded.byId, recursive, loaded.$schema),
    };
  }

  if (basename(absolute) === ROOT_FILE_NAME) {
    if (!recursive) {
      const single = await loadSingleCanvas(absolute);
      if ("message" in single) return { ok: false, message: single.message };
      return {
        ok: true,
        ...project(format, single.canvas, undefined, false, single.$schema),
      };
    }
    const loaded = await loadEcosystem(dirname(absolute));
    if ("message" in loaded) return { ok: false, message: loaded.message };
    return {
      ok: true,
      ...project(format, loaded.canvas, loaded.byId, true, loaded.$schema),
    };
  }

  const single = await loadSingleCanvas(absolute);
  if ("message" in single) return { ok: false, message: single.message };

  if (!recursive) {
    return {
      ok: true,
      ...project(format, single.canvas, undefined, false, single.$schema),
    };
  }

  const searchRoot = await findEcosystemRoot(dirname(absolute));
  if (!searchRoot) {
    return {
      ok: false,
      message: `Cannot resolve node ids (-r): no ${ROOT_FILE_NAME} above ${relative(process.cwd(), absolute) || absolute}`,
    };
  }
  const loaded = await loadEcosystem(searchRoot);
  if ("message" in loaded) return { ok: false, message: loaded.message };
  const start = loaded.byId.get(single.canvas.id);
  if (!start) {
    return {
      ok: false,
      message: `Canvas id "${single.canvas.id}" not found in ecosystem`,
    };
  }
  return {
    ok: true,
    ...project(format, start, loaded.byId, true, loaded.$schema),
  };
}

/** Render path as sectioned markdown tables. */
export async function markdownFromPath(
  targetPath: string,
  options: Omit<RenderFromPathOptions, "format"> = {},
): Promise<MarkdownFromPathResult> {
  const result = await renderFromPath(targetPath, {
    ...options,
    format: "markdown",
  });
  if (!result.ok) return result;
  return {
    ok: true,
    markdown: result.output,
    filesRendered: result.filesRendered,
  };
}

/** Render path as classic Lean Canvas HTML table(s). */
export async function htmlTableFromPath(
  targetPath: string,
  options: Omit<RenderFromPathOptions, "format"> = {},
): Promise<RenderFromPathResult> {
  return renderFromPath(targetPath, { ...options, format: "html-table" });
}

/** Render path as JSON (with `-r`, node refs become inlined canvases). */
export async function jsonFromPath(
  targetPath: string,
  options: Omit<RenderFromPathOptions, "format"> = {},
): Promise<RenderFromPathResult> {
  return renderFromPath(targetPath, { ...options, format: "json" });
}
