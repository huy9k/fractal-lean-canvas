import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  blankCanvas,
  blankCanvasJson,
  blankRootEnvelope,
  blankRootEnvelopeJson,
} from "../src/shared/blank/index.js";
import { runInit } from "../src/cli/init.js";
import { validateDocument } from "../src/shared/validate/document.js";
import {
  ROOT_FILE_NAME,
  validateCanvasStructural,
} from "../src/shared/validate/structural.js";

describe("FLC blank templates", () => {
  it("blankCanvas passes structural validation", () => {
    const canvas = blankCanvas({ id: "demo", title: "Demo" });
    const issues = validateCanvasStructural(canvas);
    assert.equal(issues.length, 0);
    assert.equal(canvas.problem.topProblems.length, 0);
    assert.equal(canvas.solution.features.length, 0);
  });

  it("blankRootEnvelope passes validateDocument", () => {
    const envelope = blankRootEnvelope({ id: "root-demo", title: "Root" });
    const issues = validateDocument(envelope, ROOT_FILE_NAME);
    assert.equal(issues.length, 0);
    assert.equal(envelope.data.title, "Root");
  });

  it("blank JSON helpers end with a newline", () => {
    assert.match(blankCanvasJson({ id: "a" }), /\n$/);
    assert.match(blankRootEnvelopeJson({ id: "b" }), /\n$/);
  });
});

describe("FLC init CLI write", () => {
  it("init writes a bare canvas file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flc-init-"));
    try {
      const written = await runInit({
        path: join(dir, "child-node"),
        root: false,
        force: false,
      });
      assert.equal(written, join(dir, "child-node.flc.json"));
      const raw = await readFile(written, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      const issues = validateCanvasStructural(parsed);
      assert.equal(issues.length, 0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("init --root on a directory writes root.flc.json", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flc-init-root-"));
    try {
      const written = await runInit({
        path: dir,
        root: true,
        force: false,
      });
      assert.equal(written, join(dir, ROOT_FILE_NAME));
      const raw = await readFile(written, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      const issues = validateDocument(parsed, ROOT_FILE_NAME);
      assert.equal(issues.length, 0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("init refuses overwrite without --force", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flc-init-force-"));
    try {
      const path = join(dir, "once.flc.json");
      await runInit({ path, root: false, force: false });
      await assert.rejects(
        () => runInit({ path, root: false, force: false }),
        /already exists/,
      );
      await runInit({ path, root: false, force: true });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
