import { CanvasPanel } from "./canvas/index.js";
import { CopilotPanel } from "./copilot/index.js";
import { ExportMenu } from "./export/index.js";
import { ProjectsBar } from "./persistence/index.js";
import { SourcesPanel } from "./sources";
import "./App.css";

export function App() {
  return (
    <div className="app-root">
      <ExportMenu />
      <ProjectsBar />
      <div className="app-shell">
        <SourcesPanel />
        <CanvasPanel />
        <CopilotPanel />
      </div>
    </div>
  );
}
