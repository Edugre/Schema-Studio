import { useEffect, useRef, useState } from "react";

import { PanelOpenIcon, SparkleIcon, XIcon } from "../ui/icons.js";
import { useSuggestions } from "./useSuggestions.js";
import "./SuggestionsToast.css";

/**
 * Bottom-right nudge toast (handoff: design_handoff_suggestions, Part 1). A header-only,
 * time-boxed prompt that the detectors found reviewable suggestions — it does not list them.
 * "View suggestions" routes to the Copilot Suggestions tab (`onView`) and dismisses.
 *
 * It fires when the open-suggestion set *grows* (e.g. after a new file is parsed), not on every
 * render, so it reads as "we just found these" rather than nagging. The 8s countdown is a CSS
 * animation; hovering pauses it (the bar only completes — and the toast only auto-dismisses —
 * once the mouse leaves).
 */
export function SuggestionsToast({ onView }: { onView: () => void }) {
  const { open, openCount, needsReviewCount, fileCount } = useSuggestions();
  const ids = open.map((item) => item.id).join("|");

  const seenRef = useRef<Set<string> | null>(null);
  const [visible, setVisible] = useState(false);
  const [paused, setPaused] = useState(false);
  // Bumping this remounts the timer-bar element, restarting its CSS animation from full.
  const [runId, setRunId] = useState(0);

  // Show whenever a suggestion id appears that we haven't seen before. The first pass only
  // seeds the baseline (no nudge for suggestions already present when the app loads).
  useEffect(() => {
    const current = new Set(ids ? ids.split("|") : []);
    const seen = seenRef.current;
    seenRef.current = current;
    if (seen === null) {
      return;
    }
    let hasNew = false;
    for (const id of current) {
      if (!seen.has(id)) {
        hasNew = true;
        break;
      }
    }
    if (hasNew) {
      setPaused(false);
      setRunId((value) => value + 1);
      setVisible(true);
    }
  }, [ids]);

  // Nothing left to nudge about — drop the toast if it was up.
  useEffect(() => {
    if (openCount === 0) {
      setVisible(false);
    }
  }, [openCount]);

  if (!visible || openCount === 0) {
    return null;
  }

  const dismiss = () => setVisible(false);
  const view = () => {
    onView();
    setVisible(false);
  };

  return (
    <div
      className="suggest-toast"
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="suggest-toast__header">
        <span className="suggest-toast__icon" aria-hidden>
          <SparkleIcon size={16} />
        </span>
        <div className="suggest-toast__text">
          <div className="suggest-toast__title">Suggested keys &amp; relationships</div>
          <div className="suggest-toast__subtitle">
            Inferred from sample values across {fileCount} file{fileCount === 1 ? "" : "s"}
          </div>
        </div>
        <button
          type="button"
          className="suggest-toast__close"
          onClick={dismiss}
          aria-label="Dismiss"
        >
          <XIcon size={16} />
        </button>
      </div>

      <div className="suggest-toast__action">
        <span className="suggest-toast__summary">
          {openCount} suggestion{openCount === 1 ? "" : "s"}
          {needsReviewCount > 0 ? (
            <>
              {" · "}
              <span className="suggest-toast__review">{needsReviewCount} needs review</span>
            </>
          ) : null}
        </span>
        <button type="button" className="suggest-toast__cta" onClick={view}>
          View suggestions
          <PanelOpenIcon size={15} />
        </button>
      </div>

      <div className="suggest-toast__timer" aria-hidden>
        <span
          key={runId}
          className="suggest-toast__timerfill"
          style={{ animationPlayState: paused ? "paused" : "running" }}
          onAnimationEnd={dismiss}
        />
      </div>
    </div>
  );
}
