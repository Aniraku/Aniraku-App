import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getAnimePage } from "@/lib/anilist";
import { animeTitle } from "@/lib/types";
import { ErrorState, LoadingState } from "@/components/async-state";
import { DotLabel, NothingButton, nothing, Signal } from "@/components/nothing-ui";
import { NativeHeader, NativeScreen } from "@/components/screen";

export default function RandomScreen() {
  const [seed, setSeed] = useState(1);
  const suggestion = useQuery({ queryKey: ["random", seed], queryFn: async () => { const page = await getAnimePage({ page: (seed % 20) + 1, perPage: 20, sort: ["POPULARITY_DESC"] }); return page.media[Math.floor(Math.random() * page.media.length)]; } });
  return <NativeScreen><NativeHeader eyebrow="Minimal selection engine" title="Random" />{suggestion.isPending ? <LoadingState label="Finding a real title" /> : suggestion.isError || !suggestion.data ? <ErrorState message={suggestion.error?.message ?? "Random discovery unavailable."} onRetry={() => setSeed((value) => value + 1)} /> : <View style={styles.wrapper}><View style={styles.art}><Image source={suggestion.data.coverImage?.extraLarge || suggestion.data.coverImage?.large || undefined} style={StyleSheet.absoluteFill} contentFit="cover" /><View style={styles.artMask} /><View style={styles.code}><DotLabel tone="live">Signal locked</DotLabel><Text style={styles.id}>ID/{suggestion.data.id}</Text></View></View><View style={styles.content}><Signal label={suggestion.data.format || "ANIME"} /><Text style={styles.title}>{animeTitle(suggestion.data)}</Text><Text style={styles.meta}>{suggestion.data.genres?.slice(0, 3).join(" · ") || "Genre data unavailable"}</Text><NothingButton label="Open title" onPress={() => router.push((`/anime/${suggestion.data.id}`) as never)} /><Pressable onPress={() => setSeed((value) => value + 1)} style={styles.again}><Text style={styles.againText}>RESHUFFLE</Text></Pressable></View></View>}</NativeScreen>;
}

const styles = StyleSheet.create({ wrapper: { gap: 15 }, art: { height: 400, borderRadius: 22, overflow: "hidden", borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.raised }, artMask: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.16)" }, code: { position: "absolute", left: 14, bottom: 14, gap: 5 }, id: { color: nothing.white, fontFamily: "monospace", fontWeight: "800", fontSize: 11, letterSpacing: 0.8 }, content: { gap: 12 }, title: { color: nothing.white, fontSize: 29, fontWeight: "900", lineHeight: 34, letterSpacing: -0.8 }, meta: { color: nothing.muted, fontSize: 13, lineHeight: 19 }, again: { minHeight: 46, alignItems: "center", justifyContent: "center" }, againText: { color: nothing.muted, fontFamily: "monospace", fontSize: 11, fontWeight: "800", letterSpacing: 1.5 }, });
