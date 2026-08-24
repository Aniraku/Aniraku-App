import { describe, expect, it } from "vitest";
import { displayAnimeRelations, groupAnimeRelations, relationLabel } from "../lib/anime-relations";
import type { Anime, AnimeRelationEdge } from "../lib/types";

const anime = (id: number, format = "TV"): Anime => ({ id, type: "ANIME", format, title: { english: `Title ${id}` } });

describe("Anime Detail relationships", () => {
  it("uses reader-friendly labels for sequels, specials, and side stories", () => {
    expect(relationLabel("SEQUEL", anime(2))).toBe("Sequel");
    expect(relationLabel("SEQUEL", anime(3, "SPECIAL"))).toBe("Special");
    expect(relationLabel("SIDE_STORY", anime(4))).toBe("Side story");
  });

  it("keeps only unique, non-adult anime relations and presents canonical story order first", () => {
    const edges: AnimeRelationEdge[] = [
      { relationType: "SIDE_STORY", node: anime(4) },
      { relationType: "SEQUEL", node: anime(3) },
      { relationType: "PREQUEL", node: anime(2) },
      { relationType: "SEQUEL", node: anime(3) },
      { relationType: "SOURCE", node: { ...anime(99), type: "MANGA" } },
      { relationType: "OTHER", node: { ...anime(100), isAdult: true } },
    ];

    expect(displayAnimeRelations(edges).map((item) => [item.id, item.label])).toEqual([
      [2, "Prequel"],
      [3, "Sequel"],
      [4, "Side story"],
    ]);
    expect(groupAnimeRelations(edges).map((group) => [group.key, group.relations.map((item) => item.id)])).toEqual([
      ["story", [2, 3]],
      ["extras", [4]],
    ]);
  });
});
