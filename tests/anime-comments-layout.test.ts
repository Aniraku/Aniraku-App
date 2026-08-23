import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("native GIF picker layout", () => {
  it("shows original-ratio full-width GIFs in an internally scrollable results list", async () => {
    const source = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), "../components/anime-comments.tsx"), "utf8");

    expect(source).toContain('resizeMode="contain"');
    expect(source).toContain('{ aspectRatio: gif.aspectRatio }');
    expect(source).toContain('gifTile: { alignItems: "center", backgroundColor: nothing.surface');
    expect(source).toContain('minHeight: 124');
    expect(source).toContain('width: "100%"');
    expect(source).toContain('width: gif.width ?? undefined, height: gif.height ?? undefined');
    expect(source).toContain('<ScrollView style={styles.gifResults}');
    expect(source).toContain('gifResults: { maxHeight: 360 }');
    expect(source).not.toContain('style={styles.gifLabel}');
  });
});
