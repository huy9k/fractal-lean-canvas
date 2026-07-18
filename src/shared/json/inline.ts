import type {
  CanvasLineItem,
  CostLineItem,
  FractalLeanCanvas,
  MetricLineItem,
  RevenueLineItem,
  CanvasSlot,
} from "../schema/canvas.js";
import { DEFAULT_SCHEMA_URI, versionedEnvelope } from "../schema/envelope.js";
import type { VersionedFractalEnvelope } from "../schema/envelope.js";

/**
 * Deep-clone a canvas with every cost `node: { id }` replaced by the full child.
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

  const mapQual = (item: CanvasLineItem): CanvasLineItem => ({ ...item });

  const mapCost = (item: CostLineItem): CostLineItem => {
    const { node, ...rest } = item;
    if (!node) return { ...rest };
    const child = byId.get(node.id);
    if (!child) return { ...rest, node };
    return {
      ...rest,
      node: inlineCanvasNodes(child, byId, nextAncestors),
    };
  };

  const mapRevenue = (item: RevenueLineItem): RevenueLineItem => ({ ...item });
  const mapMetric = (item: MetricLineItem): MetricLineItem => ({ ...item });

  return {
    id: canvas.id,
    title: canvas.title,
    ownerId: canvas.ownerId,
    detail: canvas.detail,
    startDate: canvas.startDate,
    endDate: canvas.endDate,
    problem: {
      topProblems: canvas.problem.topProblems.map(mapQual),
      existingAlternatives: canvas.problem.existingAlternatives.map(mapQual),
    },
    solution: {
      features: canvas.solution.features.map(mapQual),
    },
    customerSegments: {
      targetUsers: canvas.customerSegments.targetUsers.map(mapQual),
      earlyAdopters: canvas.customerSegments.earlyAdopters.map(mapQual),
    },
    valueProposition: {
      statements: canvas.valueProposition.statements.map(mapQual),
      highLevelConcepts: canvas.valueProposition.highLevelConcepts.map(mapQual),
    },
    channels: {
      paths: canvas.channels.paths.map(mapQual),
    },
    costStructure: {
      expenses: canvas.costStructure.expenses.map(mapCost),
    },
    revenueStreams: {
      returns: canvas.revenueStreams.returns.map(mapRevenue),
    },
    keyMetrics: {
      kpis: canvas.keyMetrics.kpis.map(mapMetric),
    },
    unfairAdvantage: {
      advantages: canvas.unfairAdvantage.advantages.map(mapQual),
    },
  };
}

export type JsonCanvasOptions = {
  /** When set, expand `{ id }` node refs into nested canvases. */
  byId?: Map<string, FractalLeanCanvas>;
  /** `$schema` URI for the versioned envelope (default: package URI). */
  $schema?: string;
  /** ISO 4217 currency for the envelope (default: USD). */
  currency?: string;
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
  const data = inlined as FractalLeanCanvas;
  const envelope: VersionedFractalEnvelope = versionedEnvelope(data, {
    $schema: options.$schema ?? DEFAULT_SCHEMA_URI,
    currency: options.currency,
  });
  return `${JSON.stringify(envelope, null, 2)}\n`;
}
