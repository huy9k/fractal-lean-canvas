import Type from "typebox";
import pkg from "../../../package.json" with { type: "json" };
import { FractalLeanCanvas } from "./canvas.js";
import type { FractalLeanCanvas as Canvas } from "./canvas.js";

/** Current FLC schema version literal. */
export const SCHEMA_VERSION = pkg.version;

export type SchemaVersionString = typeof SCHEMA_VERSION;

/** Default `$schema` URI when wrapping canvases for JSON export. */
export const DEFAULT_SCHEMA_URI = `https://raw.githubusercontent.com/huy9k/fractal-lean-canvas/raw-schema-json/envelope-${SCHEMA_VERSION}.json`;

/** Default ISO 4217 currency for blank roots. */
export const DEFAULT_CURRENCY = "USD";

/**
 * GitOps document shell: version authority + settlement currency for one root.
 */
export const VersionedFractalEnvelope = Type.Object(
  {
    $schema: Type.String({ minLength: 1 }),
    schemaVersion: Type.Literal(SCHEMA_VERSION),
    currency: Type.String({ pattern: "^[A-Z]{3}$" }),
    data: FractalLeanCanvas,
  },
  { additionalProperties: false },
);

export type VersionedFractalEnvelope = {
  $schema: string;
  schemaVersion: SchemaVersionString;
  currency: string;
  data: Canvas;
};

export type VersionedEnvelopeOptions = {
  currency?: string;
  $schema?: string;
};

/** Build a versioned envelope around a canvas (or inlined tree). */
export function versionedEnvelope(
  data: Canvas,
  options: VersionedEnvelopeOptions = {},
): VersionedFractalEnvelope {
  return {
    $schema: options.$schema ?? DEFAULT_SCHEMA_URI,
    schemaVersion: SCHEMA_VERSION,
    currency: (options.currency ?? DEFAULT_CURRENCY).toUpperCase(),
    data,
  };
}
