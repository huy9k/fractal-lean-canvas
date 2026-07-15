import {
  collectLineItems,
  isEmbeddedCanvas,
  type CanvasSlot,
  type FractalLeanCanvas,
} from "../schema/canvas.js";

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
 * Collect direct child node slots from every line item.
 */
export function collectCanvasSlots(
  canvas: FractalLeanCanvas,
  basePath: string,
): NestedCanvasSlot[] {
  const slots: NestedCanvasSlot[] = [];
  for (const { path, item } of collectLineItems(canvas)) {
    if (item.node) {
      slots.push({ path: `${basePath}/${path}/node`, slot: item.node });
    }
  }
  return slots;
}

/** Sum expense line-item values on a canvas. */
function expenseTotal(canvas: FractalLeanCanvas): number {
  return canvas.costStructure.expenses.reduce(
    (sum, e) => sum + (e.value ?? 0),
    0,
  );
}

/**
 * Semantic rules: unique ids, max depth, cycle guard, budget rollups.
 * Embedded canvases under `node` are always walked; `{ id }` refs need `resolveCanvasId`.
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

  /** Resolve a node slot (embedded canvas or id ref); skip when not following links. */
  const resolveChild = (
    slot: CanvasSlot,
    slotPath: string,
    fromFile: string,
  ): { canvas: FractalLeanCanvas; file: string } | undefined => {
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

    // Nested canvases (e.g. flc json -r) walk in-document; no file resolve.
    if (isEmbeddedCanvas(slot)) {
      return { canvas: slot, file: fromFile };
    }

    if (!options.resolveCanvasId) return undefined;

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

    if (!idsRegisteredFor.has(canvas)) {
      idsRegisteredFor.add(canvas);
      registerId(canvas.id, `${path}/id`, file);
      for (const { path: itemPath, item } of collectLineItems(canvas)) {
        registerId(item.id, `${path}/${itemPath}/id`, file);
      }
    }

    // Per-expense mitigation budget must not exceed the expense value.
    for (const expense of canvas.costStructure.expenses) {
      if (!expense.node || expense.value === undefined) continue;
      const slotPath = `${path}/costStructure/expenses/${expense.id}/node`;
      const resolved = resolveChild(expense.node, slotPath, file);
      if (!resolved) continue;
      const childTotal = expenseTotal(resolved.canvas);
      if (childTotal > expense.value) {
        pushIssue(
          {
            path: slotPath,
            message: `Mitigation expenses (${childTotal}) exceed expense value (${expense.value})`,
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
