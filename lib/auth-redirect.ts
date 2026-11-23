/** HTTPS App Link target — verified Android App Links cannot be hijacked by
 *  another installed app the way the legacy `aniraku://auth` scheme can. */
export const ANIRAKU_AUTH_REDIRECT_URL = "https://aniraku.tech/auth";

export function signUpVerificationNotice(email: string) {
  const destination = email.trim() || "your email address";
  return `We sent a confirmation email to ${destination}. Open it and select Confirm email address to finish setting up your account. If it is not there after a few minutes, please check Spam or Junk.`;
}

export function verificationResentNotice(email: string) {
  const destination = email.trim() || "your email address";
  return `We sent another confirmation email to ${destination}. Please use that email to finish setting up your account.`;
}

export function readCallbackValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
