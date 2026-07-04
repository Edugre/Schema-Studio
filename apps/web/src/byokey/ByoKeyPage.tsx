import { useEffect, useState } from "react";

import { useProviderPreference } from "../ai/providerPreference.js";
import { PROVIDERS, PROVIDER_IDS, type ProviderId } from "../ai/providers.js";
import { useApiKeyContext } from "../copilot/ApiKeyContext.js";
import {
  CheckIcon,
  DatabaseIcon,
  EyeIcon,
  EyeOffIcon,
  InfoIcon,
  KeyIcon,
  LockIcon,
  ServerIcon,
  SparkleIcon,
} from "../ui/icons.js";
import "./ByoKeyPage.css";

// Every provider comes from the registry now — including local, whose credential is a server URL
// rather than a secret key (see `credentialKind`).
const SEGMENTS = PROVIDER_IDS.map((id) => ({ id, label: PROVIDERS[id].label }));

/** The value to seed the field with for a provider: its stored credential, or local's default URL. */
function seedCredential(stored: string, meta: (typeof PROVIDERS)[ProviderId]): string {
  if (stored.trim()) {
    return stored;
  }
  // Endpoint providers (local) prefill their default so the field is usable out of the box.
  return meta.credentialKind === "endpoint" ? (meta.defaultCredential ?? "") : "";
}

export function ByoKeyPage({ onClose }: { onClose: () => void }) {
  const { keyFor, setApiKey, setRemember } = useApiKeyContext();
  const { provider: activeProvider, setProvider } = useProviderPreference();
  const [selected, setSelected] = useState<ProviderId>(activeProvider);
  const meta = PROVIDERS[selected];
  const isEndpoint = meta.credentialKind === "endpoint";
  const storedKey = keyFor(selected).apiKey;
  const { remember } = keyFor(selected);
  const [draft, setDraft] = useState(() => seedCredential(storedKey, meta));
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Remembered keys hydrate from IndexedDB asynchronously after mount, so `draft` may be seeded
  // empty on the first render. Adopt the stored key once it lands (or when switching to a provider
  // that has one) — but only when the field is still empty, never overwriting what the user typed.
  useEffect(() => {
    setDraft((current) => (current.trim() === "" ? seedCredential(storedKey, meta) : current));
  }, [storedKey, selected, meta]);

  const trimmed = draft.trim();

  const chooseProvider = (next: ProviderId) => {
    setSelected(next);
    setDraft(seedCredential(keyFor(next).apiKey, PROVIDERS[next]));
    setError(null);
  };

  const handleSave = () => {
    if (!trimmed) {
      return;
    }
    if (!trimmed.startsWith(meta.keyPrefix)) {
      setError(
        isEndpoint
          ? "That doesn't look like a server URL — it should start with “http”."
          : `That doesn't look like a ${meta.label} key — it should start with “${meta.keyPrefix}”.`,
      );
      return;
    }
    setError(null);
    setApiKey(selected, trimmed);
    // Make the just-entered provider the active one so the copilot uses it immediately.
    setProvider(selected);
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
              {SEGMENTS.map((item) => {
                const isSelected = item.id === selected;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`byok__segment${isSelected ? " is-selected" : ""}`}
                    aria-pressed={isSelected}
                    onClick={() => chooseProvider(item.id)}
                  >
                    {isSelected ? <CheckIcon size={15} /> : null}
                    {item.label}
                  </button>
                );
              })}
            </div>

            <div className="byok__key-row">
              <span className="byok__label">{isEndpoint ? "Server URL" : "API key"}</span>
              <a
                className="byok__link"
                href={meta.keysUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                {isEndpoint ? "Set up a local model" : "Where do I find my key?"}
              </a>
            </div>

            <div className={`byok__input${error ? " is-invalid" : ""}`}>
              {isEndpoint ? (
                <ServerIcon size={16} className="byok__input-icon" />
              ) : (
                <KeyIcon size={16} className="byok__input-icon" />
              )}
              <input
                // A server URL isn't a secret, so it stays visible; keys are masked until revealed.
                type={isEndpoint || revealed ? "text" : "password"}
                className="byok__input-field"
                placeholder={meta.keyPlaceholder}
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
              {isEndpoint ? null : (
                <button
                  type="button"
                  className="byok__reveal"
                  onClick={() => setRevealed((value) => !value)}
                  aria-label={revealed ? "Hide key" : "Show key"}
                  title={revealed ? "Hide key" : "Show key"}
                >
                  {revealed ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                </button>
              )}
            </div>

            {error ? (
              <p className="byok__helper byok__helper--error">{error}</p>
            ) : isEndpoint ? (
              <p className="byok__helper">
                Point this at any OpenAI-compatible local runtime (Ollama, LM Studio, llama.cpp).
                The model must support tool calling — e.g. Llama 3.1, Qwen2.5, Mistral.
              </p>
            ) : (
              <p className="byok__helper">
                Used directly from this browser to call the provider — never sent to our servers.
              </p>
            )}

            {isEndpoint ? (
              <div className="byok__trust">
                <InfoIcon size={16} />
                <span>
                  Your browser calls the server directly, so it must allow this origin. For Ollama,
                  start it with <code>OLLAMA_ORIGINS</code> set to this page’s origin (LM Studio
                  allows it by default).
                </span>
              </div>
            ) : null}

            <label className="byok__remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(selected, event.target.checked)}
              />
              Remember this {isEndpoint ? "endpoint" : "key"} on this device
            </label>

            <div className="byok__trust">
              <InfoIcon size={16} />
              <span>
                Your {isEndpoint ? "endpoint" : "key"} is stored{" "}
                {remember ? "locally in this browser" : "in memory for this session"} and used to
                call the {isEndpoint ? "server" : "provider"} directly. It never passes through
                Schema Studio&apos;s servers — files are parsed locally too.
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
            ? "Keys are stored in this browser's local storage · manage them in Settings → API keys"
            : "Keys live in memory for this session · enable “Remember” to persist them locally"}
        </span>
      </footer>
    </div>
  );
}
