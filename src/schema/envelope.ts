import Type from "typebox";
import { FractalLeanCanvas } from "./canvas.js";
import type { FractalLeanCanvas as Canvas } from "./canvas.js";

/** Current FLC schema version literal. */
export const SCHEMA_VERSION = "0.1.0" as const;

export type SchemaVersionString = typeof SCHEMA_VERSION;

/** Default `$schema` URI when wrapping canvases for JSON export. */
export const DEFAULT_SCHEMA_URI =
  "https://github.com/huy9k/fractal-lean-canvas/tree/main/src/schema";

/**
 * GitOps document shell: version authority for one Fractal Lean Canvas root.
 */
export const VersionedFractalEnvelope = Type.Object(
  {
    $schema: Type.String({ minLength: 1 }),
    schemaVersion: Type.Literal(SCHEMA_VERSION),
    data: FractalLeanCanvas,
  },
  { additionalProperties: false },
);

export type VersionedFractalEnvelope = {
  $schema: string;
  schemaVersion: SchemaVersionString;
  data: Canvas;
};

/** Build a versioned envelope around a canvas (or inlined tree). */
export function versionedEnvelope(
  data: Canvas,
  $schema: string = DEFAULT_SCHEMA_URI,
): VersionedFractalEnvelope {
  return {
    $schema,
    schemaVersion: SCHEMA_VERSION,
    data,
  };
}
