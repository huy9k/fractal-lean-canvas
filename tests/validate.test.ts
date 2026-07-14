import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { FractalLeanCanvas } from "../src/schema/canvas.js";
import {
  validateDocument,
  validateEcosystem,
} from "../src/validate/ecosystem.js";
import {
  validateSemantic,
  MAX_CANVAS_DEPTH,
} from "../src/validate/semantic.js";
import {
  ROOT_FILE_NAME,
  validateStructural,
} from "../src/validate/structural.js";
import { SCHEMA_VERSION } from "../src/schema/envelope.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = join(ROOT, "fixtures", ROOT_FILE_NAME);

/** Minimal valid canvas for mutation in failure cases. */
function blankCanvas(
  overrides: Partial<FractalLeanCanvas> &
    Pick<FractalLeanCanvas, "id" | "title">,
): FractalLeanCanvas {
  return {
    layerDepth: 0,
    ownerId: "human",
    lastUpdatedIso: "2026-07-14T00:00:00.000Z",
    problem: { topProblems: [], existingAlternatives: [] },
    solution: { features: [] },
    customerSegments: { targetUsers: [], earlyAdopters: [] },
    valueProposition: { statement: "x" },
    channels: { paths: [] },
    costStructure: { expenses: [] },
    revenueStreams: { returns: [] },
    keyMetrics: { kpis: [] },
    unfairAdvantage: { moatDescription: "x" },
    ...overrides,
  };
}

/** Wrap a canvas in a versioned envelope. */
function envelope(data: FractalLeanCanvas): unknown {
  return {
    $schema: "https://example.com/flc/0.1.0.json",
    schemaVersion: SCHEMA_VERSION,
    data,
  };
}

