import { CanvasPanel } from "./canvas/index.js";
import { CopilotPanel } from "./copilot/index.js";
import { SourcesPanel } from "./sources";
import "./App.css";

export function App() {
  return (
    <div className="app-shell">
      <SourcesPanel />
      <CanvasPanel />
      <CopilotPanel />
    </div>
  );
}
