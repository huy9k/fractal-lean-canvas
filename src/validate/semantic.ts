import type { CanvasSlot, FractalLeanCanvas } from "../schema/canvas.js";

export const MAX_CANVAS_DEPTH = 16;

export type SemanticIssue = {
  path: string;
  message: string;
  /** Set when walking with a file context (ecosystem / multi-file). */
  file?: string;
};

export type NestedCanvasSlot = {
  path: string;
  slot: CanvasSlot;
};

/**
 * Options for graph-aware semantic walks (used by ecosystem validation).
 */
export type SemanticWalkOptions = {
  /** Resolve a canvas id to a document; return an issue on failure. */
  resolveCanvasId?: (
    canvasId: string,
    fromFile: string,
    slotPath: string,
  ) => { canvas: FractalLeanCanvas; file: string } | SemanticIssue;
  /** Path/label of the document owning `root`. */
  file?: string;
  /** Shared id registry for ecosystem-wide uniqueness. */
  seenIds?: Map<string, string>;
  /** Files already fully walked (skip re-entry as a new root). */
  walkedFiles?: Set<string>;
  /** Canvas objects whose ids were already registered (shared across ecosystem walks). */
  idsRegisteredFor?: WeakSet<object>;
};

/**
 * Collect direct child nest slots (`{ id }` only).
 */
export function collectCanvasSlots(
  canvas: FractalLeanCanvas,
  basePath: string,
): NestedCanvasSlot[] {
  const slots: NestedCanvasSlot[] = [];

  const push = (path: string, slot: CanvasSlot | undefined): void => {
    if (slot) slots.push({ path, slot });
  };

  for (const problem of canvas.problem.topProblems) {
    push(
      `${basePath}/problem/topProblems/${problem.id}/subAnalysisCanvas`,
      problem.subAnalysisCanvas,
    );
  }

  for (let i = 0; i < canvas.problem.existingAlternatives.length; i++) {
    push(
      `${basePath}/problem/existingAlternatives/${i}/disruptionCanvas`,
      canvas.problem.existingAlternatives[i]?.disruptionCanvas,
    );
  }

  for (const feature of canvas.solution.features) {
    push(
      `${basePath}/solution/features/${feature.id}/executionCanvas`,
      feature.executionCanvas,
    );
  }

  for (let i = 0; i < canvas.customerSegments.targetUsers.length; i++) {
    push(
      `${basePath}/customerSegments/targetUsers/${i}/demographicCanvas`,
      canvas.customerSegments.targetUsers[i]?.demographicCanvas,
    );
  }

  push(
    `${basePath}/valueProposition/highLevelConceptCanvas`,
    canvas.valueProposition.highLevelConceptCanvas,
  );

  for (let i = 0; i < canvas.channels.paths.length; i++) {
    push(
      `${basePath}/channels/paths/${i}/acquisitionCanvas`,
      canvas.channels.paths[i]?.acquisitionCanvas,
    );
  }

  for (let i = 0; i < canvas.costStructure.expenses.length; i++) {
    push(
      `${basePath}/costStructure/expenses/${i}/mitigationCanvas`,
      canvas.costStructure.expenses[i]?.mitigationCanvas,
    );
  }

  for (let i = 0; i < canvas.revenueStreams.returns.length; i++) {
    push(
      `${basePath}/revenueStreams/returns/${i}/monetizationCanvas`,
      canvas.revenueStreams.returns[i]?.monetizationCanvas,
    );
  }

  for (let i = 0; i < canvas.keyMetrics.kpis.length; i++) {
    push(
      `${basePath}/keyMetrics/kpis/${i}/optimizationCanvas`,
      canvas.keyMetrics.kpis[i]?.optimizationCanvas,
    );
  }

  push(
    `${basePath}/unfairAdvantage/defenseCanvas`,
    canvas.unfairAdvantage.defenseCanvas,
  );

  return slots;
}

/** Sum expense amounts on a canvas. */
function expenseTotal(canvas: FractalLeanCanvas): number {
  return canvas.costStructure.expenses.reduce((sum, e) => sum + e.amountUsd, 0);
}

/**
 * Semantic rules: unique ids, max depth, cycle guard, budget rollups.
 * Without `resolveCanvasId`, nest slots are not followed.
 */
