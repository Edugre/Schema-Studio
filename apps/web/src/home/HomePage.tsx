import { useMemo, useState } from "react";

import { useProjectsContext } from "../persistence/index.js";
import type { ProjectSummary } from "../persistence/index.js";
import { DatabaseIcon, GearIcon, PlusIcon, SearchIcon, UserIcon } from "../ui/icons.js";
import { formatRelativeTime } from "./relativeTime.js";
import "./HomePage.css";

type FilterMode = "recent" | "all";

/** How many file chips to show before collapsing the rest into a "+N" chip. */
const MAX_CHIPS = 2;

/**
 * Home / Projects — the app's landing screen (handoff: design_handoff_home). Lists the user's
 * local projects as a searchable/filterable grid, with a dashed tile to derive a new one from
 * raw files. Project data comes from the shared projects context; selecting or creating a project
 * routes into the editor via `onEnterEditor`.
 *
 * Cards render only truthful, already-persisted metadata: file-name chips, table count, file
 * count, relative edited time, and a badge from the applied relationship count. (The mock's
 * row counts and per-project type icons aren't tracked in the open core, so they're omitted.)
 */
export function HomePage({
  onOpenSettings,
  onEnterEditor,
}: {
  onOpenSettings: () => void;
  onEnterEditor: () => void;
}) {
  const { summaries, ready, newProject, openProject } = useProjectsContext();
  const [query, setQuery] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("recent");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matched = needle
      ? summaries.filter(
          (project) =>
            project.name.toLowerCase().includes(needle) ||
            project.fileNames.some((file) => file.toLowerCase().includes(needle)),
        )
      : summaries;
    // "Recent" keeps the store's updated-desc order; "All" switches to alphabetical.
    return filterMode === "all"
      ? [...matched].sort((a, b) => a.name.localeCompare(b.name))
      : matched;
  }, [summaries, query, filterMode]);

  const startNew = () => {
    newProject();
    onEnterEditor();
  };

  const open = (id: string) => {
    openProject(id);
    onEnterEditor();
  };

  return (
    <div className="home">
      <header className="home-topbar">
        <div className="home-topbar__brand">
          <span className="home-topbar__logo" aria-hidden>
            <DatabaseIcon size={14} />
          </span>
          <span className="home-topbar__wordmark">Schema Studio</span>
        </div>
        <div className="home-topbar__right">
          <button
            type="button"
            className="home-topbar__icon-btn"
            onClick={onOpenSettings}
            aria-label="Settings"
            title="Settings"
          >
            <GearIcon size={16} />
          </button>
          <span className="home-topbar__avatar" aria-hidden>
            <UserIcon size={16} />
          </span>
        </div>
      </header>

      <div className="home-content">
        <div className="home-header">
          <div>
            <h1 className="home-header__title">Projects</h1>
            <p className="home-header__subtitle">
              Pick a schema to keep working, or derive a new one from raw files.
            </p>
          </div>
          <button type="button" className="home-newbtn" onClick={startNew} disabled={!ready}>
            <PlusIcon size={16} />
            New project
          </button>
        </div>

        <div className="home-filters">
          <div className="home-search">
            <SearchIcon size={16} className="home-search__icon" />
            <input
              className="home-search__input"
              type="search"
              placeholder="Search projects…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search projects"
            />
          </div>
          <div className="home-segmented" role="tablist" aria-label="Filter projects">
            {(["recent", "all"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={filterMode === mode}
                className={`home-segmented__option${filterMode === mode ? " is-active" : ""}`}
                onClick={() => setFilterMode(mode)}
              >
                {mode === "recent" ? "Recent" : "All"}
              </button>
            ))}
          </div>
        </div>

        <div className="home-grid">
          {visible.map((project) => (
            <ProjectCard key={project.id} project={project} onOpen={() => open(project.id)} />
          ))}

          {ready && visible.length === 0 ? (
            <p className="home-empty">No projects match “{query}”.</p>
          ) : null}

          <button type="button" className="home-derive" onClick={startNew} disabled={!ready}>
            <span className="home-derive__icon" aria-hidden>
              <PlusIcon size={18} />
            </span>
            <span className="home-derive__title">Derive from files</span>
            <span className="home-derive__subtitle">Drop CSV, XLSX or JSON to start</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ project, onOpen }: { project: ProjectSummary; onOpen: () => void }) {
  const chips = project.fileNames.slice(0, MAX_CHIPS);
  const overflow = project.fileNames.length - chips.length;

  return (
    <button type="button" className="home-card" onClick={onOpen}>
      <div className="home-card__head">
        <span className="home-card__type" aria-hidden>
          <DatabaseIcon size={17} />
        </span>
        {project.relationshipCount > 0 ? (
          <span className="home-card__badge">
            <span className="home-card__badge-dot" aria-hidden />
            {project.relationshipCount} {project.relationshipCount === 1 ? "join" : "joins"}
          </span>
        ) : null}
      </div>

      <div>
        <div className="home-card__name">{project.name}</div>
        <div className="home-card__chips">
          {chips.map((file) => (
            <span key={file} className="home-card__chip">
              {file}
            </span>
          ))}
          {overflow > 0 ? <span className="home-card__chip">+{overflow}</span> : null}
          {project.fileNames.length === 0 ? (
            <span className="home-card__chip home-card__chip--empty">no files yet</span>
          ) : null}
        </div>
      </div>

      <div className="home-card__footer">
        <span>
          {project.tableCount} {project.tableCount === 1 ? "table" : "tables"}
        </span>
        <span className="home-card__dot" aria-hidden>
          ·
        </span>
        <span>
          {project.fileNames.length} {project.fileNames.length === 1 ? "file" : "files"}
        </span>
        <span className="home-card__dot" aria-hidden>
          ·
        </span>
        <span>edited {formatRelativeTime(project.updatedAt)}</span>
      </div>
    </button>
  );
}
