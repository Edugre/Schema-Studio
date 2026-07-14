import type { Source } from "@grafture/core";
import { describe, expect, it } from "vitest";

import { childLabel, groupSources } from "../src/sources/groupSources.js";

function source(id: string, name: string, derivedFrom?: Source["derivedFrom"]): Source {
  return {
    id,
    name,
    kind: derivedFrom ? "json" : "csv",
    fields: [],
    ...(derivedFrom ? { derivedFrom } : {}),
  };
}

describe("groupSources", () => {
  it("nests JSON children under the parent they were unnested from", () => {
    const parent = source("p1", "opais.json");
    const groups = groupSources([
      source("c0", "sites.csv"),
      parent,
      source("c1", "opais.json.npiNumbers", { parentId: "p1", arrayField: "npiNumbers" }),
      source("c2", "opais.json.contacts", { parentId: "p1", arrayField: "contacts" }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.root.name).toBe("sites.csv");
    expect(groups[0]?.children).toEqual([]);
    expect(groups[1]?.root).toBe(parent);
    expect(groups[1]?.children.map((child) => child.name)).toEqual([
      "opais.json.npiNumbers",
      "opais.json.contacts",
    ]);
  });

  it("promotes an orphaned child to a root rather than dropping it", () => {
    // The parent was removed from a persisted project: the child must still be visible.
    const orphan = source("c1", "opais.json.npiNumbers", {
      parentId: "gone",
      arrayField: "npiNumbers",
    });
    const groups = groupSources([orphan]);

    expect(groups).toEqual([{ root: orphan, children: [] }]);
  });

  it("keeps every source exactly once", () => {
    const sources = [
      source("p1", "a.json"),
      source("c1", "a.json.rows", { parentId: "p1", arrayField: "rows" }),
      source("p2", "b.csv"),
    ];
    const groups = groupSources(sources);
    const ids = groups.flatMap((group) => [group.root.id, ...group.children.map((c) => c.id)]);

    expect(ids.sort()).toEqual(["c1", "p1", "p2"]);
  });
});

describe("childLabel", () => {
  it("shows the JSON key, not the parent-prefixed source name", () => {
    expect(
      childLabel(
        source("c1", "opais.json.npiNumbers", { parentId: "p1", arrayField: "npiNumbers" }),
      ),
    ).toBe("npiNumbers");
  });

  it("falls back to the full name when there is no lineage", () => {
    expect(childLabel(source("s1", "sites.csv"))).toBe("sites.csv");
  });
});
