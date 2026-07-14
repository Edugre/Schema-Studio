import type { ConversationTurn, CopilotStatus } from "@grafture/core";

export const DEFAULT_MAX_ITERATIONS = 4;

/** A rejected action plus the reason the store gave for refusing it. */
export type RejectedEntry = { action: unknown; reason: string };

/** Outcome of one model→apply round. `applied` are human-readable summaries. */
export type LoopStep = {
  reply: string;
  status: CopilotStatus;
  applied: string[];
  rejected: RejectedEntry[];
  /** Provider-level note about how the turn ran (e.g. local JSON fallback). Usually absent. */
  notice?: string | undefined;
};

export type LoopOutcome = "complete" | "blocked" | "stalled" | "exhausted" | "cancelled";

export type CopilotLoopResult = {
  steps: LoopStep[];
  outcome: LoopOutcome;
};

export type ProposeFn = (
  message: string,
  history: ConversationTurn[],
) => Promise<{
  reply: string;
  actions: unknown[];
  status: CopilotStatus;
  notice?: string | undefined;
}>;

/** Applies actions to the live schema and returns display summaries + rejections. */
export type ApplyFn = (actions: unknown[]) => { applied: string[]; rejected: RejectedEntry[] };

export type RunCopilotLoopParams = {
  message: string;
  history: ConversationTurn[];
  propose: ProposeFn;
  apply: ApplyFn;
  maxIterations?: number;
  isCancelled?: () => boolean;
};

/** Stable key for a set of rejections, used to detect the model re-emitting the same failures. */
function rejectionSignature(rejected: RejectedEntry[]): string {
  return rejected
    .map((entry) => entry.reason)
    .sort()
    .join(" ");
}

/** The feedback turn sent back to the model after some actions were rejected. */
export function buildRejectionFeedback(rejected: RejectedEntry[]): string {
  const lines = rejected.map((entry) => `- ${entry.reason}`).join("\n");
  return [
    "Some of those actions could not be applied to the schema:",
    lines,
    "",
    'Analyze each reason and emit corrected actions. Do not repeat an action that was just rejected. If the goal cannot be achieved, set "status" to "blocked" and explain why instead of emitting more actions.',
  ].join("\n");
}

/**
 * The turn sent back after a clean apply when the model has not yet declared completion. It lets
 * the model observe the now-updated schema and either continue or write a closing confirmation.
 */
export function buildContinuationFeedback(): string {
  return [
    "Your actions were applied to the schema successfully.",
    'If the request is now fully satisfied, briefly confirm what changed and set "status" to "complete" with no further actions. If more changes are still needed, emit them.',
  ].join("\n");
}

/**
 * Drive the copilot as a rejection-correction agent: propose → apply → if anything was rejected,
 * feed the reasons back and let the model revise, repeating until the schema applies cleanly, the
 * model declares the goal blocked, no progress is made, the iteration cap is hit, or the caller
 * cancels. The propose/apply effects are injected so the loop logic is unit-testable.
 */
export async function runCopilotLoop(params: RunCopilotLoopParams): Promise<CopilotLoopResult> {
  const max = params.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const steps: LoopStep[] = [];
  const history: ConversationTurn[] = [...params.history];

  let message = params.message;
  let previousSignature: string | null = null;

  for (let iteration = 0; iteration < max; iteration++) {
    if (params.isCancelled?.()) {
      return { steps, outcome: "cancelled" };
    }

    const { reply, actions, status, notice } = await params.propose(message, history);
    const { applied, rejected } = params.apply(actions);
    steps.push({ reply, status, applied, rejected, notice });

    // Carry this round into the context the next iteration sees.
    history.push({ role: "user", content: message });
    history.push({ role: "assistant", content: reply });

    if (status === "blocked") {
      return { steps, outcome: "blocked" };
    }

    if (rejected.length > 0) {
      const signature = rejectionSignature(rejected);
      if (signature === previousSignature) {
        return { steps, outcome: "stalled" };
      }
      previousSignature = signature;
      message = buildRejectionFeedback(rejected);
      continue;
    }

    // Clean apply. Stop if the model says it's done, or if nothing happened (a pure answer or
    // narration with no changes). Otherwise run one more round so it can observe the updated
    // schema and send a closing confirmation — or keep going if more work remains.
    if (status === "complete" || applied.length === 0) {
      return { steps, outcome: "complete" };
    }
    message = buildContinuationFeedback();
  }

  return { steps, outcome: "exhausted" };
}
