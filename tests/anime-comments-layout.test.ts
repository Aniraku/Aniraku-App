import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("native comments composer", () => {
  it("has no GIF picker or third-party GIF dependency", async () => {
    const source = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), "../components/anime-comments.tsx"), "utf8");

    expect(source).not.toContain("useGiphyGifs");
    expect(source).not.toContain("use-giphy-gifs");
    expect(source).not.toContain("giphy");
    expect(source).not.toContain("GIPHY");
    expect(source).not.toContain("GIF picker");
    expect(source).not.toContain("REACTION GIFS");
  });
});
