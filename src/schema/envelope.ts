import Type from "typebox";
import { FractalLeanCanvas } from "./canvas.js";

/** Current FLC schema version literal. */
export const SCHEMA_VERSION = "0.1.0" as const;

export type SchemaVersionString = typeof SCHEMA_VERSION;

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

export type VersionedFractalEnvelope = Type.Static<
  typeof VersionedFractalEnvelope
>;
