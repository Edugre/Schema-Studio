import type { Source } from "@grafture/core";

/**
 * A source and the child sources unnested from it. One JSON file parses into a parent record set
 * plus one child per array-of-objects field (see core's `parseJson`), which the flat panel listed
 * as unrelated siblings — `file.json`, `file.json.orders`, `file.json.contacts` — with no visual
 * clue they came from one upload. Grouping restores that structure.
 */
export type SourceGroup = { root: Source; children: Source[] };

/**
 * Group the loaded sources by JSON lineage, preserving load order.
 *
 * A source with no `derivedFrom` is a root. A child attaches to its parent's group. A child whose
 * parent is gone (the user removed it) is NOT dropped — it becomes a root of its own, so no source
 * can go missing from the panel.
 */
export function groupSources(sources: Source[]): SourceGroup[] {
  const present = new Set(sources.map((source) => source.id));
  const groups: SourceGroup[] = [];
  const byRootId = new Map<string, SourceGroup>();

  for (const source of sources) {
    const parentId = source.derivedFrom?.parentId;
    if (parentId === undefined || !present.has(parentId)) {
      const group: SourceGroup = { root: source, children: [] };
      groups.push(group);
      byRootId.set(source.id, group);
    }
  }

  for (const source of sources) {
    const parentId = source.derivedFrom?.parentId;
    if (parentId === undefined) {
      continue;
    }
    byRootId.get(parentId)?.children.push(source);
  }

  return groups;
}

/**
 * The label for a child card inside its parent's group. Child sources are named
 * `<parent>.<arrayField>`; under the parent the prefix is redundant, so show just the JSON key.
 */
export function childLabel(source: Source): string {
  return source.derivedFrom?.arrayField ?? source.name;
}
