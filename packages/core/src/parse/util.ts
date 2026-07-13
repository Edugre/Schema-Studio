import type { SourceField } from "./types.js";
import {
  collectDistinctValues,
  collectInferenceValues,
  collectSamples,
  collectStats,
} from "./sample.js";
import { inferType } from "./infer.js";

export type ParseOptions = {
  makeId?: () => string;
};

export function defaultMakeId(): string {
  return crypto.randomUUID();
}

export function resolveMakeId(opts?: ParseOptions): () => string {
  return opts?.makeId ?? defaultMakeId;
}

/** Deterministic dedupe: name, name_2, name_3, … */
export function dedupeNames(names: string[]): string[] {
  const seen = new Map<string, number>();

  return names.map((name) => {
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    if (count === 0) {
      return name;
    }
    return `${name}_${count + 1}`;
  });
}

export function buildSourceField(
  values: string[],
  name: string,
  joinValues?: string[],
): SourceField {
  const distinctValues = collectDistinctValues(values);
  return {
    name,
    type: inferType(collectInferenceValues(values)),
    samples: collectSamples(values),
    stats: collectStats(values),
    distinctValues,
    // Carry the wide join-discovery set whenever the wide pass ran, even when it saw nothing
    // beyond the scan window: its presence is the "full-file fidelity" signal probe_join reads,
    // and a redundant set is bounded by the distinct cap (~1000 strings), so the cost is trivial.
    ...(joinValues ? { joinValues } : {}),
  };
}
