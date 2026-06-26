import { useState } from "react";

import { InfoIcon } from "../ui/icons.js";
import type { SuggestionItem, SuggestionsApi } from "./useSuggestions.js";
import "./SuggestionsTab.css";

/**
 * SS-9 suggestions surfaced as the Copilot pane's "Suggestions" tab (handoff:
 * `design_handoff_suggestions`). Content-aware detector output — primary keys, foreign
 * keys/relationships, and column types — grouped into reviewable cards. "Apply" flows through
 * the validated store path; "Dismiss" hides a card without touching the schema. Body + footer
 * are returned as siblings so they slot into the pane's flex column (scroll body, pinned footer).
 */
export function SuggestionsTab({ api }: { api: SuggestionsApi }) {
  const { groups, openCount, needsReviewCount } = api;
  const [message, setMessage] = useState<{ kind: "info" | "error"; text: string } | null>(null);

  const apply = (item: SuggestionItem) => {
    const outcome = api.apply(item);
    setMessage(
      outcome.ok ? { kind: "info", text: outcome.label } : { kind: "error", text: outcome.error },
    );
  };

  const applyAll = () => {
    // Snapshot first: applying mutates the schema, which re-derives `open` mid-iteration.
    const items = [...api.open];
    let applied = 0;
    let lastError: string | null = null;
    for (const item of items) {
      const outcome = api.apply(item);
      if (outcome.ok) {
        applied += 1;
      } else {
        lastError = outcome.error;
      }
    }
    if (lastError && applied === 0) {
      setMessage({ kind: "error", text: lastError });
    } else {
      setMessage({
        kind: "info",
        text: `Applied ${applied} suggestion${applied === 1 ? "" : "s"}.`,
      });
    }
  };

  return (
    <>
      <div className="copilot-suggest-body">
        {message ? (
          <p className={`copilot-suggest-message copilot-suggest-message--${message.kind}`}>
            {message.text}
          </p>
        ) : null}

        {groups.map((group) => (
          <section key={group.key} className="copilot-suggest-group">
            <header className="copilot-suggest-grouphead">
              <span className="copilot-suggest-grouphead__label">{group.label}</span>
              <span className="copilot-suggest-grouphead__count">{group.items.length}</span>
              <span className="copilot-suggest-grouphead__rule" aria-hidden />
            </header>

            {group.items.map((item) => (
              <SuggestionCard
                key={item.id}
                item={item}
                onApply={() => apply(item)}
                onDismiss={() => api.dismiss(item.id)}
              />
            ))}
          </section>
        ))}
      </div>

      <div className="copilot-suggest-footer">
        <span className="copilot-suggest-footer__status">
          {needsReviewCount > 0 ? (
            <span className="copilot-suggest-amber">{needsReviewCount} needs review</span>
          ) : (
            `${openCount} open`
          )}
        </span>
        <div className="copilot-suggest-footer__actions">
          <button
            type="button"
            className="copilot-suggest-btn copilot-suggest-btn--ghost"
            onClick={api.dismissAll}
          >
            Dismiss all
          </button>
          <button
            type="button"
            className="copilot-suggest-btn copilot-suggest-btn--primary"
            onClick={applyAll}
          >
            Apply all {openCount}
          </button>
        </div>
      </div>
    </>
  );
}

/** A single suggestion card. Title shape varies by group; details + actions are shared. */
function SuggestionCard({
  item,
  onApply,
  onDismiss,
}: {
  item: SuggestionItem;
  onApply: () => void;
  onDismiss: () => void;
}) {
  if (item.group === "fk" && item.needsReview) {
    // Format-mismatch join: amber caution card with the normalize-before-join warning. Still
    // actionable (Apply adds the relationship), but flagged so the user reviews the mismatch.
    return (
      <div className="copilot-suggest-card copilot-suggest-card--caution">
        <span className="copilot-suggest-card__cautionicon" aria-hidden>
          <InfoIcon size={16} />
        </span>
        <div className="copilot-suggest-card__cautionbody">
          <div className="copilot-suggest-card__title">
            Possible join: <code>{item.join.candidate.left.field}</code> ↔{" "}
            <code>{item.join.candidate.right.field}</code>
          </div>
          <div className="copilot-suggest-card__detail">
            {item.join.overlapPercent}% overlap · {item.join.warning}
          </div>
          <CardActions onApply={onApply} onDismiss={onDismiss} />
        </div>
      </div>
    );
  }

  return (
    <div className="copilot-suggest-card">
      <SuggestionTitle item={item} />
      <div className="copilot-suggest-card__detail">{detailFor(item)}</div>
      <CardActions onApply={onApply} onDismiss={onDismiss} />
    </div>
  );
}

function SuggestionTitle({ item }: { item: SuggestionItem }) {
  if (item.group === "pk") {
    return (
      <div className="copilot-suggest-card__title">
        <span className="copilot-suggest-card__dot" aria-hidden />
        Primary key: <code>{item.key.label.replace(" · ", ".")}</code>
      </div>
    );
  }
  if (item.group === "fk") {
    const grain = item.join.grainLabel;
    return (
      <div className="copilot-suggest-card__title">
        {grain === "N:M" ? "Relationship" : "Foreign key"}:{" "}
        <code>{item.join.leftLabel.replace(" · ", ".")}</code> →{" "}
        <code>{item.join.rightLabel.replace(" · ", ".")}</code>
      </div>
    );
  }
  return (
    <div className="copilot-suggest-card__title">
      Type: <code>{item.type.label.replace(" · ", ".")}</code> →{" "}
      <code>{item.type.suggestedType}</code>
    </div>
  );
}

function detailFor(item: SuggestionItem): string {
  if (item.group === "pk") {
    return item.key.reason;
  }
  if (item.group === "fk") {
    const grain = item.join.grainLabel ? ` · grain ${item.join.grainLabel}` : "";
    return `${item.join.overlapPercent}% value overlap · ${item.join.sharedValues} shared${grain}`;
  }
  return item.type.reason;
}

function CardActions({ onApply, onDismiss }: { onApply: () => void; onDismiss: () => void }) {
  return (
    <div className="copilot-suggest-card__actions">
      <button
        type="button"
        className="copilot-suggest-btn copilot-suggest-btn--ghost"
        onClick={onDismiss}
      >
        Dismiss
      </button>
      <button
        type="button"
        className="copilot-suggest-btn copilot-suggest-btn--primary"
        onClick={onApply}
      >
        Apply
      </button>
    </div>
  );
}
