import { useState } from "react";

import { ByoKeyPage } from "./byokey/ByoKeyPage.js";
import { CanvasPanel } from "./canvas/index.js";
import { ApiKeyProvider } from "./copilot/ApiKeyContext.js";
import { CopilotPanel } from "./copilot/index.js";
import { SourcesPanel } from "./sources";
import { TopBar } from "./topbar/TopBar.js";
import "./App.css";

type View = "dashboard" | "byok";

export function App() {
  const [view, setView] = useState<View>("dashboard");

  return (
    <ApiKeyProvider>
      {view === "byok" ? (
        <ByoKeyPage onClose={() => setView("dashboard")} />
      ) : (
        <div className="app-root">
          <TopBar />
          <div className="app-shell">
            <SourcesPanel />
            <CanvasPanel />
            <CopilotPanel onConnect={() => setView("byok")} />
          </div>
        </div>
      )}
    </ApiKeyProvider>
  );
}
