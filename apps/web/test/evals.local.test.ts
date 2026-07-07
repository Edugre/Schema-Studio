import { applyActions, emptySchema, parseCsv, type Schema } from "@schema-studio/core";
import { describe, expect, it } from "vitest";

import { LocalBrowserProvider } from "../src/ai/LocalBrowserProvider.js";
import { buildInitialSchemaPrompt } from "../src/copilot/kickoff.js";
import { DEFAULT_MAX_ITERATIONS, runCopilotLoop } from "../src/copilot/agentLoop.js";
import { summarizeAppliedActions } from "../src/copilot/formatActions.js";

/**
 * Local-model comparison harness: opt-in, never runs in CI. Points the REAL
 * {@link LocalBrowserProvider} (agentic tool loop, JSON fallback, keyless headers) at a running
 * OpenAI-compatible runtime — Ollama by default — and drives the same initial-draft flow the app
 * sends, once per model, printing a scorecard so you can compare e.g. `qwen2.5:7b` vs `qwen2.5:14b`
 * on the SAME schema and sources.
 *
 * The scenario is the product's signature test — content-aware modeling. Two files SHOULD join on a
 * grant number, but one stores leading zeros and the other strips them (a format conflict, not a
 * name mismatch). A model that only reads column names proposes the join blind; a good one warns.
 *
 * Prereqs (see the app's local-model setup):
 *   ollama pull qwen2.5:7b && ollama pull qwen2.5:14b
 *   OLLAMA_ORIGINS="*" ollama serve        # CORS is browser-only; Node fetch ignores it
 *
 * Opt-in: this file is inert unless LOCAL_MODELS is set, so a plain `pnpm test` never reaches out
 * to a local server (same discipline as evals.live.test.ts gating on ANTHROPIC_API_KEY).
 *
 * Run (from repo root):
 *   LOCAL_MODELS="qwen2.5:7b,qwen2.5:14b" \
 *     pnpm --filter @schema-studio/web exec vitest run test/evals.local.test.ts
 *
 * Optional env:
 *   LOCAL_ENDPOINT   OpenAI-compatible base URL (default http://localhost:11434/v1)
 */

const endpoint = process.env["LOCAL_ENDPOINT"] ?? "http://localhost:11434/v1";
const models = (process.env["LOCAL_MODELS"] ?? "")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

// Two files that describe grants at the SAME grain and are meant to join on the grant number —
// but `grants.csv` keeps leading zeros ("0004521") and `payments.csv` strips them ("4521"). The
// values overlap semantically yet won't match as strings without normalization.
const GRANTS = [
  "grant_number,title,agency,awarded_on",
  "0004521,Coastal Erosion Study,NOAA,2026-01-05",
  "0004522,Urban Heat Mapping,EPA,2026-01-06",
  "0004523,Aquifer Recharge Model,USGS,2026-01-07",
  "0004524,Wildfire Fuel Survey,USFS,2026-01-08",
  "0004525,Pollinator Corridor Pilot,USDA,2026-01-09",
].join("\n");

const PAYMENTS = [
  "grant_no,amount,paid_on,status",
  "4521,125000,2026-02-01,disbursed",
  "4522,98000,2026-02-02,disbursed",
  "4523,143500,2026-02-03,pending",
  "4524,76000,2026-02-04,disbursed",
  "4525,210000,2026-02-05,pending",
].join("\n");

