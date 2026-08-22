import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { AppState } from "react-native";
import { supabase } from "@/lib/supabase";
import { serverUserCanStartSession, sessionIsVerified } from "@/lib/auth-session";
import { ANIRAKU_AUTH_REDIRECT_URL } from "@/lib/auth-redirect";
import { defaultAvatar } from "@/lib/aniraku-avatars";
import type { AnirakuProfile } from "@/lib/types";

type ProfileUpdate = Pick<AnirakuProfile, "username" | "display_name" | "bio" | "avatar_url">;

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: AnirakuProfile | null;
  loading: boolean;
  verified: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  sendRecovery: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  updateProfile: (updates: ProfileUpdate) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function sanitizeUsername(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  return (normalized || "aniraku_member").slice(0, 20);
}

function fallbackProfile(user: User): AnirakuProfile {
  const username = sanitizeUsername(String(user.user_metadata?.username || user.email?.split("@")[0] || `user_${user.id.slice(0, 6)}`));
  return {
    id: user.id,
    username,
    display_name: String(user.user_metadata?.display_name || username),
    avatar_url: defaultAvatar(username.charCodeAt(0)).url,
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AnirakuProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionValidation = useRef(0);

  const loadProfile = useCallback(async (user: User) => {
    const fallback = fallbackProfile(user);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, bio, avatar_url, banner_url, location, socials, created_at")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setProfile(data as AnirakuProfile);
        return;
      }
      // Same recovery path as the main frontend when an older auth trigger
      // failed to create a `profiles` row on signup.
      const { data: created, error: createError } = await supabase
        .from("profiles")
        .upsert(fallback, { onConflict: "id" })
        .select("id, username, display_name, bio, avatar_url, banner_url, location, socials, created_at")
        .maybeSingle();
      if (createError) throw createError;
      setProfile((created as AnirakuProfile | null) || fallback);
    } catch {
      // The account remains usable even if an offline/RLS issue postpones
      // profile hydration. The deterministic main-avatar fallback still shows.
      setProfile(fallback);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const clearSessionState = () => {
      if (!mounted) return;
      setSession(null);
      setProfile(null);
      setLoading(false);
    };
    const applySession = async (candidate: Session | null) => {
      const validationId = ++sessionValidation.current;
      if (!candidate?.user) {
        clearSessionState();
        return;
      }
      if (mounted) setLoading(true);
      try {
        // getUser always asks Supabase Auth for the present user record. This
        // deliberately rejects a cached token after an account was deleted.
        const { data, error } = await supabase.auth.getUser();
        if (!mounted || validationId !== sessionValidation.current) return;
        if (error || !serverUserCanStartSession(candidate, data.user)) {
          await supabase.auth.signOut({ scope: "local" }).catch(() => {});
          clearSessionState();
          return;
        }
        const next = { ...candidate, user: data.user };
        setSession(next);
        void loadProfile(data.user).finally(() => {
          if (mounted && validationId === sessionValidation.current) setLoading(false);
        });
      } catch {
        if (!mounted || validationId !== sessionValidation.current) return;
        // Offline or malformed stored sessions must not grant app access.
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        clearSessionState();
      }
    };
    void supabase.auth.getSession().then(({ data }) => void applySession(data.session)).catch(() => void applySession(null));
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void supabase.auth.getSession().then(({ data }) => void applySession(data.session));
    });
    let subscription: ReturnType<typeof supabase.auth.onAuthStateChange>["data"]["subscription"] | undefined;
    try {
      ({ data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        // Defer the Supabase Auth network request outside the state-change callback.
        setTimeout(() => { if (mounted) void applySession(nextSession); }, 0);
      }));
    } catch {
      clearSessionState();
    }
    return () => { mounted = false; sessionValidation.current += 1; appStateSubscription.remove(); subscription?.unsubscribe(); };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    const { data: current, error: currentUserError } = await supabase.auth.getUser();
    if (currentUserError || !serverUserCanStartSession(data.session, current.user)) {
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      throw new Error("Please confirm your email before signing in.");
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, username: string) => {
    const clean = sanitizeUsername(username || email.split("@")[0]);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username: clean, display_name: clean }, emailRedirectTo: ANIRAKU_AUTH_REDIRECT_URL },
    });
    if (error) throw error;
  }, []);

  const resendVerification = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: ANIRAKU_AUTH_REDIRECT_URL },
    });
    if (error) throw error;
  }, []);

  const sendRecovery = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: ANIRAKU_AUTH_REDIRECT_URL });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }, []);

  const updateProfile = useCallback(async (updates: ProfileUpdate) => {
    const user = session?.user;
    if (!user) throw new Error("Sign in to edit your profile.");
    const fields: ProfileUpdate = { ...updates };
    if (fields.username) fields.username = sanitizeUsername(fields.username);
    const { error } = await supabase.from("profiles").update(fields).eq("id", user.id);
    if (error) throw error;
    if (fields.username || fields.display_name) {
      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          username: fields.username || user.user_metadata?.username,
          display_name: fields.display_name || user.user_metadata?.display_name,
        },
      });
      if (metadataError) throw metadataError;
    }
    setProfile((current) => ({ ...(current || fallbackProfile(user)), ...fields }));
  }, [session?.user]);

  const signOut = useCallback(async () => {
    sessionValidation.current += 1;
    await supabase.auth.signOut().catch(() => {});
    setSession(null);
    setProfile(null);
  }, []);

  const value = useMemo<AuthState>(() => ({
    session,
    user: session?.user ?? null,
    profile,
    loading,
    verified: sessionIsVerified(session),
    signIn,
    signUp,
    resendVerification,
    sendRecovery,
    updatePassword,
    updateProfile,
    signOut,
  }), [loading, profile, resendVerification, session, sendRecovery, signIn, signOut, signUp, updatePassword, updateProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAnirakuAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAnirakuAuth must be used inside AuthProvider.");
  return context;
}
