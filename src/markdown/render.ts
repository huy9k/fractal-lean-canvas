import type { CanvasSlot, FractalLeanCanvas } from "../schema/canvas.js";
import { collectCanvasSlots } from "../validate/semantic.js";

export type MarkdownCanvasOptions = {
  /** Markdown heading level for the canvas title (1–6). */
  headingLevel?: number;
};

/** Format a nest slot as a compact inline pointer. */
function nestRef(slot: CanvasSlot | undefined): string {
  return slot ? ` → \`${slot.id}\`` : "";
}

/** USD display for cost/revenue lines. */
function usd(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}

/** Emit a markdown heading clamped to levels 1–6. */
function heading(level: number, text: string): string {
  const n = Math.min(6, Math.max(1, level));
  return `${"#".repeat(n)} ${text}`;
}

/**
 * Render one Fractal Lean Canvas as human-readable markdown.
 */
export function markdownCanvas(
  canvas: FractalLeanCanvas,
  options: MarkdownCanvasOptions = {},
): string {
  const h = options.headingLevel ?? 1;
  const lines: string[] = [];

  lines.push(heading(h, canvas.title));
  lines.push("");
  lines.push(`- **id:** \`${canvas.id}\``);
  lines.push(`- **owner:** \`${canvas.ownerId}\``);
  lines.push("");

  // Problem
  lines.push(heading(h + 1, "Problem"));
  lines.push("");
  if (canvas.problem.topProblems.length === 0) {
    lines.push("_No top problems._");
    lines.push("");
  } else {
    lines.push(heading(h + 2, "Top problems"));
    lines.push("");
    for (const p of canvas.problem.topProblems) {
      lines.push(
        `- **\`${p.id}\`** — ${p.description}${nestRef(p.subAnalysisCanvas)}`,
      );
    }
    lines.push("");
  }
  if (canvas.problem.existingAlternatives.length > 0) {
    lines.push(heading(h + 2, "Existing alternatives"));
    lines.push("");
    for (const a of canvas.problem.existingAlternatives) {
      lines.push(`- ${a.description}${nestRef(a.disruptionCanvas)}`);
    }
    lines.push("");
  }

  // Solution
  lines.push(heading(h + 1, "Solution"));
  lines.push("");
  if (canvas.solution.features.length === 0) {
    lines.push("_No features._");
    lines.push("");
  } else {
    for (const f of canvas.solution.features) {
      lines.push(
        `- **\`${f.id}\`** — ${f.description}${nestRef(f.executionCanvas)}`,
      );
    }
    lines.push("");
  }

  // Customer segments
  lines.push(heading(h + 1, "Customer segments"));
  lines.push("");
  if (canvas.customerSegments.targetUsers.length > 0) {
    lines.push(heading(h + 2, "Target users"));
    lines.push("");
    for (const u of canvas.customerSegments.targetUsers) {
      lines.push(`- ${u.personaName}${nestRef(u.demographicCanvas)}`);
    }
    lines.push("");
  }
  if (canvas.customerSegments.earlyAdopters.length > 0) {
    lines.push(heading(h + 2, "Early adopters"));
    lines.push("");
    for (const a of canvas.customerSegments.earlyAdopters) {
      lines.push(`- \`${a}\``);
    }
    lines.push("");
  }

  // Value proposition
  lines.push(heading(h + 1, "Value proposition"));
  lines.push("");
  lines.push(
    `${canvas.valueProposition.statement}${nestRef(canvas.valueProposition.highLevelConceptCanvas)}`,
  );
  lines.push("");

  // Channels
  lines.push(heading(h + 1, "Channels"));
  lines.push("");
  if (canvas.channels.paths.length === 0) {
    lines.push("_No channels._");
    lines.push("");
  } else {
    for (const p of canvas.channels.paths) {
      lines.push(`- ${p.description}${nestRef(p.acquisitionCanvas)}`);
    }
    lines.push("");
  }

  // Cost structure
  lines.push(heading(h + 1, "Cost structure"));
  lines.push("");
  if (canvas.costStructure.expenses.length === 0) {
    lines.push("_No expenses._");
    lines.push("");
  } else {
    for (const e of canvas.costStructure.expenses) {
      lines.push(
        `- ${e.description} — **${usd(e.amountUsd)}**${nestRef(e.mitigationCanvas)}`,
      );
    }
    lines.push("");
  }

  // Revenue
  lines.push(heading(h + 1, "Revenue streams"));
  lines.push("");
  if (canvas.revenueStreams.returns.length === 0) {
    lines.push("_No revenue streams._");
    lines.push("");
  } else {
    for (const r of canvas.revenueStreams.returns) {
      lines.push(
        `- ${r.description} — **${usd(r.valueUsd)}**${nestRef(r.monetizationCanvas)}`,
      );
    }
    lines.push("");
  }

  // KPIs
  lines.push(heading(h + 1, "Key metrics"));
  lines.push("");
  if (canvas.keyMetrics.kpis.length === 0) {
    lines.push("_No KPIs._");
    lines.push("");
  } else {
    for (const k of canvas.keyMetrics.kpis) {
      lines.push(
        `- **\`${k.metricName}\`** target **${k.targetValue}**${nestRef(k.optimizationCanvas)}`,
      );
    }
    lines.push("");
  }

  // Unfair advantage
  lines.push(heading(h + 1, "Unfair advantage"));
  lines.push("");
  lines.push(
    `${canvas.unfairAdvantage.moatDescription}${nestRef(canvas.unfairAdvantage.defenseCanvas)}`,
  );
  lines.push("");

  return lines.join("\n").trimEnd() + "\n";
}

/**
 * Render a root canvas and every reachable nest (DFS), separated by rules.
 */
export function markdownEcosystem(
  root: FractalLeanCanvas,
  byId: Map<string, FractalLeanCanvas>,
): string {
  const parts: string[] = [];
  const visited = new Set<string>();

  const walk = (canvas: FractalLeanCanvas, depth: number): void => {
    if (visited.has(canvas.id)) return;
    visited.add(canvas.id);

    if (parts.length > 0) parts.push("\n---\n");
    parts.push(
      markdownCanvas(canvas, { headingLevel: Math.min(6, depth + 1) }),
    );

    for (const { slot } of collectCanvasSlots(canvas, "")) {
      const child = byId.get(slot.id);
      if (child) walk(child, depth + 1);
    }
  };

  walk(root, 0);
  return parts.join("\n").trimEnd() + "\n";
}
