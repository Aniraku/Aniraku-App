import { useEffect, useMemo, useState } from "react";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { supabase } from "@/lib/supabase";
import type { EmailOtpType } from "@supabase/supabase-js";
import { readCallbackValue, signUpVerificationNotice, verificationResentNotice } from "@/lib/auth-redirect";
import { AnirakuMark, DotLabel, NothingButton, NothingCard, nothing, Signal } from "@/components/nothing-ui";
import { NativeScreen } from "@/components/screen";

type Mode = "signIn" | "signUp" | "forgot" | "recovery";
type VerificationPending = { email: string; detail: string } | null;

export default function AuthScreen() {
  const params = useLocalSearchParams<{ mode?: string; code?: string; token_hash?: string; type?: string }>();
  const incomingUrl = Linking.useURL();
  const auth = useAnirakuAuth();
  const [mode, setMode] = useState<Mode>(params.mode === "recovery" ? "recovery" : "signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState<string | null>(params.mode === "confirmed" ? "Email verified. You can sign in now." : null);
  const [verificationPending, setVerificationPending] = useState<VerificationPending>(null);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [usernameState, setUsernameState] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const callbackQuery = useMemo(() => incomingUrl ? Linking.parse(incomingUrl).queryParams : undefined, [incomingUrl]);
  const callbackMode = readCallbackValue(params.mode || callbackQuery?.mode);
  const code = readCallbackValue(params.code || callbackQuery?.code);
  const tokenHash = readCallbackValue(params.token_hash || callbackQuery?.token_hash);
  const callbackType = readCallbackValue(params.type || callbackQuery?.type);

  useEffect(() => {
    const isRecovery = callbackMode === "recovery" || callbackType === "recovery";
    if (isRecovery) setMode("recovery");
    if (callbackMode === "confirmed" && !code && !tokenHash) {
      setMode("signIn");
      setMessage("Email verified. You can sign in now.");
    }
    if (!code && !tokenHash) return;
    setBusy(true);
    const callback = code
      ? supabase.auth.exchangeCodeForSession(code)
      : supabase.auth.verifyOtp({
        token_hash: tokenHash!,
        type: (callbackType === "recovery" ? "recovery" : callbackType === "signup" ? "signup" : "email") as EmailOtpType,
      });
    callback.then(({ error: exchangeError }) => {
      if (exchangeError) setError(isRecovery ? "This recovery link is invalid or has expired." : "This email-confirmation link is invalid or has expired. Request a new verification email.");
      else if (isRecovery) { setMode("recovery"); setMessage("Choose a new password for your account."); }
      else { setVerificationPending(null); setMode("signIn"); setMessage("Email verified. Signing you in to Aniraku."); }
    }).finally(() => setBusy(false));
  }, [callbackMode, callbackType, code, tokenHash]);

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
        await auth.signUp(email, password, username); setMode("signIn"); setPassword(""); setMessage(null); setVerificationPending({ email: email.trim(), detail: signUpVerificationNotice(email) }); return;
      }
      if (mode === "forgot") { await auth.sendRecovery(email); setMessage("A password-reset link has been sent if this email belongs to an account."); return; }
      await auth.updatePassword(password); setMessage("Password updated. You can continue to Aniraku."); setTimeout(() => router.replace("/(tabs)" as never), 600);
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Authentication could not be completed."); }
    finally { setBusy(false); }
  };
  const resendVerification = async () => {
    if (!verificationPending?.email) return;
    setResendingVerification(true); setError(null);
    try {
      await auth.resendVerification(verificationPending.email);
      setVerificationPending({ email: verificationPending.email, detail: verificationResentNotice(verificationPending.email) });
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : "Verification email could not be resent. Try again shortly.");
    } finally { setResendingVerification(false); }
  };
  const heading = mode === "signUp" ? "Create account" : mode === "forgot" ? "Recover access" : mode === "recovery" ? "New password" : "Sign in";
  const action = mode === "signUp" ? "Create account" : mode === "forgot" ? "Send recovery link" : mode === "recovery" ? "Update password" : "Sign in";
  const verificationView = verificationPending ? <NothingCard style={styles.verificationCard}><View style={styles.verificationMark}><AnirakuMark size={46} inverted /></View><DotLabel tone="muted">Email confirmation</DotLabel><Text style={styles.verificationTitle}>CONFIRM YOUR EMAIL</Text><Text style={styles.verificationLead}>{verificationPending.detail}</Text><View style={styles.steps}><Text style={styles.step}>01  OPEN THE EMAIL FROM ANIRAKU</Text><Text style={styles.step}>02  TAP CONFIRM EMAIL ADDRESS</Text><Text style={styles.step}>03  RETURN HERE TO SIGN IN</Text></View><Signal label="IF NEEDED, CHECK SPAM OR JUNK" tone="muted" />{error ? <Signal label={error} tone="signal" /> : null}<NothingButton label={resendingVerification ? "SENDING…" : "SEND ANOTHER EMAIL"} onPress={() => void resendVerification()} disabled={resendingVerification} /><NothingButton label="BACK TO SIGN IN" onPress={() => { setVerificationPending(null); setMessage("Once your email is confirmed, you can sign in."); }} variant="outline" /><Pressable onPress={() => { setVerificationPending(null); setMode("signUp"); }}><Text style={styles.changeEmail}>USE A DIFFERENT EMAIL</Text></Pressable></NothingCard> : null;
  return <NativeScreen scroll={false} style={styles.fill}><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}><View style={styles.top}><Pressable onPress={() => router.back()} accessibilityRole="button"><Text style={styles.close}>CLOSE</Text></Pressable><DotLabel>Aniraku ID / account</DotLabel></View><View style={styles.body}><Text style={styles.heading}>{verificationPending ? "Almost there" : heading}</Text><Text style={styles.lead}>{verificationPending ? "Confirm the email we sent to finish creating your account. You can sign in once it is confirmed." : mode === "signUp" ? "Create your Aniraku account. We will send a confirmation email before you sign in." : "Sign in with an email address that has already been confirmed."}</Text>{verificationView || <><NothingCard style={styles.form}>{mode === "signUp" ? <><TextInput value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="Username" placeholderTextColor={nothing.dim} style={styles.input} /><Text style={[styles.usernameState, usernameState === "taken" && styles.taken, usernameState === "available" && styles.available]}>{usernameState === "checking" ? "CHECKING USERNAME" : usernameState === "taken" ? "USERNAME TAKEN" : usernameState === "available" ? "USERNAME AVAILABLE" : "3–20 lowercase letters, numbers, underscores"}</Text></> : null}{mode !== "recovery" ? <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="Email" placeholderTextColor={nothing.dim} style={styles.input} /> : null}{mode !== "forgot" ? <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder={mode === "recovery" ? "New password" : "Password"} placeholderTextColor={nothing.dim} style={styles.input} /> : null}{error ? <Signal label={error} tone="signal" /> : null}{message ? <Signal label={message} tone="live" /> : null}{busy ? <ActivityIndicator color={nothing.white} /> : <NothingButton label={action} onPress={() => void submit()} disabled={mode === "signUp" && usernameState === "checking"} />}</NothingCard><View style={styles.switches}>{mode === "signIn" ? <><Pressable onPress={() => setMode("forgot")}><Text style={styles.link}>Forgot password?</Text></Pressable><Pressable onPress={() => setMode("signUp")}><Text style={styles.link}>Create account</Text></Pressable></> : <Pressable onPress={() => setMode("signIn")}><Text style={styles.link}>Back to sign in</Text></Pressable>}</View></>}</View></KeyboardAvoidingView></NativeScreen>;
}

