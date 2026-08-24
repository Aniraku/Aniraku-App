import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Anime Detail hook ordering", () => {
  it("creates the Relations memo before every loading or error early-return branch", () => {
    const source = readFileSync(resolve(process.cwd(), "app/anime/[id].tsx"), "utf8");
    const relationsMemo = source.indexOf("const relationGroups = useMemo(() => groupAnimeRelations(anime.data?.relations?.edges)");
    const firstEarlyReturn = source.indexOf("if (anime.isPending) return");

    expect(relationsMemo).toBeGreaterThan(-1);
    expect(firstEarlyReturn).toBeGreaterThan(-1);
    expect(relationsMemo).toBeLessThan(firstEarlyReturn);
  });

  it("places the comments section after the complete episode selector", () => {
    const source = readFileSync(resolve(process.cwd(), "app/anime/[id].tsx"), "utf8");
    const episodeSection = source.indexOf('<DotLabel>EPISODES</DotLabel>');
    const commentsSection = source.lastIndexOf("<AnimeComments animeId={id} />");

    expect(episodeSection).toBeGreaterThan(-1);
    expect(commentsSection).toBeGreaterThan(episodeSection);
  });
});