export function validateSemantic(
  root: FractalLeanCanvas,
  rootPath: string = "",
  options: SemanticWalkOptions = {},
): SemanticIssue[] {
  const issues: SemanticIssue[] = [];
  const seenIds = options.seenIds ?? new Map<string, string>();
  const walkedFiles = options.walkedFiles ?? new Set<string>();
  const idsRegisteredFor = options.idsRegisteredFor ?? new WeakSet<object>();
  const startFile = options.file ?? "";
  const dfsStack = new Set<object>();
  const idStack: string[] = [];

  if (startFile) walkedFiles.add(startFile);

  const pushIssue = (
    issue: Omit<SemanticIssue, "file"> & { file?: string },
    file: string,
  ): void => {
    issues.push({ ...issue, file: issue.file ?? (file || undefined) });
  };

  const registerId = (id: string, path: string, file: string): void => {
    const prior = seenIds.get(id);
    if (prior !== undefined) {
      pushIssue(
        {
          path,
          message: `Duplicate id "${id}" (also at ${prior})`,
        },
        file,
      );
      return;
    }
    seenIds.set(id, file ? `${file}:${path}` : path);
  };

  /** Resolve an id nest slot; emits issues and returns undefined on failure/skip. */
  const resolveChild = (
    slot: CanvasSlot,
    slotPath: string,
    fromFile: string,
  ): { canvas: FractalLeanCanvas; file: string } | undefined => {
    // Single-document mode: do not follow nest slots.
    if (!options.resolveCanvasId) return undefined;

    if (idStack.includes(slot.id)) {
      pushIssue(
        {
          path: slotPath,
          message: `Cycle detected via canvas id "${slot.id}"`,
        },
        fromFile,
      );
      return undefined;
    }

    const result = options.resolveCanvasId(slot.id, fromFile, slotPath);
    if ("message" in result) {
      pushIssue(result, fromFile);
      return undefined;
    }

    return result;
  };

  const walk = (
    canvas: FractalLeanCanvas,
    path: string,
    depth: number,
    file: string,
  ): void => {
    if (dfsStack.has(canvas)) {
      pushIssue({ path, message: "Cycle detected in canvas graph" }, file);
      return;
    }
    dfsStack.add(canvas);
    idStack.push(canvas.id);

    if (depth > MAX_CANVAS_DEPTH) {
      pushIssue(
        {
          path,
          message: `Canvas depth ${depth} exceeds max ${MAX_CANVAS_DEPTH}`,
        },
        file,
      );
      idStack.pop();
      dfsStack.delete(canvas);
      return;
    }

    // Register ids once per canvas object (re-entry via another nest skips).
    if (!idsRegisteredFor.has(canvas)) {
      idsRegisteredFor.add(canvas);
      registerId(canvas.id, `${path}/id`, file);

      for (const problem of canvas.problem.topProblems) {
        registerId(
          problem.id,
          `${path}/problem/topProblems/${problem.id}/id`,
          file,
        );
      }
      for (const feature of canvas.solution.features) {
        registerId(
          feature.id,
          `${path}/solution/features/${feature.id}/id`,
          file,
        );
      }
    }

    // Per-expense mitigation budget must not exceed the expense amount.
    for (let i = 0; i < canvas.costStructure.expenses.length; i++) {
      const expense = canvas.costStructure.expenses[i];
      if (!expense?.mitigationCanvas) continue;
      const slotPath = `${path}/costStructure/expenses/${i}/mitigationCanvas`;
      const resolved = resolveChild(expense.mitigationCanvas, slotPath, file);
      if (!resolved) continue;
      const childTotal = expenseTotal(resolved.canvas);
      if (childTotal > expense.amountUsd) {
        pushIssue(
          {
            path: slotPath,
            message: `Mitigation expenses (${childTotal}) exceed expense amountUsd (${expense.amountUsd})`,
          },
          file,
        );
      }
    }

    const parentTotal = expenseTotal(canvas);

    for (const child of collectCanvasSlots(canvas, path)) {
      const resolved = resolveChild(child.slot, child.path, file);
      if (!resolved) continue;

      const childTotal = expenseTotal(resolved.canvas);
      if (parentTotal > 0 && childTotal > parentTotal) {
        pushIssue(
          {
            path: child.path,
            message: `Child expense total (${childTotal}) exceeds parent total (${parentTotal})`,
          },
          file,
        );
      }

      const enteredNewFile = resolved.file !== file;
      if (enteredNewFile) walkedFiles.add(resolved.file);
      walk(resolved.canvas, child.path, depth + 1, resolved.file);
    }

    idStack.pop();
    dfsStack.delete(canvas);
  };

  walk(root, rootPath || `/${root.id}`, 0, startFile);
  return issues;
}
