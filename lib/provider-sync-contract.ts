import type { SyncProvider } from "@/components/provider-mark";

export type ProviderSyncState = {
  configured: boolean;
  connected: boolean;
  username?: string;
  expires_at?: number;
};

export type ProviderSyncStatus = Record<SyncProvider, ProviderSyncState>;

const empty = (): ProviderSyncState => ({ configured: false, connected: false });

export function normalizeSyncStatus(input: unknown): ProviderSyncStatus {
  const record = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const normalizeProvider = (provider: SyncProvider): ProviderSyncState => {
    const value = record[provider];
    const item = value && typeof value === "object" ? value as Record<string, unknown> : {};
    return {
      configured: item.configured === true,
      connected: item.connected === true,
      username: typeof item.username === "string" && item.username.trim() ? item.username.trim() : undefined,
      expires_at: typeof item.expires_at === "number" && Number.isFinite(item.expires_at) ? item.expires_at : undefined,
    };
  };
  return { mal: normalizeProvider("mal"), anilist: normalizeProvider("anilist") };
}

export const EMPTY_SYNC_STATUS: ProviderSyncStatus = { mal: empty(), anilist: empty() };

export function connectedProviders(status: ProviderSyncStatus | null | undefined): SyncProvider[] {
  if (!status) return [];
  return (["mal", "anilist"] as SyncProvider[]).filter((provider) => status[provider].configured && status[provider].connected);
}

export function tokenHealth(expiresAt?: number) {
  if (!expiresAt) return "TOKEN STATUS MANAGED SECURELY";
  const seconds = expiresAt - Math.floor(Date.now() / 1000);
  if (seconds <= 0) return "TOKEN WILL REFRESH WHEN NEEDED";
  if (seconds < 3_600) return "TOKEN EXPIRING SOON";
  return "TOKEN READY";
}
