import { useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEvent } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { useKeepAwake } from "expo-keep-awake";
import { getPlaybackType, getServers, getStream, playableSources } from "@/lib/aniraku-api";
import type { Server, StreamResponse, StreamSource } from "@/lib/types";
import { useWatchHistory } from "@/hooks/use-watch-history";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { ErrorState, LoadingState } from "@/components/async-state";
import { AppIcon } from "@/components/app-icon";
import { DotLabel, NothingButton, NothingCard, nothing, Signal } from "@/components/nothing-ui";
import { NativeScreen } from "@/components/screen";

type Language = "sub" | "dub";

function directSources(response: StreamResponse) {
  return playableSources(response.sources ?? []).filter((source) => getPlaybackType(source) !== "embed");
}

export default function WatchScreen() {
  const params = useLocalSearchParams<{ id: string; episode?: string; title?: string; image?: string }>();
  const animeId = Number(params.id);
  const episode = Math.max(1, Number(params.episode ?? "1"));
  const title = params.title || "Aniraku stream";
  const auth = useAnirakuAuth();
  const history = useWatchHistory();
  useKeepAwake("aniraku-watch");
  const player = useVideoPlayer(null, (instance) => { instance.timeUpdateEventInterval = 1; instance.staysActiveInBackground = false; instance.preservesPitch = true; instance.showNowPlayingNotification = true; });
  const statusEvent = useEvent(player, "statusChange", { status: player.status });
  const timeEvent = useEvent(player, "timeUpdate", { currentTime: 0, bufferedPosition: 0, currentLiveTimestamp: null, currentOffsetFromLive: null });
  const status = statusEvent?.status;
  const playerError = statusEvent?.error;
  const currentTime = timeEvent?.currentTime ?? 0;
  const duration = player.duration || 0;
  const { isPlaying } = useEvent(player, "playingChange", { isPlaying: player.playing });
  const [language, setLanguage] = useState<Language>("sub");
  const [providers, setProviders] = useState<Record<Language, Server[]>>({ sub: [], dub: [] });
  const [serverIndex, setServerIndex] = useState(0);
  const [stream, setStream] = useState<StreamResponse | null>(null);
  const [source, setSource] = useState<StreamSource | null>(null);
  const [loadingServers, setLoadingServers] = useState(true);
  const [loadingStream, setLoadingStream] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [autoNext, setAutoNext] = useState(true);
  const [autoSkip, setAutoSkip] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [showSources, setShowSources] = useState(false);
  const lastSync = useRef(0);
  const failedSource = useRef<string | null>(null);
  const activeProviders = providers[language] ?? [];
  const activeProvider = activeProviders[serverIndex];
  const qualities = useMemo(() => directSources(stream ?? { sources: [] }).filter((item, index, items) => item.quality && items.findIndex((candidate) => candidate.quality === item.quality) === index), [stream]);

  useEffect(() => {
    let cancelled = false;
    setLoadingServers(true); setError(null); setStream(null); setSource(null); setServerIndex(0);
    Promise.allSettled([getServers(animeId, episode, "sub"), getServers(animeId, episode, "dub")]).then((results) => {
      if (cancelled) return;
      const sub = results[0].status === "fulfilled" ? results[0].value : [];
      const dub = results[1].status === "fulfilled" ? results[1].value : [];
      setProviders({ sub, dub });
      if (!sub.length && dub.length) setLanguage("dub");
      if (!sub.length && !dub.length) setError("No verified providers are currently available for this episode.");
    }).catch(() => { if (!cancelled) setError("Provider availability could not be retrieved."); }).finally(() => { if (!cancelled) setLoadingServers(false); });
    return () => { cancelled = true; };
  }, [animeId, episode]);

  useEffect(() => { setServerIndex(0); setStream(null); setSource(null); setError(null); }, [language]);

  useEffect(() => {
    if (!activeProvider) return;
    let cancelled = false;
    setLoadingStream(true); setError(null); setStream(null); setSource(null);
    getStream({ animeId, episode, provider: activeProvider.provider || activeProvider.id, lang: language, refresh: refresh > 0 }).then((response) => {
      if (cancelled) return;
      const available = directSources(response);
      if (!available.length) {
        if (serverIndex + 1 < activeProviders.length) { setServerIndex((index) => index + 1); return; }
        setError("Providers responded, but none supplied a verified direct stream this native player can open.");
        return;
      }
      setStream(response); setSource(available[0]);
    }).catch((streamError) => {
      if (cancelled) return;
      if (serverIndex + 1 < activeProviders.length) { setServerIndex((index) => index + 1); return; }
      setError(streamError instanceof Error ? streamError.message : "The selected provider could not start playback.");
    }).finally(() => { if (!cancelled) setLoadingStream(false); });
    return () => { cancelled = true; };
  }, [activeProvider?.id, activeProvider?.provider, activeProviders.length, animeId, episode, language, refresh, serverIndex]);

  useEffect(() => {
    if (!source) return;
    failedSource.current = null;
    const contentType = getPlaybackType(source) === "hls" ? "hls" : getPlaybackType(source) === "dash" ? "dash" : undefined;
    void player.replaceAsync({ uri: source.url, headers: stream?.headers, contentType } as never).then(() => { player.play(); }).catch(() => setError("The selected verified stream could not be loaded."));
  }, [player, source?.url, stream?.headers]);

  useEffect(() => { player.playbackRate = speed; }, [player, speed]);

  useEffect(() => {
    if (status !== "error" || !source?.url || failedSource.current === source.url) return;
    failedSource.current = source.url;
    if (serverIndex + 1 < activeProviders.length) setServerIndex((index) => index + 1);
    else setError(playerError?.message || "The player could not decode this provider stream.");
  }, [activeProviders.length, playerError?.message, serverIndex, source?.url, status]);

  useEffect(() => {
    if (!source || !auth.user || currentTime < 1 || duration <= 0 || currentTime - lastSync.current < 15) return;
    lastSync.current = currentTime;
    history.save.mutate({ animeId, animeTitle: title, animeImage: params.image || null, episode, progress: currentTime, duration });
  }, [animeId, auth.user, currentTime, duration, episode, history.save, params.image, source, title]);

  useEffect(() => {
    if (!autoSkip || !stream) return;
    const interval = stream.intro && currentTime >= (stream.intro.startTime ?? Number.MAX_VALUE) && currentTime < (stream.intro.endTime ?? -1) ? stream.intro : stream.outro && currentTime >= (stream.outro.startTime ?? Number.MAX_VALUE) && currentTime < (stream.outro.endTime ?? -1) ? stream.outro : null;
    if (interval?.endTime) player.currentTime = interval.endTime;
  }, [autoSkip, currentTime, player, stream]);

  useEffect(() => {
    const subscription = player.addListener("playToEnd", () => {
      if (auth.user) history.save.mutate({ animeId, animeTitle: title, animeImage: params.image || null, episode, progress: duration || currentTime, duration: duration || currentTime });
      if (autoNext) router.replace({ pathname: "/watch/[id]", params: { id: String(animeId), episode: String(episode + 1), title, image: params.image || "" } } as never);
    });
    return () => subscription.remove();
  }, [animeId, auth.user, autoNext, currentTime, duration, episode, history.save, params.image, player, title]);

  const selectLanguage = (next: Language) => { if (providers[next].length) setLanguage(next); };
  const seek = (seconds: number) => player.seekBy(seconds);
  const selectQuality = (next: StreamSource) => setSource(next);
  const skip = (kind: "intro" | "outro") => { const target = stream?.[kind]?.endTime; if (target) player.currentTime = target; };
  const retry = () => { setRefresh((value) => value + 1); setError(null); };
  const nextEpisode = () => router.replace({ pathname: "/watch/[id]", params: { id: String(animeId), episode: String(episode + 1), title, image: params.image || "" } } as never);

  return <NativeScreen scroll={false} style={styles.fill}>
    <View style={styles.top}><Pressable onPress={() => router.back()}><Text style={styles.close}>CLOSE</Text></Pressable><View><DotLabel>Native playback</DotLabel><Text style={styles.title} numberOfLines={1}>{title}</Text></View></View>
    <View style={styles.videoShell}>{source ? <VideoView style={styles.video} player={player} nativeControls allowsFullscreen allowsPictureInPicture contentFit="contain" surfaceType="textureView" /> : <View style={styles.videoPlaceholder}>{loadingServers || loadingStream ? <><ActivityIndicator color={nothing.white} /><Text style={styles.placeholderText}>{loadingServers ? "LOCATING VERIFIED PROVIDERS" : "COORDINATING SOURCE"}</Text></> : error ? <Text style={styles.errorText}>{error}</Text> : <Text style={styles.placeholderText}>WAITING FOR A VERIFIED SOURCE</Text>}</View>}</View>
    {error && !source ? <View style={styles.errorAction}><NothingButton label="Retry source coordination" onPress={retry} variant="outline" /></View> : null}
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.controls}><Pressable onPress={() => seek(-10)} style={styles.control}><AppIcon name="rewind-10" size={22} color={nothing.white} /><Text style={styles.controlText}>-10</Text></Pressable><Pressable onPress={() => { if (isPlaying) player.pause(); else player.play(); }} style={styles.playControl}><AppIcon name={isPlaying ? "pause" : "play"} size={26} color={nothing.black} /></Pressable><Pressable onPress={() => seek(10)} style={styles.control}><AppIcon name="fast-forward-10" size={22} color={nothing.white} /><Text style={styles.controlText}>+10</Text></Pressable><Pressable onPress={nextEpisode} style={styles.control}><AppIcon name="skip-next" size={22} color={nothing.white} /><Text style={styles.controlText}>NEXT</Text></Pressable></View>
      <NothingCard style={styles.state}><Signal label={source ? `${activeProvider?.label || activeProvider?.provider || "Provider"} · ${language.toUpperCase()}` : "SOURCE COORDINATION"} tone={source ? "live" : "muted"} /><Text style={styles.stateText}>{source?.quality ? `${source.quality} · ${getPlaybackType(source).toUpperCase()}` : "Auto quality selects the backend-preferred verified direct source."}</Text></NothingCard>
      <View style={styles.languageRow}>{(["sub", "dub"] as Language[]).map((item) => <Pressable key={item} onPress={() => selectLanguage(item)} disabled={!providers[item].length} style={[styles.language, language === item && styles.languageActive, !providers[item].length && styles.languageDisabled]}><Text style={[styles.languageText, language === item && styles.languageTextActive]}>{item.toUpperCase()} {String(providers[item].length).padStart(2, "0")}</Text></Pressable>)}</View>
      <NothingCard style={styles.panel}><View style={styles.panelHead}><DotLabel>Verified providers</DotLabel><Pressable onPress={() => setShowSources((value) => !value)}><Text style={styles.panelToggle}>{showSources ? "HIDE" : "SHOW"}</Text></Pressable></View>{showSources ? <View style={styles.providerList}>{activeProviders.map((provider, index) => <Pressable key={provider.id} onPress={() => setServerIndex(index)} style={[styles.provider, index === serverIndex && styles.providerActive]}><Text style={[styles.providerText, index === serverIndex && styles.providerTextActive]}>{provider.label || provider.provider}</Text><Text style={styles.providerMeta}>{index === serverIndex ? "ACTIVE" : "SELECT"}</Text></Pressable>)}</View> : <Text style={styles.panelCopy}>{activeProvider?.label || "Providers appear when the backend verifies this episode."}</Text>}</NothingCard>
      {qualities.length > 1 ? <NothingCard style={styles.panel}><DotLabel>Quality source</DotLabel><View style={styles.qualityRow}>{qualities.map((item, index) => <Pressable key={`${item.url}:${index}`} onPress={() => selectQuality(item)} style={[styles.quality, source?.url === item.url && styles.qualityActive]}><Text style={[styles.qualityText, source?.url === item.url && styles.qualityTextActive]}>{item.quality || "AUTO"}</Text></Pressable>)}</View></NothingCard> : null}
      <NothingCard style={styles.panel}><DotLabel>Playback behavior</DotLabel><View style={styles.toggleRow}><Pressable onPress={() => setAutoNext((value) => !value)} style={[styles.toggle, autoNext && styles.toggleOn]}><Text style={[styles.toggleText, autoNext && styles.toggleTextOn]}>AUTO NEXT {autoNext ? "ON" : "OFF"}</Text></Pressable><Pressable onPress={() => setAutoSkip((value) => !value)} style={[styles.toggle, autoSkip && styles.toggleOn]}><Text style={[styles.toggleText, autoSkip && styles.toggleTextOn]}>AUTO SKIP {autoSkip ? "ON" : "OFF"}</Text></Pressable></View><View style={styles.speedRow}>{[1, 1.25, 1.5, 2].map((value) => <Pressable key={value} onPress={() => setSpeed(value)} style={[styles.speed, speed === value && styles.speedActive]}><Text style={[styles.speedText, speed === value && styles.speedTextActive]}>{value}×</Text></Pressable>)}</View></NothingCard>
      {(stream?.intro?.endTime || stream?.outro?.endTime) ? <NothingCard style={styles.panel}><DotLabel>Verified intervals</DotLabel><View style={styles.skipRow}>{stream?.intro?.endTime ? <NothingButton label="Skip intro" variant="outline" onPress={() => skip("intro")} /> : null}{stream?.outro?.endTime ? <NothingButton label="Skip outro" variant="outline" onPress={() => skip("outro")} /> : null}</View></NothingCard> : null}
    </ScrollView>
  </NativeScreen>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 }, top: { minHeight: 76, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 15 }, close: { color: nothing.muted, fontFamily: "monospace", fontWeight: "800", fontSize: 11, letterSpacing: 1.3 }, title: { maxWidth: 250, color: nothing.white, fontSize: 17, fontWeight: "900", marginTop: 3 }, videoShell: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000000" }, video: { flex: 1 }, videoPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 11, padding: 22 }, placeholderText: { color: nothing.muted, fontFamily: "monospace", fontSize: 10, fontWeight: "800", textAlign: "center", letterSpacing: 1 }, errorText: { color: nothing.red, fontSize: 13, lineHeight: 19, textAlign: "center" }, errorAction: { paddingHorizontal: 18, paddingTop: 12 }, scroll: { padding: 18, paddingBottom: 42, gap: 12 }, controls: { flexDirection: "row", gap: 9 }, control: { flex: 1, minHeight: 54, borderWidth: 1, borderColor: nothing.line, borderRadius: 14, backgroundColor: nothing.surface, alignItems: "center", justifyContent: "center", gap: 2 }, playControl: { width: 58, minHeight: 54, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: nothing.white }, controlText: { color: nothing.muted, fontFamily: "monospace", fontSize: 9, fontWeight: "800" }, state: { padding: 14, gap: 7 }, stateText: { color: nothing.muted, fontSize: 12, lineHeight: 18 }, languageRow: { flexDirection: "row", gap: 9 }, language: { flex: 1, minHeight: 42, borderWidth: 1, borderColor: nothing.line, borderRadius: 12, alignItems: "center", justifyContent: "center" }, languageActive: { backgroundColor: nothing.white, borderColor: nothing.white }, languageDisabled: { opacity: 0.35 }, languageText: { color: nothing.muted, fontFamily: "monospace", fontWeight: "800", fontSize: 10, letterSpacing: 0.6 }, languageTextActive: { color: nothing.black }, panel: { padding: 14, gap: 11 }, panelHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, panelToggle: { color: nothing.white, fontFamily: "monospace", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 }, panelCopy: { color: nothing.muted, fontSize: 13, lineHeight: 18 }, providerList: { gap: 7 }, provider: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 11, borderRadius: 10, borderWidth: 1, borderColor: nothing.line }, providerActive: { backgroundColor: nothing.white, borderColor: nothing.white }, providerText: { color: nothing.white, fontWeight: "800", fontSize: 13 }, providerTextActive: { color: nothing.black }, providerMeta: { color: nothing.muted, fontFamily: "monospace", fontSize: 9, fontWeight: "800" }, qualityRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, quality: { minHeight: 35, paddingHorizontal: 11, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 1, borderColor: nothing.line }, qualityActive: { backgroundColor: nothing.white, borderColor: nothing.white }, qualityText: { color: nothing.muted, fontFamily: "monospace", fontWeight: "800", fontSize: 10 }, qualityTextActive: { color: nothing.black }, toggleRow: { flexDirection: "row", gap: 8 }, toggle: { flex: 1, minHeight: 38, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 1, borderColor: nothing.line }, toggleOn: { borderColor: nothing.green, backgroundColor: "rgba(150,211,123,0.10)" }, toggleText: { color: nothing.muted, fontFamily: "monospace", fontSize: 9, fontWeight: "800" }, toggleTextOn: { color: nothing.green }, speedRow: { flexDirection: "row", gap: 7 }, speed: { flex: 1, minHeight: 35, alignItems: "center", justifyContent: "center", borderRadius: 9, borderWidth: 1, borderColor: nothing.line }, speedActive: { backgroundColor: nothing.white, borderColor: nothing.white }, speedText: { color: nothing.muted, fontFamily: "monospace", fontSize: 10, fontWeight: "800" }, speedTextActive: { color: nothing.black }, skipRow: { flexDirection: "row", gap: 8 }, });
