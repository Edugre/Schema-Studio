import { useMemo, useState } from "react";

import { useSchemaStore } from "../store/index.js";
import { buildApplyPlan, buildJoinSuggestions } from "./joinSuggestions.js";
import "./JoinSuggestions.css";

/**
 * SS-9b — reviewable join-key suggestions derived from the core detectors. Runs locally over
 * the parsed sources (no AI, no network) and applies through the validated store path.
 */
export function JoinSuggestions() {
  const sources = useSchemaStore((state) => state.sources);
  const schema = useSchemaStore((state) => state.schema);
  const runActions = useSchemaStore((state) => state.runActions);
  const selectTable = useSchemaStore((state) => state.selectTable);

  const [message, setMessage] = useState<{ kind: "info" | "error"; text: string } | null>(null);

  const suggestions = useMemo(
    () => buildJoinSuggestions(sources, schema).filter((suggestion) => !suggestion.alreadyLinked),
    [sources, schema],
  );

  if (sources.length < 2 || suggestions.length === 0) {
    return null;
  }

  const handleApply = (candidate: (typeof suggestions)[number]["candidate"]) => {
    const plan = buildApplyPlan(sources, schema, candidate);
    if (!plan.ok) {
      setMessage({ kind: "error", text: plan.error });
      return;
    }

    const { applied, rejected } = runActions(plan.actions);
    if (rejected.length > 0) {
      setMessage({ kind: "error", text: rejected.map((entry) => entry.reason).join("; ") });
      return;
    }

    const linkedTableId = applied.at(-1)?.tableIds[0];
    if (linkedTableId) {
      selectTable(linkedTableId);
    }

    const built = plan.builtTables.length > 0 ? ` (built ${plan.builtTables.join(", ")})` : "";
    setMessage({ kind: "info", text: `Linked on ${candidate.left.field}${built}.` });
  };

  return (
    <section className="join-suggestions" aria-label="Suggested joins">
      <header className="join-suggestions__header">
        <span>Suggested joins</span>
        <span className="join-suggestions__subtle">from your data, not column names</span>
      </header>

      {message ? (
        <p className={`join-suggestions__message join-suggestions__message--${message.kind}`}>
          {message.text}
        </p>
      ) : null}

      <ul className="join-suggestions__list">
        {suggestions.map((suggestion) => (
          <li key={suggestion.id} className="join-suggestions__item">
            <div className="join-suggestions__pair">
              <code>{suggestion.leftLabel}</code>
              <span className="join-suggestions__arrow" aria-hidden="true">
                ↔
              </span>
              <code>{suggestion.rightLabel}</code>
            </div>
            <div className="join-suggestions__meta">
              <span className="join-suggestions__overlap">
                {suggestion.overlapPercent}% match · {suggestion.sharedValues} shared
              </span>
              {suggestion.warning ? (
                <span className="join-suggestions__warning" title={suggestion.warning}>
                  ⚠ {suggestion.warning}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              className="join-suggestions__apply"
              onClick={() => handleApply(suggestion.candidate)}
            >
              Apply
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
