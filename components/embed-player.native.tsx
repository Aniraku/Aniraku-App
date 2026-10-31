import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { WebView } from "react-native-webview";
import { embeddedPopupGuardScript, shouldAllowEmbedNavigation } from "@/lib/embed-navigation";

export function EmbedPlayer({ uri, headers, onError, onLoaded }: { uri: string; headers?: Record<string, string>; onError: () => void; onLoaded?: () => void }) {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
  }, [uri]);
  // Fallback: some embed pages never fire onLoadEnd (ads / redirects /
  // blocked subframes). Without this the opaque black loading veil stays
  // forever and looks like a "black overlay for no reason".
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setLoading(false), 8000);
    return () => clearTimeout(timer);
  }, [loading, uri]);
  const handleError = () => {
    setLoading(false);
    onError();
  };
  return <View style={styles.shell}>
    <WebView
      source={{ uri, headers }}
      style={styles.webview}
      // Security: only HTTPS navigation allowed (all provider embeds are HTTPS).
      // per-navigation requests are additionally gated by shouldAllowEmbedNavigation
      // which blocks known ad/tracking hosts. originWhitelist=["https://*"] lets the
      // WebView follow HTTPS redirects within the same provider domain; the RN-side
      // filter is the real gate, not a blanket allow-all.
      originWhitelist={["https://*"]}
      allowsFullscreenVideo
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      // Cookies/session required by provider embed players to authenticate playback.
      // WebView cookie jar is isolated from AsyncStorage/SecureStore — no app data leaks.
      javaScriptEnabled
      domStorageEnabled
      javaScriptCanOpenWindowsAutomatically={false}
      setSupportMultipleWindows={false}
      cacheEnabled
      cacheMode="LOAD_DEFAULT"
      thirdPartyCookiesEnabled
      sharedCookiesEnabled
      mixedContentMode="never"  // never load HTTP resources over HTTPS pages
      allowsProtectedMedia
      androidLayerType="hardware"
      userAgent="Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36"
      injectedJavaScriptBeforeContentLoaded={embeddedPopupGuardScript}
      onShouldStartLoadWithRequest={(request) => shouldAllowEmbedNavigation(request.url)}
      onLoadStart={() => setLoading(true)}
      onLoadEnd={() => { setLoading(false); onLoaded?.(); }}
      onError={handleError}
      onRenderProcessGone={handleError}
      onHttpError={() => setLoading(false)}
    />
    {loading ? <View style={[styles.loading, styles.pointerNone]} pointerEvents="none"><ActivityIndicator color="#F6F6F2" /><Text style={styles.loadingText}>OPENING EMBED PLAYER</Text></View> : null}
  </View>;
}

const styles = StyleSheet.create({
  // Absolute fill: the embed owns the whole video area. (An in-flow flex
  // shell split the area with the placeholder, leaving a permanent
  // "PREPARING VIDEO" panel under a squashed player that also stole touches.)
  shell: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000000" },
  webview: { flex: 1, backgroundColor: "#000000" },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#000000" },
  pointerNone: { pointerEvents: "none" },
  loadingText: { color: "#A2A2A0", fontSize: 11, fontWeight: "600", letterSpacing: 0.4 },
});
