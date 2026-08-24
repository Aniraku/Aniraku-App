import type { Anime, AnimeRelationEdge, AnimeRelationType } from "@/lib/types";

export type DisplayAnimeRelation = {
  id: number;
  label: string;
  relationType: AnimeRelationType | null;
  anime: Anime;
};

export type DisplayAnimeRelationGroup = {
  key: "story" | "extras" | "other";
  title: string;
  subtitle: string;
  relations: DisplayAnimeRelation[];
};

const RELATION_LABELS: Partial<Record<AnimeRelationType, string>> = {
  PREQUEL: "Prequel",
  SEQUEL: "Sequel",
  SIDE_STORY: "Side story",
  SPIN_OFF: "Spin-off",
  ALTERNATIVE: "Alternative",
  CHARACTER: "Character story",
  SUMMARY: "Summary",
  ADAPTATION: "Adaptation",
  PARENT: "Parent story",
  COMPILATION: "Compilation",
  CONTAINS: "Contains",
  VERSION: "Version",
  OTHER: "Related",
};

const RELATION_PRIORITY: Partial<Record<AnimeRelationType, number>> = {
  PREQUEL: 1,
  SEQUEL: 2,
  SIDE_STORY: 3,
  SPIN_OFF: 4,
  PARENT: 5,
  ALTERNATIVE: 6,
  CHARACTER: 7,
  SUMMARY: 8,
  COMPILATION: 9,
  VERSION: 10,
  ADAPTATION: 11,
  CONTAINS: 12,
  OTHER: 13,
};

export function relationLabel(relationType: AnimeRelationType | null | undefined, anime: Pick<Anime, "format">): string {
  if (anime.format === "SPECIAL") return "Special";
  if (anime.format === "OVA") return "OVA";
  if (anime.format === "ONA") return "ONA";
  if (anime.format === "MOVIE") return "Movie";
  return (relationType && RELATION_LABELS[relationType]) || "Related";
}

export function displayAnimeRelations(edges: AnimeRelationEdge[] | null | undefined): DisplayAnimeRelation[] {
  const seenIds = new Set<number>();
  return (edges ?? [])
    .reduce<Array<DisplayAnimeRelation & { index: number }>>((relations, edge, index) => {
      const node = edge.node;
      if (!node || !Number.isInteger(node.id) || node.id <= 0 || node.type === "MANGA" || node.isAdult || seenIds.has(node.id)) return relations;
      seenIds.add(node.id);
      relations.push({ id: node.id, label: relationLabel(edge.relationType, node), relationType: edge.relationType ?? null, anime: node, index });
      return relations;
    }, [])
    .sort((left, right) => (RELATION_PRIORITY[left.relationType ?? "OTHER"] ?? 99) - (RELATION_PRIORITY[right.relationType ?? "OTHER"] ?? 99) || left.index - right.index)
    .map(({ index: _index, ...relation }) => relation);
}

function relationGroupKey(relation: DisplayAnimeRelation): DisplayAnimeRelationGroup["key"] {
  if (relation.relationType === "PREQUEL" || relation.relationType === "SEQUEL" || relation.relationType === "PARENT") return "story";
  if (relation.relationType === "SIDE_STORY" || relation.relationType === "SPIN_OFF" || relation.relationType === "CHARACTER" || ["SPECIAL", "OVA", "ONA"].includes(relation.anime.format ?? "")) return "extras";
  return "other";
}

export function groupAnimeRelations(edges: AnimeRelationEdge[] | null | undefined): DisplayAnimeRelationGroup[] {
  const groups: DisplayAnimeRelationGroup[] = [
    { key: "story", title: "Story order", subtitle: "Prequels, sequels, and parent stories", relations: [] },
    { key: "extras", title: "Extras", subtitle: "Specials, side stories, and spin-offs", relations: [] },
    { key: "other", title: "More related", subtitle: "Alternate versions and companion titles", relations: [] },
  ];
  for (const relation of displayAnimeRelations(edges)) {
    groups.find((group) => group.key === relationGroupKey(relation))?.relations.push(relation);
  }
  return groups.filter((group) => group.relations.length > 0);
}
