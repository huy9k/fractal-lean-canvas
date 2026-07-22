import Type from "typebox";
import type { TSchema } from "typebox";
import type { BillingCadence } from "../finance/cadence.js";

/**
 * Host-agnostic git locator for a canvas in another repository.
 * Services (GitHub, GitLab, …) map `url` to their fetch APIs.
 */
export const CanvasGitLocator = Type.Object(
  {
    url: Type.String({ minLength: 1 }),
    ref: Type.Optional(Type.String({ minLength: 1 })),
    path: Type.Optional(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

export type CanvasGitLocator = {
  url: string;
  ref?: string;
  path?: string;
};

/**
 * Pointer to another canvas by its `id`.
 * Same-ecosystem: `{ id }` only. Cross-repo: add optional `git` locator.
 */
export const CanvasIdRef = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    git: Type.Optional(CanvasGitLocator),
  },
  { additionalProperties: false },
);

export type CanvasIdRef = {
  id: string;
  git?: CanvasGitLocator;
};

/** True when the ref points outside the local filesystem ecosystem. */
export function isRemoteCanvasRef(
  ref: CanvasIdRef,
): ref is CanvasIdRef & { git: CanvasGitLocator } {
  return Boolean(ref.git?.url);
}

const IsoDate = Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" });

const BillingCadenceSchema = Type.Union([
  Type.Object(
    { type: Type.Literal("one_time") },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      type: Type.Literal("recurring"),
      every: Type.Integer({ minimum: 1 }),
      unit: Type.Union([
        Type.Literal("day"),
        Type.Literal("week"),
        Type.Literal("month"),
        Type.Literal("year"),
      ]),
    },
    { additionalProperties: false },
  ),
]);

/** Qualitative line item (no money, no fractal node). */
function qualitativeLineItem() {
  return Type.Object(
    {
      id: Type.String({ minLength: 1 }),
      title: Type.String({ minLength: 1 }),
      detail: Type.Optional(Type.String()),
    },
    { additionalProperties: false },
  );
}

/** Shared human/agent qualitative line item. */
export type CanvasLineItem = {
  id: string;
  title: string;
  detail?: string;
};

type TimedMoneyBase = CanvasLineItem & {
  amountMinor: number;
  cadence: BillingCadence;
  startDate?: string;
  endDate?: string;
};

/** Cost line with optional child canvas (fractal only lives here). */
export type CostLineItem = TimedMoneyBase & {
  node?: CanvasSlot;
};

/** Revenue line (flat timed money). */
export type RevenueLineItem = TimedMoneyBase;

/** CI/CD metric guardrail. */
export type MetricLineItem = CanvasLineItem & {
  targetValue: number;
  comparator: "gte" | "lte" | "eq";
  unit?: string;
};

/**
 * Fractal Lean Canvas (9 Lean Canvas dimensions).
 * Document versioning + currency live on VersionedFractalEnvelope.
 * On disk, cost `node` is usually `{ id }`; nested canvases are allowed (e.g. `flc json -r`).
 */
export type FractalLeanCanvas = {
  id: string;
  title: string;
  ownerId: string;
  detail?: string;
  startDate: string;
  endDate: string;
  problem: {
    topProblems: CanvasLineItem[];
    existingAlternatives: CanvasLineItem[];
  };
  solution: { features: CanvasLineItem[] };
  customerSegments: {
    targetUsers: CanvasLineItem[];
    earlyAdopters: CanvasLineItem[];
  };
  valueProposition: {
    statements: CanvasLineItem[];
    highLevelConcepts: CanvasLineItem[];
  };
  channels: { paths: CanvasLineItem[] };
  costStructure: { expenses: CostLineItem[] };
  revenueStreams: { returns: RevenueLineItem[] };
  keyMetrics: { kpis: MetricLineItem[] };
  unfairAdvantage: { advantages: CanvasLineItem[] };
};

/** Child canvas: id pointer or nested canvas (inlined projections). */
export type CanvasSlot = CanvasIdRef | FractalLeanCanvas;

/** TypeBox object with only named line-item arrays. */
function itemSection(shape: Record<string, TSchema>) {
  return Type.Object(shape, { additionalProperties: false });
}

function timedMoneyFields(nodeSchema: TSchema | undefined) {
  const base = {
    id: Type.String({ minLength: 1 }),
    title: Type.String({ minLength: 1 }),
    detail: Type.Optional(Type.String()),
    amountMinor: Type.Integer({ minimum: 1 }),
    cadence: BillingCadenceSchema,
    startDate: Type.Optional(IsoDate),
    endDate: Type.Optional(IsoDate),
  };
  if (nodeSchema === undefined) {
    return Type.Object(base, { additionalProperties: false });
  }
  return Type.Object(
    {
      ...base,
      node: Type.Optional(Type.Union([CanvasIdRef, nodeSchema])),
    },
    { additionalProperties: false },
  );
}

