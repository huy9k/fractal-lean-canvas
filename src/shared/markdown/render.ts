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

export type MarkdownCanvasOptions = {
  /** Markdown heading level for the canvas title (1–6). */
  headingLevel?: number;
  /** ISO 4217 currency for money display (default: USD). */
  currency?: string;
};

/** Format a child-node pointer as a compact inline link. */
function nodeRef(slot: CanvasSlot | undefined): string {
  return slot ? ` → \`${slot.id}\`` : "";
}

/** Format a KPI target number. */
function formatTarget(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString("en-US")
    : String(value);
}

/** Human line for a qualitative CanvasLineItem. */
function lineText(item: CanvasLineItem): string {
  const bits = [item.title];
  if (item.detail) bits.push(item.detail);
  return bits.join(" — ");
}

/** Human line for a timed money item. */
function moneyLine(
  item: CostLineItem | RevenueLineItem,
  currency: string,
  withNode: boolean,
): string {
  const money = formatMoney(item.amountMinor, currency);
  const cadence = formatCadence(item.cadence);
  const bits = [
    `${item.title} — **${money}${cadence === "one-time" ? ` ${cadence}` : cadence}**`,
  ];
  if (item.detail) bits.push(item.detail);
  if (item.startDate || item.endDate) {
    bits.push(`${item.startDate ?? "…"}→${item.endDate ?? "…"}`);
  }
  const node = withNode && "node" in item ? nodeRef(item.node) : "";
  return `${bits.join(" — ")}${node}`;
}

/** Comparator code → display symbol */
function comparatorSymbol(comparator: MetricLineItem["comparator"]): string {
  switch (comparator) {
    case "gte":
      return "≥";
    case "lte":
      return "≤";
    case "eq":
      return "=";
  }
}

/** Human line for a metric. */
function metricLine(item: MetricLineItem): string {
  const unit = item.unit ? ` ${item.unit}` : "";
  const bits = [
    `${item.title} — **${comparatorSymbol(item.comparator)} ${formatTarget(item.targetValue)}${unit}**`,
  ];
  if (item.detail) bits.push(item.detail);
  return bits.join(" — ");
}

/** Emit a markdown heading clamped to levels 1–6. */
function heading(level: number, text: string): string {
  const n = Math.min(6, Math.max(1, level));
  return `${"#".repeat(n)} ${text}`;
}

/**
 * Render one Fractal Lean Canvas as human-readable markdown (lists + headings).
 */
