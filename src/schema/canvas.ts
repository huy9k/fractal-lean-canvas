import Type from "typebox";
import type { TSchema } from "typebox";

/** Pointer to another canvas by its `id` (resolved across the ecosystem). */
export const CanvasIdRef = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export type CanvasIdRef = {
  id: string;
};

/** Line-item schema; `nodeSchema` is the canvas type (id-ref or nested). */
function canvasLineItem(nodeSchema: TSchema) {
  return Type.Object(
    {
      id: Type.String({ minLength: 1 }),
      title: Type.String({ minLength: 1 }),
      value: Type.Optional(Type.Number()),
      detail: Type.Optional(Type.String()),
      node: Type.Optional(Type.Union([CanvasIdRef, nodeSchema])),
    },
    { additionalProperties: false },
  );
}

/**
 * Shared human/agent line item.
 * Show `title` (+ optional numeric `value`) in UI; keep `id` machine-only.
 * File layout uses id-ref `node`; nested canvases are schema-valid too.
 */
export type CanvasLineItem = {
  id: string;
  title: string;
  value?: number;
  detail?: string;
  node?: CanvasSlot;
};

/**
 * Fractal Lean Canvas (9 Lean Canvas dimensions).
 * Document versioning lives on VersionedFractalEnvelope, not on child nodes.
 * On disk, `node` is usually `{ id }`; nested canvases are allowed (e.g. `flc json -r`).
 */
export type FractalLeanCanvas = {
  id: string;
  title: string;
  ownerId: string;
  problem: {
    topProblems: CanvasLineItem[];
    existingAlternatives: CanvasLineItem[];
  };
  solution: { features: CanvasLineItem[] };
  customerSegments: {
    targetUsers: CanvasLineItem[];
    earlyAdopters: CanvasLineItem[];
  };
  valueProposition: CanvasLineItem;
  channels: { paths: CanvasLineItem[] };
  costStructure: { expenses: CanvasLineItem[] };
  revenueStreams: { returns: CanvasLineItem[] };
  keyMetrics: { kpis: CanvasLineItem[] };
  unfairAdvantage: CanvasLineItem;
};

/** Child canvas: id pointer or nested canvas (inlined projections). */
export type CanvasSlot = CanvasIdRef | FractalLeanCanvas;

/**
 * Runtime TypeBox schema for FractalLeanCanvas (cyclic: `node` may nest).
 */
export const FractalLeanCanvas = Type.Cyclic(
  {
    FractalLeanCanvas: Type.Object(
      {
        id: Type.String({ minLength: 1 }),
        title: Type.String({ minLength: 1 }),
        ownerId: Type.String({ minLength: 1 }),

        problem: Type.Object({
          topProblems: Type.Array(
            canvasLineItem(Type.Ref("FractalLeanCanvas")),
          ),
          existingAlternatives: Type.Array(
            canvasLineItem(Type.Ref("FractalLeanCanvas")),
          ),
        }),

        solution: Type.Object({
          features: Type.Array(canvasLineItem(Type.Ref("FractalLeanCanvas"))),
        }),

        customerSegments: Type.Object({
          targetUsers: Type.Array(
            canvasLineItem(Type.Ref("FractalLeanCanvas")),
          ),
          earlyAdopters: Type.Array(
            canvasLineItem(Type.Ref("FractalLeanCanvas")),
          ),
        }),

        valueProposition: canvasLineItem(Type.Ref("FractalLeanCanvas")),

        channels: Type.Object({
          paths: Type.Array(canvasLineItem(Type.Ref("FractalLeanCanvas"))),
        }),

        costStructure: Type.Object({
          expenses: Type.Array(canvasLineItem(Type.Ref("FractalLeanCanvas"))),
        }),

        revenueStreams: Type.Object({
          returns: Type.Array(canvasLineItem(Type.Ref("FractalLeanCanvas"))),
        }),

        keyMetrics: Type.Object({
          kpis: Type.Array(canvasLineItem(Type.Ref("FractalLeanCanvas"))),
        }),

        unfairAdvantage: canvasLineItem(Type.Ref("FractalLeanCanvas")),
      },
      { additionalProperties: false },
    ),
  },
  "FractalLeanCanvas",
);

/** TypeBox line-item schema with id-ref-only `node` (file layout). */
export const CanvasLineItem = canvasLineItem(CanvasIdRef);

/** True when `node` holds a nested canvas rather than an `{ id }` pointer. */
export function isEmbeddedCanvas(slot: CanvasSlot): slot is FractalLeanCanvas {
  return "ownerId" in slot;
}

/** Every line item on a canvas (for id registration / node walks). */
export function collectLineItems(
  canvas: FractalLeanCanvas,
): { path: string; item: CanvasLineItem }[] {
  const out: { path: string; item: CanvasLineItem }[] = [];
  const push = (path: string, item: CanvasLineItem): void => {
    out.push({ path, item });
  };

  for (const item of canvas.problem.topProblems) {
    push(`problem/topProblems/${item.id}`, item);
  }
  for (const item of canvas.problem.existingAlternatives) {
    push(`problem/existingAlternatives/${item.id}`, item);
  }
  for (const item of canvas.solution.features) {
    push(`solution/features/${item.id}`, item);
  }
  for (const item of canvas.customerSegments.targetUsers) {
    push(`customerSegments/targetUsers/${item.id}`, item);
  }
  for (const item of canvas.customerSegments.earlyAdopters) {
    push(`customerSegments/earlyAdopters/${item.id}`, item);
  }
  push("valueProposition", canvas.valueProposition);
  for (const item of canvas.channels.paths) {
    push(`channels/paths/${item.id}`, item);
  }
  for (const item of canvas.costStructure.expenses) {
    push(`costStructure/expenses/${item.id}`, item);
  }
  for (const item of canvas.revenueStreams.returns) {
    push(`revenueStreams/returns/${item.id}`, item);
  }
  for (const item of canvas.keyMetrics.kpis) {
    push(`keyMetrics/kpis/${item.id}`, item);
  }
  push("unfairAdvantage", canvas.unfairAdvantage);

  return out;
}