describe("FLC validation", () => {
  it("accepts the root fixture", async () => {
    const raw = JSON.parse(await readFile(FIXTURE, "utf8")) as unknown;
    const issues = validateDocument(raw, `fixtures/${ROOT_FILE_NAME}`);
    assert.equal(issues.length, 0);
  });

  it("validateEcosystem resolves cross-file refs in fixtures/", async () => {
    const result = await validateEcosystem(join(ROOT, "fixtures"));
    assert.equal(result.ok, true, JSON.stringify(result.issues, null, 2));
    assert.ok(result.filesChecked >= 2);
  });

  it("rejects bare canvas when envelope is required", () => {
    const issues = validateStructural({ id: "only-id" });
    assert.ok(
      issues.some((i) => i.message.includes("VersionedFractalEnvelope")),
    );
  });

  it("rejects envelopes with incomplete data", () => {
    const issues = validateStructural({
      $schema: "https://example.com/flc/0.1.0.json",
      schemaVersion: "0.1.0",
      data: { id: "only-id" },
    });
    assert.ok(issues.length > 0);
  });

  it("rejects duplicate ids across the tree", () => {
    const child = blankCanvas({
      id: "shared-id",
      title: "Child",
      layerDepth: 1,
    });
    const parent = blankCanvas({
      id: "shared-id",
      title: "Parent",
      solution: {
        features: [
          {
            id: "feat-1",
            description: "nested",
            executionCanvas: child,
          },
        ],
      },
    });
    const issues = validateSemantic(parent);
    assert.ok(issues.some((i) => i.message.includes("Duplicate id")));
  });

  it("rejects over-deep nesting", () => {
    let canvas = blankCanvas({
      id: "leaf",
      title: "Leaf",
      layerDepth: MAX_CANVAS_DEPTH + 1,
    });
    for (let depth = MAX_CANVAS_DEPTH; depth >= 0; depth--) {
      canvas = blankCanvas({
        id: `node-${depth}`,
        title: `Node ${depth}`,
        layerDepth: depth,
        solution: {
          features: [
            {
              id: `feat-${depth}`,
              description: "nest",
              executionCanvas: canvas,
            },
          ],
        },
      });
    }
    const issues = validateSemantic(canvas);
    assert.ok(issues.some((i) => i.message.includes("exceeds max")));
  });

  it("rejects absolute file refs", () => {
    const parent = blankCanvas({
      id: "parent",
      title: "Parent",
      solution: {
        features: [
          {
            id: "feat-1",
            description: "nested",
            executionCanvas: { ref: "/tmp/other.json" },
          },
        ],
      },
    });
    const issues = validateSemantic(parent);
    assert.ok(issues.some((i) => i.message.includes("relative path")));
  });

  it("rejects unreachable orphan canvas files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flc-"));
    await writeFile(
      join(dir, ROOT_FILE_NAME),
      JSON.stringify(envelope(blankCanvas({ id: "root", title: "Root" }))),
    );
    await writeFile(
      join(dir, "orphan.json"),
      JSON.stringify(blankCanvas({ id: "orphan", title: "Orphan" })),
    );
    const result = await validateEcosystem(dir);
    assert.equal(result.ok, false);
    assert.ok(
      result.issues.some((i) => i.message.includes("Unreachable canvas file")),
    );
  });

  it("rejects missing root.json", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flc-"));
    await writeFile(
      join(dir, "orphan.json"),
      JSON.stringify(blankCanvas({ id: "x", title: "X" })),
    );
    const result = await validateEcosystem(dir);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.message.includes(ROOT_FILE_NAME)));
  });

  it("rejects child files that use an envelope", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flc-"));
    await writeFile(
      join(dir, ROOT_FILE_NAME),
      JSON.stringify(
        envelope(
          blankCanvas({
            id: "root",
            title: "Root",
            solution: {
              features: [
                {
                  id: "feat-1",
                  description: "child",
                  executionCanvas: { ref: "./child.json" },
                },
              ],
            },
          }),
        ),
      ),
    );
    await writeFile(
      join(dir, "child.json"),
      JSON.stringify(envelope(blankCanvas({ id: "child", title: "Child" }))),
    );
    const result = await validateEcosystem(dir);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.message.includes("bare canvases")));
  });

  it("rejects missing file refs in ecosystem", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flc-"));
    await writeFile(
      join(dir, ROOT_FILE_NAME),
      JSON.stringify(
        envelope(
          blankCanvas({
            id: "root",
            title: "Root",
            solution: {
              features: [
                {
                  id: "feat-1",
                  description: "missing child",
                  executionCanvas: { ref: "./missing.json" },
                },
              ],
            },
          }),
        ),
      ),
    );
    const result = await validateEcosystem(dir);
    assert.equal(result.ok, false);
    assert.ok(
      result.issues.some((i) => i.message.includes("Missing file ref")),
    );
  });

  it("rejects cyclic file refs in ecosystem", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flc-"));
    await writeFile(
      join(dir, ROOT_FILE_NAME),
      JSON.stringify(
        envelope(
          blankCanvas({
            id: "root",
            title: "Root",
            solution: {
              features: [
                {
                  id: "feat-root",
                  description: "to a",
                  executionCanvas: { ref: "./a.json" },
                },
              ],
            },
          }),
        ),
      ),
    );
    await writeFile(
      join(dir, "a.json"),
      JSON.stringify(
        blankCanvas({
          id: "canvas-a",
          title: "A",
          solution: {
            features: [
              {
                id: "feat-a",
                description: "to b",
                executionCanvas: { ref: "./b.json" },
              },
            ],
          },
        }),
      ),
    );
    await writeFile(
      join(dir, "b.json"),
      JSON.stringify(
        blankCanvas({
          id: "canvas-b",
          title: "B",
          solution: {
            features: [
              {
                id: "feat-b",
                description: "to a",
                executionCanvas: { ref: "./a.json" },
              },
            ],
          },
        }),
      ),
    );
    const result = await validateEcosystem(dir);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.message.includes("Cycle detected")));
  });
});