function metricLineItem() {
  return Type.Object(
    {
      id: Type.String({ minLength: 1 }),
      title: Type.String({ minLength: 1 }),
      detail: Type.Optional(Type.String()),
      targetValue: Type.Number(),
      comparator: Type.Union([
        Type.Literal("gte"),
        Type.Literal("lte"),
        Type.Literal("eq"),
      ]),
      unit: Type.Optional(Type.String()),
    },
    { additionalProperties: false },
  );
}

/** Build the cyclic FractalLeanCanvas object schema. */
function buildFractalLeanCanvasSchema(canvasRef: TSchema) {
  const qualitative = Type.Array(qualitativeLineItem());
  const costs = Type.Array(timedMoneyFields(canvasRef));
  const revenues = Type.Array(timedMoneyFields(undefined));
  const metrics = Type.Array(metricLineItem());

  return Type.Object(
    {
      id: Type.String({ minLength: 1 }),
      title: Type.String({ minLength: 1 }),
      ownerId: Type.String({ minLength: 1 }),
      detail: Type.Optional(Type.String()),
      startDate: IsoDate,
      endDate: IsoDate,

      problem: itemSection({
        topProblems: qualitative,
        existingAlternatives: qualitative,
      }),
      solution: itemSection({ features: qualitative }),
      customerSegments: itemSection({
        targetUsers: qualitative,
        earlyAdopters: qualitative,
      }),
      valueProposition: itemSection({
        statements: qualitative,
        highLevelConcepts: qualitative,
      }),
      channels: itemSection({ paths: qualitative }),
      costStructure: itemSection({ expenses: costs }),
      revenueStreams: itemSection({ returns: revenues }),
      keyMetrics: itemSection({ kpis: metrics }),
      unfairAdvantage: itemSection({ advantages: qualitative }),
    },
    { additionalProperties: false },
  );
}

/**
 * Runtime TypeBox schema for FractalLeanCanvas (cyclic: cost `node` may nest).
 */
export const FractalLeanCanvas = Type.Cyclic(
  {
    FractalLeanCanvas: buildFractalLeanCanvasSchema(
      Type.Ref("FractalLeanCanvas"),
    ),
  },
  "FractalLeanCanvas",
);

/** TypeBox qualitative line-item schema. */
export const CanvasLineItem = qualitativeLineItem();

/** TypeBox cost line-item schema with id-ref-only `node` (file layout). */
export const CostLineItem = timedMoneyFields(CanvasIdRef);

/** TypeBox revenue line-item schema. */
export const RevenueLineItem = timedMoneyFields(undefined);

/** TypeBox metric line-item schema. */
export const MetricLineItem = metricLineItem();

/** TypeBox billing cadence schema. */
export { BillingCadenceSchema };

/** True when `node` holds a nested canvas rather than an `{ id }` pointer. */
export function isEmbeddedCanvas(slot: CanvasSlot): slot is FractalLeanCanvas {
  return "ownerId" in slot;
}

type IdPath = { path: string; id: string };

/** Every line-item id on a canvas (for uniqueness registration). */
export function collectAllLineItemIds(canvas: FractalLeanCanvas): IdPath[] {
  const rows: IdPath[] = [];
  const push = (path: string, id: string): void => {
    rows.push({ path, id });
  };

  for (const i of canvas.problem.topProblems) {
    push(`problem/topProblems/${i.id}`, i.id);
  }
  for (const i of canvas.problem.existingAlternatives) {
    push(`problem/existingAlternatives/${i.id}`, i.id);
  }
  for (const i of canvas.solution.features) {
    push(`solution/features/${i.id}`, i.id);
  }
  for (const i of canvas.customerSegments.targetUsers) {
    push(`customerSegments/targetUsers/${i.id}`, i.id);
  }
  for (const i of canvas.customerSegments.earlyAdopters) {
    push(`customerSegments/earlyAdopters/${i.id}`, i.id);
  }
  for (const i of canvas.valueProposition.statements) {
    push(`valueProposition/statements/${i.id}`, i.id);
  }
  for (const i of canvas.valueProposition.highLevelConcepts) {
    push(`valueProposition/highLevelConcepts/${i.id}`, i.id);
  }
  for (const i of canvas.channels.paths) {
    push(`channels/paths/${i.id}`, i.id);
  }
  for (const i of canvas.costStructure.expenses) {
    push(`costStructure/expenses/${i.id}`, i.id);
  }
  for (const i of canvas.revenueStreams.returns) {
    push(`revenueStreams/returns/${i.id}`, i.id);
  }
  for (const i of canvas.keyMetrics.kpis) {
    push(`keyMetrics/kpis/${i.id}`, i.id);
  }
  for (const i of canvas.unfairAdvantage.advantages) {
    push(`unfairAdvantage/advantages/${i.id}`, i.id);
  }
  return rows;
}

/** Cost line items with their section paths. */
export function collectCostItems(
  canvas: FractalLeanCanvas,
): { path: string; item: CostLineItem }[] {
  return canvas.costStructure.expenses.map((item) => ({
    path: `costStructure/expenses/${item.id}`,
    item,
  }));
}
