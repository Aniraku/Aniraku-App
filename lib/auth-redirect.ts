export const ANIRAKU_AUTH_REDIRECT_URL = "aniraku://auth";

export function signUpVerificationNotice(email: string) {
  const destination = email.trim() || "your email address";
  return `We sent an activation link to ${destination}. Verify your email before signing in. Check your inbox, then check Spam or Junk if it does not arrive within a few minutes.`;
}

export function readCallbackValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