const styles = StyleSheet.create({ fill: { flex: 1 }, top: { minHeight: 70, paddingHorizontal: 20, alignItems: "flex-start", justifyContent: "center", gap: 10 }, close: { color: nothing.muted, fontFamily: "monospace", fontWeight: "800", fontSize: 11, letterSpacing: 1.4 }, body: { flex: 1, justifyContent: "center", paddingHorizontal: 20, gap: 18 }, heading: { color: nothing.white, fontSize: 34, fontWeight: "900", letterSpacing: -1 }, lead: { color: nothing.muted, fontSize: 14, lineHeight: 21 }, form: { padding: 16, gap: 12 }, input: { minHeight: 52, color: nothing.white, borderBottomWidth: 1, borderBottomColor: nothing.line, fontSize: 16 }, usernameState: { color: nothing.dim, fontFamily: "monospace", fontSize: 9, letterSpacing: 0.5 }, available: { color: nothing.green }, taken: { color: nothing.red }, switches: { flexDirection: "row", justifyContent: "space-between" }, link: { color: nothing.white, fontFamily: "monospace", fontWeight: "700", fontSize: 11, letterSpacing: 0.6 }, verificationCard: { padding: 20, gap: 15, borderColor: "rgba(255,77,77,0.45)" }, verificationMark: { alignItems: "flex-start" }, verificationTitle: { color: nothing.white, fontFamily: "monospace", fontSize: 20, fontWeight: "900", letterSpacing: 0.4 }, verificationLead: { color: nothing.muted, fontSize: 14, lineHeight: 21 }, steps: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: nothing.line, paddingVertical: 12, gap: 8 }, step: { color: nothing.white, fontFamily: "monospace", fontSize: 10, fontWeight: "700", letterSpacing: 0.35 }, changeEmail: { color: nothing.muted, fontFamily: "monospace", fontSize: 10, fontWeight: "800", letterSpacing: 0.7, textAlign: "center" }, });
