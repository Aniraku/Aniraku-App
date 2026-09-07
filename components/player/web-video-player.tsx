import { useEffect, useRef, useState } from "react";
import { StyleSheet, View, Platform } from "react-native";

type WebVideoPlayerProps = {
  sourceUri?: string;
  sourceHeaders?: Record<string, string>;
  paused?: boolean;
  rate?: number;
  resizeMode?: "contain" | "cover" | "stretch";
  muted?: boolean;
  onLoad?: (data: { duration: number }) => void;
  onProgress?: (data: { currentTime: number; playableDuration: number }) => void;
  onBuffer?: (data: { isBuffering: boolean }) => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
  onVideoTracks?: (tracks: any[]) => void;
  onAudioTracks?: (tracks: any[]) => void;
  onTextTracks?: (tracks: any[]) => void;
  selectedAudioTrack?: { type: string; value?: string | number };
  style?: any;
};

/**
 * Web-only HLS player using hls.js + HTML5 <video>.
 * On Android, react-native-video's ExoPlayer handles HLS natively.
 * On web, hls.js provides the same capability through MediaSource Extensions.
 */
export function WebVideoPlayer({
  sourceUri,
  paused = false,
  rate = 1,
  resizeMode = "contain",
  muted = false,
  onLoad,
  onProgress,
  onBuffer,
  onEnd,
  onError,
  onVideoTracks,
  onAudioTracks,
  onTextTracks,
  style,
}: WebVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onProgressRef = useRef(onProgress);
  const onEndRef = useRef(onEnd);
  const [ready, setReady] = useState(false);

  onProgressRef.current = onProgress;
  onEndRef.current = onEnd;

  useEffect(() => {
    if (!sourceUri || Platform.OS !== "web") return;

    let destroyed = false;

    const init = async () => {
      try {
        const Hls = (await import("hls.js")).default;

        const videoEl = videoRef.current;
        if (!videoEl || destroyed) return;

        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }

        const isHls = sourceUri.includes(".m3u8") || sourceUri.includes("hls");

        if (isHls && Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            startLevel: -1,
          });

          hls.loadSource(sourceUri);
          hls.attachMedia(videoEl);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (destroyed) return;
            setReady(true);
            onBuffer?.({ isBuffering: false });
            onLoad?.({ duration: videoEl.duration || 0 });
            videoEl.play().catch(() => {});
          });

          hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
            if (destroyed) return;
            if (data.fatal) onError?.(data.details || "HLS playback error");
          });

          hls.on(Hls.Events.BUFFER_APPENDED, () => {
            if (!destroyed) onBuffer?.({ isBuffering: false });
          });

          hls.on(Hls.Events.BUFFER_APPENDING, () => {
            if (!destroyed) onBuffer?.({ isBuffering: true });
          });

          hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_e: any, data: any) => {
            if (destroyed) return;
            onAudioTracks?.(data.audioTracks.map((t: any, i: number) => ({
              index: i, language: t.lang || "", title: t.name || "", type: "audio",
            })));
          });

          hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_e: any, data: any) => {
            if (destroyed) return;
            onTextTracks?.(data.subtitleTracks.map((t: any, i: number) => ({
              index: i, language: t.lang || "", title: t.name || "", type: "text",
            })));
          });

          hls.on(Hls.Events.LEVEL_SWITCHED, () => {
            if (destroyed) return;
            const levels = hlsRef.current?.levels ?? [];
            onVideoTracks?.(levels.map((l: any, i: number) => ({
              index: i, width: l.width || 0, height: l.height || 0, bitrate: l.bitrate || 0, title: l.name || `${l.height || "?"}p`,
            })));
          });

          hlsRef.current = hls;
        } else if (videoEl.canPlayType("application/vnd.apple.mpegurl")) {
          videoEl.src = sourceUri;
          videoEl.addEventListener("loadedmetadata", () => {
            if (!destroyed) { setReady(true); onLoad?.({ duration: videoEl.duration || 0 }); videoEl.play().catch(() => {}); }
          }, { once: true });
        } else {
          videoEl.src = sourceUri;
          videoEl.addEventListener("loadedmetadata", () => {
            if (!destroyed) { setReady(true); onLoad?.({ duration: videoEl.duration || 0 }); videoEl.play().catch(() => {}); }
          }, { once: true });
        }
      } catch (err: any) {
        if (!destroyed) onError?.(err?.message || "Failed to initialize player");
      }
    };

    init();

    return () => {
      destroyed = true;
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [sourceUri]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || Platform.OS !== "web") return;
    if (paused) video.pause();
    else if (ready) video.play().catch(() => {});
  }, [paused, ready]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || Platform.OS !== "web") return;
    video.playbackRate = rate;
  }, [rate]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || Platform.OS !== "web") return;
    video.muted = muted;
  }, [muted]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const timer = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;
      onProgressRef.current?.({ currentTime: video.currentTime, playableDuration: video.buffered.length > 0 ? video.buffered.end(video.buffered.length - 1) : 0 });
    }, 250);
    progressTimerRef.current = timer;
    return () => { if (progressTimerRef.current) clearInterval(progressTimerRef.current); };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || Platform.OS !== "web") return;
    const handler = () => onEndRef.current?.();
    video.addEventListener("ended", handler);
    return () => video.removeEventListener("ended", handler);
  }, []);

  if (Platform.OS !== "web") return null;

  const objectFit = resizeMode === "cover" ? "cover" : resizeMode === "stretch" ? "fill" : "contain";

  return (
    <View style={[styles.container, style]}>
      <video
        ref={videoRef as any}
        style={{ width: "100%", height: "100%", objectFit, backgroundColor: "#000" }}
        playsInline
        controls={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
});
