import type { Source } from "@schema-studio/core";
import { SchemaSchema, SourceSchema } from "@schema-studio/core";

import {
  PROJECT_FILE_KIND,
  PROJECT_FILE_VERSION,
  type ProjectFile,
  type ProjectRecord,
} from "./types.js";

type ExportableProject = Pick<ProjectRecord, "name" | "schema" | "sources">;

export function toProjectFile(project: ExportableProject): ProjectFile {
  return {
    kind: PROJECT_FILE_KIND,
    version: PROJECT_FILE_VERSION,
    name: project.name,
    schema: project.schema,
    sources: project.sources,
  };
}

export function serializeProjectFile(project: ExportableProject): string {
  return JSON.stringify(toProjectFile(project), null, 2);
}

export type ParseProjectResult = { ok: true; file: ProjectFile } | { ok: false; error: string };

/**
 * Validate untrusted JSON as a project file. The schema and every source are checked against
 * core's zod models — an invalid import is rejected with a reason, never partially loaded.
 */
export function parseProjectFile(text: string): ParseProjectResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "File is not valid JSON." };
  }

  if (typeof json !== "object" || json === null) {
    return { ok: false, error: "Project file must be a JSON object." };
  }

  const obj = json as Record<string, unknown>;
  if (obj["kind"] !== PROJECT_FILE_KIND) {
    return { ok: false, error: "Not a Schema Studio project file." };
  }

  const schemaResult = SchemaSchema.safeParse(obj["schema"]);
  if (!schemaResult.success) {
    return { ok: false, error: "Project file has an invalid schema." };
  }

  const rawSources = obj["sources"];
  if (!Array.isArray(rawSources)) {
    return { ok: false, error: "Project file has invalid sources." };
  }

  const sources: Source[] = [];
  for (const raw of rawSources) {
    const sourceResult = SourceSchema.safeParse(raw);
    if (!sourceResult.success) {
      return { ok: false, error: "Project file has an invalid source." };
    }
    sources.push(sourceResult.data);
  }

  const rawName = obj["name"];
  const name =
    typeof rawName === "string" && rawName.trim().length > 0 ? rawName : "Imported project";
  const rawVersion = obj["version"];
  const version = typeof rawVersion === "number" ? rawVersion : PROJECT_FILE_VERSION;

  return {
    ok: true,
    file: { kind: PROJECT_FILE_KIND, version, name, schema: schemaResult.data, sources },
  };
}
