import type { Schema } from "../model.js";
import type { ParsedSource } from "../parse/index.js";

/**
 * The model's view of where the request stands, used to drive the correction loop:
 * - "complete": the request is satisfied; stop.
 * - "needs_revision": more work or a fix is expected; the loop may continue.
 * - "blocked": the goal cannot be achieved (explained in `reply`); stop.
 */
export type CopilotStatus = "complete" | "needs_revision" | "blocked";

export type AiProviderResult = {
  reply: string;
  actions: unknown[];
  status?: CopilotStatus;
  /**
   * An out-of-band note from the PROVIDER (not the model) about how this turn was produced —
   * e.g. a local runtime that can't call tools ran in prompt-based JSON mode, so the copilot
   * could not probe joins or inspect values before answering. Rendered beside the reply, never
   * inside it: the reply is the model's words and is fed back as conversation history, and a
   * provider note must not become something the model reads as its own. Optional; most turns
   * have none.
   */
  notice?: string;
};

/** A prior turn in the copilot conversation, in the order it occurred. */
export type ConversationTurn = {
  role: "user" | "assistant";
  content: string;
};

/**
 * Caller-declared intent for a propose call. The entry point knows whether it is kicking off a
 * fresh schema derivation (the "draft a schema" flow) or relaying an ordinary chat turn — a
 * provider must never have to infer this from history length, which misclassifies plain
 * first-turn questions as derivations. Providers may use `intent: "derive"` to gate
 * investigation-phase behavior (e.g. withholding finalization for a few tool rounds).
 */
export type ProposeOptions = {
  intent?: "derive" | "chat";
};

/**
 * A lossy projection of one already-detected suggestion, sent to the model for reranking. Carries
 * only the stats the detectors already computed — never raw sample values (privacy + token cost).
 * `id` echoes the consumer's suggestion id so a returned {@link SuggestionRanking} can be matched
 * back; rankings whose id isn't in the sent set are dropped (the model cannot fabricate).
 */
export type SuggestionDigest = {
  id: string;
  kind: "pk" | "fk" | "type";
  /** Human label for the (left) field, e.g. "facilities · facility_id". */
  left: string;
  /** Right-hand field label — fk suggestions only. */
  right?: string;
  /** Normalized value overlap as a whole-number percent — fk only. */
  overlapPercent?: number;
  /** Count of shared normalized values — fk only. */
  sharedValues?: number;
  /** Inferred relationship grain, e.g. "1:N" — fk only. */
  grain?: string | null;
  /** True when the join needs normalization before the columns will match — fk only. */
  needsNormalization?: boolean;
  /** Detector justification — pk/type suggestions. */
  reason?: string;
};

/**
 * The model's verdict on one suggestion: where it should sit (`rank`, ascending) and why
 * (`rationale`, one line shown under the card). `priority` is an optional emphasis hint. Reranking
 * is presentation-only: it can demote, promote, and explain, but never invents, gates, or removes a
 * suggestion (the detectors remain the source of truth).
 */
export type SuggestionRanking = {
  id: string;
  rank: number;
  rationale: string;
  priority?: "high" | "normal" | "low";
};

/**
 * One model the user's key can access, as projected from the provider's model catalog. A lossy
 * view of the Anthropic Models API object: `id` is the request string, `displayName` is for the
 * picker, and the optional token fields describe the context window / output cap when the provider
 * reports them. Providers (and tests) need not implement listing — see {@link AiProvider.listModels}.
 */
export type ModelInfo = {
  id: string;
  displayName: string;
  createdAt?: string;
  /** Context-window size in tokens, when the provider reports it. */
  maxInputTokens?: number;
  /** Maximum output tokens per request, when the provider reports it. */
  maxOutputTokens?: number;
};

export interface AiProvider {
  /**
   * Propose a reply + actions for `message`. `history` carries earlier turns so the model can
   * resolve follow-ups ("link them on that key", "do the second one"); it excludes the current
   * `message`. The live schema/sources are always passed fresh, so history only needs the dialogue.
   */
  propose(
    schema: Schema,
    sources: ParsedSource[],
    message: string,
    history?: ConversationTurn[],
    options?: ProposeOptions,
  ): Promise<AiProviderResult>;

  /**
   * Optional: reorder + annotate already-detected suggestions by how likely a data engineer is to
   * want them. Receives the live schema/sources for naming + grain context and the candidate
   * digests; returns a ranking per suggestion. Optional so providers (and tests) need not implement
   * it — consumers feature-detect and fall back to the deterministic detector order when absent.
   */
  rankSuggestions?(
    schema: Schema,
    sources: ParsedSource[],
    candidates: SuggestionDigest[],
  ): Promise<SuggestionRanking[]>;

  /**
   * Optional: list the models the current credentials can use, for a model picker. Optional so
   * providers (and tests) need not implement it — consumers feature-detect and fall back to a
   * curated static catalog when it's absent or the call fails.
   */
  listModels?(): Promise<ModelInfo[]>;
}
