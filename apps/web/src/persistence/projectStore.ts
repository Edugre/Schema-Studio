import type { KeyValueStore, ProjectMeta, ProjectRecord } from "./types.js";

const PROJECT_PREFIX = "project:";
const ACTIVE_KEY = "meta:activeId";

const projectKey = (id: string): string => `${PROJECT_PREFIX}${id}`;

export function toMeta(record: ProjectRecord): ProjectMeta {
  return {
    id: record.id,
    name: record.name,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/** All projects' metadata, most recently updated first. */
export async function listProjects(kv: KeyValueStore): Promise<ProjectMeta[]> {
  const keys = (await kv.keys()).filter((key) => key.startsWith(PROJECT_PREFIX));
  const records = await Promise.all(keys.map((key) => kv.get<ProjectRecord>(key)));
  return records
    .filter((record): record is ProjectRecord => record !== undefined)
    .map(toMeta)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadProjectRecord(
  kv: KeyValueStore,
  id: string,
): Promise<ProjectRecord | undefined> {
  return kv.get<ProjectRecord>(projectKey(id));
}

export async function saveProjectRecord(kv: KeyValueStore, record: ProjectRecord): Promise<void> {
  await kv.set(projectKey(record.id), record);
}

export async function deleteProjectRecord(kv: KeyValueStore, id: string): Promise<void> {
  await kv.remove(projectKey(id));
}

export async function getActiveProjectId(kv: KeyValueStore): Promise<string | undefined> {
  return kv.get<string>(ACTIVE_KEY);
}

export async function setActiveProjectId(kv: KeyValueStore, id: string): Promise<void> {
  await kv.set(ACTIVE_KEY, id);
}
