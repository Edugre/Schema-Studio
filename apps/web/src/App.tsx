import { CanvasPanel } from "./canvas/index.js";
import { CopilotPanel } from "./copilot/index.js";
import { ExportMenu } from "./export/index.js";
import { SourcesPanel } from "./sources";
import "./App.css";

export function App() {
  return (
    <div className="app-shell">
      <ExportMenu />
      <SourcesPanel />
      <CanvasPanel />
      <CopilotPanel />
    </div>
  );
}
