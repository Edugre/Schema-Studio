import { describe, expect, it } from "vitest";

import {
  DEFAULT_TARGET,
  TARGET_PROFILES,
  TargetIdSchema,
  describeTargetForPrompt,
  getTargetProfile,
} from "../src/index.js";

describe("target profiles", () => {
  it("defaults to postgres", () => {
    expect(DEFAULT_TARGET).toBe("postgres");
    expect(getTargetProfile(DEFAULT_TARGET).label).toBe("PostgreSQL");
  });

  it("validates target ids", () => {
    expect(TargetIdSchema.safeParse("postgres").success).toBe(true);
    expect(TargetIdSchema.safeParse("prisma").success).toBe(true);
    expect(TargetIdSchema.safeParse("mongodb").success).toBe(false);
  });

  it("renders a deterministic Postgres prompt block grounded in the exporter", () => {
    const block = describeTargetForPrompt(TARGET_PROFILES.postgres);
    expect(block).toContain("Target: PostgreSQL");
    expect(block).toContain("- text —");
    expect(block).toContain("PRIMARY KEY");
    expect(block).toContain("leading zeros");
    // Deterministic across calls so prompt-caching and diffs stay stable.
    expect(describeTargetForPrompt(TARGET_PROFILES.postgres)).toBe(block);
  });

  it("renders Prisma-native vocabulary and idioms", () => {
    const block = describeTargetForPrompt(TARGET_PROFILES.prisma);
    expect(block).toContain("Target: Prisma");
    expect(block).toContain("- String —");
    expect(block).toContain("@id");
  });
});
