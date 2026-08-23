import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("native GIF picker layout", () => {
  it("preserves each reaction GIF's intrinsic ratio without forcing a square crop", async () => {
    const source = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), "../components/anime-comments.tsx"), "utf8");

    expect(source).toContain('aspectRatio: gif.aspectRatio');
    expect(source).toContain('resizeMode="contain"');
    expect(source).toContain('width: "31.8%"');
    expect(source).not.toContain('style={styles.gifLabel}');
  });
});
