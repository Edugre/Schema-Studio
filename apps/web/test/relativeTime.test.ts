import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "../src/home/relativeTime.js";

const NOW = 1_700_000_000_000;
const minutes = (n: number) => NOW - n * 60_000;
const hours = (n: number) => NOW - n * 3_600_000;
const days = (n: number) => NOW - n * 86_400_000;

describe("formatRelativeTime", () => {
  it("buckets recent edits by minute and hour", () => {
    expect(formatRelativeTime(NOW, NOW)).toBe("just now");
    expect(formatRelativeTime(minutes(5), NOW)).toBe("5m ago");
    expect(formatRelativeTime(hours(2), NOW)).toBe("2h ago");
  });

  it("uses day, week, and month phrasing for older edits", () => {
    expect(formatRelativeTime(days(1), NOW)).toBe("yesterday");
    expect(formatRelativeTime(days(4), NOW)).toBe("4d ago");
    expect(formatRelativeTime(days(7), NOW)).toBe("1w ago");
    expect(formatRelativeTime(days(40), NOW)).toBe("1mo ago");
  });
});
