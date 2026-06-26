import { CanvasPanel } from "./canvas/index.js";
import { CopilotPanel } from "./copilot/index.js";
import { SourcesPanel } from "./sources";
import { TopBar } from "./topbar/TopBar.js";
import "./App.css";

export function App() {
  return (
    <div className="app-root">
      <TopBar />
      <div className="app-shell">
        <SourcesPanel />
        <CanvasPanel />
        <CopilotPanel />
      </div>
    </div>
  );
}
