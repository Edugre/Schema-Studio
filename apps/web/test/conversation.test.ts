import { describe, expect, it } from "vitest";

import { buildConversationHistory } from "../src/copilot/conversation.js";
import type { ChatMessage } from "../src/copilot/messages.js";

function user(id: string, text: string): ChatMessage {
  return { id, role: "user", text };
}

function assistant(id: string, text: string): ChatMessage {
  return { id, role: "assistant", text };
}

describe("buildConversationHistory", () => {
  it("maps user and assistant turns in order", () => {
    const history = buildConversationHistory([
      user("u1", "link these on grant_no"),
      assistant("a1", "Done — added a relationship."),
      user("u2", "what about formats?"),
    ]);

    expect(history).toEqual([
      { role: "user", content: "link these on grant_no" },
      { role: "assistant", content: "Done — added a relationship." },
      { role: "user", content: "what about formats?" },
    ]);
  });

  it("drops error messages so role alternation is preserved", () => {
    const history = buildConversationHistory([
      user("u1", "do it"),
      { id: "e1", role: "error", text: "Anthropic API error (429)" },
      user("u2", "try again"),
    ]);

    expect(history).toEqual([
      { role: "user", content: "do it" },
      { role: "user", content: "try again" },
    ]);
  });

  it("keeps only the most recent turns within the turn cap", () => {
    const messages: ChatMessage[] = [];
    for (let i = 0; i < 30; i++) {
      messages.push(user(`u${i}`, `m${i}`));
    }

    const history = buildConversationHistory(messages, { maxTurns: 5 });

    expect(history).toHaveLength(5);
    expect(history.map((t) => t.content)).toEqual(["m25", "m26", "m27", "m28", "m29"]);
  });

  it("caps by character budget while always keeping the latest turn", () => {
    const history = buildConversationHistory(
      [user("u1", "old and short"), assistant("a1", "x".repeat(50)), user("u2", "y".repeat(500))],
      { maxChars: 100 },
    );

    // The newest turn is kept even though it alone exceeds the budget; older turns are dropped.
    expect(history).toEqual([{ role: "user", content: "y".repeat(500) }]);
  });

  it("trims leading assistant turns so history begins with a user turn", () => {
    const history = buildConversationHistory(
      [user("u0", "first"), assistant("a0", "earlier answer"), user("u1", "follow up")],
      { maxTurns: 2 },
    );

    // The window kept [assistant a0, user u1]; the leading assistant turn is dropped.
    expect(history).toEqual([{ role: "user", content: "follow up" }]);
  });

  it("returns an empty array for an empty conversation", () => {
    expect(buildConversationHistory([])).toEqual([]);
  });
});
