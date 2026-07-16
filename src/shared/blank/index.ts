import type { FractalLeanCanvas } from "../schema/canvas.js";
import {
  versionedEnvelope,
  type VersionedFractalEnvelope,
} from "../schema/envelope.js";

export type BlankCanvasOptions = {
  /** Canvas id (default: short random hex). */
  id?: string;
  /** Display title (default: Untitled). */
  title?: string;
  /** Owner id (default: human). */
  ownerId?: string;
};

/** Short random id for new canvases (browser + Node). */
function newCanvasId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

/**
 * Build a bare FractalLeanCanvas with empty line-item arrays.
 */
export function blankCanvas(
  options: BlankCanvasOptions = {},
): FractalLeanCanvas {
  return {
    id: options.id ?? newCanvasId(),
    title: options.title?.trim() || "Untitled",
    ownerId: options.ownerId?.trim() || "human",
    problem: { topProblems: [], existingAlternatives: [] },
    solution: { features: [] },
    customerSegments: { targetUsers: [], earlyAdopters: [] },
    valueProposition: { statements: [], highLevelConcepts: [] },
    channels: { paths: [] },
    costStructure: { expenses: [] },
    revenueStreams: { returns: [] },
    keyMetrics: { kpis: [] },
    unfairAdvantage: { advantages: [] },
  };
}

/**
 * Build a versioned root envelope around a blank canvas.
 */
export function blankRootEnvelope(
  options: BlankCanvasOptions = {},
): VersionedFractalEnvelope {
  return versionedEnvelope(blankCanvas(options));
}

/** Pretty-print a bare blank canvas as JSON (trailing newline). */
export function blankCanvasJson(options: BlankCanvasOptions = {}): string {
  return `${JSON.stringify(blankCanvas(options), null, 2)}\n`;
}

/** Pretty-print a blank root envelope as JSON (trailing newline). */
export function blankRootEnvelopeJson(
  options: BlankCanvasOptions = {},
): string {
  return `${JSON.stringify(blankRootEnvelope(options), null, 2)}\n`;
}
