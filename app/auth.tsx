import { useEffect, useMemo, useRef, useState } from "react";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Animated, AppState, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { supabase } from "@/lib/supabase";
import type { EmailOtpType } from "@supabase/supabase-js";
import { readCallbackValue, signUpVerificationNotice, verificationResentNotice } from "@/lib/auth-redirect";
import { emailProblemOrTypo } from "@/lib/auth-validation";
import { APP_CONFIG } from "@/lib/app-config";
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
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  // "Check your mail" confirmation — the last look at the address before the
  // verification mail (and the account) exists.
  const [confirmingEmail, setConfirmingEmail] = useState(false);
  const confirmEnter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!confirmingEmail) return;
    confirmEnter.setValue(0);
    Animated.timing(confirmEnter, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [confirmingEmail, confirmEnter]);
  const [resendCooldown, setResendCooldown] = useState(0);
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

  const cooldownActive = resendCooldown > 0;
  // PUBLIC verify-email API (api.aniraku.tech edge function): warns before
  // submit when the email is malformed for delivery or already registered.
  const [emailCheck, setEmailCheck] = useState<{ state: "checking" | "ok" | "invalid" | "exists" | "no-mx" | "no-mailbox"; hint: string } | null>(null);
  useEffect(() => {
    if (mode !== "signUp" || email.length < 6 || !email.includes("@") || emailProblemOrTypo(email)) { setEmailCheck(null); return; }
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const base = (APP_CONFIG.supabaseUrl || "").replace(/\/+$/, "");
          const res = await fetch(`${base}/functions/v1/verify-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email.trim() }),
          });
          if (!res.ok) { setEmailCheck(null); return; }
          const data = await res.json();
          if (data.exists) setEmailCheck({ state: "exists", hint: "This email is already registered — switch to SIGN IN." });
          else if (data.valid === false && data.reason === "format") setEmailCheck({ state: "invalid", hint: "That email address doesn't look right." });
          else if (data.valid === false) setEmailCheck({ state: "no-mx", hint: "This email domain can't receive mail — check for typos." });
          else if (data.deliverable === false) setEmailCheck({ state: "no-mailbox", hint: "This mailbox doesn't exist — the address can't receive mail. Check for typos." });
          else if (data.suggestion) setEmailCheck({ state: "invalid", hint: `Did you mean ${data.suggestion}?` });
          else setEmailCheck({ state: "ok", hint: "" });
        } catch { setEmailCheck(null); }
      })();
    }, 700);
    return () => clearTimeout(timer);
  }, [mode, email]);

  // Users who confirm through the web link (the email may open the browser
  // instead of the app) come back with the account already confirmed — retry
  // the sign-in silently the moment they return to the app.
  useEffect(() => {
    if (!verificationPending?.email || !email || !password) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" || busy) return;
      void (async () => {
        try {
          setBusy(true);
          await auth.signIn(verificationPending.email, password);
          setVerificationPending(null);
          setMessage("Email verified. Signing you in to Aniraku.");
        } catch { /* still unconfirmed — keep waiting */ }
        finally { setBusy(false); }
      })();
    });
    return () => sub.remove();
  }, [verificationPending?.email, email, password, busy, auth]);
  useEffect(() => {
    if (!cooldownActive) return;
    const timer = setInterval(() => setResendCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldownActive]);

  /** The actual account creation — runs only after the user confirms their
   *  email address in the check-your-mail dialog. */
  const finishSignUp = async () => {
    setBusy(true); setError(null); setMessage(null);
    try {
      await auth.signUp(email, password, username);
      setMode("signIn"); setPassword(""); setMessage(null);
      setVerificationPending({ email: email.trim(), detail: signUpVerificationNotice(email) });
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Authentication could not be completed."); }
    finally { setBusy(false); }
  };

  const submit = async () => {
    setError(null); setMessage(null);
    try {
      if (mode === "signIn") { setBusy(true); await auth.signIn(email, password); router.replace("/(tabs)" as never); return; }
      if (mode === "signUp") {
        const emailProblem = emailProblemOrTypo(email);
        if (emailProblem) throw new Error(emailProblem);
        if (emailCheck?.state === "exists") throw new Error("This email is already registered — switch to SIGN IN.");
        if (emailCheck?.state === "no-mx") throw new Error("This email domain can't receive mail — double-check the address.");
        // Mailbox-level verdict (verify-email edge function + a configured
        // verification provider): a confirmed missing mailbox would burn a
        // Supabase confirmation email for nothing — block before submit.
        if (emailCheck?.state === "no-mailbox") throw new Error("This mailbox doesn't exist — the address can't receive the verification email. Double-check it.");
        if (!acceptedTerms) throw new Error("Accept the Terms and Privacy policy to continue.");
        if (!/^[a-z0-9_]{3,20}$/.test(username.trim().toLowerCase())) throw new Error("Use 3–20 lowercase letters, numbers, or underscores for your username.");
        if (usernameState === "taken") throw new Error("That username is already in use.");
        // Last-chance check before the account exists: a mistyped address
        // means the verification mail never arrives and the signup dead-ends.
        setConfirmingEmail(true);
        return;
      }
      if (mode === "forgot") { const emailProblem = emailProblemOrTypo(email); if (emailProblem) throw new Error(emailProblem); setBusy(true); await auth.sendRecovery(email); setMessage("A password-reset link has been sent if this email belongs to an account."); return; }
      setBusy(true); await auth.updatePassword(password); setMessage("Password updated. You can continue to Aniraku."); setTimeout(() => router.replace("/(tabs)" as never), 600);
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Authentication could not be completed."); }
    finally { setBusy(false); }
  };
  const resendVerification = async () => {
    if (!verificationPending?.email || resendCooldown > 0) return;
    setResendingVerification(true); setError(null);
    try {
      await auth.resendVerification(verificationPending.email);
      setResendCooldown(60);
      setVerificationPending({ email: verificationPending.email, detail: verificationResentNotice(verificationPending.email) });
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : "Verification email could not be resent. Try again shortly.");
    } finally { setResendingVerification(false); }
  };
  const heading = mode === "signUp" ? "Create account" : mode === "forgot" ? "Recover access" : mode === "recovery" ? "New password" : "Sign in";
  const action = mode === "signUp" ? "Create account" : mode === "forgot" ? "Send recovery link" : mode === "recovery" ? "Update password" : "Sign in";
  const verificationView = verificationPending ? <NothingCard style={styles.verificationCard}><View style={styles.verificationMark}><AnirakuMark size={46} inverted /></View><DotLabel tone="muted">Email confirmation</DotLabel><Text style={styles.verificationTitle}>CONFIRM YOUR EMAIL</Text><Text style={styles.verificationLead}>{verificationPending.detail}</Text><View style={styles.steps}><Text style={styles.step}>01  OPEN THE EMAIL FROM ANIRAKU</Text><Text style={styles.step}>02  TAP CONFIRM EMAIL ADDRESS</Text><Text style={styles.step}>03  RETURN HERE TO SIGN IN</Text></View><Signal label="IF NEEDED, CHECK SPAM OR JUNK" tone="muted" />{error ? <Signal label={error} tone="signal" /> : null}<NothingButton label={resendingVerification ? "SENDING…" : resendCooldown > 0 ? `RESEND IN ${resendCooldown}s` : "SEND ANOTHER EMAIL"} onPress={() => void resendVerification()} disabled={resendingVerification || resendCooldown > 0} /><NothingButton label="BACK TO SIGN IN" onPress={() => { setVerificationPending(null); setMessage("Once your email is confirmed, you can sign in."); }} variant="outline" /><Pressable onPress={() => { setVerificationPending(null); setMode("signUp"); }}><Text style={styles.changeEmail}>USE A DIFFERENT EMAIL</Text></Pressable></NothingCard> : null;
  return <NativeScreen scroll={false} style={styles.fill}><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}><View style={styles.top}><Pressable onPress={() => router.back()} accessibilityRole="button"><Text style={styles.close}>CLOSE</Text></Pressable><DotLabel>Aniraku ID / account</DotLabel></View><View style={styles.body}><Text style={styles.heading}>{verificationPending ? "Almost there" : heading}</Text><Text style={styles.lead}>{verificationPending ? "Confirm the email we sent to finish creating your account. You can sign in once it is confirmed." : mode === "signUp" ? "Create your Aniraku account. We will send a confirmation email before you sign in." : "Sign in with an email address that has already been confirmed."}</Text>{verificationView || <><NothingCard style={styles.form}>{mode === "signUp" ? <><TextInput value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="Username" placeholderTextColor={nothing.dim} style={styles.input} /><Text style={[styles.usernameState, usernameState === "taken" && styles.taken, usernameState === "available" && styles.available]}>{usernameState === "checking" ? "CHECKING USERNAME" : usernameState === "taken" ? "USERNAME TAKEN" : usernameState === "available" ? "USERNAME AVAILABLE" : "3–20 lowercase letters, numbers, underscores"}</Text></> : null}{mode !== "recovery" ? <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="Email" placeholderTextColor={nothing.dim} style={styles.input} /> : null}{mode === "signUp" && emailCheck && emailCheck.hint ? <Text style={[styles.usernameState, (emailCheck.state === "exists" || emailCheck.state === "no-mailbox") && styles.taken, emailCheck.state === "ok" && styles.available]}>{emailCheck.hint.toUpperCase()}</Text> : null}{mode !== "forgot" ? <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder={mode === "recovery" ? "New password" : "Password"} placeholderTextColor={nothing.dim} style={styles.input} /> : null}{mode === "signUp" ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: acceptedTerms }} accessibilityLabel="Accept the Terms and Privacy policy" accessibilityHint="Toggles agreement; the Terms open via the link" onPress={() => setAcceptedTerms((value) => !value)} style={({ pressed }) => [styles.termsRow, pressed && styles.termsRowPressed]}><View style={[styles.termsBox, acceptedTerms && styles.termsBoxChecked]}>{acceptedTerms ? <View style={styles.termsBoxFill} /> : null}</View><Text style={styles.termsText}>I agree to the <Pressable onPress={(event) => { event.stopPropagation(); router.push("/legal" as never); }} accessibilityRole="link" hitSlop={8}><Text style={styles.termsLink}>Terms and Privacy policy</Text></Pressable>.</Text></Pressable> : null}{error ? <Signal label={error} tone="signal" /> : null}{message ? <Signal label={message} tone="live" /> : null}{busy ? <ActivityIndicator color={nothing.white} /> : <NothingButton label={action} onPress={() => void submit()} disabled={mode === "signUp" && usernameState === "checking"} />}</NothingCard><View style={styles.switches}>{mode === "signIn" ? <><Pressable onPress={() => setMode("forgot")}><Text style={styles.link}>Forgot password?</Text></Pressable><Pressable onPress={() => setMode("signUp")}><Text style={styles.link}>Create account</Text></Pressable></> : <Pressable onPress={() => setMode("signIn")}><Text style={styles.link}>Back to sign in</Text></Pressable>}</View></>}</View></KeyboardAvoidingView>{/* ── "Check your mail" — last look at the address before the account exists ── */}
      <Modal visible={confirmingEmail} transparent animationType="fade" onRequestClose={() => setConfirmingEmail(false)}>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss email confirmation" style={styles.confirmBackdrop} onPress={() => setConfirmingEmail(false)}>
          <Animated.View accessibilityViewIsModal style={[styles.confirmCard, { opacity: confirmEnter, transform: [{ translateY: confirmEnter.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }] }]}>
            <DotLabel tone="live">CHECK YOUR MAIL</DotLabel>
            <Text style={styles.confirmTitle}>Is this email correct?</Text>
            <View style={styles.confirmEmailBox}><Text selectable style={styles.confirmEmail}>{email.trim()}</Text></View>
            <Text style={styles.confirmCopy}>The verification link goes to exactly this address. Aniraku cannot see typos — the mail goes wherever this says.</Text>
            <View style={styles.confirmWarn}>
              <Text style={styles.confirmWarnText}>WRONG ADDRESS = THE MAIL NEVER ARRIVES. THE ACCOUNT STAYS UNCONFIRMED AND YOU CANNOT SIGN IN.</Text>
            </View>
            <NothingButton label="CORRECT — SEND IT" onPress={() => { setConfirmingEmail(false); void finishSignUp(); }} />
            <NothingButton label="LET ME FIX IT" variant="outline" onPress={() => setConfirmingEmail(false)} />
          </Animated.View>
        </Pressable>
      </Modal>
    </NativeScreen>;
}

const styles = StyleSheet.create({ fill: { flex: 1 }, top: { minHeight: 70, paddingHorizontal: 20, alignItems: "flex-start", justifyContent: "center", gap: 10 }, close: { color: nothing.muted, fontWeight: "800", fontSize: 11, letterSpacing: 1 }, body: { flex: 1, justifyContent: "center", paddingHorizontal: 20, gap: 18 }, heading: { color: nothing.white, fontSize: 34, fontWeight: "900", letterSpacing: -1 }, lead: { color: nothing.muted, fontSize: 14, lineHeight: 21 }, form: { padding: 16, gap: 12 }, input: { minHeight: 52, color: nothing.white, borderBottomWidth: 1, borderBottomColor: nothing.line, fontSize: 16 }, usernameState: { color: nothing.dim, fontSize: 10, letterSpacing: 0.5 }, available: { color: nothing.green }, taken: { color: nothing.red }, switches: { flexDirection: "row", justifyContent: "space-between" }, link: { color: nothing.white, fontWeight: "700", fontSize: 11, letterSpacing: 0.6 }, verificationCard: { padding: 20, gap: 15, borderColor: "rgba(255,77,77,0.45)" }, verificationMark: { alignItems: "flex-start" }, verificationTitle: { color: nothing.white, fontSize: 20, fontWeight: "900", letterSpacing: 0.4 }, verificationLead: { color: nothing.muted, fontSize: 14, lineHeight: 21 }, steps: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: nothing.line, paddingVertical: 12, gap: 8 }, step: { color: nothing.white, fontSize: 10, fontWeight: "700", letterSpacing: 0.35 }, changeEmail: { color: nothing.muted, fontSize: 10, fontWeight: "800", letterSpacing: 0.7, textAlign: "center" }, termsRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 4, borderRadius: 8 }, termsRowPressed: { backgroundColor: nothing.raised }, termsBox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: nothing.line, alignItems: "center", justifyContent: "center" }, termsBoxChecked: { borderColor: nothing.red }, termsBoxFill: { width: 10, height: 10, borderRadius: 2.5, backgroundColor: nothing.red }, termsText: { flex: 1, color: nothing.muted, fontSize: 12, lineHeight: 17, letterSpacing: 0.2 }, termsLink: { color: nothing.white, fontWeight: "800", textDecorationLine: "underline" }, confirmBackdrop: { flex: 1, padding: 24, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.78)" }, confirmCard: { gap: 13, padding: 18, borderRadius: 12, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.surface }, confirmTitle: { color: nothing.white, fontSize: 19, fontWeight: "900", letterSpacing: -0.3 }, confirmEmailBox: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,77,77,0.4)", backgroundColor: nothing.raised }, confirmEmail: { color: nothing.white, fontFamily: nothing.mono, fontSize: 13.5, fontWeight: "700" }, confirmCopy: { color: nothing.muted, fontSize: 12.5, lineHeight: 18 }, confirmWarn: { borderLeftWidth: 2, borderLeftColor: nothing.red, paddingLeft: 10, paddingVertical: 2 }, confirmWarnText: { color: nothing.red, fontSize: 10.5, fontWeight: "800", letterSpacing: 0.4, lineHeight: 15 }, });
