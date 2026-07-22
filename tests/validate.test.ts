import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type {
  CostLineItem,
  FractalLeanCanvas,
} from "../src/shared/schema/canvas.js";
import { validateDocument } from "../src/shared/validate/document.js";
import { validateEcosystem } from "../src/node/ecosystem/index.js";
import { MAX_CANVAS_DEPTH } from "../src/shared/validate/semantic.js";
import {
  ROOT_FILE_NAME,
  validateStructural,
} from "../src/shared/validate/structural.js";
import { SCHEMA_VERSION } from "../src/shared/schema/envelope.js";
import { validateSemantic } from "../src/shared/validate/semantic.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE_DIR = join(ROOT, "fixtures", "recommended");
const FIXTURE = join(FIXTURE_DIR, ROOT_FILE_NAME);

const MONTHLY = {
  type: "recurring" as const,
  every: 1,
  unit: "month" as const,
};

/** Minimal valid canvas for mutation in failure cases. */
function blankCanvas(
  overrides: Partial<FractalLeanCanvas> &
    Pick<FractalLeanCanvas, "id" | "title">,
): FractalLeanCanvas {
  return {
    ownerId: "human",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    problem: { topProblems: [], existingAlternatives: [] },
    solution: { features: [] },
    customerSegments: { targetUsers: [], earlyAdopters: [] },
    valueProposition: {
      statements: [{ id: "uvp", title: "x" }],
      highLevelConcepts: [],
    },
    channels: { paths: [] },
    costStructure: { expenses: [] },
    revenueStreams: { returns: [] },
    keyMetrics: { kpis: [] },
    unfairAdvantage: { advantages: [{ id: "moat", title: "x" }] },
    ...overrides,
  };
}

/** Cost line that sponsors a child canvas. */
function sponsor(
  id: string,
  title: string,
  childId: string,
  amountMinor = 100_00,
): CostLineItem {
  return {
    id,
    title,
    amountMinor,
    cadence: MONTHLY,
    node: { id: childId },
  };
}

/** Wrap a canvas in a versioned envelope. */
function envelope(data: FractalLeanCanvas): unknown {
  return {
    $schema: "https://example.com/flc/0.1.0.json",
    schemaVersion: SCHEMA_VERSION,
    currency: "USD",
    data,
  };
}

