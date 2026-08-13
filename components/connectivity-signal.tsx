import * as Network from "expo-network";
import { StyleSheet, Text, View } from "react-native";
import { nothing } from "@/components/nothing-ui";

export function ConnectivitySignal() {
  const state = Network.useNetworkState();
  if (state.isInternetReachable !== false) return null;
  return <View pointerEvents="none" style={styles.banner}><Text style={styles.text}>OFFLINE · LIVE DATA WILL RETRY WHEN CONNECTED</Text></View>;
}

const styles = StyleSheet.create({ banner: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, minHeight: 28, justifyContent: "center", alignItems: "center", backgroundColor: nothing.red }, text: { color: nothing.black, fontFamily: "monospace", fontSize: 9, fontWeight: "900", letterSpacing: 0.6 } });
