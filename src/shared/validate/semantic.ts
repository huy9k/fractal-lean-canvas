import {
  collectAllLineItemIds,
  collectCostItems,
  isEmbeddedCanvas,
  type CanvasSlot,
  type FractalLeanCanvas,
} from "../schema/canvas.js";
import {
  compareIsoDate,
  effectiveWindow,
  intersectWindows,
  netBurnMinor,
  parseIsoDate,
  totalMinor,
  type DateWindow,
} from "../finance/index.js";

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
  /** Child canvas id → first parent cost-slot path (tree, not DAG). */
  parentByChildId?: Map<string, string>;
};

/**
 * Collect direct child node slots from cost line items only.
 */
export function collectCanvasSlots(
  canvas: FractalLeanCanvas,
  basePath: string,
): NestedCanvasSlot[] {
  const slots: NestedCanvasSlot[] = [];
  for (const { path, item } of collectCostItems(canvas)) {
    if (item.node) {
      slots.push({ path: `${basePath}/${path}/node`, slot: item.node });
    }
  }
  return slots;
}

/**
 * Semantic rules: unique ids, max depth, cycle guard, date bounds, cost rollups.
 * Embedded canvases under cost `node` are always walked; `{ id }` refs need `resolveCanvasId`.
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
  const parentByChildId = options.parentByChildId ?? new Map<string, string>();
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

  const validateCanvasDates = (
    canvas: FractalLeanCanvas,
    path: string,
    file: string,
  ): DateWindow | undefined => {
    try {
      parseIsoDate(canvas.startDate);
      parseIsoDate(canvas.endDate);
    } catch (err) {
      pushIssue(
        {
          path: `${path}/startDate`,
          message: err instanceof Error ? err.message : String(err),
        },
        file,
      );
      return undefined;
    }
    if (compareIsoDate(canvas.startDate, canvas.endDate) > 0) {
      pushIssue(
        {
          path: `${path}/endDate`,
          message: `Canvas endDate ${canvas.endDate} is before startDate ${canvas.startDate}`,
        },
        file,
      );
      return undefined;
    }
    return { start: canvas.startDate, end: canvas.endDate };
  };

  const validateTimedItems = (
    canvas: FractalLeanCanvas,
    path: string,
    file: string,
  ): void => {
    for (const expense of canvas.costStructure.expenses) {
      try {
        effectiveWindow(expense, canvas);
      } catch (err) {
        pushIssue(
          {
            path: `${path}/costStructure/expenses/${expense.id}`,
            message: err instanceof Error ? err.message : String(err),
          },
          file,
        );
      }
    }
    for (const ret of canvas.revenueStreams.returns) {
      try {
        effectiveWindow(ret, canvas);
      } catch (err) {
        pushIssue(
          {
            path: `${path}/revenueStreams/returns/${ret.id}`,
            message: err instanceof Error ? err.message : String(err),
          },
          file,
        );
      }
    }
  };

  const walk = (
    canvas: FractalLeanCanvas,
    path: string,
    depth: number,
    file: string,
    parentWindow: DateWindow | undefined,
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

    const canvasWindow = validateCanvasDates(canvas, path, file);
    if (canvasWindow && parentWindow) {
      if (
        compareIsoDate(canvasWindow.start, parentWindow.start) < 0 ||
        compareIsoDate(canvasWindow.end, parentWindow.end) > 0
      ) {
        pushIssue(
          {
            path,
            message: `Child canvas window ${canvasWindow.start}…${canvasWindow.end} exceeds parent window ${parentWindow.start}…${parentWindow.end}`,
          },
          file,
        );
      }
    }

    if (!idsRegisteredFor.has(canvas)) {
      idsRegisteredFor.add(canvas);
      registerId(canvas.id, `${path}/id`, file);
      for (const { path: itemPath, id } of collectAllLineItemIds(canvas)) {
        registerId(id, `${path}/${itemPath}/id`, file);
      }
    }

    validateTimedItems(canvas, path, file);

    // Cost-excuse rollup: child net burn ≤ sponsoring expense over overlap.
    for (const expense of canvas.costStructure.expenses) {
      if (!expense.node) continue;
      const slotPath = `${path}/costStructure/expenses/${expense.id}/node`;
      const resolved = resolveChild(expense.node, slotPath, file);
      if (!resolved) continue;

      const priorParent = parentByChildId.get(resolved.canvas.id);
      if (priorParent !== undefined && priorParent !== slotPath) {
        pushIssue(
          {
            path: slotPath,
            message: `Canvas "${resolved.canvas.id}" already sponsored by ${priorParent} (tree, not DAG)`,
          },
          file,
        );
      } else {
        parentByChildId.set(resolved.canvas.id, slotPath);
      }

      try {
        const expenseWindow = effectiveWindow(expense, canvas);
        const childWindow: DateWindow = {
          start: resolved.canvas.startDate,
          end: resolved.canvas.endDate,
        };
        const overlap = intersectWindows(expenseWindow, childWindow);
        if (!overlap) {
          pushIssue(
            {
              path: slotPath,
              message: `Sponsoring expense window ${expenseWindow.start}…${expenseWindow.end} does not overlap child ${childWindow.start}…${childWindow.end}`,
            },
            file,
          );
        } else {
          const sponsorTotal = totalMinor(expense, overlap);
          const childBurn = netBurnMinor(resolved.canvas, overlap);
          if (childBurn > sponsorTotal) {
            pushIssue(
              {
                path: slotPath,
                message: `Child net burn (${childBurn}) exceeds sponsoring expense total (${sponsorTotal}) over ${overlap.start}…${overlap.end}`,
              },
              file,
            );
          }
        }
      } catch (err) {
        pushIssue(
          {
            path: slotPath,
            message: err instanceof Error ? err.message : String(err),
          },
          file,
        );
      }

      const enteredNewFile = resolved.file !== file;
      if (enteredNewFile) walkedFiles.add(resolved.file);
      walk(resolved.canvas, slotPath, depth + 1, resolved.file, canvasWindow);
    }

    idStack.pop();
    dfsStack.delete(canvas);
  };

  walk(root, rootPath || `/${root.id}`, 0, startFile, undefined);
  return issues;
}
