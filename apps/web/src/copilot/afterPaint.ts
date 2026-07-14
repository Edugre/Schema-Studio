/**
 * Resolve once the browser has painted whatever React committed before the call.
 *
 * Sending a message queues the user bubble and the "Thinking…" line, but React only renders when
 * the call stack unwinds — and `propose()` runs the content detectors *synchronously* before its
 * first `await` (the fetch). Without a yield here, that whole pass sits between the click and the
 * first paint and reads as a freeze. Awaiting this hands the frame to the browser first, so the
 * optimistic UI is on screen before the expensive work starts.
 *
 * rAF callbacks run *before* paint, so a task queued from inside one is the first thing to run
 * after it.
 */
export function afterPaint(): Promise<void> {
  if (typeof requestAnimationFrame !== "function") {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      setTimeout(resolve, 0);
    });
  });
}
