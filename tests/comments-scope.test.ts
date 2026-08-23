import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = dirname(fileURLToPath(import.meta.url));

describe("shared comment surfaces", () => {
  it("filters Watch discussions by episode and uses the common spoiler- and GIF-safe component", async () => {
    const [hook, watch] = await Promise.all([
      readFile(resolve(root, "../hooks/use-comments.ts"), "utf8"),
      readFile(resolve(root, "../app/watch/[id].tsx"), "utf8"),
    ]);

    expect(hook).toContain('if (typeof episodeNumber === "number") request = request.eq("episode_number", episodeNumber);');
    expect(hook).toContain('episode_number: input.episode ?? episodeNumber ?? null');
    expect(watch).toContain('<AnimeComments animeId={animeId} episodeNumber={episode} />');
    expect(watch).not.toContain('episodeComments.slice(0, 4)');
  });
});
