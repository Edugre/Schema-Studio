import { z } from "zod";

/**
 * Copilot chat messages. This is a web/app concept (not part of the core domain model), but it
 * is persisted with the project, so it carries a zod schema for validating untrusted imports.
 */
export const ChatMessageSchema = z.discriminatedUnion("role", [
  z.object({
    id: z.string(),
    role: z.literal("user"),
    text: z.string(),
  }),
  z.object({
    id: z.string(),
    role: z.literal("assistant"),
    text: z.string(),
    applied: z.array(z.string()).optional(),
    rejected: z.array(z.string()).optional(),
    /**
     * A provider note about how the turn ran (e.g. a local model without tool calling fell back to
     * JSON mode). Kept out of `text` so it is never replayed to the model as its own words —
     * `buildConversationHistory` sends only `text`.
     */
    notice: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    role: z.literal("error"),
    text: z.string(),
  }),
]);

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export function nextMessageId(): string {
  return `msg-${crypto.randomUUID()}`;
}
