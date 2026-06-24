import { emptySchema } from "@schema-studio/core";
import { describe, expect, it } from "vitest";

import {
  buildCopilotSystemPrompt,
  formatRejectedAction,
  parseCopilotResponse,
  summarizeAppliedActions,
} from "../src/copilot/index.js";

describe("buildCopilotSystemPrompt", () => {
  it("includes schema, source samples, and the action protocol", () => {
    const prompt = buildCopilotSystemPrompt(emptySchema(), [
      {
        id: "s1",
        name: "covered_entities.csv",
        kind: "csv",
        fields: [{ name: "grant_number", type: "text", samples: ["01234", "05678"] }],
      },
    ]);

    expect(prompt).toContain("grant_number");
    expect(prompt).toContain("01234");
    expect(prompt).toContain("add_relationship");
    expect(prompt).toContain('"reply"');
    expect(prompt).toContain("sample values");
  });
});

describe("parseCopilotResponse", () => {
  it("parses a bare JSON object", () => {
    const result = parseCopilotResponse(
      '{"reply":"Linked tables.","actions":[{"op":"add_table","name":"orgs"}]}',
    );

    expect(result).toEqual({
      reply: "Linked tables.",
      actions: [{ op: "add_table", name: "orgs" }],
    });
  });

  it("parses JSON wrapped in markdown fences", () => {
    const result = parseCopilotResponse('```json\n{"reply":"ok","actions":[]}\n```');

    expect(result).toEqual({ reply: "ok", actions: [] });
  });

  it("returns an error for invalid JSON", () => {
    const result = parseCopilotResponse("not json at all");

    expect(result).toEqual({ error: "Copilot response was not valid JSON." });
  });
});

describe("formatRejectedAction", () => {
  it("describes the action and reason", () => {
    const text = formatRejectedAction(
      { op: "add_field", table: "users", name: "email" },
      "field 'email' already exists",
    );

    expect(text).toBe("Couldn't apply add field \"email\" to users: field 'email' already exists");
  });
});

describe("summarizeAppliedActions", () => {
  it("lists ops with table names", () => {
    const schema = emptySchema();
    schema.tables.push({
      id: "t1",
      name: "users",
      x: 0,
      y: 0,
      fields: [],
    });

    const lines = summarizeAppliedActions(schema, [{ op: "add_table", tableIds: ["t1"] }]);

    expect(lines).toEqual(["add_table (users)"]);
  });
});
