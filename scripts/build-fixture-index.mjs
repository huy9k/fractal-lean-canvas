#!/usr/bin/env node
/**
 * Walks fixtures/<folder>/*.flc.json and writes one index.json per folder
 * under .fixture-index/ for the fixture-index branch.
 */

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES_DIR = join(REPO_ROOT, "fixtures");
const OUT_ROOT = join(REPO_ROOT, ".fixture-index");

/** Recursively collect .flc.json paths under dir. */
async function findFlcFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await findFlcFiles(path)));
    else if (entry.name.endsWith(".flc.json")) files.push(path);
  }
  return files;
}

/** Unwrap root envelope to the bare canvas object. */
function asCanvas(doc) {
  if (doc && typeof doc === "object" && doc.data && doc.schemaVersion)
    return doc.data;
  return doc;
}

/** Record parentId for every node: { id } link under a canvas. */
function collectParents(value, parentId, parentOf) {
  if (value === null || typeof value !== "object") return;

  if (Array.isArray(value)) {
    for (const item of value) collectParents(item, parentId, parentOf);
    return;
  }

  const node = value.node;
  if (node && typeof node === "object" && typeof node.id === "string") {
    parentOf.set(node.id, parentId);
    // Inline nested canvases (have title) are walked as their own parent.
    if (typeof node.title === "string") collectParents(node, node.id, parentOf);
  }

  for (const [key, child] of Object.entries(value)) {
    if (key === "node") continue;
    collectParents(child, parentId, parentOf);
  }
}

/** Build AjCanvasIndex for one top-level fixtures folder. */
async function buildFolderIndex(folderName) {
  const folderAbs = join(FIXTURES_DIR, folderName);
  const paths = await findFlcFiles(folderAbs);
  const byId = new Map();
  const parentOf = new Map();

  for (const absPath of paths) {
    const doc = JSON.parse(await readFile(absPath, "utf8"));
    const canvas = asCanvas(doc);
    if (!canvas?.id || typeof canvas.title !== "string") {
      throw new Error(`Invalid canvas (missing id/title): ${absPath}`);
    }
    if (typeof canvas.ownerId !== "string") {
      throw new Error(`Invalid canvas (missing ownerId): ${absPath}`);
    }
    if (byId.has(canvas.id)) {
      throw new Error(`Duplicate canvas id "${canvas.id}": ${absPath}`);
    }

    const repoPath = relative(REPO_ROOT, absPath);
    byId.set(canvas.id, {
      id: canvas.id,
      title: canvas.title,
      path: repoPath,
      ownerId: canvas.ownerId,
      parentId: null,
    });
    collectParents(canvas, canvas.id, parentOf);
  }

  for (const [childId, parentId] of parentOf) {
    const entry = byId.get(childId);
    if (entry) entry.parentId = parentId;
  }

  return {
    generatedAt: new Date().toISOString(),
    canvases: [...byId.values()].sort((a, b) => a.path.localeCompare(b.path)),
  };
}

async function main() {
  await rm(OUT_ROOT, { recursive: true, force: true });

  const entries = await readdir(FIXTURES_DIR, { withFileTypes: true });
  const folders = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  if (folders.length === 0) {
    throw new Error(`No folders under ${relative(REPO_ROOT, FIXTURES_DIR)}`);
  }

  for (const folder of folders) {
    const index = await buildFolderIndex(folder);
    const outPath = join(OUT_ROOT, "fixtures", folder, "index.json");
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
    console.log(
      `Wrote ${index.canvases.length} canvases → ${relative(REPO_ROOT, outPath)}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
