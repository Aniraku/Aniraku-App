import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("native GIF picker layout", () => {
  it("renders a visible two-line label over each compact reaction tile", async () => {
    const source = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), "../components/anime-comments.tsx"), "utf8");

    expect(source).toContain('style={styles.gifLabel}');
    expect(source).toContain('numberOfLines={2} style={styles.gifLabelText}');
    expect(source).toContain('backgroundColor: "rgba(0,0,0,0.84)"');
  });
});