export function markdownCanvas(
  canvas: FractalLeanCanvas,
  options: MarkdownCanvasOptions = {},
): string {
  const h = options.headingLevel ?? 1;
  const currency = options.currency ?? "USD";
  const lines: string[] = [];

  lines.push(heading(h, canvas.title));
  lines.push("");
  lines.push(`- **id:** \`${canvas.id}\``);
  lines.push(`- **owner:** \`${canvas.ownerId}\``);
  lines.push(`- **window:** ${canvas.startDate} → ${canvas.endDate}`);
  if (canvas.detail) {
    lines.push(`- **detail:** ${canvas.detail}`);
  }
  lines.push("");

  lines.push(heading(h + 1, "Problem"));
  lines.push("");
  if (canvas.problem.topProblems.length === 0) {
    lines.push("_No top problems._");
    lines.push("");
  } else {
    lines.push(heading(h + 2, "Top problems"));
    lines.push("");
    for (const p of canvas.problem.topProblems) {
      lines.push(`- ${lineText(p)}`);
    }
    lines.push("");
  }
  if (canvas.problem.existingAlternatives.length > 0) {
    lines.push(heading(h + 2, "Existing alternatives"));
    lines.push("");
    for (const a of canvas.problem.existingAlternatives) {
      lines.push(`- ${lineText(a)}`);
    }
    lines.push("");
  }

  lines.push(heading(h + 1, "Solution"));
  lines.push("");
  if (canvas.solution.features.length === 0) {
    lines.push("_No features._");
    lines.push("");
  } else {
    for (const f of canvas.solution.features) {
      lines.push(`- ${lineText(f)}`);
    }
    lines.push("");
  }

  lines.push(heading(h + 1, "Customer segments"));
  lines.push("");
  if (canvas.customerSegments.targetUsers.length > 0) {
    lines.push(heading(h + 2, "Target users"));
    lines.push("");
    for (const u of canvas.customerSegments.targetUsers) {
      lines.push(`- ${lineText(u)}`);
    }
    lines.push("");
  }
  if (canvas.customerSegments.earlyAdopters.length > 0) {
    lines.push(heading(h + 2, "Early adopters"));
    lines.push("");
    for (const a of canvas.customerSegments.earlyAdopters) {
      lines.push(`- ${lineText(a)}`);
    }
    lines.push("");
  }

  lines.push(heading(h + 1, "Value proposition"));
  lines.push("");
  if (canvas.valueProposition.statements.length === 0) {
    lines.push("_No statements._");
    lines.push("");
  } else {
    for (const s of canvas.valueProposition.statements) {
      lines.push(`- ${lineText(s)}`);
    }
    lines.push("");
  }
  if (canvas.valueProposition.highLevelConcepts.length > 0) {
    lines.push(heading(h + 2, "High-level concepts"));
    lines.push("");
    for (const c of canvas.valueProposition.highLevelConcepts) {
      lines.push(`- ${lineText(c)}`);
    }
    lines.push("");
  }

  lines.push(heading(h + 1, "Channels"));
  lines.push("");
  if (canvas.channels.paths.length === 0) {
    lines.push("_No channels._");
    lines.push("");
  } else {
    for (const p of canvas.channels.paths) {
      lines.push(`- ${lineText(p)}`);
    }
    lines.push("");
  }

  lines.push(heading(h + 1, "Cost structure"));
  lines.push("");
  if (canvas.costStructure.expenses.length === 0) {
    lines.push("_No expenses._");
    lines.push("");
  } else {
    for (const e of canvas.costStructure.expenses) {
      lines.push(`- ${moneyLine(e, currency, true)}`);
    }
    lines.push("");
  }

  lines.push(heading(h + 1, "Revenue streams"));
  lines.push("");
  if (canvas.revenueStreams.returns.length === 0) {
    lines.push("_No revenue streams._");
    lines.push("");
  } else {
    for (const r of canvas.revenueStreams.returns) {
      lines.push(`- ${moneyLine(r, currency, false)}`);
    }
    lines.push("");
  }

  lines.push(heading(h + 1, "Key metrics"));
  lines.push("");
  if (canvas.keyMetrics.kpis.length === 0) {
    lines.push("_No KPIs._");
    lines.push("");
  } else {
    for (const k of canvas.keyMetrics.kpis) {
      lines.push(`- ${metricLine(k)}`);
    }
    lines.push("");
  }

  lines.push(heading(h + 1, "Unfair advantage"));
  lines.push("");
  if (canvas.unfairAdvantage.advantages.length === 0) {
    lines.push("_No advantages._");
  } else {
    for (const a of canvas.unfairAdvantage.advantages) {
      lines.push(`- ${lineText(a)}`);
    }
  }
  lines.push("");

  return lines.join("\n").trimEnd() + "\n";
}

/**
 * Render a root canvas and every reachable nest (DFS), separated by rules.
 */
export function markdownEcosystem(
  root: FractalLeanCanvas,
  byId: Map<string, FractalLeanCanvas>,
  options: { currency?: string } = {},
): string {
  const parts: string[] = [];
  const visited = new Set<string>();

  const walk = (canvas: FractalLeanCanvas, depth: number): void => {
    if (visited.has(canvas.id)) return;
    visited.add(canvas.id);

    if (parts.length > 0) parts.push("\n---\n");
    parts.push(
      markdownCanvas(canvas, {
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
