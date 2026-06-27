import { useEffect, useRef, useState } from "react";

import { useProjectsContext } from "./ProjectsContext.js";
import "./ProjectsBar.css";

export function ProjectsBar() {
  const {
    projects,
    activeId,
    ready,
    error,
    dismissError,
    newProject,
    deleteProject,
    renameProject,
    exportProject,
    importProject,
  } = useProjectsContext();

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
    <div className="projects-bar">
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
        // Project switching now happens from the Home screen; the editor just shows the active
        // project's name (click to rename).
        <button
          type="button"
          className="projects-bar__name"
          onClick={() => setRenaming(true)}
          disabled={!ready}
          title="Rename project"
        >
          {active?.name ?? "Untitled project"}
        </button>
      )}

      <div className="projects-bar__actions">
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
    </div>
  );
}
