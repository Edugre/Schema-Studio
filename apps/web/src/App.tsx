import { useState } from "react";

import { ByoKeyPage } from "./byokey/ByoKeyPage.js";
import { CanvasPanel } from "./canvas/index.js";
import { ApiKeyProvider } from "./copilot/ApiKeyContext.js";
import { CopilotPanel } from "./copilot/index.js";
import { SettingsPage } from "./settings/SettingsPage.js";
import { SourcesPanel } from "./sources";
import { ThemeProvider } from "./theme/ThemeContext.js";
import { TopBar } from "./topbar/TopBar.js";
import "./App.css";

type View = "dashboard" | "settings" | "byok";

export function App() {
  const [view, setView] = useState<View>("dashboard");
  // Where the BYO-key page returns to when closed (it's opened from both the
  // Copilot CTA and the Settings → API keys page).
  const [byokReturn, setByokReturn] = useState<View>("dashboard");

  const openByok = (from: View) => {
    setByokReturn(from);
    setView("byok");
  };

  return (
    <ThemeProvider>
      <ApiKeyProvider>
        {view === "byok" ? (
          <ByoKeyPage onClose={() => setView(byokReturn)} />
        ) : view === "settings" ? (
          <SettingsPage onBack={() => setView("dashboard")} onAddKey={() => openByok("settings")} />
        ) : (
          <div className="app-root">
            <TopBar onOpenSettings={() => setView("settings")} />
            <div className="app-shell">
              <SourcesPanel />
              <CanvasPanel />
              <CopilotPanel onConnect={() => openByok("dashboard")} />
            </div>
          </div>
        )}
      </ApiKeyProvider>
    </ThemeProvider>
  );
}
