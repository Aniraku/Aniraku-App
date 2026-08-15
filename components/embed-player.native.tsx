import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { WebView } from "react-native-webview";

export function EmbedPlayer({ uri, headers, onError }: { uri: string; headers?: Record<string, string>; onError: () => void }) {
  const [loading, setLoading] = useState(true);
  return <View style={styles.shell}>
    <WebView
      source={{ uri, headers }}
      style={styles.webview}
      originWhitelist={["*"]}
      allowsFullscreenVideo
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      javaScriptEnabled
      domStorageEnabled
      javaScriptCanOpenWindowsAutomatically
      setSupportMultipleWindows={false}
      cacheEnabled
      cacheMode="LOAD_DEFAULT"
      thirdPartyCookiesEnabled
      sharedCookiesEnabled
      mixedContentMode="always"
      allowsProtectedMedia
      androidLayerType="hardware"
      userAgent="Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36"
      injectedJavaScriptBeforeContentLoaded="window.open = function(url) { window.location.assign(url); }; true;"
      onShouldStartLoadWithRequest={() => true}
      onLoadStart={() => setLoading(true)}
      onLoadEnd={() => setLoading(false)}
      onError={onError}
      onRenderProcessGone={onError}
    />
    {loading ? <View pointerEvents="none" style={styles.loading}><ActivityIndicator color="#F6F6F2" /><Text style={styles.loadingText}>OPENING EMBED PLAYER</Text></View> : null}
  </View>;
}

const styles = StyleSheet.create({ shell: { flex: 1, backgroundColor: "#000000" }, webview: { flex: 1, backgroundColor: "#000000" }, loading: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#000000" }, loadingText: { color: "#A2A2A0", fontFamily: "monospace", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 } });
