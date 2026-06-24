import type { AiProvider } from "@schema-studio/core";
import { useMemo, useRef, useState } from "react";

import { AnthropicBrowserProvider } from "../ai/AnthropicBrowserProvider.js";
import { useSchemaStore } from "../store/index.js";
import "./CopilotPanel.css";
import { Markdown } from "./Markdown.js";
import {
  collectAffectedTableIds,
  formatRejectedAction,
  summarizeAppliedActions,
} from "./formatActions.js";

type UserMessage = {
  id: string;
  role: "user";
  text: string;
};

type AssistantMessage = {
  id: string;
  role: "assistant";
  text: string;
  applied?: string[];
  rejected?: string[];
};

type ErrorMessage = {
  id: string;
  role: "error";
  text: string;
};

type ChatMessage = UserMessage | AssistantMessage | ErrorMessage;

function nextMessageId(): string {
  return `msg-${crypto.randomUUID()}`;
}

export function CopilotPanel() {
  const [apiKey, setApiKey] = useState("");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const schema = useSchemaStore((state) => state.schema);
  const sources = useSchemaStore((state) => state.sources);
  const runActions = useSchemaStore((state) => state.runActions);
  const selectTable = useSchemaStore((state) => state.selectTable);

  const provider = useMemo((): AiProvider | null => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      return null;
    }
    return new AnthropicBrowserProvider(trimmed);
  }, [apiKey]);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !provider || busy) {
      return;
    }

    setDraft("");
    setMessages((prev) => [...prev, { id: nextMessageId(), role: "user", text }]);
    setBusy(true);
    scrollToBottom();

    try {
      const { reply, actions } = await provider.propose(schema, sources, text);
      const { applied, rejected } = runActions(actions);
      const updatedSchema = useSchemaStore.getState().schema;

      const affectedTableIds = collectAffectedTableIds(applied);
      if (affectedTableIds[0]) {
        selectTable(affectedTableIds[0]);
      }

      const appliedSummary =
        applied.length > 0 ? summarizeAppliedActions(updatedSchema, applied) : undefined;
      const rejectedSummary =
        rejected.length > 0
          ? rejected.map((entry) => formatRejectedAction(entry.action, entry.reason))
          : undefined;

      setMessages((prev) => [
        ...prev,
        {
          id: nextMessageId(),
          role: "assistant",
          text: reply || "(No reply text returned.)",
          ...(appliedSummary ? { applied: appliedSummary } : {}),
          ...(rejectedSummary ? { rejected: rejectedSummary } : {}),
        },
      ]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong talking to the copilot.";
      setMessages((prev) => [...prev, { id: nextMessageId(), role: "error", text: message }]);
    } finally {
      setBusy(false);
      scrollToBottom();
    }
  };

  return (
    <section className="panel copilot-panel">
      <header className="panel-header">Copilot</header>
      <div className="panel-body">
        <div className="copilot-key">
          <label htmlFor="anthropic-key">Anthropic API key</label>
          <input
            id="anthropic-key"
            type="password"
            placeholder="sk-ant-..."
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            autoComplete="off"
          />
        </div>

        {!provider ? (
          <p className="copilot-placeholder">
            Enter an API key to enable the copilot. The canvas works without it — your key stays in
            memory and is never saved.
          </p>
        ) : null}

        {messages.length > 0 ? (
          <div className="copilot-chat">
            {messages.map((message) => {
              if (message.role === "user") {
                return (
                  <div key={message.id} className="copilot-message copilot-message--user">
                    <span className="copilot-message__label">You</span>
                    {message.text}
                  </div>
                );
              }

              if (message.role === "error") {
                return (
                  <div key={message.id} className="copilot-message copilot-message--error">
                    <span className="copilot-message__label">Error</span>
                    {message.text}
                  </div>
                );
              }

              return (
                <div key={message.id} className="copilot-message copilot-message--assistant">
                  <span className="copilot-message__label">Copilot</span>
                  <Markdown>{message.text}</Markdown>
                  {message.applied ? (
                    <div className="copilot-applied">
                      <strong>Applied to canvas</strong>
                      <ul>
                        {message.applied.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {message.rejected ? (
                    <div className="copilot-rejected">
                      <strong>Could not apply</strong>
                      <ul>
                        {message.rejected.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              );
            })}
            {busy ? <p className="copilot-status">Thinking…</p> : null}
            <div ref={chatEndRef} />
          </div>
        ) : provider ? (
          <p className="copilot-placeholder">
            Ask about your sources and schema — e.g. link tables on a grant number and warn if
            sample formats differ.
          </p>
        ) : null}

        <div className="copilot-compose">
          <textarea
            rows={3}
            placeholder="Ask the copilot about your schema..."
            value={draft}
            disabled={!provider || busy}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
          />
          <div className="copilot-compose__actions">
            <button type="button" onClick={() => void handleSend()} disabled={!provider || busy}>
              {busy ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
