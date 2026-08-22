export type SessionIdentity = { id?: string; email_confirmed_at?: string | null; app_metadata?: { provider?: string } };

export function sessionIsVerified(session: { user?: SessionIdentity | null } | null | undefined) {
  return Boolean(session?.user?.email_confirmed_at || session?.user?.app_metadata?.provider === "anonymous");
}

/**
 * A persisted access token is not enough to open the app. Supabase must return
 * the same current user and that user must still meet Aniraku's confirmation rule.
 */
export function serverUserCanStartSession(
  session: { user?: SessionIdentity | null } | null | undefined,
  serverUser: SessionIdentity | null | undefined,
) {
  return Boolean(
    session?.user?.id
      && serverUser?.id
      && session.user.id === serverUser.id
      && sessionIsVerified({ user: serverUser }),
  );
}
