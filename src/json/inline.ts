import type {
  CanvasLineItem,
  CanvasSlot,
  FractalLeanCanvas,
} from "../schema/canvas.js";
import { DEFAULT_SCHEMA_URI, versionedEnvelope } from "../schema/envelope.js";
import type { VersionedFractalEnvelope } from "../schema/envelope.js";

/**
 * Deep-clone a canvas with every `node: { id }` replaced by the full child canvas.
 * Cycles stay as `{ id }` stubs so expansion terminates.
 */
export function inlineCanvasNodes(
  canvas: FractalLeanCanvas,
  byId: Map<string, FractalLeanCanvas>,
  ancestors: ReadonlySet<string> = new Set(),
): CanvasSlot {
  if (ancestors.has(canvas.id)) {
    return { id: canvas.id };
  }

  const nextAncestors = new Set(ancestors);
  nextAncestors.add(canvas.id);

  const mapItem = (item: CanvasLineItem): CanvasLineItem => {
    const { node, ...rest } = item;
    if (!node) return { ...rest };
    const child = byId.get(node.id);
    if (!child) return { ...rest, node };
    return {
      ...rest,
      node: inlineCanvasNodes(child, byId, nextAncestors),
    };
  };

  return {
    id: canvas.id,
    title: canvas.title,
    ownerId: canvas.ownerId,
    problem: {
      topProblems: canvas.problem.topProblems.map(mapItem),
      existingAlternatives: canvas.problem.existingAlternatives.map(mapItem),
    },
    solution: {
      features: canvas.solution.features.map(mapItem),
    },
    customerSegments: {
      targetUsers: canvas.customerSegments.targetUsers.map(mapItem),
      earlyAdopters: canvas.customerSegments.earlyAdopters.map(mapItem),
    },
    valueProposition: {
      statements: canvas.valueProposition.statements.map(mapItem),
      highLevelConcepts: canvas.valueProposition.highLevelConcepts.map(mapItem),
    },
    channels: {
      paths: canvas.channels.paths.map(mapItem),
    },
    costStructure: {
      expenses: canvas.costStructure.expenses.map(mapItem),
    },
    revenueStreams: {
      returns: canvas.revenueStreams.returns.map(mapItem),
    },
    keyMetrics: {
      kpis: canvas.keyMetrics.kpis.map(mapItem),
    },
    unfairAdvantage: {
      advantages: canvas.unfairAdvantage.advantages.map(mapItem),
    },
  };
}

export type JsonCanvasOptions = {
  /** When set, expand `{ id }` node refs into nested canvases. */
  byId?: Map<string, FractalLeanCanvas>;
  /** `$schema` URI for the versioned envelope (default: package URI). */
  $schema?: string;
};

/**
 * Pretty-print a canvas as a VersionedFractalEnvelope (optionally with nodes inlined).
 */
export function jsonCanvas(
  canvas: FractalLeanCanvas,
  options: JsonCanvasOptions = {},
): string {
  const inlined =
    options.byId === undefined
      ? canvas
      : inlineCanvasNodes(canvas, options.byId);
  // Top-level expansion never returns a cycle stub (ancestors start empty).
  const data = inlined as FractalLeanCanvas;
  const envelope: VersionedFractalEnvelope = versionedEnvelope(
    data,
    options.$schema ?? DEFAULT_SCHEMA_URI,
  );
  return `${JSON.stringify(envelope, null, 2)}\n`;
}
