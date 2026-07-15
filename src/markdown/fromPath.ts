import {
  basename,
  dirname,
  join,
  normalize,
  relative,
  resolve,
} from "node:path";
import { readdir, readFile, stat } from "node:fs/promises";
import type { FractalLeanCanvas } from "../schema/canvas.js";
import {
  ROOT_FILE_NAME,
  isEnvelope,
  unwrapCanvas,
  validateCanvasStructural,
  validateStructural,
} from "../validate/structural.js";
import { markdownCanvas, markdownEcosystem } from "./render.js";

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
 * Render markdown from a canvas file or an ecosystem directory.
 */
export async function markdownFromPath(
  targetPath: string,
): Promise<MarkdownFromPathResult> {
  const absolute = resolve(targetPath);
  let info;
  try {
    info = await stat(absolute);
  } catch {
    return { ok: false, message: `Path not found: ${targetPath}` };
  }

  // Directory (or explicit root.json) → full ecosystem projection.
  const asEcosystem =
    info.isDirectory() ||
    (info.isFile() && basename(absolute) === ROOT_FILE_NAME);

  if (asEcosystem) {
    const searchRoot = info.isDirectory() ? absolute : dirname(absolute);
    const rootFile = join(searchRoot, ROOT_FILE_NAME);
    try {
      await stat(rootFile);
    } catch {
      return {
        ok: false,
        message: `Missing ${ROOT_FILE_NAME} in ${relative(process.cwd(), searchRoot) || searchRoot}`,
      };
    }

    const byId = new Map<string, FractalLeanCanvas>();
    let root: FractalLeanCanvas | undefined;
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
        return {
          ok: false,
          message: `${label}: failed to parse JSON: ${message}`,
        };
      }

      if (abs === rootAbsolute) {
        const issues = validateStructural(parsed);
        if (issues.length > 0) {
          return {
            ok: false,
            message: `${label}: ${issues.map((i) => i.message).join("; ")}`,
          };
        }
        root = unwrapCanvas(parsed);
        byId.set(root.id, root);
        continue;
      }

      const issues = validateCanvasStructural(parsed);
      if (issues.length > 0) {
        return {
          ok: false,
          message: `${label}: ${issues.map((i) => i.message).join("; ")}`,
        };
      }
      const canvas = parsed as FractalLeanCanvas;
      if (byId.has(canvas.id)) {
        return {
          ok: false,
          message: `${label}: duplicate canvas id "${canvas.id}"`,
        };
      }
      byId.set(canvas.id, canvas);
    }

    if (!root) {
      return { ok: false, message: `Failed to load ${ROOT_FILE_NAME}` };
    }

    return {
      ok: true,
      markdown: markdownEcosystem(root, byId),
      filesRendered: byId.size,
    };
  }

  // Single bare (or envelope) JSON file.
  const label = relative(process.cwd(), absolute) || absolute;
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(absolute, "utf8")) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `${label}: failed to parse JSON: ${message}` };
  }

  if (isEnvelope(parsed)) {
    const issues = validateStructural(parsed);
    if (issues.length > 0) {
      return {
        ok: false,
        message: `${label}: ${issues.map((i) => i.message).join("; ")}`,
      };
    }
    return {
      ok: true,
      markdown: markdownCanvas(unwrapCanvas(parsed)),
      filesRendered: 1,
    };
  }

  const issues = validateCanvasStructural(parsed);
  if (issues.length > 0) {
    return {
      ok: false,
      message: `${label}: ${issues.map((i) => i.message).join("; ")}`,
    };
  }

  return {
    ok: true,
    markdown: markdownCanvas(parsed as FractalLeanCanvas),
    filesRendered: 1,
  };
}
