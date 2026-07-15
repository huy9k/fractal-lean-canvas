import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { markdownCanvas, markdownFromPath } from "../src/markdown/index.js";
import { unwrapCanvas } from "../src/validate/structural.js";
import type { FractalLeanCanvas } from "../src/schema/canvas.js";
import { ROOT_FILE_NAME } from "../src/validate/structural.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE_DIR = join(ROOT, "fixtures", "recommended");
const FIXTURE = join(FIXTURE_DIR, ROOT_FILE_NAME);

describe("FLC markdown", () => {
  it("renders a single canvas with lean dimensions", () => {
    const canvas: FractalLeanCanvas = {
      id: "demo",
      title: "Demo",
      ownerId: "human",
      problem: {
        topProblems: [
          {
            id: "p1",
            description: "Pain",
            subAnalysisCanvas: { id: "child" },
          },
        ],
        existingAlternatives: [],
      },
      solution: { features: [] },
      customerSegments: { targetUsers: [], earlyAdopters: [] },
      valueProposition: { statement: "Value" },
      channels: { paths: [] },
      costStructure: { expenses: [{ description: "Cloud", amountUsd: 1000 }] },
      revenueStreams: { returns: [] },
      keyMetrics: { kpis: [] },
      unfairAdvantage: { moatDescription: "Moat" },
    };
    const md = markdownCanvas(canvas);
    assert.match(md, /^# Demo/m);
    assert.match(md, /`demo`/);
    assert.match(md, /Pain → `child`/);
    assert.match(md, /\$1,000/);
    assert.match(md, /## Problem/);
  });

  it("markdownFromPath renders the recommended fixture ecosystem", async () => {
    const result = await markdownFromPath(FIXTURE_DIR);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.match(result.markdown, /# Uber \(early Lean Canvas\)/);
    assert.match(result.markdown, /→ `exec-on-demand-dispatch`/);
    assert.match(result.markdown, /On-demand dispatch execution/);
    assert.match(result.markdown, /personal driver in your pocket/);
    assert.ok(result.filesRendered >= 3);
  });

  it("markdownFromPath renders a bare node file", async () => {
    const path = join(FIXTURE_DIR, "nodes", "concept-personal-driver.json");
    const result = await markdownFromPath(path);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.match(result.markdown, /personal driver in your pocket/);
    assert.equal(result.filesRendered, 1);
  });

  it("markdownFromPath renders root.json alone without following nests", async () => {
    // Passing root.json triggers ecosystem mode (directory of that root).
    const raw = JSON.parse(await readFile(FIXTURE, "utf8")) as unknown;
    const canvas = unwrapCanvas(raw);
    const md = markdownCanvas(canvas);
    assert.match(md, /Uber \(early Lean Canvas\)/);
    assert.match(md, /→ `exec-on-demand-dispatch`/);
    assert.doesNotMatch(md, /^# On-demand dispatch execution/m);
  });
});
