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
import { MAX_CANVAS_DEPTH } from "../src/validate/semantic.js";
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
    ownerId: "human",
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

  it("validateEcosystem resolves nest ids in fixtures/", async () => {
    const result = await validateEcosystem(join(ROOT, "fixtures"));
    assert.equal(result.ok, true, JSON.stringify(result.issues, null, 2));
    assert.ok(result.filesChecked >= 3);
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

  it("rejects duplicate canvas ids across files", async () => {
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
                  description: "nested",
                  executionCanvas: { id: "shared-id" },
                },
              ],
            },
          }),
        ),
      ),
    );
    await writeFile(
      join(dir, "a.json"),
      JSON.stringify(blankCanvas({ id: "shared-id", title: "A" })),
    );
    await writeFile(
      join(dir, "b.json"),
      JSON.stringify(blankCanvas({ id: "shared-id", title: "B" })),
    );
    const result = await validateEcosystem(dir);
    assert.equal(result.ok, false);
    assert.ok(
      result.issues.some((i) => i.message.includes("Duplicate canvas id")),
    );
  });

  it("rejects over-deep nesting", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flc-"));
    // Root (depth 0) → node-1 → … → node-(MAX+1) exceeds max depth.
    await writeFile(
      join(dir, ROOT_FILE_NAME),
      JSON.stringify(
        envelope(
          blankCanvas({
            id: "node-0",
            title: "Node 0",
            solution: {
              features: [
                {
                  id: "feat-0",
                  description: "nest",
                  executionCanvas: { id: "node-1" },
                },
              ],
            },
          }),
        ),
      ),
    );
    for (let depth = 1; depth <= MAX_CANVAS_DEPTH + 1; depth++) {
      const isLeaf = depth === MAX_CANVAS_DEPTH + 1;
      await writeFile(
        join(dir, `node-${depth}.json`),
        JSON.stringify(
          blankCanvas({
            id: `node-${depth}`,
            title: `Node ${depth}`,
            solution: isLeaf
              ? { features: [] }
              : {
                  features: [
                    {
                      id: `feat-${depth}`,
                      description: "nest",
                      executionCanvas: { id: `node-${depth + 1}` },
                    },
                  ],
                },
          }),
        ),
      );
    }
    const result = await validateEcosystem(dir);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.message.includes("exceeds max")));
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
                  executionCanvas: { id: "child" },
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

  it("rejects missing canvas ids in ecosystem", async () => {
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
                  executionCanvas: { id: "does-not-exist" },
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
      result.issues.some((i) => i.message.includes("Missing canvas id")),
    );
  });

  it("rejects cyclic canvas ids in ecosystem", async () => {
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
                  executionCanvas: { id: "canvas-a" },
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
                executionCanvas: { id: "canvas-b" },
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
                executionCanvas: { id: "canvas-a" },
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
