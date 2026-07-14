import Type from "typebox";

/** External canvas pointer (relative path to another envelope file). */
export const CanvasFileRef = Type.Object(
  {
    ref: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export type CanvasFileRef = Type.Static<typeof CanvasFileRef>;

const InlineCanvas = Type.Ref("FractalLeanCanvas");
const CanvasSlot = Type.Union([InlineCanvas, CanvasFileRef]);

/**
 * Recursive Fractal Lean Canvas TypeBox schema (9 Lean Canvas dimensions).
 * Document versioning lives on VersionedFractalEnvelope, not on nest nodes.
 * Nest slots are inline canvases or `{ ref }` to another envelope file.
 */
export const FractalLeanCanvas = Type.Cyclic(
  {
    FractalLeanCanvas: Type.Object(
      {
        id: Type.String({ minLength: 1 }),
        title: Type.String({ minLength: 1 }),
        layerDepth: Type.Integer({ minimum: 0 }),
        ownerId: Type.String({ minLength: 1 }),
        lastUpdatedIso: Type.String({ minLength: 1 }),

        problem: Type.Object({
          topProblems: Type.Array(
            Type.Object({
              id: Type.String({ minLength: 1 }),
              description: Type.String(),
              subAnalysisCanvas: Type.Optional(CanvasSlot),
            }),
          ),
          existingAlternatives: Type.Array(
            Type.Object({
              description: Type.String(),
              disruptionCanvas: Type.Optional(CanvasSlot),
            }),
          ),
        }),

        solution: Type.Object({
          features: Type.Array(
            Type.Object({
              id: Type.String({ minLength: 1 }),
              description: Type.String(),
              executionCanvas: Type.Optional(CanvasSlot),
            }),
          ),
        }),

        customerSegments: Type.Object({
          targetUsers: Type.Array(
            Type.Object({
              personaName: Type.String(),
              demographicCanvas: Type.Optional(CanvasSlot),
            }),
          ),
          earlyAdopters: Type.Array(Type.String()),
        }),

        valueProposition: Type.Object({
          statement: Type.String(),
          highLevelConceptCanvas: Type.Optional(CanvasSlot),
        }),

        channels: Type.Object({
          paths: Type.Array(
            Type.Object({
              description: Type.String(),
              acquisitionCanvas: Type.Optional(CanvasSlot),
            }),
          ),
        }),

        costStructure: Type.Object({
          expenses: Type.Array(
            Type.Object({
              description: Type.String(),
              amountUsd: Type.Number(),
              mitigationCanvas: Type.Optional(CanvasSlot),
            }),
          ),
        }),

        revenueStreams: Type.Object({
          returns: Type.Array(
            Type.Object({
              description: Type.String(),
              valueUsd: Type.Number(),
              monetizationCanvas: Type.Optional(CanvasSlot),
            }),
          ),
        }),

        keyMetrics: Type.Object({
          kpis: Type.Array(
            Type.Object({
              metricName: Type.String(),
              targetValue: Type.Number(),
              optimizationCanvas: Type.Optional(CanvasSlot),
            }),
          ),
        }),

        unfairAdvantage: Type.Object({
          moatDescription: Type.String(),
          defenseCanvas: Type.Optional(CanvasSlot),
        }),
      },
      { additionalProperties: false },
    ),
  },
  "FractalLeanCanvas",
);

export type FractalLeanCanvas = Type.Static<typeof FractalLeanCanvas>;

export type CanvasSlot = FractalLeanCanvas | CanvasFileRef;

/** True when a nest slot points at another envelope file. */
export function isFileCanvasRef(slot: CanvasSlot): slot is CanvasFileRef {
  return (
    typeof slot === "object" &&
    slot !== null &&
    "ref" in slot &&
    !("id" in slot)
  );
}
