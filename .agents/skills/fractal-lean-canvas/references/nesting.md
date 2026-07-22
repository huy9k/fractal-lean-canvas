# Why nesting hangs off cost structure

FLC attaches child canvases only via `costStructure.expenses[].node`. This is intentional. It follows **responsibility accounting**: nested nodes are **cost centers** under **budgetary control**, not **profit centers** whose earnings consolidate into the parent.

## Short answer

| Question                    | Answer                                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Why nest from expenses?     | The parent is granting **budget authority** (an appropriation) to fund the child.                              |
| Why not from revenue?       | That would treat nesting like **profit-center consolidation** — parent results would depend on child earnings. |
| Where does child profit go? | It stays on the child (local P&L). Parent does not auto-claim it.                                              |
| Can the child lose money?   | Yes. Loss leaders and early bets are normal cost-center behavior.                                              |

## Vocabulary (standard finance / managerial accounting)

| Term                                  | Meaning in FLC                                                                                                             |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Responsibility accounting**         | Units are judged only on what they control. Nesting encodes _who funds whom_, not a full group consolidation.              |
| **Cost center**                       | Unit managed primarily on spend vs budget. A cost-sponsored child is a cost center.                                        |
| **Profit center**                     | Unit managed on profit; results typically roll up. FLC does **not** model nesting as profit-center rollup.                 |
| **Budgetary control / appropriation** | Parent authorizes a spending ceiling. Child net burn must not exceed the sponsoring expense over the overlap window.       |
| **Net burn**                          | Child costs − child revenues (same window). The budget check uses burn, not “must be profitable.”                          |
| **Residual claim**                    | Whoever has an economic stake in the _child_ owns (or decides what to do with) child surplus — not the parent, by default. |
| **Retention vs distribution**         | Child may reinvest surplus (e.g. R&D) or pay stakeholders. That is a child-local policy choice.                            |
| **Upstream remittance**               | If cash/profit must move to the parent, book it explicitly (child expense + parent return) — never as silent rollup.       |
| **Consolidation**                     | Group accounting where subsidiary earnings flow into parent. FLC nesting is **not** consolidation.                         |
| **Loss leader / subsidy**             | Intentional spend above near-term revenue. Fits cost-center funding; fights forced-profit rules.                           |

## The economic edge (one direction)

```
Parent expense  ──funds──►  Child canvas
     ▲                         │
     │                         │ local revenue / cost / profit stay here
     │                         ▼
     └── budget ceiling only (child net burn ≤ expense)
```

- **Down the tree:** funding and authority (parent → child).
- **Up the tree:** only a **spend constraint** (burn must fit the appropriation).
- **Not up the tree:** automatic profit, revenue attribution, or “parent is valid only if children earn.”

## Why not revenue (or canvas-level `children`)?

### Nesting under `revenueStreams`

Tempting story: “this child is the source of that return.” Problems:

1. **Parent depends on child** — validating or deriving parent revenue from child profit makes the parent a hostage to the child’s performance (**forced profitability**).
2. **Loss leaders become illegal or dishonest** — early products often have costs ≫ revenues by design; an earn-floor rejects truthful plans.
3. **Mixes funding with performance** — responsibility accounting warns against funding a unit as a cost center and then judging it as a profit center.

Revenue lines on the parent stay **declared on the parent**. A child may _explain_ how value is created; it does not silently settle the parent’s top line.

### Canvas-level `children: []`

A free children list is a generic tree, not a **funding edge**. It loses the question responsibility accounting answers: _who appropriated the budget for this unit?_ Prefer deriving a child list from expenses that carry `node` when a UI needs one.

## What happens to child profit?

Child canvases keep a full Lean Canvas, including their own `revenueStreams` and `costStructure`. Surplus is **local**:

1. **Distribute** to child stakeholders (operators, partners, owners of that node).
2. **Retain / reinvest** — spend on R&D, growth, quality so reported profit stays near zero while building future optionality.

The parent’s sponsoring expense is a **ceiling on loss**, not a claim on gains.

If the organization later needs money to move parent ← child, model an **explicit remittance** (visible money lines on both sides). Do not add schema rules that push profit up automatically.

## Why amountMinor must be at least 1 (never zero)

Schema rule: every money line (`costStructure.expenses` and `revenueStreams.returns`) requires `amountMinor: integer ≥ 1`. Omit the line instead of booking `$0`.

For **sponsoring costs** this is intentional economics, not pedantry:

- Nesting always costs the parent **something** — at minimum **attention** (opportunity cost of time spent on the child).
- A child that nets a local profit does **not** make the parent’s sponsorship free. Child surplus stays on the child; the parent still paid to keep the nest alive.
- Example: you spend **1 day/month** on a nested project and your rate is **$1000/day** → the sponsoring expense is still at least **$1000/mo**, even when the child shows green on its own P&L.

So the parent cost row answers _“what does it cost me to keep this linked?”_ The child’s own books answer _“is the nested unit solvent?”_ Those are different ledgers. Forcing `amountMinor ≥ 1` stops “free nesting” fiction: if the row exists, the appropriation is real.

(Revenue shares the same structural floor — a zero return is noise; delete the line.)

## What validation encodes

- Child may attach to **at most one** sponsoring expense (tree, not DAG).
- Over the overlapping date window: **child net burn ≤ sponsoring expense total**.
- A profitable child (net burn ≤ 0) easily satisfies the ceiling; surplus is **not** credited to the parent.
- Money lines reject `amountMinor < 1` structurally (see above).
- The root canvas has no sponsor and may run at a loss freely.

See [validation.md](validation.md) for the full check list.

## One-liner

> Nesting is a **cost-center funding edge** under budgetary control — not a **profit-center consolidation edge**.

## Anti-patterns

- Requiring children (or the tree) to be profitable for the document to validate
- Deriving parent `revenueStreams` from child earnings
- Nesting under UVP, segments, or a bare `children` array “because it’s a sub-project”
- Treating the sponsoring expense as ownership of child upside
- Silent profit rollup instead of an explicit upstream remittance when cash must move
- Booking `$0` (or omitting attention) on a sponsoring expense because the child is profitable — nesting still costs the parent; use a real appropriation (e.g. attention × rate)
