import type { Schema } from "@schema-studio/core";
import { describe, expect, it } from "vitest";

import { PREVIEW_EXPORT_TOOL, runExportPreview } from "../src/copilot/exportPreviewTool.js";

function sampleSchema(): Schema {
  return {
    tables: [
      {
        id: "t1",
        name: "users",
        x: 0,
        y: 0,
        fields: [
          { id: "f1", name: "id", type: "int", pk: true, fk: false },
          { id: "f2", name: "email", type: "text", pk: false, fk: false },
        ],
      },
    ],
    relationships: [],
  };
}

describe("PREVIEW_EXPORT_TOOL", () => {
  it("requires a target and offers the three exporters", () => {
    expect(PREVIEW_EXPORT_TOOL.name).toBe("preview_export");
    expect(PREVIEW_EXPORT_TOOL.input_schema.required).toEqual(["target"]);
    expect(PREVIEW_EXPORT_TOOL.input_schema.properties.target.enum).toEqual([
      "sql",
      "dbml",
      "prisma",
    ]);
  });
});

describe("runExportPreview", () => {
  it("exports the current schema for the requested target", () => {
    const out = runExportPreview(sampleSchema(), { target: "sql" });
    expect(out).toContain("Export preview (sql)");
    expect(out).toContain('CREATE TABLE "users"');
    expect(out).toContain("PRIMARY KEY");
  });

  it("applies proposed actions in memory without mutating the schema", () => {
    const schema = sampleSchema();
    const out = runExportPreview(schema, {
      target: "prisma",
      actions: [{ op: "add_table", name: "orgs", fields: [{ name: "id", pk: true }] }],
    });

    expect(out).toContain("1 action(s) applied");
    expect(out).toContain("model orgs");
    // The live schema is untouched — preview is read-only.
    expect(schema.tables).toHaveLength(1);
  });

  it("reports actions that could not be applied", () => {
    const out = runExportPreview(sampleSchema(), {
      target: "sql",
      actions: [{ op: "add_table", name: "users" }],
    });

    expect(out).toContain("rejected");
    expect(out).toContain("Could not apply:");
    expect(out).toContain("already exists");
  });

  it("returns an error string for an unknown target", () => {
    expect(runExportPreview(sampleSchema(), { target: "mongo" })).toBe(
      "preview_export error: `target` must be one of sql, dbml, prisma.",
    );
  });
});
