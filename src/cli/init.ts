import { mkdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import {
  blankCanvasJson,
  blankRootEnvelopeJson,
} from "../shared/blank/index.js";
import { ROOT_FILE_NAME } from "../shared/validate/structural.js";

const FLC_SUFFIX = ".flc.json";

export type InitCliOptions = {
  /** Target path (file or directory for --root). */
  path: string;
  /** Write a versioned root envelope instead of a bare canvas. */
  root: boolean;
  /** Overwrite an existing file. */
  force: boolean;
};

/** True when the path already ends with .flc.json */
function hasFlcSuffix(path: string): boolean {
  return path.toLowerCase().endsWith(FLC_SUFFIX);
}

/** Filename stem used as the default canvas title */
function titleFromFilePath(filePath: string): string {
  const name = basename(filePath);
  const stem = hasFlcSuffix(name)
    ? name.slice(0, -FLC_SUFFIX.length)
    : name.replace(/\.json$/i, "");
  return stem.trim() || "Untitled";
}

/** Slug id from title when it is not the Untitled default */
function idFromTitle(title: string): string | undefined {
  if (title === "Untitled") return undefined;
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || undefined;
}

/** Ensure the path ends with .flc.json */
function withFlcSuffix(path: string): string {
  return hasFlcSuffix(path) ? path : `${path}${FLC_SUFFIX}`;
}

/**
 * Resolve the file path to write for init.
 * --root + directory → `<dir>/root.flc.json`.
 */
async function resolveOutputPath(
  target: string,
  asRoot: boolean,
): Promise<string> {
  const absolute = resolve(target);

  let isDirectory = target.endsWith("/") || target.endsWith("\\");
  if (!isDirectory) {
    try {
      isDirectory = (await stat(absolute)).isDirectory();
    } catch {
      isDirectory = false;
    }
  }

  if (asRoot && isDirectory) {
    return join(absolute, ROOT_FILE_NAME);
  }

  if (!asRoot && isDirectory) {
    throw new Error(
      `Path is a directory: ${target} (provide a file path, or use --root for ${ROOT_FILE_NAME})`,
    );
  }

  return withFlcSuffix(absolute);
}

/**
 * Write a blank bare canvas or root envelope to disk.
 * Returns the absolute path written.
 */
export async function runInit(options: InitCliOptions): Promise<string> {
  const outputPath = await resolveOutputPath(options.path, options.root);

  try {
    await stat(outputPath);
    if (!options.force) {
      throw new Error(
        `File already exists: ${outputPath} (use --force to overwrite)`,
      );
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("File already exists")
    ) {
      throw error;
    }
    // ENOENT — fine to create
  }

  const title = titleFromFilePath(outputPath);
  const content = options.root
    ? blankRootEnvelopeJson({ title })
    : blankCanvasJson({ title, id: idFromTitle(title) });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, content, "utf8");
  return outputPath;
}
