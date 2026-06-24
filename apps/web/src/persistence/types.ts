import type { Schema, Source } from "@schema-studio/core";

/** Lightweight project descriptor used for listing/switching without loading the full body. */
export type ProjectMeta = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};

/** A full local project: its metadata plus the working set (schema + parsed sources). */
export type ProjectRecord = ProjectMeta & {
  schema: Schema;
  sources: Source[];
};

/**
 * Minimal async key/value contract the project layer depends on. The browser uses an
 * IndexedDB-backed implementation; tests use an in-memory one. Keeping persistence behind
 * this interface lets the project logic be unit-tested without a browser.
 */
export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

/** Marker + version for the import/export file format. */
export const PROJECT_FILE_KIND = "schema-studio/project";
export const PROJECT_FILE_VERSION = 1;

/** On-disk JSON shape for a project exported from / imported into the app. */
export type ProjectFile = {
  kind: typeof PROJECT_FILE_KIND;
  version: number;
  name: string;
  schema: Schema;
  sources: Source[];
};
