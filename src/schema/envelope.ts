import Type from "typebox";
import pkg from "../../package.json" with { type: "json" };
import { FractalLeanCanvas } from "./canvas.js";
import type { FractalLeanCanvas as Canvas } from "./canvas.js";

/** Current FLC schema version literal. */
export const SCHEMA_VERSION = pkg.version;

export type SchemaVersionString = typeof SCHEMA_VERSION;

/** Default `$schema` URI when wrapping canvases for JSON export. */
export const DEFAULT_SCHEMA_URI = `https://raw.githubusercontent.com/huy9k/fractal-lean-canvas/raw-schema-json/envelope-${SCHEMA_VERSION}.json`;

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