describe("FLC validation", () => {
  it("accepts the root fixture", async () => {
    const raw = JSON.parse(await readFile(FIXTURE, "utf8")) as unknown;
    const issues = validateDocument(
      raw,
      `fixtures/recommended/${ROOT_FILE_NAME}`,
    );
    assert.equal(issues.length, 0);
  });

  it("validateEcosystem resolves node ids in fixtures/recommended/", async () => {
    const result = await validateEcosystem(FIXTURE_DIR);
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
      currency: "USD",
      data: { id: "only-id" },
    });
    assert.ok(issues.length > 0);
  });

  it("rejects envelopes missing currency", () => {
    const issues = validateStructural({
      $schema: "https://example.com/flc/0.1.0.json",
      schemaVersion: SCHEMA_VERSION,
      data: blankCanvas({ id: "root", title: "Root" }),
    });
    assert.ok(issues.length > 0);
  });

  it("rejects envelopes with invalid currency", () => {
    const issues = validateStructural({
      $schema: "https://example.com/flc/0.1.0.json",
      schemaVersion: SCHEMA_VERSION,
      currency: "usd",
      data: blankCanvas({ id: "root", title: "Root" }),
    });
    assert.ok(issues.length > 0);
  });

  it("rejects amountMinor of zero structurally", () => {
    const issues = validateStructural(
      envelope(
        blankCanvas({
          id: "root",
          title: "Root",
          costStructure: {
            expenses: [
              {
                id: "exp",
                title: "zero",
                amountMinor: 0,
                cadence: { type: "one_time" },
              },
            ],
          },
        }),
      ),
    );
    assert.ok(issues.length > 0);
  });

  it("rejects KPIs missing comparator structurally", () => {
    const issues = validateStructural(
      envelope(
        blankCanvas({
          id: "root",
          title: "Root",
          keyMetrics: {
            kpis: [{ id: "kpi", title: "x", targetValue: 1 } as never],
          },
        }),
      ),
    );
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
            costStructure: {
              expenses: [sponsor("exp-1", "nested", "shared-id")],
            },
          }),
        ),
      ),
    );
    await writeFile(
      join(dir, "a.flc.json"),
      JSON.stringify(blankCanvas({ id: "shared-id", title: "A" })),
    );
    await writeFile(
      join(dir, "b.flc.json"),
      JSON.stringify(blankCanvas({ id: "shared-id", title: "B" })),
    );
    const result = await validateEcosystem(dir);
    assert.equal(result.ok, false);
    assert.ok(
      result.issues.some((i) => i.message.includes("Duplicate canvas id")),
    );
  });

  it("rejects over-deep nesting via cost nodes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flc-"));
    await writeFile(
      join(dir, ROOT_FILE_NAME),
      JSON.stringify(
        envelope(
          blankCanvas({
            id: "node-0",
            title: "Node 0",
            costStructure: {
              expenses: [sponsor("exp-0", "nest", "node-1")],
            },
          }),
        ),
      ),
    );
    for (let depth = 1; depth <= MAX_CANVAS_DEPTH + 1; depth++) {
      const isLeaf = depth === MAX_CANVAS_DEPTH + 1;
      await writeFile(
        join(dir, `node-${depth}.flc.json`),
        JSON.stringify(
          blankCanvas({
            id: `node-${depth}`,
            title: `Node ${depth}`,
            costStructure: isLeaf
              ? { expenses: [] }
              : {
                  expenses: [
                    sponsor(`exp-${depth}`, "nest", `node-${depth + 1}`),
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
      join(dir, "orphan.flc.json"),
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
      join(dir, "orphan.flc.json"),
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
            costStructure: {
              expenses: [sponsor("exp-1", "child", "child")],
            },
          }),
        ),
      ),
    );
    await writeFile(
      join(dir, "child.flc.json"),
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
            costStructure: {
              expenses: [sponsor("exp-1", "missing", "does-not-exist")],
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
            costStructure: {
              expenses: [sponsor("exp-root", "to a", "canvas-a")],
            },
          }),
        ),
      ),
    );
    await writeFile(
      join(dir, "a.flc.json"),
      JSON.stringify(
        blankCanvas({
          id: "canvas-a",
          title: "A",
          costStructure: {
            expenses: [sponsor("exp-a", "to b", "canvas-b")],
          },
        }),
      ),
    );
    await writeFile(
      join(dir, "b.flc.json"),
      JSON.stringify(
        blankCanvas({
          id: "canvas-b",
          title: "B",
          costStructure: {
            expenses: [sponsor("exp-b", "to a", "canvas-a")],
          },
        }),
      ),
    );
    const result = await validateEcosystem(dir);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.message.includes("Cycle detected")));
  });

  it("rejects child net burn exceeding sponsoring expense", () => {
    const child = blankCanvas({
      id: "child",
      title: "Child",
      valueProposition: {
        statements: [{ id: "uvp-child", title: "x" }],
        highLevelConcepts: [],
      },
      unfairAdvantage: { advantages: [{ id: "moat-child", title: "x" }] },
      costStructure: {
        expenses: [
          {
            id: "exp-child",
            title: "heavy",
            amountMinor: 500_00,
            cadence: MONTHLY,
          },
        ],
      },
    });
    const parent = blankCanvas({
      id: "parent",
      title: "Parent",
      costStructure: {
        expenses: [
          {
            id: "exp-sponsor",
            title: "small",
            amountMinor: 100_00,
            cadence: MONTHLY,
            node: child,
          },
        ],
      },
    });
    const issues = validateSemantic(parent);
    assert.ok(issues.some((i) => i.message.includes("net burn")));
  });

  it("accepts profitable child under a small sponsoring expense", () => {
    const child = blankCanvas({
      id: "child",
      title: "Child",
      valueProposition: {
        statements: [{ id: "uvp-child", title: "x" }],
        highLevelConcepts: [],
      },
      unfairAdvantage: { advantages: [{ id: "moat-child", title: "x" }] },
      costStructure: {
        expenses: [
          {
            id: "exp-child",
            title: "ops",
            amountMinor: 100_00,
            cadence: MONTHLY,
          },
        ],
      },
      revenueStreams: {
        returns: [
          {
            id: "rev-child",
            title: "sales",
            amountMinor: 500_00,
            cadence: MONTHLY,
          },
        ],
      },
    });
    const parent = blankCanvas({
      id: "parent",
      title: "Parent",
      costStructure: {
        expenses: [
          {
            id: "exp-sponsor",
            title: "small",
            amountMinor: 50_00,
            cadence: MONTHLY,
            node: child,
          },
        ],
      },
    });
    const issues = validateSemantic(parent);
    assert.equal(issues.length, 0, JSON.stringify(issues, null, 2));
  });

  it("rejects timed item dates outside the canvas window", () => {
    const canvas = blankCanvas({
      id: "c",
      title: "C",
      costStructure: {
        expenses: [
          {
            id: "exp",
            title: "out of bounds",
            amountMinor: 100,
            cadence: { type: "one_time" },
            startDate: "2025-12-01",
            endDate: "2025-12-31",
          },
        ],
      },
    });
    const issues = validateSemantic(canvas);
    assert.ok(issues.some((i) => i.message.includes("exceeds canvas")));
  });

  it("rejects child canvas dates beyond parent canvas", () => {
    const child = blankCanvas({
      id: "child",
      title: "Child",
      startDate: "2026-01-01",
      endDate: "2027-12-31",
    });
    const parent = blankCanvas({
      id: "parent",
      title: "Parent",
      costStructure: {
        expenses: [
          {
            id: "exp",
            title: "sponsor",
            amountMinor: 100_00,
            cadence: MONTHLY,
            node: child,
          },
        ],
      },
    });
    const issues = validateSemantic(parent);
    assert.ok(issues.some((i) => i.message.includes("exceeds parent window")));
  });

  it("rejects two expenses sponsoring the same child id", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flc-"));
    await writeFile(
      join(dir, ROOT_FILE_NAME),
      JSON.stringify(
        envelope(
          blankCanvas({
            id: "root",
            title: "Root",
            costStructure: {
              expenses: [
                sponsor("exp-a", "a", "shared-child", 200_00),
                sponsor("exp-b", "b", "shared-child", 200_00),
              ],
            },
          }),
        ),
      ),
    );
    await writeFile(
      join(dir, "child.flc.json"),
      JSON.stringify(blankCanvas({ id: "shared-child", title: "Child" })),
    );
    const result = await validateEcosystem(dir);
    assert.equal(result.ok, false);
    assert.ok(
      result.issues.some((i) => i.message.includes("already sponsored")),
    );
  });

  it("accepts cost node with git locator structurally", () => {
    const issues = validateDocument(
      envelope(
        blankCanvas({
          id: "root",
          title: "Root",
          costStructure: {
            expenses: [
              {
                id: "exp-remote",
                title: "Remote budget",
                amountMinor: 100_00,
                cadence: MONTHLY,
                node: {
                  id: "life-flc",
                  git: {
                    url: "https://github.com/org-name/repo-name.git",
                    ref: "main",
                    path: "canvas/root.flc.json",
                  },
                },
              },
            ],
          },
        }),
      ),
    );
    assert.equal(issues.length, 0);
  });

  it("reports unresolved remote git refs in local validateEcosystem", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flc-remote-"));
    await writeFile(
      join(dir, ROOT_FILE_NAME),
      JSON.stringify(
        envelope(
          blankCanvas({
            id: "root",
            title: "Root",
            costStructure: {
              expenses: [
                {
                  id: "exp-remote",
                  title: "Remote budget",
                  amountMinor: 100_00,
                  cadence: MONTHLY,
                  node: {
                    id: "life-flc",
                    git: {
                      url: "https://github.com/org-name/repo-name.git",
                      path: "canvas/root.flc.json",
                    },
                  },
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
      result.issues.some((i) =>
        i.message.includes("cannot be resolved by local validate"),
      ),
      JSON.stringify(result.issues, null, 2),
    );
  });

  it("resolveCanvasRef can load a remote-shaped ref for rollup", () => {
    const remoteChild = blankCanvas({
      id: "life-flc",
      title: "Life",
      valueProposition: {
        statements: [{ id: "life-uvp", title: "x" }],
        highLevelConcepts: [],
      },
      unfairAdvantage: { advantages: [{ id: "life-moat", title: "x" }] },
      costStructure: {
        expenses: [
          {
            id: "c1",
            title: "Burn",
            amountMinor: 50_00,
            cadence: MONTHLY,
          },
        ],
      },
    });
    const parent = blankCanvas({
      id: "root",
      title: "Root",
      costStructure: {
        expenses: [
          {
            id: "exp-remote",
            title: "Remote budget",
            amountMinor: 100_00,
            cadence: MONTHLY,
            node: {
              id: "life-flc",
              git: { url: "https://github.com/org-name/repo-name.git" },
            },
          },
        ],
      },
    });
    const issues = validateSemantic(parent, undefined, {
      resolveCanvasRef: (ref) => {
        if (ref.id === "life-flc" && ref.git?.url) {
          return { canvas: remoteChild, file: "remote:life-flc" };
        }
        return { path: "", message: `unexpected ref ${ref.id}` };
      },
    });
    assert.equal(issues.length, 0, JSON.stringify(issues, null, 2));
  });
});
