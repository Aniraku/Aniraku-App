import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("native GIF picker layout", () => {
  it("shows a compact two-row GIF viewport with additional results internally scrollable", async () => {
    const source = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), "../components/anime-comments.tsx"), "utf8");

    expect(source).toContain('resizeMode="contain"');
    expect(source).toContain('gifTile: { aspectRatio: 1.45');
    expect(source).toContain('width: "31.8%"');
    expect(source).toContain('<ScrollView style={styles.gifResults}');
    expect(source).toContain('gifResults: { maxHeight: 158 }');
    expect(source).not.toContain('style={styles.gifLabel}');
  });
});
