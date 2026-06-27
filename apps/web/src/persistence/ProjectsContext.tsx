import { createContext, useContext, type ReactNode } from "react";

import { useProjects, type UseProjects } from "./useProjects.js";

/**
 * Shares a single {@link useProjects} instance across the app. The hook owns bootstrap and a
 * debounced autosave subscription, so it must run exactly once — both the Home/Projects screen
 * and the editor's ProjectsBar read the same lifecycle through this context rather than each
 * calling the hook (which would double-bootstrap and run competing autosaves).
 */
const ProjectsContext = createContext<UseProjects | null>(null);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const projects = useProjects();
  return <ProjectsContext.Provider value={projects}>{children}</ProjectsContext.Provider>;
}

export function useProjectsContext(): UseProjects {
  const value = useContext(ProjectsContext);
  if (!value) {
    throw new Error("useProjectsContext must be used within a ProjectsProvider");
  }
  return value;
}
