import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { inlineCanvasNodes, jsonCanvas } from "../src/json/inline.js";
import { jsonFromPath } from "../src/markdown/fromPath.js";
import type { FractalLeanCanvas } from "../src/schema/canvas.js";
import { validateDocument } from "../src/validate/ecosystem.js";
import { ROOT_FILE_NAME } from "../src/validate/structural.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE_DIR = join(ROOT, "fixtures", "recommended");
const FIXTURE = join(FIXTURE_DIR, ROOT_FILE_NAME);

describe("FLC json", () => {
  it("json without -r emits a versioned envelope with id refs", async () => {
    const result = await jsonFromPath(FIXTURE);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.filesRendered, 1);
    const parsed = JSON.parse(result.output) as {
      $schema: string;
      schemaVersion: string;
      data: FractalLeanCanvas;
    };
    assert.equal(parsed.schemaVersion, "0.1.0");
    assert.ok(parsed.$schema.length > 0);
    assert.equal(parsed.data.id, "uber-lean-canvas");
    const feature = parsed.data.solution.features.find(
      (f) => f.id === "feat-on-demand-dispatch",
    );
    assert.deepEqual(feature?.node, { id: "exec-on-demand-dispatch" });
    assert.doesNotMatch(
      result.output,
      /"title": "On-demand dispatch execution"/,
    );
  });

  it("json -r inlines child canvases under node inside the envelope", async () => {
    const result = await jsonFromPath(FIXTURE_DIR, { recursive: true });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(result.filesRendered >= 3);
    const parsed = JSON.parse(result.output) as {
      schemaVersion: string;
      data: {
        solution: {
          features: Array<{
            id: string;
            node?: { id: string; title?: string };
          }>;
        };
        valueProposition: { node?: { id: string; title?: string } };
      };
    };
    assert.equal(parsed.schemaVersion, "0.1.0");
    const feature = parsed.data.solution.features.find(
      (f) => f.id === "feat-on-demand-dispatch",
    );
    assert.equal(feature?.node?.id, "exec-on-demand-dispatch");
    assert.equal(feature?.node?.title, "On-demand dispatch execution");
    assert.equal(
      parsed.data.valueProposition.node?.title,
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
    const a: FractalLeanCanvas = {
      id: "a",
      title: "A",
      ownerId: "human",
      problem: { topProblems: [], existingAlternatives: [] },
      solution: {
        features: [{ id: "f", title: "to b", node: { id: "b" } }],
      },
      customerSegments: { targetUsers: [], earlyAdopters: [] },
      valueProposition: { id: "uvp-a", title: "a" },
      channels: { paths: [] },
      costStructure: { expenses: [] },
      revenueStreams: { returns: [] },
      keyMetrics: { kpis: [] },
      unfairAdvantage: { id: "moat-a", title: "a" },
    };
    const b: FractalLeanCanvas = {
      ...a,
      id: "b",
      title: "B",
      solution: {
        features: [{ id: "f2", title: "to a", node: { id: "a" } }],
      },
      valueProposition: { id: "uvp-b", title: "b" },
      unfairAdvantage: { id: "moat-b", title: "b" },
    };
    const byId = new Map([
      ["a", a],
      ["b", b],
    ]);
    const inlined = inlineCanvasNodes(a, byId) as {
      solution: { features: Array<{ node: { id: string; title?: string } }> };
    };
    assert.equal(inlined.solution.features[0]?.node.id, "b");
    assert.equal(inlined.solution.features[0]?.node.title, "B");
    const back = (
      inlined.solution.features[0]?.node as {
        solution: { features: Array<{ node: { id: string; title?: string } }> };
      }
    ).solution.features[0]?.node;
    assert.deepEqual(back, { id: "a" });
  });

  it("jsonCanvas pretty-prints a versioned envelope", () => {
    const canvas: FractalLeanCanvas = {
      id: "x",
      title: "X",
      ownerId: "human",
      problem: { topProblems: [], existingAlternatives: [] },
      solution: { features: [] },
      customerSegments: { targetUsers: [], earlyAdopters: [] },
      valueProposition: { id: "uvp", title: "v" },
      channels: { paths: [] },
      costStructure: { expenses: [] },
      revenueStreams: { returns: [] },
      keyMetrics: { kpis: [] },
      unfairAdvantage: { id: "moat", title: "m" },
    };
    const out = jsonCanvas(canvas);
    assert.match(out, /"schemaVersion": "0.1.0"/);
    assert.match(out, /"id": "x"/);
    assert.ok(out.endsWith("\n"));
  });
});
