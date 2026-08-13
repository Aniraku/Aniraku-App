export type SessionIdentity = { email_confirmed_at?: string | null; app_metadata?: { provider?: string } };

export function sessionIsVerified(session: { user?: SessionIdentity | null } | null | undefined) {
  return Boolean(session?.user?.email_confirmed_at || session?.user?.app_metadata?.provider === "anonymous");
}
