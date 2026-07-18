import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { inlineCanvasNodes, jsonCanvas } from "../src/shared/json/inline.js";
import { jsonFromPath } from "../src/node/fromPath/index.js";
import type { FractalLeanCanvas } from "../src/shared/schema/canvas.js";
import { SCHEMA_VERSION } from "../src/shared/schema/envelope.js";
import { validateDocument } from "../src/shared/validate/document.js";
import { ROOT_FILE_NAME } from "../src/shared/validate/structural.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE_DIR = join(ROOT, "fixtures", "recommended");
const FIXTURE = join(FIXTURE_DIR, ROOT_FILE_NAME);

const MONTHLY = {
  type: "recurring" as const,
  every: 1,
  unit: "month" as const,
};

function baseCanvas(
  id: string,
  title: string,
  extras: Partial<FractalLeanCanvas> = {},
): FractalLeanCanvas {
  return {
    id,
    title,
    ownerId: "human",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    problem: { topProblems: [], existingAlternatives: [] },
    solution: { features: [] },
    customerSegments: { targetUsers: [], earlyAdopters: [] },
    valueProposition: {
      statements: [{ id: `uvp-${id}`, title: id }],
      highLevelConcepts: [],
    },
    channels: { paths: [] },
    costStructure: { expenses: [] },
    revenueStreams: { returns: [] },
    keyMetrics: { kpis: [] },
    unfairAdvantage: { advantages: [{ id: `moat-${id}`, title: id }] },
    ...extras,
  };
}

describe("FLC json", () => {
  it("json without -r emits a versioned envelope with id refs", async () => {
    const result = await jsonFromPath(FIXTURE);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.filesRendered, 1);
    const parsed = JSON.parse(result.output) as {
      $schema: string;
      schemaVersion: string;
      currency: string;
      data: FractalLeanCanvas;
    };
    assert.equal(parsed.schemaVersion, SCHEMA_VERSION);
    assert.equal(parsed.currency, "USD");
    assert.ok(parsed.$schema.length > 0);
    assert.equal(parsed.data.id, "uber-lean-canvas");
    const infra = parsed.data.costStructure.expenses.find(
      (e) => e.id === "exp-infra",
    );
    assert.deepEqual(infra?.node, { id: "exec-on-demand-dispatch" });
    assert.doesNotMatch(
      result.output,
      /"title": "On-demand dispatch execution"/,
    );
  });

  it("json -r inlines child canvases under cost node inside the envelope", async () => {
    const result = await jsonFromPath(FIXTURE_DIR, { recursive: true });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(result.filesRendered >= 3);
    const parsed = JSON.parse(result.output) as {
      schemaVersion: string;
      currency: string;
      data: {
        costStructure: {
          expenses: Array<{
            id: string;
            node?: { id: string; title?: string };
          }>;
        };
      };
    };
    assert.equal(parsed.schemaVersion, SCHEMA_VERSION);
    assert.equal(parsed.currency, "USD");
    const infra = parsed.data.costStructure.expenses.find(
      (e) => e.id === "exp-infra",
    );
    assert.equal(infra?.node?.id, "exec-on-demand-dispatch");
    assert.equal(infra?.node?.title, "On-demand dispatch execution");
    const concept = parsed.data.costStructure.expenses.find(
      (e) => e.id === "exp-concept-marketing",
    );
    assert.equal(
      concept?.node?.title,
      "High-level concept: personal driver in your pocket",
    );
  });

  it("json -r output validates as a VersionedFractalEnvelope", async () => {
    const result = await jsonFromPath(FIXTURE_DIR, { recursive: true });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const parsed = JSON.parse(result.output) as unknown;
    const issues = validateDocument(parsed, "dump/root.json");
    assert.equal(issues.length, 0, JSON.stringify(issues, null, 2));
  });

  it("inlineCanvasNodes leaves cycle stubs as id refs", () => {
    const a = baseCanvas("a", "A", {
      costStructure: {
        expenses: [
          {
            id: "exp-a",
            title: "to b",
            amountMinor: 100,
            cadence: MONTHLY,
            node: { id: "b" },
          },
        ],
      },
    });
    const b = baseCanvas("b", "B", {
      costStructure: {
        expenses: [
          {
            id: "exp-b",
            title: "to a",
            amountMinor: 100,
            cadence: MONTHLY,
            node: { id: "a" },
          },
        ],
      },
    });
    const byId = new Map([
      ["a", a],
      ["b", b],
    ]);
    const inlined = inlineCanvasNodes(a, byId) as {
      costStructure: {
        expenses: Array<{ node: { id: string; title?: string } }>;
      };
    };
    assert.equal(inlined.costStructure.expenses[0]?.node.id, "b");
    assert.equal(inlined.costStructure.expenses[0]?.node.title, "B");
    const back = (
      inlined.costStructure.expenses[0]?.node as {
        costStructure: {
          expenses: Array<{ node: { id: string; title?: string } }>;
        };
      }
    ).costStructure.expenses[0]?.node;
    assert.deepEqual(back, { id: "a" });
  });

  it("jsonCanvas pretty-prints a versioned envelope", () => {
    const canvas = baseCanvas("x", "X");
    const out = jsonCanvas(canvas);
    assert.match(out, new RegExp(`"schemaVersion": "${SCHEMA_VERSION}"`));
    assert.match(out, /"currency": "USD"/);
    assert.match(out, /"id": "x"/);
    assert.ok(out.endsWith("\n"));
  });
});
