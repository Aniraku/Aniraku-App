export const FIRST_RUN_IMPORT_STORAGE_KEY = "aniraku.first-run-import.v1";

export function shouldPromptFirstRunImport(input: {
  signedIn: boolean;
  verified: boolean;
  connectedProviders: readonly string[];
  hasPrompted: boolean;
}): boolean {
  return (
    input.signedIn && input.verified && input.connectedProviders.length > 0 && !input.hasPrompted
  );
}

export function parseFirstRunImportPrompted(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "boolean") return parsed;
    if (parsed && typeof parsed === "object") return (parsed as { prompted?: unknown }).prompted === true;
    return raw === "1";
  } catch {
    return raw === "1";
  }
}
