import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { markdownCanvas } from "../src/shared/markdown/index.js";
import {
  htmlTableFromPath,
  markdownFromPath,
} from "../src/node/fromPath/index.js";
import type { FractalLeanCanvas } from "../src/shared/schema/canvas.js";
import { ROOT_FILE_NAME } from "../src/shared/validate/structural.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE_DIR = join(ROOT, "fixtures", "recommended");
const FIXTURE = join(FIXTURE_DIR, ROOT_FILE_NAME);

describe("FLC markdown / html-table", () => {
  it("markdownCanvas shows titles not line-item ids", () => {
    const canvas: FractalLeanCanvas = {
      id: "demo",
      title: "Demo",
      ownerId: "human",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      problem: {
        topProblems: [{ id: "p1", title: "Pain" }],
        existingAlternatives: [],
      },
      solution: { features: [] },
      customerSegments: { targetUsers: [], earlyAdopters: [] },
      valueProposition: {
        statements: [{ id: "uvp", title: "Value" }],
        highLevelConcepts: [],
      },
      channels: { paths: [] },
      costStructure: {
        expenses: [
          {
            id: "exp-cloud",
            title: "Cloud",
            amountMinor: 1000_00,
            cadence: { type: "recurring", every: 1, unit: "month" },
            node: { id: "child" },
          },
        ],
      },
      revenueStreams: { returns: [] },
      keyMetrics: {
        kpis: [
          {
            id: "kpi-x",
            title: "Latency",
            targetValue: 100,
            comparator: "lte",
            unit: "ms",
          },
        ],
      },
      unfairAdvantage: { advantages: [{ id: "moat", title: "Moat" }] },
    };
    const md = markdownCanvas(canvas, { currency: "USD" });
    assert.match(md, /^# Demo/m);
    assert.match(md, /- \*\*id:\*\* `demo`/);
    assert.match(md, /2026-01-01 → 2026-12-31/);
    assert.match(md, /Pain/);
    assert.doesNotMatch(md, /\*\*`p1`\*\*/);
    assert.match(md, /Cloud — \*\*USD 1,000\.00\/mo\*\*/);
    assert.match(md, /→ `child`/);
    assert.match(md, /Latency — \*\*≤ 100 ms\*\*/);
    assert.match(md, /## Problem/);
  });

  it("markdown without -r renders only the target canvas", async () => {
    const result = await markdownFromPath(FIXTURE);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.filesRendered, 1);
    assert.match(result.markdown, /# Uber \(early Lean Canvas\)/);
    assert.match(result.markdown, /`exec-on-demand-dispatch`/);
    assert.doesNotMatch(result.markdown, /On-demand dispatch execution/);
  });

  it("markdown -r renders nested canvases", async () => {
    const result = await markdownFromPath(FIXTURE_DIR, { recursive: true });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(result.filesRendered >= 3);
    assert.match(result.markdown, /On-demand dispatch execution/);
    assert.match(result.markdown, /personal driver in your pocket/);
  });

  it("html-table without -r is a single Lean Canvas grid", async () => {
    const result = await htmlTableFromPath(FIXTURE);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.filesRendered, 1);
    assert.match(
      result.output,
      /<td colspan="5">[\s\S]*?<h1>Uber \(early Lean Canvas\)<\/h1>/,
    );
    assert.match(
      result.output,
      /<code>uber-lean-canvas<\/code> · owner <code>human<\/code>/,
    );
    assert.doesNotMatch(result.output, /^<h1>/);
    assert.match(result.output, /rowspan="2"><strong>Problem<\/strong>/);
    assert.match(result.output, /<strong>Unique Value Proposition<\/strong>/);
    assert.match(
      result.output,
      /colspan="2"[^>]*>\s*<strong>Product<\/strong>/,
    );
    assert.match(result.output, /colspan="3"[^>]*>\s*<strong>Market<\/strong>/);
    assert.doesNotMatch(result.output, /prob-unreliable-ride/);
    assert.doesNotMatch(result.output, /On-demand dispatch execution/);
  });

  it("html-table -r includes nested Lean Canvas grids", async () => {
    const result = await htmlTableFromPath(FIXTURE_DIR, { recursive: true });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(result.filesRendered >= 3);
    assert.match(result.output, /<hr\/>/);
    assert.match(result.output, /On-demand dispatch execution/);
    assert.match(result.output, /personal driver in your pocket/);
  });
});
