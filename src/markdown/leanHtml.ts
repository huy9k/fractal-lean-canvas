import type {
  CanvasLineItem,
  CanvasSlot,
  FractalLeanCanvas,
} from "../schema/canvas.js";
import { collectCanvasSlots } from "../validate/semantic.js";

export type LeanHtmlCanvasOptions = {
  /** HTML heading level for the title cell (1–6). */
  headingLevel?: number;
};

/** Format a child-node pointer as an inline HTML link. */
function nodeRef(slot: CanvasSlot | undefined): string {
  return slot ? ` → <code>${escapeHtml(slot.id)}</code>` : "";
}

/** Escape HTML special characters. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Format numeric value for display. */
function formatValue(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString("en-US")
    : String(value);
}

/** Human line for a CanvasLineItem (title-first). */
function lineHtml(item: CanvasLineItem, money = false): string {
  const parts = [escapeHtml(item.title)];
  if (item.detail) parts.push(escapeHtml(item.detail));
  if (item.value !== undefined) {
    const formatted = formatValue(item.value);
    parts.push(
      money
        ? `<strong>$${formatted}</strong>`
        : `<strong>${formatted}</strong>`,
    );
  }
  return `${parts.join(" — ")}${nodeRef(item.node)}`;
}

/** Emit an HTML heading clamped to levels 1–6. */
function heading(level: number, text: string): string {
  const n = Math.min(6, Math.max(1, level));
  return `<h${n}>${escapeHtml(text)}</h${n}>`;
}

/** Bullet list inside a Lean Canvas cell. */
function bullets(items: string[]): string {
  if (items.length === 0) return "<em>None</em>";
  return `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
}

/** Labeled Lean Canvas cell (title + body). */
function box(title: string, body: string): string {
  return `<td><strong>${escapeHtml(title)}</strong><br/>${body}</td>`;
}

/**
 * Classic Ash Maurya Lean Canvas as a single HTML table.
 */
function leanCanvasTable(
  canvas: FractalLeanCanvas,
  headingLevel: number,
): string {
  const problems = bullets(canvas.problem.topProblems.map((p) => lineHtml(p)));
  const alternatives =
    canvas.problem.existingAlternatives.length === 0
      ? ""
      : `<br/><strong>Existing alternatives</strong>${bullets(
          canvas.problem.existingAlternatives.map((a) => lineHtml(a)),
        )}`;

  const solutions = bullets(canvas.solution.features.map((f) => lineHtml(f)));
  const metrics = bullets(canvas.keyMetrics.kpis.map((k) => lineHtml(k)));
  const uvpStatements = bullets(
    canvas.valueProposition.statements.map((s) => lineHtml(s)),
  );
  const highLevelConcepts =
    canvas.valueProposition.highLevelConcepts.length === 0
      ? ""
      : `<br/><strong>High-level concept</strong>${bullets(
          canvas.valueProposition.highLevelConcepts.map((c) => lineHtml(c)),
        )}`;
  const uvp = `${uvpStatements}${highLevelConcepts}`;
  const unfair = bullets(
    canvas.unfairAdvantage.advantages.map((a) => lineHtml(a)),
  );
  const channels = bullets(canvas.channels.paths.map((p) => lineHtml(p)));
  const segments = bullets(
    canvas.customerSegments.targetUsers.map((u) => lineHtml(u)),
  );
  const early =
    canvas.customerSegments.earlyAdopters.length === 0
      ? ""
      : `<br/><strong>Early adopters</strong>${bullets(
          canvas.customerSegments.earlyAdopters.map((a) => lineHtml(a)),
        )}`;
  const costs = bullets(
    canvas.costStructure.expenses.map((e) => lineHtml(e, true)),
  );
  const revenue = bullets(
    canvas.revenueStreams.returns.map((r) => lineHtml(r, true)),
  );

  const header = [
    heading(headingLevel, canvas.title),
    `<code>${escapeHtml(canvas.id)}</code> · owner <code>${escapeHtml(canvas.ownerId)}</code>`,
  ].join("<br/>");

  return [
    '<table className="flc-table">',
    "<tr>",
    `<td colspan="5">${header}</td>`,
    "</tr>",
    "<tr>",
    `<td rowspan="2"><strong>Problem</strong><br/>${problems}${alternatives}</td>`,
    box("Solution", solutions),
    `<td rowspan="2"><strong>Unique Value Proposition</strong><br/>${uvp}</td>`,
    box("Unfair Advantage", unfair),
    `<td rowspan="2"><strong>Customer Segments</strong><br/>${segments}${early}</td>`,
    "</tr>",
    "<tr>",
    box("Key Metrics", metrics),
    box("Channels", channels),
    "</tr>",
    "<tr>",
    `<td colspan="2"><strong>Cost Structure</strong><br/>${costs}</td>`,
    `<td colspan="3"><strong>Revenue Streams</strong><br/>${revenue}</td>`,
    "</tr>",
    "<tr>",
    `<td colspan="2" style="text-align:center"><strong>Product</strong></td>`,
    `<td colspan="3" style="text-align:center"><strong>Market</strong></td>`,
    "</tr>",
    "</table>",
  ].join("\n");
}

/** Render one canvas as a pure HTML Lean Canvas table. */
export function leanHtmlCanvas(
  canvas: FractalLeanCanvas,
  options: LeanHtmlCanvasOptions = {},
): string {
  const h = options.headingLevel ?? 1;
  return leanCanvasTable(canvas, h).trimEnd() + "\n";
}

/** Render root + reachable nests as Lean Canvas HTML (DFS). */
export function leanHtmlEcosystem(
  root: FractalLeanCanvas,
  byId: Map<string, FractalLeanCanvas>,
): string {
  const parts: string[] = [];
  const visited = new Set<string>();

  const walk = (canvas: FractalLeanCanvas, depth: number): void => {
    if (visited.has(canvas.id)) return;
    visited.add(canvas.id);

    if (parts.length > 0) parts.push("\n<hr/>\n");
    parts.push(
      leanHtmlCanvas(canvas, { headingLevel: Math.min(6, depth + 1) }),
    );

    for (const { slot } of collectCanvasSlots(canvas, "")) {
      const child = byId.get(slot.id);
      if (child) walk(child, depth + 1);
    }
  };

  walk(root, 0);
  return parts.join("\n").trimEnd() + "\n";
}
