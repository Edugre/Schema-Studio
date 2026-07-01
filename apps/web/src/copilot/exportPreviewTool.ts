import { applyActions, toDbml, toPrisma, toSql, type Schema } from "@schema-studio/core";

/**
 * A read-only tool the copilot can call mid-turn to see the migration its design would generate,
 * before committing to it. The model passes its *proposed* actions; we apply them to a copy of the
 * live schema in memory (pure `applyActions` — nothing is saved or drawn) and run the exporter, so
 * it can catch a bad type or a missing key by reading the actual DDL/Prisma and revise before
 * finalizing with the response tool. Grounds the copilot in the export "libraries" directly.
 */
export const PREVIEW_EXPORT_TOOL = {
  name: "preview_export",
  description:
    "Preview the migration code the schema would export to, optionally with proposed actions applied on top (in memory only — nothing is saved). Use it to check the generated SQL/DBML/Prisma before finalizing with submit_schema_response. Returns the code plus any actions that could not be applied.",
  input_schema: {
    type: "object" as const,
    properties: {
      target: {
        type: "string",
        enum: ["sql", "dbml", "prisma"],
        description: "Which exporter to preview.",
      },
      actions: {
        type: "array",
        items: { type: "object" },
        description:
          "Optional proposed actions applied on top of the current schema before exporting (in-memory preview only).",
      },
    },
    required: ["target"],
  },
} as const;

type PreviewTarget = "sql" | "dbml" | "prisma";

function isPreviewTarget(value: unknown): value is PreviewTarget {
  return value === "sql" || value === "dbml" || value === "prisma";
}

/**
 * Run a `preview_export` tool call against `schema`. Pure: applies the (optional) proposed actions
 * to a clone via core's `applyActions`, exports, and returns a model-readable string with the code
 * and any rejected actions. Never mutates `schema`. Returns an error string (not a throw) so the
 * tool result can be handed straight back to the model.
 */
export function runExportPreview(schema: Schema, input: unknown): string {
  const record =
    typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};

  if (!isPreviewTarget(record["target"])) {
    return "preview_export error: `target` must be one of sql, dbml, prisma.";
  }
  const target = record["target"];
  const actions = Array.isArray(record["actions"]) ? record["actions"] : [];

  const result = applyActions(schema, actions);
  const code =
    target === "sql"
      ? toSql(result.schema)
      : target === "dbml"
        ? toDbml(result.schema)
        : toPrisma(result.schema);

  const header = `Export preview (${target}) — ${result.applied.length} action(s) applied, ${result.rejected.length} rejected.`;
  const body = code.trim().length > 0 ? code : "(schema is empty)";
  const rejected =
    result.rejected.length > 0
      ? `\n\nCould not apply:\n${result.rejected.map((entry) => `- ${entry.reason}`).join("\n")}`
      : "";

  return `${header}\n\n${body}${rejected}`;
}
