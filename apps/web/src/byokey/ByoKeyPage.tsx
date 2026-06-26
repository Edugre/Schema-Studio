import { useState } from "react";

import { useApiKeyContext } from "../copilot/ApiKeyContext.js";
import {
  CheckIcon,
  DatabaseIcon,
  EyeIcon,
  EyeOffIcon,
  InfoIcon,
  KeyIcon,
  LockIcon,
  SparkleIcon,
} from "../ui/icons.js";
import "./ByoKeyPage.css";

type ProviderId = "anthropic" | "openai" | "local";

const PROVIDERS: Array<{ id: ProviderId; label: string; enabled: boolean }> = [
  { id: "anthropic", label: "Anthropic", enabled: true },
  { id: "openai", label: "OpenAI", enabled: false },
  { id: "local", label: "Local", enabled: false },
];

const ANTHROPIC_KEYS_URL = "https://console.anthropic.com/settings/keys";

export function ByoKeyPage({ onClose }: { onClose: () => void }) {
  const { apiKey, remember, setApiKey, setRemember } = useApiKeyContext();
  // Only Anthropic is wired up today; the other segments are disabled.
  const provider: ProviderId = "anthropic";
  const [draft, setDraft] = useState(apiKey);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = draft.trim();

  const handleSave = () => {
    if (!trimmed) {
      return;
    }
    if (!trimmed.startsWith("sk-ant-")) {
      setError("That doesn't look like an Anthropic key — it should start with “sk-ant-”.");
      return;
    }
    setError(null);
    setApiKey(trimmed);
    onClose();
  };

  return (
    <div className="byok">
      <header className="byok__topbar">
        <span className="byok__logo" aria-hidden>
          <DatabaseIcon size={14} />
        </span>
        <span className="byok__wordmark">Schema Studio</span>
      </header>

      <main className="byok__body">
        <section className="byok__card" aria-labelledby="byok-title">
          <div className="byok__card-header">
            <span className="byok__icon-tile" aria-hidden>
              <SparkleIcon size={20} />
            </span>
            <h1 id="byok-title" className="byok__title">
              Connect your AI provider
            </h1>
            <p className="byok__subtitle">
              Schema Studio uses your own API key to reason over sample values and propose joins.
              Bring a key from any supported provider.
            </p>
          </div>

          <div className="byok__form">
            <span className="byok__label">Provider</span>
            <div className="byok__segments" role="group" aria-label="AI provider">
              {PROVIDERS.map((item) => {
                const selected = item.id === provider;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`byok__segment${selected ? " is-selected" : ""}`}
                    aria-pressed={selected}
                    disabled={!item.enabled}
                    title={item.enabled ? undefined : "Coming soon"}
                  >
                    {selected ? <CheckIcon size={15} /> : null}
                    {item.label}
                    {!item.enabled ? <span className="byok__segment-soon">Soon</span> : null}
                  </button>
                );
              })}
            </div>

            <div className="byok__key-row">
              <span className="byok__label">API key</span>
              <a
                className="byok__link"
                href={ANTHROPIC_KEYS_URL}
                target="_blank"
                rel="noreferrer noopener"
              >
                Where do I find my key?
              </a>
            </div>

            <div className={`byok__input${error ? " is-invalid" : ""}`}>
              <KeyIcon size={16} className="byok__input-icon" />
              <input
                type={revealed ? "text" : "password"}
                className="byok__input-field"
                placeholder="sk-ant-api03-…"
                value={draft}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => {
                  setDraft(event.target.value);
                  if (error) {
                    setError(null);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleSave();
                  }
                }}
              />
              <button
                type="button"
                className="byok__reveal"
                onClick={() => setRevealed((value) => !value)}
                aria-label={revealed ? "Hide key" : "Show key"}
                title={revealed ? "Hide key" : "Show key"}
              >
                {revealed ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
              </button>
            </div>

            {error ? (
              <p className="byok__helper byok__helper--error">{error}</p>
            ) : (
              <p className="byok__helper">
                Used directly from this browser to call the provider — never sent to our servers.
              </p>
            )}

            <label className="byok__remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
              />
              Remember this key on this device
            </label>

            <div className="byok__trust">
              <InfoIcon size={16} />
              <span>
                Your key is stored{" "}
                {remember ? "locally in this browser" : "in memory for this session"} and used to
                call the provider directly. It never passes through Schema Studio&apos;s servers —
                files are parsed locally too.
              </span>
            </div>
          </div>

          <div className="byok__actions">
            <button
              type="button"
              className="byok__btn byok__btn--primary"
              onClick={handleSave}
              disabled={!trimmed}
            >
              Save &amp; continue
            </button>
            <button type="button" className="byok__btn byok__btn--ghost" onClick={onClose}>
              Skip for now
            </button>
          </div>
        </section>
      </main>

      <footer className="byok__footer">
        <LockIcon size={13} />
        <span>
          {remember
            ? "Keys are stored in this browser's local storage · revoke anytime in the Copilot pane"
            : "Keys live in memory for this session · enable “Remember” to persist them locally"}
        </span>
      </footer>
    </div>
  );
}
