import { readdir, readFile, stat } from "node:fs/promises";
import {
  basename,
  dirname,
  join,
  normalize,
  relative,
  resolve,
} from "node:path";
import {
  ROOT_FILE_NAME,
  isEnvelope,
  unwrapCanvas,
  validateCanvasStructural,
  validateStructural,
  type StructuralIssue,
} from "./structural.js";
import { validateSemantic, type SemanticIssue } from "./semantic.js";
import type { FractalLeanCanvas } from "../schema/canvas.js";

export type ValidationIssue = (StructuralIssue | SemanticIssue) & {
  file: string;
};

export type EcosystemResult = {
  ok: boolean;
  filesChecked: number;
  issues: ValidationIssue[];
};

type LoadedDocument = {
  absolutePath: string;
  label: string;
  canvas: FractalLeanCanvas;
};

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
    if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(full);
    }
  }

  return files;
}

/**
 * Locate root.json for a directory or a path to root.json itself.
 */
async function locateRoot(
  targetPath: string,
): Promise<
  | { ok: true; rootFile: string; searchRoot: string }
  | { ok: false; issue: ValidationIssue }
> {
  const absolute = resolve(targetPath);
  let info;
  try {
    info = await stat(absolute);
  } catch {
    return {
      ok: false,
      issue: {
        file: relative(process.cwd(), absolute) || absolute,
        path: "",
        message: `Path not found: ${targetPath}`,
      },
    };
  }

  if (info.isFile()) {
    const label = relative(process.cwd(), absolute) || absolute;
    if (basename(absolute) !== ROOT_FILE_NAME) {
      return {
        ok: false,
        issue: {
          file: label,
          path: "",
          message: `Ecosystem root must be named ${ROOT_FILE_NAME}`,
        },
      };
    }
    return { ok: true, rootFile: absolute, searchRoot: dirname(absolute) };
  }

  const rootFile = join(absolute, ROOT_FILE_NAME);
  try {
    await stat(rootFile);
  } catch {
    return {
      ok: false,
      issue: {
        file: relative(process.cwd(), absolute) || absolute,
        path: "",
        message: `Missing ${ROOT_FILE_NAME} in ${relative(process.cwd(), absolute) || absolute}`,
      },
    };
  }
  return { ok: true, rootFile, searchRoot: absolute };
}

/**
 * Validate a single root envelope document (file refs are not followed).
 */
export function validateDocument(
  value: unknown,
  fileLabel: string,
): ValidationIssue[] {
  const structural = validateStructural(value).map((issue) => ({
    ...issue,
    file: fileLabel,
  }));
  if (structural.length > 0) return structural;

  const canvas = unwrapCanvas(value);
  return validateSemantic(canvas, undefined, { file: fileLabel }).map(
    (issue) => ({
      ...issue,
      file: fileLabel,
    }),
  );
}

/**
 * Lint a single-root ecosystem: root.json (envelope) + bare canvas ref targets.
 */
export async function validateEcosystem(
  targetPath: string,
): Promise<EcosystemResult> {
  const located = await locateRoot(targetPath);
  if (!located.ok) {
    return { ok: false, filesChecked: 0, issues: [located.issue] };
  }

  const { rootFile, searchRoot } = located;
  const absoluteFiles = await collectJsonFiles(searchRoot);
  const issues: ValidationIssue[] = [];
  const documents = new Map<string, LoadedDocument>();
  const rootAbsolute = normalize(resolve(rootFile));
  let rootDoc: LoadedDocument | undefined;

  for (const file of absoluteFiles) {
    const absolute = normalize(resolve(file));
    const label = relative(process.cwd(), absolute) || absolute;
    const isRoot = absolute === rootAbsolute;
    let parsed: unknown;

    try {
      const raw = await readFile(absolute, "utf8");
      parsed = JSON.parse(raw) as unknown;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      issues.push({
        file: label,
        path: "",
        message: `Failed to parse JSON: ${message}`,
      });
      continue;
    }

    if (isRoot) {
      const structural = validateStructural(parsed).map((issue) => ({
        ...issue,
        file: label,
      }));
      if (structural.length > 0) {
        issues.push(...structural);
        continue;
      }
      rootDoc = {
        absolutePath: absolute,
        label,
        canvas: unwrapCanvas(parsed),
      };
      documents.set(absolute, rootDoc);
      continue;
    }

    // Child files must be bare canvases (never envelopes).
    if (isEnvelope(parsed)) {
      issues.push({
        file: label,
        path: "",
        message: `Only ${ROOT_FILE_NAME} may use the versioned envelope; child files must be bare canvases`,
      });
      continue;
    }

    const structural = validateCanvasStructural(parsed).map((issue) => ({
      ...issue,
      file: label,
    }));
    if (structural.length > 0) {
      issues.push(...structural);
      continue;
    }

    documents.set(absolute, {
      absolutePath: absolute,
      label,
      canvas: parsed as FractalLeanCanvas,
    });
  }

  if (!rootDoc) {
    return {
      ok: false,
      filesChecked: absoluteFiles.length,
      issues:
        issues.length > 0
          ? issues
          : [
              {
                file: relative(process.cwd(), rootAbsolute) || rootAbsolute,
                path: "",
                message: `Failed to load ${ROOT_FILE_NAME}`,
              },
            ],
    };
  }

  // Refuse refs that target the root envelope file.
  const resolveFileRef = (
    ref: string,
    fromFile: string,
    slotPath: string,
  ): { canvas: FractalLeanCanvas; file: string } | SemanticIssue => {
    const fromDoc = [...documents.values()].find((d) => d.label === fromFile);
    const fromAbsolute =
      fromDoc?.absolutePath ??
      (fromFile.endsWith(".json") ? normalize(resolve(fromFile)) : "");

    if (!fromAbsolute) {
      return {
        path: slotPath,
        message: `Cannot resolve ref "${ref}" (unknown source file)`,
      };
    }

    const targetAbsolute = normalize(resolve(dirname(fromAbsolute), ref));
    if (targetAbsolute === rootAbsolute) {
      return {
        path: slotPath,
        message: `File ref must not target ${ROOT_FILE_NAME} (bare canvas only)`,
      };
    }

    const target = documents.get(targetAbsolute);
    if (!target) {
      return {
        path: slotPath,
        message: `Missing file ref "${ref}" (resolved ${relative(process.cwd(), targetAbsolute) || targetAbsolute})`,
      };
    }
    return { canvas: target.canvas, file: target.label };
  };

  // Single semantic walk from the versioned root.
  const seenIds = new Map<string, string>();
  const walkedFiles = new Set<string>();
  const idsRegisteredFor = new WeakSet<object>();

  const semanticIssues = validateSemantic(rootDoc.canvas, undefined, {
    file: rootDoc.label,
    seenIds,
    walkedFiles,
    idsRegisteredFor,
    resolveFileRef,
  });

  for (const issue of semanticIssues) {
    issues.push({ ...issue, file: issue.file ?? rootDoc.label });
  }

  // Every loaded file must be reachable from root.json (no orphans).
  for (const doc of documents.values()) {
    if (walkedFiles.has(doc.label)) continue;
    issues.push({
      file: doc.label,
      path: "",
      message: `Unreachable canvas file (not referenced from ${ROOT_FILE_NAME})`,
    });
  }

  return {
    ok: issues.length === 0,
    filesChecked: absoluteFiles.length,
    issues,
  };
}