/** Does the reply call out the leading-zero / normalization risk (vs. proposing the join blind)? */
function mentionsFormatConflict(reply: string): boolean {
  const text = reply.toLowerCase();
  const risk = /(leading zero|zero-?pad|normal(?:ize|ization)|format|padd|won'?t match|mismatch)/;
  return risk.test(text);
}

/** A single model's run, reduced to comparable numbers. */
type Scorecard = {
  model: string;
  seconds: number;
  status: string;
  actions: number;
  applied: number;
  rejected: number;
  tables: number;
  relationships: number;
  flaggedConflict: boolean;
  error?: string;
};

async function runModel(model: string, sources: ReturnType<typeof parseCsv>[]): Promise<Scorecard> {
  const provider = new LocalBrowserProvider(endpoint, model);
  const started = Date.now();
  try {
    const result = await provider.propose(
      emptySchema(),
      sources,
      buildInitialSchemaPrompt({ name: "Grants integration", description: "" }),
    );
    const { schema, rejected } = applyActions(emptySchema(), result.actions);
    return {
      model,
      seconds: Math.round((Date.now() - started) / 100) / 10,
      status: result.status ?? "needs_revision",
      actions: result.actions.length,
      applied: result.actions.length - rejected.length,
      rejected: rejected.length,
      tables: schema.tables.length,
      relationships: schema.relationships.length,
      flaggedConflict: mentionsFormatConflict(result.reply),
    };
  } catch (error) {
    return {
      model,
      seconds: Math.round((Date.now() - started) / 100) / 10,
      status: "ERROR",
      actions: 0,
      applied: 0,
      rejected: 0,
      tables: 0,
      relationships: 0,
      flaggedConflict: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

describe.runIf(models.length > 0)(`local model comparison @ ${endpoint}`, () => {
  const cards: Scorecard[] = [];

  // One test per model so a slow/failed model doesn't sink the others; each still asserts the one
  // invariant the app enforces — whatever the model emits must survive core's action validator.
  for (const model of models) {
    it(`drives the tool loop on ${model}`, { timeout: 600_000 }, async () => {
      const sources = [parseCsv(GRANTS, "grants.csv"), parseCsv(PAYMENTS, "payments.csv")];
      const card = await runModel(model, sources);
      cards.push(card);

      if (card.error) {
        throw new Error(`${model} failed: ${card.error}`);
      }
      // Hard invariant (matches evals.live.test.ts): no emitted action may be rejected by core.
      // Everything else is reported, not asserted — small local models vary run to run.
      expect(card.rejected, `${model} emitted actions core rejected`).toBe(0);
    });
  }

  // Prints after the per-model tests: a side-by-side scorecard. `flaggedConflict` is the one that
  // separates content-aware reasoning from name-only guessing.
  it("prints the comparison scorecard", () => {
    const ordered = models.map((m) => cards.find((c) => c.model === m)).filter(Boolean);
    console.table(
      ordered.map((c) => ({
        model: c!.model,
        secs: c!.seconds,
        status: c!.status,
        tables: c!.tables,
        rels: c!.relationships,
        applied: c!.applied,
        rejected: c!.rejected,
        "flagged format conflict?": c!.flaggedConflict ? "yes ✅" : "no",
      })),
    );
    expect(ordered.length).toBe(models.length);
  });
});

// ---------------------------------------------------------------------------------------------
// Variant 2: the FULL multi-round copilot loop (propose → apply → feed rejections back → revise),
// not just a single propose() turn. This reproduces the app's `runDraft` wiring exactly: the real
// `runCopilotLoop` driving the real provider against a throwaway `working` copy via pure
// `applyActions` + `summarizeAppliedActions`, so what it measures is what a user would actually get.
// ---------------------------------------------------------------------------------------------

/** A multi-round run, reduced to comparable numbers. Adds round/outcome over the single-turn card. */
type LoopScorecard = {
  model: string;
  seconds: number;
  outcome: string;
  rounds: number;
  applied: number;
  rejected: number;
  tables: number;
  relationships: number;
  flaggedConflict: boolean;
  error?: string;
};

async function runModelLoop(
  model: string,
  sources: ReturnType<typeof parseCsv>[],
): Promise<LoopScorecard> {
  const provider = new LocalBrowserProvider(endpoint, model);
  const started = Date.now();
  // The evolving proposal the model builds across rounds — the store's `runDraft` uses the same
  // throwaway copy so nothing is committed. `makeId` mirrors the app (crypto.randomUUID).
  let working: Schema = emptySchema();
  const makeId = () => crypto.randomUUID();

  try {
    const result = await runCopilotLoop({
      message: buildInitialSchemaPrompt({ name: "Grants integration", description: "" }),
      history: [],
      maxIterations: DEFAULT_MAX_ITERATIONS,
      // Each round proposes against the CURRENT working copy (not a stale snapshot), exactly as the
      // app does — so the model sees the schema its earlier actions produced.
      propose: async (msg, turns) => {
        const proposed = await provider.propose(working, sources, msg, turns);
        return {
          reply: proposed.reply,
          actions: proposed.actions,
          status: proposed.status ?? "needs_revision",
        };
      },
      apply: (actions) => {
        const r = applyActions(working, actions, { makeId });
        working = r.schema;
        return {
          applied: r.applied.length > 0 ? summarizeAppliedActions(working, r.applied) : [],
          rejected: r.rejected,
        };
      },
    });

    // Content-aware warning can land in ANY round's reply (often the closing confirmation), so scan
    // every step, not just the last.
    const flaggedConflict = result.steps.some((step) => mentionsFormatConflict(step.reply));
    return {
      model,
      seconds: Math.round((Date.now() - started) / 100) / 10,
      outcome: result.outcome,
      rounds: result.steps.length,
      applied: result.steps.reduce((n, step) => n + step.applied.length, 0),
      rejected: result.steps.reduce((n, step) => n + step.rejected.length, 0),
      tables: working.tables.length,
      relationships: working.relationships.length,
      flaggedConflict,
    };
  } catch (error) {
    return {
      model,
      seconds: Math.round((Date.now() - started) / 100) / 10,
      outcome: "ERROR",
      rounds: 0,
      applied: 0,
      rejected: 0,
      tables: 0,
      relationships: 0,
      flaggedConflict: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

describe.runIf(models.length > 0)(`local model comparison (full loop) @ ${endpoint}`, () => {
  const cards: LoopScorecard[] = [];

  for (const model of models) {
    it(`runs the full copilot loop on ${model}`, { timeout: 900_000 }, async () => {
      const sources = [parseCsv(GRANTS, "grants.csv"), parseCsv(PAYMENTS, "payments.csv")];
      const card = await runModelLoop(model, sources);
      cards.push(card);

      if (card.error) {
        throw new Error(`${model} failed: ${card.error}`);
      }
      // The loop feeds rejections back, so the product of the loop is the final `working` schema —
      // it must actually build something from two clean CSVs (the app only stashes a draft when
      // tables > 0). Round-to-round rejections are expected and reported, not asserted.
      expect(card.tables, `${model} built no tables`).toBeGreaterThan(0);
    });
  }

  it("prints the full-loop comparison scorecard", () => {
    const ordered = models.map((m) => cards.find((c) => c.model === m)).filter(Boolean);
    console.table(
      ordered.map((c) => ({
        model: c!.model,
        secs: c!.seconds,
        outcome: c!.outcome,
        rounds: c!.rounds,
        tables: c!.tables,
        rels: c!.relationships,
        applied: c!.applied,
        rejected: c!.rejected,
        "flagged format conflict?": c!.flaggedConflict ? "yes ✅" : "no",
      })),
    );
    expect(ordered.length).toBe(models.length);
  });
});

// Re-exported so a future non-vitest runner (or a manual script) can reuse the scenario.
export const LOCAL_EVAL_SCENARIO = { GRANTS, PAYMENTS };
export type { Schema };
