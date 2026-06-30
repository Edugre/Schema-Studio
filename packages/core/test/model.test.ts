import { describe, expect, it } from "vitest";

import { SchemaSchema, emptySchema } from "../src/model.js";

describe("model", () => {
  it("creates an empty schema", () => {
    const schema = emptySchema();

    expect(schema.tables).toEqual([]);
    expect(schema.relationships).toEqual([]);
  });

  it("round-trips an optional table width", () => {
    const withWidth = {
      tables: [{ id: "t1", name: "users", x: 0, y: 0, width: 280, fields: [] }],
      relationships: [],
    };
    expect(SchemaSchema.parse(withWidth).tables[0]?.width).toBe(280);

    // Width is optional — a table without it still parses.
    const withoutWidth = {
      tables: [{ id: "t1", name: "users", x: 0, y: 0, fields: [] }],
      relationships: [],
    };
    expect(SchemaSchema.parse(withoutWidth).tables[0]?.width).toBeUndefined();
  });
});
