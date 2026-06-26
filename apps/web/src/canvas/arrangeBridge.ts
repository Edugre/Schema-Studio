/**
 * Lets the top-bar "Auto-arrange" button drive the canvas without lifting
 * ReactFlow's instance into global state. The CanvasPanel registers its
 * handler on mount; the top bar invokes whatever is currently registered.
 */
type ArrangeHandler = () => void | Promise<void>;

let handler: ArrangeHandler | null = null;

export function registerArrangeHandler(fn: ArrangeHandler): () => void {
  handler = fn;
  return () => {
    if (handler === fn) {
      handler = null;
    }
  };
}

export function triggerArrange(): void {
  void handler?.();
}
