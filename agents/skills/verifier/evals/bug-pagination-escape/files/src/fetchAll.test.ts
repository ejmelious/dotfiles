import { describe, expect, it } from "vitest";
import { fetchAll, type Page } from "./fetchAll";

describe("fetchAll", () => {
  it("collects items across pages", async () => {
    const pages: Record<string, Page<number>> = {
      start: { items: [1, 2], nextToken: "b" },
      b: { items: [3], nextToken: undefined },
    };
    const result = await fetchAll<number>(async (t) => pages[t ?? "start"]!);
    expect(result).toEqual([1, 2, 3]);
  });
});
