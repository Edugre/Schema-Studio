import type { JoinKeyCandidate, Schema, Source } from "@schema-studio/core";
import { detectJoinKeys } from "@schema-studio/core";

import { tableNameFromFilename } from "../sources/tableName.js";

/**
 * SS-9b — surface the core content-aware detectors (SS-9) as reviewable suggestions.
 *
 * `detectJoinKeys` reasons over the *sample values* captured at parse time (not column
 * names) to propose cross-source join keys and flag identifier columns that won't match
 * without normalization. This module turns those raw candidates into view models the UI
 * can render, and into validated `applyActions` payloads — so "Apply" still flows through
 * the single typed path, never a direct mutation.
 */

export type JoinSuggestion = {
  /** Stable key for React + dedupe. */
  id: string;
  candidate: JoinKeyCandidate;
  leftLabel: string;
  rightLabel: string;
  /** Normalized overlap as a whole-number percent. */
  overlapPercent: number;
  sharedValues: number;
  /** Non-null when the columns need normalization before they'll join. */
  warning: string | null;
  /** True once both sides are linked in the schema — used to hide done suggestions. */
  alreadyLinked: boolean;
};

const MAX_SUGGESTIONS = 6;

function fieldNamesEqual(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Does the schema already contain a relationship between the two candidate columns?
 * Compared by field *name* (unordered) since suggestions are source-level, not id-level.
 */
function isAlreadyLinked(schema: Schema, candidate: JoinKeyCandidate): boolean {
  const fieldNameById = new Map<string, string>();
  for (const table of schema.tables) {
    for (const field of table.fields) {
      fieldNameById.set(field.id, field.name);
    }
  }

  return schema.relationships.some((relationship) => {
    const from = fieldNameById.get(relationship.fromField);
    const to = fieldNameById.get(relationship.toField);
    if (from === undefined || to === undefined) {
      return false;
    }
    const matchForward =
      fieldNamesEqual(from, candidate.left.field) && fieldNamesEqual(to, candidate.right.field);
    const matchReverse =
      fieldNamesEqual(from, candidate.right.field) && fieldNamesEqual(to, candidate.left.field);
    return matchForward || matchReverse;
  });
}

/** Run the detectors over the loaded sources and shape the results for display. */
export function buildJoinSuggestions(sources: Source[], schema: Schema): JoinSuggestion[] {
  const candidates = detectJoinKeys(sources);

  return candidates.slice(0, MAX_SUGGESTIONS).map((candidate) => ({
    id: `${candidate.left.sourceId}:${candidate.left.field}->${candidate.right.sourceId}:${candidate.right.field}`,
    candidate,
    leftLabel: `${candidate.left.sourceName} · ${candidate.left.field}`,
    rightLabel: `${candidate.right.sourceName} · ${candidate.right.field}`,
    overlapPercent: Math.round(candidate.normalizedOverlap * 100),
    sharedValues: candidate.sharedValues,
    warning: candidate.formatMismatch ? candidate.formatMismatch.note : null,
    alreadyLinked: isAlreadyLinked(schema, candidate),
  }));
}

function tableForSource(schema: Schema, source: Source, fieldName: string) {
  const base = tableNameFromFilename(source.name).toLowerCase();
  const hasField = (table: Schema["tables"][number]) =>
    table.fields.some((field) => fieldNamesEqual(field.name, fieldName));

  return (
    schema.tables.find((table) => table.name.toLowerCase() === base && hasField(table)) ??
    schema.tables.find((table) => table.name.toLowerCase().startsWith(base) && hasField(table)) ??
    schema.tables.find(hasField)
  );
}

export type ApplyPlan =
  | { ok: true; actions: unknown[]; builtTables: string[] }
  | { ok: false; error: string };

/**
 * Build the validated action batch that realizes a suggestion: build either table from its
 * source if it doesn't exist yet, then add the relationship between the two columns. The
 * actions reference table/field *names*, exactly as `applyActions` expects, so the whole
 * batch is validated and undoable as one step.
 */
export function buildApplyPlan(
  sources: Source[],
  schema: Schema,
  candidate: JoinKeyCandidate,
): ApplyPlan {
  const leftSource = sources.find((source) => source.id === candidate.left.sourceId);
  const rightSource = sources.find((source) => source.id === candidate.right.sourceId);
  if (!leftSource || !rightSource) {
    return { ok: false, error: "Those sources are no longer loaded." };
  }

  const actions: unknown[] = [];
  const builtTables: string[] = [];
  // Names that will exist after this batch (lowercased -> actual), so two freshly-built
  // tables can't collide with each other or with what's already on the canvas.
  const reserved = new Map<string, string>(
    schema.tables.map((table) => [table.name.toLowerCase(), table.name]),
  );

  const resolve = (source: Source, fieldName: string): string => {
    const existing = tableForSource(schema, source, fieldName);
    if (existing) {
      return existing.name;
    }

    const base = tableNameFromFilename(source.name);
    let name = base;
    let index = 2;
    while (reserved.has(name.toLowerCase())) {
      name = `${base}_${index}`;
      index += 1;
    }
    reserved.set(name.toLowerCase(), name);

    actions.push({
      op: "add_table",
      name,
      fields: source.fields.map((field) => ({ name: field.name, type: field.type })),
    });
    builtTables.push(name);
    return name;
  };

  const leftTable = resolve(leftSource, candidate.left.field);
  const rightTable = resolve(rightSource, candidate.right.field);

  actions.push({
    op: "add_relationship",
    from_table: leftTable,
    from_field: candidate.left.field,
    to_table: rightTable,
    to_field: candidate.right.field,
    cardinality: "1:N",
  });

  return { ok: true, actions, builtTables };
}
