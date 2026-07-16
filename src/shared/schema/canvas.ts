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

type LineItemList = CanvasLineItem[];

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
    topProblems: LineItemList;
    existingAlternatives: LineItemList;
  };
  solution: { features: LineItemList };
  customerSegments: {
    targetUsers: LineItemList;
    earlyAdopters: LineItemList;
  };
  valueProposition: {
    statements: LineItemList;
    highLevelConcepts: LineItemList;
  };
  channels: { paths: LineItemList };
  costStructure: { expenses: LineItemList };
  revenueStreams: { returns: LineItemList };
  keyMetrics: { kpis: LineItemList };
  unfairAdvantage: { advantages: LineItemList };
};

/** Child canvas: id pointer or nested canvas (inlined projections). */
export type CanvasSlot = CanvasIdRef | FractalLeanCanvas;

/** TypeBox object with only named line-item arrays. */
function itemSection(shape: Record<string, TSchema>) {
  return Type.Object(shape, { additionalProperties: false });
}

/** Build the cyclic FractalLeanCanvas object schema. */
function buildFractalLeanCanvasSchema(canvasRef: TSchema) {
  const items = Type.Array(canvasLineItem(canvasRef));

  return Type.Object(
    {
      id: Type.String({ minLength: 1 }),
      title: Type.String({ minLength: 1 }),
      ownerId: Type.String({ minLength: 1 }),

      problem: itemSection({
        topProblems: items,
        existingAlternatives: items,
      }),
      solution: itemSection({ features: items }),
      customerSegments: itemSection({
        targetUsers: items,
        earlyAdopters: items,
      }),
      valueProposition: itemSection({
        statements: items,
        highLevelConcepts: items,
      }),
      channels: itemSection({ paths: items }),
      costStructure: itemSection({ expenses: items }),
      revenueStreams: itemSection({ returns: items }),
      keyMetrics: itemSection({ kpis: items }),
      unfairAdvantage: itemSection({ advantages: items }),
    },
    { additionalProperties: false },
  );
}

/**
 * Runtime TypeBox schema for FractalLeanCanvas (cyclic: `node` may nest).
 */
export const FractalLeanCanvas = Type.Cyclic(
  {
    FractalLeanCanvas: buildFractalLeanCanvasSchema(
      Type.Ref("FractalLeanCanvas"),
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

/** Path prefix + accessor for every CanvasLineItem[] on a canvas. */
const LINE_ITEM_SECTIONS: ReadonlyArray<{
  path: string;
  items: (canvas: FractalLeanCanvas) => LineItemList;
}> = [
  {
    path: "problem/topProblems",
    items: (c) => c.problem.topProblems,
  },
  {
    path: "problem/existingAlternatives",
    items: (c) => c.problem.existingAlternatives,
  },
  { path: "solution/features", items: (c) => c.solution.features },
  {
    path: "customerSegments/targetUsers",
    items: (c) => c.customerSegments.targetUsers,
  },
  {
    path: "customerSegments/earlyAdopters",
    items: (c) => c.customerSegments.earlyAdopters,
  },
  {
    path: "valueProposition/statements",
    items: (c) => c.valueProposition.statements,
  },
  {
    path: "valueProposition/highLevelConcepts",
    items: (c) => c.valueProposition.highLevelConcepts,
  },
  { path: "channels/paths", items: (c) => c.channels.paths },
  {
    path: "costStructure/expenses",
    items: (c) => c.costStructure.expenses,
  },
  {
    path: "revenueStreams/returns",
    items: (c) => c.revenueStreams.returns,
  },
  { path: "keyMetrics/kpis", items: (c) => c.keyMetrics.kpis },
  {
    path: "unfairAdvantage/advantages",
    items: (c) => c.unfairAdvantage.advantages,
  },
];

/** Every line item on a canvas (for id registration / node walks). */
export function collectLineItems(
  canvas: FractalLeanCanvas,
): { path: string; item: CanvasLineItem }[] {
  return LINE_ITEM_SECTIONS.flatMap(({ path, items }) =>
    items(canvas).map((item) => ({ path: `${path}/${item.id}`, item })),
  );
}
