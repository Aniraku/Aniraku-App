/**
 * Client-side email sanity checks used before any network send (intake R6):
 * format validation and a domain-typo suggestion. No server probes — the
 * only "does this account exist" signal remains the sign-up response itself.
 */

const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

/** Common consumer domains for the typo check — closest match wins. */
const KNOWN_DOMAINS = [
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "hotmail.co.uk",
  "live.com", "yahoo.com", "ymail.com", "icloud.com", "me.com", "proton.me",
  "protonmail.com", "aol.com", "zoho.com", "gmx.com", "mail.com", "fastmail.com",
];

export function validateEmail(email: string): string | null {
  const value = String(email ?? "").trim();
  if (!value) return "Enter your email address.";
  if (value.length > 254) return "That email address is too long.";
  if (/\s/.test(value)) return "Email addresses cannot contain spaces.";
  if (value.includes("..")) return "Email addresses cannot have consecutive dots.";
  if (!EMAIL_PATTERN.test(value)) return "That email address doesn't look valid. Check it and try again.";
  return null;
}

function editDistance(left: string, right: string): number {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => [index, ...new Array<number>(right.length).fill(0)]);
  for (let column = 0; column <= right.length; column += 1) rows[0][column] = column;
  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const substitution = rows[row - 1][column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1);
      rows[row][column] = Math.min(rows[row - 1][column] + 1, rows[row][column - 1] + 1, substitution);
    }
  }
  return rows[left.length][right.length];
}

/**
 * Typo suggestion for the email domain, or null. One or two edits against a
 * known domain; a transposition counts as two Levenshtein edits, which is
 * still within the threshold for the usual fat-finger domains.
 */
export function emailTypoSuggestion(email: string): string | null {
  const value = String(email ?? "").trim();
  const at = value.lastIndexOf("@");
  if (at < 1) return null;
  const domain = value.slice(at + 1).toLowerCase();
  if (!domain || KNOWN_DOMAINS.includes(domain)) return null;
  const candidates = KNOWN_DOMAINS
    .map((candidate) => ({ candidate, distance: editDistance(domain, candidate) }))
    .filter((entry) => entry.distance > 0 && entry.distance <= 2)
    .sort((left, right) => left.distance - right.distance);
  const best = candidates[0];
  return best ? `${value.slice(0, at)}@${best.candidate}` : null;
}

/** Human message for the signup/recovery path, or null when the email is fine. */
export function emailProblemOrTypo(email: string): string | null {
  const problem = validateEmail(email);
  if (problem) return problem;
  const suggestion = emailTypoSuggestion(email);
  if (suggestion) return `Did you mean ${suggestion}? Update the address and try again.`;
  return null;
}
