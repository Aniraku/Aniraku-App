import { useEffect, useMemo, useState } from "react";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { supabase } from "@/lib/supabase";
import { DotLabel, NothingButton, NothingCard, nothing, Signal } from "@/components/nothing-ui";
import { NativeScreen } from "@/components/screen";

type Mode = "signIn" | "signUp" | "forgot" | "recovery";

export default function AuthScreen() {
  const params = useLocalSearchParams<{ mode?: string; code?: string }>();
  const incomingUrl = Linking.useURL();
  const auth = useAnirakuAuth();
  const [mode, setMode] = useState<Mode>(params.mode === "recovery" ? "recovery" : "signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState<string | null>(params.mode === "confirmed" ? "Email confirmed. You can sign in now." : null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [usernameState, setUsernameState] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const code = useMemo(() => params.code || (incomingUrl ? Linking.parse(incomingUrl).queryParams?.code : undefined), [incomingUrl, params.code]);

  useEffect(() => {
    if (params.mode === "recovery") setMode("recovery");
    if (!code) return;
    setBusy(true);
    supabase.auth.exchangeCodeForSession(Array.isArray(code) ? code[0] : code).then(({ error: exchangeError }) => {
      if (exchangeError) setError("This recovery link is invalid or has expired.");
      else { setMode("recovery"); setMessage("Choose a new password for your account."); }
    }).finally(() => setBusy(false));
  }, [code, params.mode]);

  useEffect(() => {
    const value = username.trim().toLowerCase();
    if (mode !== "signUp" || value.length < 3) { setUsernameState("idle"); return; }
    const handle = setTimeout(() => {
      setUsernameState("checking");
      supabase.from("profiles").select("id", { head: true, count: "exact" }).eq("username", value).then(({ count, error: usernameError }) => setUsernameState(usernameError ? "idle" : count ? "taken" : "available"));
    }, 350);
    return () => clearTimeout(handle);
  }, [mode, username]);

  useEffect(() => { if (auth.user && mode !== "recovery") router.replace("/(tabs)" as never); }, [auth.user, mode]);

  const submit = async () => {
    setBusy(true); setError(null); setMessage(null);
    try {
      if (mode === "signIn") { await auth.signIn(email, password); router.replace("/(tabs)" as never); return; }
      if (mode === "signUp") {
        if (!/^[a-z0-9_]{3,20}$/.test(username.trim().toLowerCase())) throw new Error("Use 3–20 lowercase letters, numbers, or underscores for your username.");
        if (usernameState === "taken") throw new Error("That username is already in use.");
        await auth.signUp(email, password, username); setMode("signIn"); setPassword(""); setMessage("Check your email and verify your account before signing in."); return;
      }
      if (mode === "forgot") { await auth.sendRecovery(email); setMessage("A password-reset link has been sent if this email belongs to an account."); return; }
      await auth.updatePassword(password); setMessage("Password updated. You can continue to Aniraku."); setTimeout(() => router.replace("/(tabs)" as never), 600);
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Authentication could not be completed."); }
    finally { setBusy(false); }
  };
  const heading = mode === "signUp" ? "Create account" : mode === "forgot" ? "Recover access" : mode === "recovery" ? "New password" : "Sign in";
  const action = mode === "signUp" ? "Create verified account" : mode === "forgot" ? "Send recovery link" : mode === "recovery" ? "Update password" : "Sign in";
  return <NativeScreen scroll={false} style={styles.fill}><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}><View style={styles.top}><Pressable onPress={() => router.back()} accessibilityRole="button"><Text style={styles.close}>CLOSE</Text></Pressable><DotLabel>Aniraku ID / secure</DotLabel></View><View style={styles.body}><Text style={styles.heading}>{heading}</Text><Text style={styles.lead}>{mode === "signUp" ? "Verification is required before library synchronization becomes available." : "Your session is encrypted in native secure storage on this device."}</Text><NothingCard style={styles.form}>{mode === "signUp" ? <><TextInput value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="Username" placeholderTextColor={nothing.dim} style={styles.input} /><Text style={[styles.usernameState, usernameState === "taken" && styles.taken, usernameState === "available" && styles.available]}>{usernameState === "checking" ? "CHECKING USERNAME" : usernameState === "taken" ? "USERNAME TAKEN" : usernameState === "available" ? "USERNAME AVAILABLE" : "3–20 lowercase letters, numbers, underscores"}</Text></> : null}{mode !== "recovery" ? <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="Email" placeholderTextColor={nothing.dim} style={styles.input} /> : null}{mode !== "forgot" ? <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder={mode === "recovery" ? "New password" : "Password"} placeholderTextColor={nothing.dim} style={styles.input} /> : null}{error ? <Signal label={error} tone="signal" /> : null}{message ? <Signal label={message} tone="live" /> : null}{busy ? <ActivityIndicator color={nothing.white} /> : <NothingButton label={action} onPress={() => void submit()} disabled={mode === "signUp" && usernameState === "checking"} />}</NothingCard><View style={styles.switches}>{mode === "signIn" ? <><Pressable onPress={() => setMode("forgot")}><Text style={styles.link}>Forgot password?</Text></Pressable><Pressable onPress={() => setMode("signUp")}><Text style={styles.link}>Create account</Text></Pressable></> : <Pressable onPress={() => setMode("signIn")}><Text style={styles.link}>Back to sign in</Text></Pressable>}</View></View></KeyboardAvoidingView></NativeScreen>;
}

const styles = StyleSheet.create({ fill: { flex: 1 }, top: { minHeight: 70, paddingHorizontal: 20, alignItems: "flex-start", justifyContent: "center", gap: 10 }, close: { color: nothing.muted, fontFamily: "monospace", fontWeight: "800", fontSize: 11, letterSpacing: 1.4 }, body: { flex: 1, justifyContent: "center", paddingHorizontal: 20, gap: 18 }, heading: { color: nothing.white, fontSize: 34, fontWeight: "900", letterSpacing: -1 }, lead: { color: nothing.muted, fontSize: 14, lineHeight: 21 }, form: { padding: 16, gap: 12 }, input: { minHeight: 52, color: nothing.white, borderBottomWidth: 1, borderBottomColor: nothing.line, fontSize: 16 }, usernameState: { color: nothing.dim, fontFamily: "monospace", fontSize: 9, letterSpacing: 0.5 }, available: { color: nothing.green }, taken: { color: nothing.red }, switches: { flexDirection: "row", justifyContent: "space-between" }, link: { color: nothing.white, fontFamily: "monospace", fontWeight: "700", fontSize: 11, letterSpacing: 0.6 }, });
