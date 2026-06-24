import type { JoinKeyCandidate, Schema, Source } from "@schema-studio/core";
import { detectJoinKeys, emptySchema } from "@schema-studio/core";
import { describe, expect, it } from "vitest";

import { buildApplyPlan, buildJoinSuggestions } from "../src/suggest/joinSuggestions.js";

function source(id: string, name: string, field: string, samples: string[]): Source {
  return {
    id,
    name,
    kind: "csv",
    fields: [{ name: field, type: "text", samples }],
  };
}

// HRSA pads grant numbers with leading zeros; OPAIS does not. Same entities, different format.
const hrsa = source("s-hrsa", "covered_entities.csv", "grant_number", ["01234", "05678", "09999"]);
const opais = source("s-opais", "organizations.csv", "grant_id", ["1234", "5678", "0001"]);

function onlyCandidate(sources: Source[]): JoinKeyCandidate {
  const [candidate] = detectJoinKeys(sources);
  if (!candidate) {
    throw new Error("expected a join candidate");
  }
  return candidate;
}

describe("buildJoinSuggestions", () => {
  it("surfaces overlap, shared count, and a normalization warning from sample values", () => {
    const [suggestion, ...rest] = buildJoinSuggestions([hrsa, opais], emptySchema());

    expect(rest).toHaveLength(0);
    expect(suggestion?.leftLabel).toBe("covered_entities.csv · grant_number");
    expect(suggestion?.rightLabel).toBe("organizations.csv · grant_id");
    expect(suggestion?.overlapPercent).toBe(50);
    expect(suggestion?.sharedValues).toBe(2);
    expect(suggestion?.warning).toContain("strip leading zeros");
    expect(suggestion?.alreadyLinked).toBe(false);
  });

  it("marks a suggestion already linked when the schema has the relationship", () => {
    const schema: Schema = {
      tables: [
        {
          id: "t1",
          name: "covered_entities",
          x: 0,
          y: 0,
          fields: [{ id: "f1", name: "grant_number", type: "text", pk: false, fk: false }],
        },
        {
          id: "t2",
          name: "organizations",
          x: 0,
          y: 0,
          fields: [{ id: "f2", name: "grant_id", type: "text", pk: false, fk: true }],
        },
      ],
      relationships: [
        {
          id: "r1",
          fromTable: "t1",
          fromField: "f1",
          toTable: "t2",
          toField: "f2",
          cardinality: "1:N",
        },
      ],
    };

    const [suggestion] = buildJoinSuggestions([hrsa, opais], schema);
    expect(suggestion?.alreadyLinked).toBe(true);
  });

  it("returns nothing when sources share no values", () => {
    const a = source("a", "a.csv", "code", ["aaa", "bbb", "ccc"]);
    const b = source("b", "b.csv", "code", ["xxx", "yyy", "zzz"]);
    expect(buildJoinSuggestions([a, b], emptySchema())).toEqual([]);
  });
});

describe("buildApplyPlan", () => {
  it("builds both tables from their sources, then links the columns", () => {
    const candidate = onlyCandidate([hrsa, opais]);
    const plan = buildApplyPlan([hrsa, opais], emptySchema(), candidate);

    expect(plan.ok).toBe(true);
    if (!plan.ok) return;

    expect(plan.builtTables).toEqual(["covered_entities", "organizations"]);
    expect(plan.actions).toEqual([
      {
        op: "add_table",
        name: "covered_entities",
        fields: [{ name: "grant_number", type: "text" }],
      },
      {
        op: "add_table",
        name: "organizations",
        fields: [{ name: "grant_id", type: "text" }],
      },
      {
        op: "add_relationship",
        from_table: "covered_entities",
        from_field: "grant_number",
        to_table: "organizations",
        to_field: "grant_id",
        cardinality: "1:N",
      },
    ]);
  });

  it("reuses existing tables instead of rebuilding them", () => {
    const schema: Schema = {
      tables: [
        {
          id: "t1",
          name: "covered_entities",
          x: 0,
          y: 0,
          fields: [{ id: "f1", name: "grant_number", type: "text", pk: false, fk: false }],
        },
        {
          id: "t2",
          name: "organizations",
          x: 0,
          y: 0,
          fields: [{ id: "f2", name: "grant_id", type: "text", pk: false, fk: false }],
        },
      ],
      relationships: [],
    };

    const candidate = onlyCandidate([hrsa, opais]);
    const plan = buildApplyPlan([hrsa, opais], schema, candidate);

    expect(plan.ok).toBe(true);
    if (!plan.ok) return;

    expect(plan.builtTables).toEqual([]);
    expect(plan.actions).toEqual([
      {
        op: "add_relationship",
        from_table: "covered_entities",
        from_field: "grant_number",
        to_table: "organizations",
        to_field: "grant_id",
        cardinality: "1:N",
      },
    ]);
  });

  it("disambiguates two new tables whose filenames collide", () => {
    const left = source("l", "data.csv", "ref", ["100", "200", "300"]);
    const right = source("r", "data.csv", "ref", ["100", "200", "400"]);
    const candidate = onlyCandidate([left, right]);
    const plan = buildApplyPlan([left, right], emptySchema(), candidate);

    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.builtTables).toEqual(["data", "data_2"]);
  });

  it("fails cleanly when a source is no longer loaded", () => {
    const candidate = onlyCandidate([hrsa, opais]);
    const plan = buildApplyPlan([hrsa], emptySchema(), candidate);
    expect(plan).toEqual({ ok: false, error: "Those sources are no longer loaded." });
  });
});
