import { useEffect, useRef, useState } from "react";

import { useProjects } from "./useProjects.js";
import "./ProjectsBar.css";

export function ProjectsBar() {
  const {
    projects,
    activeId,
    ready,
    error,
    dismissError,
    newProject,
    openProject,
    deleteProject,
    renameProject,
    exportProject,
    importProject,
  } = useProjects();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");

  const active = projects.find((project) => project.id === activeId);

  useEffect(() => {
    if (!renaming) {
      setDraftName(active?.name ?? "");
    }
  }, [active?.name, renaming]);

  const commitRename = () => {
    if (activeId) {
      renameProject(activeId, draftName);
    }
    setRenaming(false);
  };

  const onImportChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      importProject(file);
    }
    event.target.value = "";
  };

  return (
    <header className="projects-bar">
      <span className="projects-bar__brand">Schema Studio</span>

      {renaming ? (
        <input
          className="projects-bar__rename"
          value={draftName}
          autoFocus
          onChange={(event) => setDraftName(event.target.value)}
          onBlur={commitRename}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commitRename();
            } else if (event.key === "Escape") {
              setRenaming(false);
            }
          }}
        />
      ) : (
        <select
          className="projects-bar__select"
          value={activeId ?? ""}
          disabled={!ready}
          onChange={(event) => openProject(event.target.value)}
          aria-label="Active project"
        >
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      )}

      <div className="projects-bar__actions">
        <button
          type="button"
          onClick={() => setRenaming(true)}
          disabled={!ready || renaming}
          title="Rename project"
        >
          Rename
        </button>
        <button type="button" onClick={newProject} disabled={!ready} title="New project">
          New
        </button>
        <button
          type="button"
          onClick={() => activeId && deleteProject(activeId)}
          disabled={!ready || !activeId}
          title="Delete project"
        >
          Delete
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={!ready}
          title="Import project JSON"
        >
          Import
        </button>
        <button type="button" onClick={exportProject} disabled={!ready} title="Export project JSON">
          Export project
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="projects-bar__file"
          onChange={onImportChange}
        />
      </div>

      {error ? (
        <button
          type="button"
          className="projects-bar__error"
          onClick={dismissError}
          title="Dismiss"
        >
          {error} ✕
        </button>
      ) : null}
    </header>
  );
}
