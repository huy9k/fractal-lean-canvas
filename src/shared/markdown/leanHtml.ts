import type {
  CanvasLineItem,
  CanvasSlot,
  CostLineItem,
  FractalLeanCanvas,
  MetricLineItem,
  RevenueLineItem,
} from "../schema/canvas.js";
import { formatCadence, formatMoney } from "../finance/index.js";
import { collectCanvasSlots } from "../validate/semantic.js";

export type LeanHtmlCanvasOptions = {
  /** HTML heading level for the title cell (1–6). */
  headingLevel?: number;
  /** ISO 4217 currency for money display (default: USD). */
  currency?: string;
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

/** Format a KPI target number. */
function formatTarget(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString("en-US")
    : String(value);
}

/** Qualitative line HTML. */
function lineHtml(item: CanvasLineItem): string {
  const parts = [escapeHtml(item.title)];
  if (item.detail) parts.push(escapeHtml(item.detail));
  return parts.join(" — ");
}

/** Timed money line HTML. */
function moneyHtml(
  item: CostLineItem | RevenueLineItem,
  currency: string,
  withNode: boolean,
): string {
  const money = formatMoney(item.amountMinor, currency);
  const cadence = formatCadence(item.cadence);
  const label =
    cadence === "one-time" ? `${money} ${cadence}` : `${money}${cadence}`;
  const parts = [
    escapeHtml(item.title),
    `<strong>${escapeHtml(label)}</strong>`,
  ];
  if (item.detail) parts.push(escapeHtml(item.detail));
  const node = withNode && "node" in item ? nodeRef(item.node) : "";
  return `${parts.join(" — ")}${node}`;
}

/** Metric line HTML. */
function metricHtml(item: MetricLineItem): string {
  const unit = item.unit ? ` ${item.unit}` : "";
  const parts = [
    escapeHtml(item.title),
    `<strong>${escapeHtml(item.comparator)} ${formatTarget(item.targetValue)}${escapeHtml(unit)}</strong>`,
  ];
  if (item.detail) parts.push(escapeHtml(item.detail));
  return parts.join(" — ");
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
  currency: string,
): string {
  const problems = bullets(canvas.problem.topProblems.map((p) => lineHtml(p)));
  const alternatives =
    canvas.problem.existingAlternatives.length === 0
      ? ""
      : `<br/><strong>Existing alternatives</strong>${bullets(
          canvas.problem.existingAlternatives.map((a) => lineHtml(a)),
        )}`;

  const solutions = bullets(canvas.solution.features.map((f) => lineHtml(f)));
  const metrics = bullets(canvas.keyMetrics.kpis.map((k) => metricHtml(k)));
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
    canvas.costStructure.expenses.map((e) => moneyHtml(e, currency, true)),
  );
  const revenue = bullets(
    canvas.revenueStreams.returns.map((r) => moneyHtml(r, currency, false)),
  );

  const header = [
    heading(headingLevel, canvas.title),
    `<code>${escapeHtml(canvas.id)}</code> · owner <code>${escapeHtml(canvas.ownerId)}</code> · ${escapeHtml(canvas.startDate)} → ${escapeHtml(canvas.endDate)} · ${escapeHtml(currency)}`,
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
  const currency = options.currency ?? "USD";
  return leanCanvasTable(canvas, h, currency).trimEnd() + "\n";
}

/** Render root + reachable nests as Lean Canvas HTML (DFS). */
export function leanHtmlEcosystem(
  root: FractalLeanCanvas,
  byId: Map<string, FractalLeanCanvas>,
  options: { currency?: string } = {},
): string {
  const parts: string[] = [];
  const visited = new Set<string>();

  const walk = (canvas: FractalLeanCanvas, depth: number): void => {
    if (visited.has(canvas.id)) return;
    visited.add(canvas.id);

    if (parts.length > 0) parts.push("\n<hr/>\n");
    parts.push(
      leanHtmlCanvas(canvas, {
        headingLevel: Math.min(6, depth + 1),
        currency: options.currency,
      }),
    );

    for (const { slot } of collectCanvasSlots(canvas, "")) {
      const child = byId.get(slot.id);
      if (child) walk(child, depth + 1);
    }
  };

  walk(root, 0);
  return parts.join("\n").trimEnd() + "\n";
}
