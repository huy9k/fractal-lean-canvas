import { Value } from "typebox/value";
import { FractalLeanCanvas } from "../schema/canvas.js";
import { VersionedFractalEnvelope } from "../schema/envelope.js";
import type { FractalLeanCanvas as Canvas } from "../schema/canvas.js";
import type { VersionedFractalEnvelope as Envelope } from "../schema/envelope.js";

export type StructuralIssue = {
  path: string;
  message: string;
};

/** Required name for the single versioned document in an ecosystem. */
export const ROOT_FILE_NAME = "root.json";

/**
 * Detect whether a value looks like a VersionedFractalEnvelope.
 */
export function isEnvelope(value: unknown): value is Envelope {
  return (
    typeof value === "object" &&
    value !== null &&
    "data" in value &&
    "schemaVersion" in value &&
    "$schema" in value
  );
}

/**
 * Run TypeBox structural checks against a versioned envelope (root only).
 */
export function validateStructural(value: unknown): StructuralIssue[] {
  if (!isEnvelope(value)) {
    return [
      {
        path: "",
        message:
          "Document must be a VersionedFractalEnvelope ($schema, schemaVersion, data)",
      },
    ];
  }

  const issues: StructuralIssue[] = [];
  if (!Value.Check(VersionedFractalEnvelope, value)) {
    for (const error of Value.Errors(VersionedFractalEnvelope, value)) {
      issues.push({ path: error.instancePath, message: error.message });
    }
  }
  return issues;
}

/**
 * Run TypeBox structural checks against a bare FractalLeanCanvas (nest targets).
 */
export function validateCanvasStructural(value: unknown): StructuralIssue[] {
  if (isEnvelope(value)) {
    return [
      {
        path: "",
        message: `Only ${ROOT_FILE_NAME} may use the versioned envelope; child files must be bare canvases`,
      },
    ];
  }

  const issues: StructuralIssue[] = [];
  if (!Value.Check(FractalLeanCanvas, value)) {
    for (const error of Value.Errors(FractalLeanCanvas, value)) {
      issues.push({ path: error.instancePath, message: error.message });
    }
  }
  return issues;
}

/**
 * Unwrap envelope data after structural success.
 */
export function unwrapCanvas(value: unknown): Canvas {
  if (!isEnvelope(value)) {
    throw new Error(
      "Expected VersionedFractalEnvelope after structural validation",
    );
  }
  return value.data;
}
