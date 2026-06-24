import type { Schema } from "../model.js";
import type { ParsedSource } from "../parse/index.js";

export type AiProviderResult = {
  reply: string;
  actions: unknown[];
};

/** A prior turn in the copilot conversation, in the order it occurred. */
export type ConversationTurn = {
  role: "user" | "assistant";
  content: string;
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
  ): Promise<AiProviderResult>;
}
