import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("native GIPHY result fetching", () => {
  it("requests a scrollable set of twenty G-rated reaction GIFs", async () => {
    const source = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), "../hooks/use-giphy-gifs.ts"), "utf8");

    expect(source).toContain('endpoint.searchParams.set("limit", "20")');
    expect(source).toContain('endpoint.searchParams.set("rating", "g")');
  });
});
