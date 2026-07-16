import {
  unwrapCanvas,
  validateStructural,
  type StructuralIssue,
} from "./structural.js";
import { validateSemantic, type SemanticIssue } from "./semantic.js";

export type ValidationIssue = (StructuralIssue | SemanticIssue) & {
  file: string;
};

/**
 * Validate a single root envelope document (canvas id nests are not followed).
 */
export function validateDocument(
  value: unknown,
  fileLabel: string,
): ValidationIssue[] {
  const structural = validateStructural(value).map((issue) => ({
    ...issue,
    file: fileLabel,
  }));
  if (structural.length > 0) return structural;

  const canvas = unwrapCanvas(value);
  return validateSemantic(canvas, undefined, { file: fileLabel }).map(
    (issue) => ({
      ...issue,
      file: fileLabel,
    }),
  );
}
