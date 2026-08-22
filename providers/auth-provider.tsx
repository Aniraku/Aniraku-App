import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { sessionIsVerified } from "@/lib/auth-session";
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
    const applySession = (candidate: Session | null) => {
      const next = sessionIsVerified(candidate) ? candidate : null;
      setSession(next);
      if (!next?.user) {
        setProfile(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      void loadProfile(next.user).finally(() => { if (mounted) setLoading(false); });
    };
    void supabase.auth.getSession().then(({ data }) => applySession(data.session)).catch(() => applySession(null));
    let subscription: ReturnType<typeof supabase.auth.onAuthStateChange>["data"]["subscription"] | undefined;
    try {
      ({ data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        // Defer the profile request outside Supabase's state-change callback.
        setTimeout(() => { if (mounted) applySession(nextSession); }, 0);
      }));
    } catch {
      if (mounted) setLoading(false);
    }
    return () => { mounted = false; subscription?.unsubscribe(); };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    if (!sessionIsVerified(data.session)) {
      await supabase.auth.signOut();
      throw new Error("Verify your email before signing in.");
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, username: string) => {
    const clean = sanitizeUsername(username || email.split("@")[0]);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username: clean, display_name: clean }, emailRedirectTo: `${ANIRAKU_AUTH_REDIRECT_URL}?mode=confirmed` },
    });
    if (error) throw error;
  }, []);

  const sendRecovery = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${ANIRAKU_AUTH_REDIRECT_URL}?mode=recovery` });
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
    sendRecovery,
    updatePassword,
    updateProfile,
    signOut,
  }), [loading, profile, session, sendRecovery, signIn, signOut, signUp, updatePassword, updateProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAnirakuAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAnirakuAuth must be used inside AuthProvider.");
  return context;
}
