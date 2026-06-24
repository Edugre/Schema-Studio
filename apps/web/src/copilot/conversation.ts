import type { ConversationTurn } from "@schema-studio/core";

import type { ChatMessage } from "./messages.js";

/**
 * Recency window for the conversation sent to the model. We cap by both turn count and total
 * characters so a few long turns can't blow up the request, then keep the most recent turns.
 * The live schema/sources are re-sent every turn in the system prompt, so older dialogue is the
 * only thing trimmed — and the system prompt's prompt-cache means the bulky part is near-free.
 */
const MAX_TURNS = 20;
const MAX_CHARS = 12000;

export type BuildHistoryOptions = {
  maxTurns?: number;
  maxChars?: number;
};

/**
 * Convert stored chat into API conversation turns. Error messages are dropped (they are not real
 * assistant turns and would corrupt user/assistant alternation), the result is windowed to the
 * most recent turns, and any leading assistant turns are trimmed so the history a caller appends a
 * user message to still begins with a user turn.
 */
export function buildConversationHistory(
  messages: ChatMessage[],
  options: BuildHistoryOptions = {},
): ConversationTurn[] {
  const maxTurns = options.maxTurns ?? MAX_TURNS;
  const maxChars = options.maxChars ?? MAX_CHARS;

  const turns: ConversationTurn[] = [];
  for (const message of messages) {
    if (message.role === "error") {
      continue;
    }
    turns.push({ role: message.role, content: message.text });
  }

  // Keep the most recent turns within both budgets, walking from the newest backward.
  const windowed: ConversationTurn[] = [];
  let chars = 0;
  for (let i = turns.length - 1; i >= 0; i--) {
    const turn = turns[i]!;
    if (windowed.length >= maxTurns) {
      break;
    }
    chars += turn.content.length;
    if (chars > maxChars && windowed.length > 0) {
      break;
    }
    windowed.push(turn);
  }
  windowed.reverse();

  // The first turn must be a user turn (the API rejects a leading assistant message once the
  // caller appends the new user message after this history).
  while (windowed.length > 0 && windowed[0]!.role === "assistant") {
    windowed.shift();
  }

  return windowed;
}
