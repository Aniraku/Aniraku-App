import { useEffect, useMemo, useRef, useState } from "react";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { Animated, AppState, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { supabase } from "@/lib/supabase";
import type { EmailOtpType } from "@supabase/supabase-js";
import { readCallbackValue, signUpVerificationNotice, verificationResentNotice } from "@/lib/auth-redirect";
import { emailProblemOrTypo } from "@/lib/auth-validation";
import { APP_CONFIG } from "@/lib/app-config";
import { AnirakuMark, DotLabel, NothingButton, NothingCard, nothing, Signal } from "@/components/nothing-ui";
import { AppIcon } from "@/components/app-icon";
import { NativeScreen } from "@/components/screen";

type Mode = "signIn" | "signUp" | "forgot" | "recovery";

/** One copy source per mode — heading, lead, action and busy label stay in step. */
const MODE_COPY: Record<Mode, { heading: string; lead: string; action: string; busy: string }> = {
  signIn: { heading: "Sign in", lead: "Your favorites, progress and preferences — on every device.", action: "Sign in", busy: "Signing in…" },
  signUp: { heading: "Create account", lead: "One account for your library, watchlist and alerts.", action: "Create account", busy: "Creating account…" },
  forgot: { heading: "Recover access", lead: "We'll email you a link to set a new password.", action: "Send recovery link", busy: "Sending…" },
  recovery: { heading: "New password", lead: "Set a new password for your account.", action: "Update password", busy: "Updating password…" },
};
type VerificationPending = { email: string; detail: string } | null;
type EmailCheck = { state: "checking" | "ok" | "invalid" | "exists" | "no-mx" | "no-mailbox"; hint: string; suggestion?: string } | null;
type UsernameState = "idle" | "checking" | "available" | "taken";
type FocusedField = "username" | "email" | "password" | null;

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
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<FocusedField>(null);
  const emailInputRef = useRef<TextInput | null>(null);
  const passwordInputRef = useRef<TextInput | null>(null);
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
  const signUpInFlight = useRef(false);
  const [usernameState, setUsernameState] = useState<UsernameState>("idle");
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
  const [emailCheck, setEmailCheck] = useState<EmailCheck>(null);
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
          if (data.exists) setEmailCheck({ state: "exists", hint: "This email is already registered." });
          else if (data.valid === false && data.reason === "format") setEmailCheck({ state: "invalid", hint: "That email address doesn't look right." });
          else if (data.valid === false) setEmailCheck({ state: "no-mx", hint: "This email domain can't receive mail — check for typos." });
          else if (data.deliverable === false) setEmailCheck({ state: "no-mailbox", hint: "This mailbox doesn't exist — the address can't receive mail. Check for typos." });
          else if (data.suggestion) setEmailCheck({ state: "invalid", hint: "Did you mean", suggestion: String(data.suggestion) });
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

  /** Switch modes without dragging the previous mode's status along. */
  const switchMode = (next: Mode) => {
    setError(null);
    setMessage(null);
    setShowPassword(false);
    setMode(next);
  };

  /** The actual account creation — runs only after the user confirms their
   *  email address in the check-your-mail dialog. */
  const finishSignUp = async () => {
    if (signUpInFlight.current) return;
    signUpInFlight.current = true;
    setBusy(true); setError(null); setMessage(null);
    try {
      const signupEmail = email.trim();
      const signupUsername = username.trim().toLowerCase();
      await auth.signUp(signupEmail, password, signupUsername);
      setMode("signIn"); setPassword(""); setMessage(null);
      setVerificationPending({ email: signupEmail, detail: signUpVerificationNotice(signupEmail) });
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Authentication could not be completed."); }
    finally { signUpInFlight.current = false; setBusy(false); }
  };

  const submit = async () => {
    if (busy) return;
    setError(null); setMessage(null);
    try {
      if (mode === "signIn") {
        const signInEmail = email.trim();
        if (!signInEmail) throw new Error("Enter your email address.");
        if (!password) throw new Error("Enter your password.");
        setBusy(true); await auth.signIn(signInEmail, password); router.replace("/(tabs)" as never); return;
      }
      if (mode === "signUp") {
        if (usernameState === "checking") throw new Error("Checking username availability…");
        const emailProblem = emailProblemOrTypo(email);
        if (emailProblem) throw new Error(emailProblem);
        if (emailCheck?.state === "exists") throw new Error("This email is already registered. Switch to sign in instead.");
        if (emailCheck?.state === "no-mx") throw new Error("This email domain can't receive mail — double-check the address.");
        // Mailbox-level verdict (verify-email edge function + a configured
        // verification provider): a confirmed missing mailbox would burn a
        // Supabase confirmation email for nothing — block before submit.
        if (emailCheck?.state === "no-mailbox") throw new Error("This mailbox doesn't exist — the address can't receive the verification email. Double-check it.");
        if (!username.trim()) throw new Error("Choose a username.");
        if (!password) throw new Error("Create a password.");
        if (!acceptedTerms) throw new Error("Accept the Terms and Privacy policy to continue.");
        if (!/^[a-z0-9_]{3,20}$/.test(username.trim().toLowerCase())) throw new Error("Use 3–20 lowercase letters, numbers, or underscores for your username.");
        if (usernameState === "taken") throw new Error("That username is already in use.");
        // Last-chance check before the account exists: a mistyped address
        // means the verification mail never arrives and the signup dead-ends.
        setConfirmingEmail(true);
        return;
      }
      if (mode === "forgot") { const emailProblem = emailProblemOrTypo(email); if (emailProblem) throw new Error(emailProblem); setBusy(true); await auth.sendRecovery(email.trim()); setMessage("A password-reset link has been sent if this email belongs to an account."); return; }
      if (!password) throw new Error("Enter a new password.");
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
  const copy = MODE_COPY[mode];
  const heading = verificationPending ? "Check your email" : copy.heading;
  const lead = verificationPending ? verificationPending.detail : copy.lead;
  const action = copy.action;
  const busyAction = copy.busy;

  const usernameField = mode === "signUp" ? (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>Username</Text>
      <TextInput
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        placeholder="e.g. kira_watches"
        placeholderTextColor={nothing.placeholder}
        onFocus={() => setFocusedField("username")}
        onBlur={() => setFocusedField(null)}
        onSubmitEditing={() => emailInputRef.current?.focus()}
        returnKeyType="next"
        accessibilityLabel="Username"
        style={[styles.input, focusedField === "username" && styles.inputFocused]}
      />
      <Signal
        label={usernameState === "checking" ? "Checking availability…" : usernameState === "taken" ? "That username is taken." : usernameState === "available" ? "That username is available." : "3–20 lowercase letters, numbers, or underscores."}
        tone={usernameState === "taken" ? "signal" : usernameState === "available" ? "positive" : "muted"}
      />
    </View>
  ) : null;

  const emailField = mode !== "recovery" ? (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>Email</Text>
      <TextInput
        ref={emailInputRef}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        placeholder="you@example.com"
        placeholderTextColor={nothing.placeholder}
        onFocus={() => setFocusedField("email")}
        onBlur={() => setFocusedField(null)}
        onSubmitEditing={() => { if (mode === "forgot") void submit(); else passwordInputRef.current?.focus(); }}
        returnKeyType={mode === "forgot" ? "send" : "next"}
        accessibilityLabel="Email address"
        style={[styles.input, focusedField === "email" && styles.inputFocused]}
      />
      {emailCheck && emailCheck.state !== "ok" && emailCheck.state !== "checking" ? (
        emailCheck.state === "exists" ? (
          <View style={styles.hintRow}>
            <Signal label="This email is already registered." tone="signal" />
            <Pressable accessibilityRole="button" onPress={() => switchMode("signIn")} hitSlop={6} style={({ pressed }) => [styles.hintAction, pressed && styles.pressedSubtle]}>
              <Text style={styles.hintActionText}>Sign in instead</Text>
            </Pressable>
          </View>
        ) : emailCheck.suggestion ? (
          <View style={styles.suggestionRow}>
            <Text style={styles.statusMutedText}>Did you mean </Text>
            <Pressable accessibilityRole="button" onPress={() => { if (emailCheck.suggestion) setEmail(emailCheck.suggestion); }} hitSlop={4}>
              <Text style={styles.suggestionLink}>{emailCheck.suggestion}</Text>
            </Pressable>
            <Text style={styles.statusMutedText}>?</Text>
          </View>
        ) : (
          <Signal label={emailCheck.hint} tone="signal" />
        )
      ) : null}
    </View>
  ) : null;

  const passwordField = mode !== "forgot" ? (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{mode === "recovery" ? "New password" : "Password"}</Text>
      <View style={[styles.inputRow, focusedField === "password" && styles.inputFocused]}>
        <TextInput
          ref={passwordInputRef}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoComplete={mode === "signUp" ? "new-password" : "password"}
          textContentType={mode === "signUp" ? "newPassword" : "password"}
          placeholder="••••••••"
          placeholderTextColor={nothing.placeholder}
          onFocus={() => setFocusedField("password")}
          onBlur={() => setFocusedField(null)}
          onSubmitEditing={() => void submit()}
          returnKeyType={mode === "recovery" ? "done" : "go"}
          accessibilityLabel={mode === "recovery" ? "New password" : "Password"}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showPassword ? "Hide password" : "Show password"}
          onPress={() => setShowPassword((value) => !value)}
          hitSlop={6}
          style={({ pressed }) => [styles.eyeButton, pressed && styles.pressedSubtle]}
        >
          <AppIcon name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color={nothing.muted} />
        </Pressable>
      </View>
    </View>
  ) : null;

  const termsField = mode === "signUp" ? (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: acceptedTerms }}
      accessibilityLabel="Accept the Terms and Privacy policy"
      accessibilityHint="Toggles agreement; the Terms open via the link"
      onPress={() => setAcceptedTerms((value) => !value)}
      style={({ pressed }) => [styles.termsRow, pressed && styles.pressedSubtle]}
    >
      <View style={[styles.termsBox, acceptedTerms && styles.termsBoxChecked]}>
        {acceptedTerms ? <AppIcon name="check" size={13} color={nothing.black} /> : null}
      </View>
      <Text style={styles.termsText}>
        I agree to the{" "}
        <Pressable onPress={(event) => { event.stopPropagation(); router.push("/legal" as never); }} accessibilityRole="link" hitSlop={8}>
          <Text style={styles.termsLink}>Terms and Privacy policy</Text>
        </Pressable>
        .
      </Text>
    </Pressable>
  ) : null;

  const verificationView = verificationPending ? (
    <NothingCard style={styles.verificationCard}>
      <View style={styles.addressBox}>
        <Text selectable style={styles.addressText}>{verificationPending.email}</Text>
      </View>
      <View style={styles.steps}>
        <Text style={styles.step}>Open the email from Aniraku.</Text>
        <Text style={styles.step}>Tap “Confirm email address”.</Text>
        <Text style={styles.step}>Return here to sign in.</Text>
      </View>
      {error ? <Signal label={error} tone="signal" /> : null}
      <NothingButton
        sentence
        label={resendingVerification ? "Sending…" : resendCooldown > 0 ? `Resend available in ${resendCooldown}s` : "Send another email"}
        onPress={() => void resendVerification()}
        disabled={resendingVerification || resendCooldown > 0}
      />
      <NothingButton sentence label="Back to sign in" variant="outline" onPress={() => { setVerificationPending(null); setMessage("Once your email is confirmed, you can sign in."); }} />
      <Pressable accessibilityRole="button" onPress={() => { setVerificationPending(null); setError(null); setMode("signUp"); }} style={({ pressed }) => [styles.changeEmail, pressed && styles.pressedSubtle]}>
        <Text style={styles.changeEmailText}>Use a different email</Text>
      </Pressable>
    </NothingCard>
  ) : null;

  return (
    <NativeScreen scroll={false} style={styles.fill}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}>
        <View style={styles.top}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} hitSlop={4} style={({ pressed }) => [styles.iconButton, pressed && styles.pressedSubtle]}>
            <AppIcon name="close" size={16} color={nothing.white} />
          </Pressable>
          <DotLabel>Aniraku ID</DotLabel>
        </View>
        <ScrollView
          style={styles.fill}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.column}>
            <AnirakuMark size={30} inverted />
            <Text style={styles.heading}>{heading}</Text>
            <Text style={styles.lead}>{lead}</Text>
            {verificationView || (
              <>
                <NothingCard style={styles.form}>
                  {usernameField}
                  {emailField}
                  {passwordField}
                  {termsField}
                  {error ? <Signal label={error} tone="signal" /> : null}
                  {message ? <Signal label={message} tone="positive" /> : null}
                  <NothingButton sentence label={busy ? busyAction : action} onPress={() => void submit()} disabled={mode === "signUp" && usernameState === "checking"} loading={busy} />
                </NothingCard>
                <View style={styles.switches}>
                  {mode === "signIn" ? (
                    <>
                      <Pressable accessibilityRole="button" onPress={() => switchMode("forgot")} style={({ pressed }) => [styles.switchLink, pressed && styles.pressedSubtle]}>
                        <Text style={styles.switchLinkMuted}>Forgot password?</Text>
                      </Pressable>
                      <Pressable accessibilityRole="button" onPress={() => switchMode("signUp")} style={({ pressed }) => [styles.switchLink, pressed && styles.pressedSubtle]}>
                        <Text style={styles.switchLinkStrong}>Create account</Text>
                      </Pressable>
                    </>
                  ) : (
                    <Pressable accessibilityRole="button" onPress={() => switchMode("signIn")} style={({ pressed }) => [styles.switchLink, pressed && styles.pressedSubtle]}>
                      <Text style={styles.switchLinkMuted}>Back to sign in</Text>
                    </Pressable>
                  )}
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {/* ── "Check your mail" — last look at the address before the account exists ── */}
      <Modal visible={confirmingEmail} transparent animationType="fade" onRequestClose={() => setConfirmingEmail(false)}>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss email confirmation" style={styles.confirmBackdrop} onPress={() => setConfirmingEmail(false)}>
          <Animated.View accessibilityViewIsModal style={[styles.confirmCard, { opacity: confirmEnter, transform: [{ translateY: confirmEnter.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }]}>
            <DotLabel tone="muted">Check your mail</DotLabel>
            <Text style={styles.confirmTitle}>Is this email correct?</Text>
            <View style={styles.addressBox}>
              <Text selectable style={styles.addressText}>{email.trim()}</Text>
            </View>
            <Text style={styles.confirmCopy}>The verification link goes to exactly this address — the mail goes wherever this says.</Text>
            <View style={styles.confirmWarn}>
              <View style={[styles.statusDot, { backgroundColor: nothing.red, marginTop: 5 }]} />
              <Text style={styles.confirmWarnText}>A typo means the mail never arrives and the account can’t be used.</Text>
            </View>
            <NothingButton sentence label="Correct — send it" onPress={() => { setConfirmingEmail(false); void finishSignUp(); }} />
            <NothingButton sentence label="Let me fix it" variant="outline" onPress={() => setConfirmingEmail(false)} />
          </Animated.View>
        </Pressable>
      </Modal>
    </NativeScreen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 4 },
  iconButton: { width: 42, height: 42, borderRadius: 8, borderWidth: 1, borderColor: nothing.line, alignItems: "center", justifyContent: "center" },
  scrollContent: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 20, paddingVertical: 28 },
  column: { width: "100%", maxWidth: 440, alignSelf: "center" },
  heading: { marginTop: 14, color: nothing.white, fontSize: 28, fontWeight: "900", letterSpacing: -0.9 },
  lead: { marginTop: 8, color: nothing.muted, fontSize: nothing.type.body, lineHeight: 21, fontFamily: nothing.font },
  form: { marginTop: 24, padding: 18, gap: 16 },
  field: { gap: 8 },
  fieldLabel: { color: nothing.muted, fontSize: 13, fontWeight: "600", fontFamily: nothing.font },
  inputRow: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: nothing.line },
  inputFocused: { borderBottomColor: nothing.white },
  input: { flex: 1, minHeight: 52, color: nothing.white, fontSize: 16, fontFamily: nothing.font, paddingVertical: 10 },
  eyeButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", marginRight: 2 },
  statusDot: { width: 7, height: 7, borderRadius: 4, marginTop: 5 },
  hintRow: { flexDirection: "row", alignItems: "flex-start", flexWrap: "wrap", gap: 8 },
  hintAction: { marginTop: 5 },
  hintActionText: { color: nothing.white, fontSize: nothing.type.status, fontWeight: "700", textDecorationLine: "underline", fontFamily: nothing.font },
  suggestionRow: { flexDirection: "row", alignItems: "flex-start", flexWrap: "wrap", gap: 3 },
  statusMutedText: { color: nothing.muted, fontSize: nothing.type.status, lineHeight: 18, fontFamily: nothing.font },
  suggestionLink: { color: nothing.white, fontSize: nothing.type.status, lineHeight: 18, fontWeight: "700", textDecorationLine: "underline", fontFamily: nothing.font },
  termsRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 2 },
  termsBox: { width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: nothing.line, alignItems: "center", justifyContent: "center" },
  termsBoxChecked: { backgroundColor: nothing.white, borderColor: nothing.white },
  termsText: { flex: 1, color: nothing.muted, fontSize: 13, lineHeight: 18, fontFamily: nothing.font },
  termsLink: { color: nothing.white, fontWeight: "700", textDecorationLine: "underline" },
  switches: { marginTop: 6, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  switchLink: { minHeight: 44, justifyContent: "center", paddingHorizontal: 2 },
  switchLinkMuted: { color: nothing.muted, fontWeight: "600", fontSize: nothing.type.link, fontFamily: nothing.font },
  switchLinkStrong: { color: nothing.white, fontWeight: "700", fontSize: nothing.type.link, fontFamily: nothing.font },
  verificationCard: { marginTop: 24, padding: 18, gap: 16 },
  addressBox: { borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.raised, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12 },
  addressText: { color: nothing.white, fontFamily: nothing.mono, fontSize: 13.5, fontWeight: "700" },
  steps: { gap: 6 },
  step: { color: nothing.muted, fontSize: 13, lineHeight: 19, fontFamily: nothing.font },
  changeEmail: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  changeEmailText: { color: nothing.muted, fontSize: 13, fontWeight: "600", textDecorationLine: "underline", fontFamily: nothing.font },
  confirmBackdrop: { flex: 1, padding: 24, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.78)" },
  confirmCard: { gap: 14, padding: 20, borderRadius: 8, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.surface, width: "100%", maxWidth: 400, alignSelf: "center" },
  confirmTitle: { color: nothing.white, fontSize: 19, fontWeight: "800", letterSpacing: -0.3 },
  confirmCopy: { color: nothing.muted, fontSize: 13, lineHeight: 19, fontFamily: nothing.font },
  confirmWarn: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  confirmWarnText: { flex: 1, color: nothing.red, fontSize: 12.5, lineHeight: 18, fontWeight: "600", fontFamily: nothing.font },
  pressed: nothing.pressed,
  pressedSubtle: nothing.pressedSubtle,
});
