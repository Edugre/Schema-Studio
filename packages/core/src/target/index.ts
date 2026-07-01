import { z } from "zod";

/**
 * Target profiles make the copilot **schema-native** instead of a generic chat: they tell the
 * model what stack the user is building toward, in that stack's own vocabulary and idioms, so it
 * proposes types/keys/relationships that actually round-trip through the exporters in
 * `../export`. This is the "libraries and tools" the copilot is contextualized on.
 *
 * Grounded in the exporters: the canonical Schema Studio types (`int | numeric | bool | date |
 * text`) map cleanly to every target; Postgres emits any other type verbatim, Prisma falls back
 * to `String`. The profiles below encode exactly that so the model's output stays exportable.
 */

export const TargetIdSchema = z.enum(["postgres", "prisma"]);
export type TargetId = z.infer<typeof TargetIdSchema>;

/** A column type the copilot should prefer, named in the target's own terms, with when-to-use guidance. */
export type TypeVocabularyEntry = {
  type: string;
  note: string;
};

export type TargetProfile = {
  id: TargetId;
  label: string;
  /** One line framing what the user is building toward and how it exports. */
  summary: string;
  /** Types that map cleanly to the export, in the target's own vocabulary. */
  types: TypeVocabularyEntry[];
  /** Optional richer types the target accepts beyond the canonical set. */
  nativeTypes: string;
  /** How the target expresses keys, relationships, and naming. */
  idioms: string[];
  /** Target-specific pitfalls the copilot should proactively warn about. */
  gotchas: string[];
};

export const DEFAULT_TARGET: TargetId = "postgres";

export const TARGET_PROFILES: Record<TargetId, TargetProfile> = {
  postgres: {
    id: "postgres",
    label: "PostgreSQL",
    summary:
      "Modeling for PostgreSQL. The schema exports to CREATE TABLE DDL with PRIMARY KEY and FOREIGN KEY constraints.",
    types: [
      { type: "integer", note: "whole numbers" },
      { type: "numeric", note: "exact decimals — money, ratios, measurements" },
      { type: "boolean", note: "true/false flags" },
      { type: "date", note: "calendar dates" },
      {
        type: "text",
        note: "variable-length strings; the safe default for identifiers, especially codes with leading zeros",
      },
    ],
    nativeTypes:
      "Any valid Postgres type is emitted verbatim, so bigint, timestamptz, uuid, varchar(n), and jsonb are all fine when they fit the data.",
    idioms: [
      "A single primary-key column emits an inline PRIMARY KEY; multiple PK columns emit a composite PRIMARY KEY (...).",
      "Foreign keys export as ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY ... REFERENCES.",
      "Use snake_case for table and column names.",
    ],
    gotchas: [
      "A foreign key must reference a PRIMARY KEY (or unique) column on the target table — set that column's pk before adding the relationship.",
      'Identifiers with leading zeros (e.g. "01234") must stay `text`; typing them `integer` drops the zeros and breaks joins.',
      "Postgres has no native many-to-many — an N:M needs a join table.",
    ],
  },
  prisma: {
    id: "prisma",
    label: "Prisma",
    summary:
      "Modeling for a Prisma schema. Tables export to `model` blocks with scalar fields and generated relation fields.",
    types: [
      { type: "Int", note: "whole numbers" },
      { type: "Decimal", note: "exact decimals — money, ratios" },
      { type: "Boolean", note: "true/false flags" },
      { type: "DateTime", note: "dates and timestamps" },
      {
        type: "String",
        note: "text; the safe default for identifiers, especially codes with leading zeros",
      },
    ],
    nativeTypes:
      "Other Prisma scalars — BigInt, Bytes, Json — are accepted; anything not a known scalar silently becomes String on export.",
    idioms: [
      "A single primary key emits `@id`; a composite key emits `@@id([...])`.",
      "Relations are generated from foreign keys — the owning side gets `@relation(fields, references)`.",
      "Model names are PascalCase and singular by convention.",
    ],
    gotchas: [
      "Every field must map to a known Prisma scalar (Int, String, Boolean, DateTime, Decimal, BigInt, Bytes, Json); an unrecognized type silently becomes `String`.",
      "A relation needs a primary key on the referenced model.",
      "Keep leading-zero identifiers as `String`, never `Int`.",
    ],
  },
};

export function getTargetProfile(id: TargetId): TargetProfile {
  return TARGET_PROFILES[id];
}

/**
 * Render a target profile as a prompt block the copilot reasons from. Deterministic (stable line
 * ordering) so prompt-caching and tests stay clean.
 */
export function describeTargetForPrompt(profile: TargetProfile): string {
  const typeLines = profile.types.map((entry) => `- ${entry.type} — ${entry.note}`);
  const idiomLines = profile.idioms.map((idiom) => `- ${idiom}`);
  const gotchaLines = profile.gotchas.map((gotcha) => `- ${gotcha}`);

  return [
    `Target: ${profile.label} — ${profile.summary}`,
    "Propose column types from this vocabulary so they round-trip through the export:",
    ...typeLines,
    profile.nativeTypes,
    "Model in this target's idioms:",
    ...idiomLines,
    "Proactively warn about these target-specific pitfalls:",
    ...gotchaLines,
  ].join("\n");
}
