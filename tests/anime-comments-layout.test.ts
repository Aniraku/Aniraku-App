import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("native GIF picker layout", () => {
  it("uses larger square reaction tiles so text inside each GIF is legible", async () => {
    const source = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), "../components/anime-comments.tsx"), "utf8");

    expect(source).toContain('gifTile: { aspectRatio: 1');
    expect(source).toContain('width: "31.8%"');
    expect(source).not.toContain('style={styles.gifLabel}');
  });
});
