import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getAnimePage } from "@/lib/anilist";
import { animeTitle } from "@/lib/types";
import { ErrorState, LoadingState } from "@/components/async-state";
import { nothing } from "@/components/nothing-ui";
import { NativeHeader, NativeScreen } from "@/components/screen";
import { AppIcon } from "@/components/app-icon";

export default function RandomScreen() {
  const [seed, setSeed] = useState(1);
  const suggestion = useQuery({ queryKey: ["random", seed], queryFn: async () => { const page = await getAnimePage({ page: (seed % 20) + 1, perPage: 20, sort: ["POPULARITY_DESC"] }); return page.media[Math.floor(Math.random() * page.media.length)]; } });
  return <NativeScreen><NativeHeader eyebrow="PICK FOR ME" title="Surprise me" />{suggestion.isPending ? <LoadingState label="Finding something you might like" /> : suggestion.isError || !suggestion.data ? <ErrorState message={suggestion.error?.message ?? "We could not pick an anime right now."} onRetry={() => setSeed((value) => value + 1)} /> : <View style={styles.wrapper}><View style={styles.art}><View style={styles.artFallback}><Text style={styles.fallbackInitial}>{animeTitle(suggestion.data).charAt(0)}</Text></View><Image source={{ uri: suggestion.data.coverImage?.extraLarge || suggestion.data.coverImage?.large || "" }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} cachePolicy="memory-disk" /><View style={styles.artMask} /><View style={styles.artBottom}><Text style={styles.artMeta}>{suggestion.data.averageScore ? `${Math.round(suggestion.data.averageScore)}% MATCH` : suggestion.data.format || "ANIME"}</Text></View></View><View style={styles.content}><Text style={styles.title}>{animeTitle(suggestion.data)}</Text><Text style={styles.meta}>{suggestion.data.genres?.slice(0, 3).join(" · ") || "Anime for tonight"}</Text><Pressable accessibilityRole="button" onPress={() => router.push((`/anime/${suggestion.data.id}`) as never)} style={({ pressed }) => [styles.open, pressed && styles.pressed]}><Text style={styles.openText}>VIEW ANIME</Text><AppIcon name="arrow-top-right" size={18} color={nothing.black} /></Pressable><Pressable accessibilityRole="button" onPress={() => setSeed((value) => value + 1)} style={({ pressed }) => [styles.again, pressed && styles.pressed]}><Text style={styles.againText}>PICK ANOTHER</Text></Pressable></View></View>}</NativeScreen>;
}

const styles = StyleSheet.create({
  wrapper: { gap: 18 }, art: { height: 430, marginHorizontal: -18, overflow: "hidden", backgroundColor: nothing.raised }, artFallback: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "#242422" }, fallbackInitial: { color: nothing.dim, fontSize: 100, fontWeight: "900" }, artMask: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.17)" }, artBottom: { position: "absolute", left: 18, bottom: 14, paddingLeft: 9, borderLeftWidth: 2, borderLeftColor: nothing.red }, artMeta: { color: nothing.white, fontFamily: "monospace", fontWeight: "900", fontSize: 9, letterSpacing: 0.5 }, content: { gap: 11 }, title: { color: nothing.white, fontSize: 35, fontWeight: "900", lineHeight: 39, letterSpacing: -1.15 }, meta: { color: nothing.muted, fontSize: 13, lineHeight: 19 }, open: { minHeight: 52, paddingHorizontal: 16, borderRadius: 6, alignItems: "center", justifyContent: "space-between", flexDirection: "row", backgroundColor: nothing.white }, openText: { color: nothing.black, fontFamily: "monospace", fontSize: 11, fontWeight: "900", letterSpacing: 0.5 }, again: { minHeight: 36, alignItems: "flex-start", justifyContent: "center" }, againText: { color: nothing.muted, fontFamily: "monospace", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 }, pressed: { opacity: 0.72 },
});
