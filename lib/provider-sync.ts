import { APP_CONFIG } from "@/lib/app-config";
import { supabase } from "@/lib/supabase";
import type { SyncProvider } from "@/components/provider-mark";
import { normalizeSyncStatus, type ProviderSyncStatus } from "@/lib/provider-sync-contract";

async function authHeaders(extra: Record<string, string> = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in to synchronize your library.");
  return { ...extra, Authorization: `Bearer ${token}` };
}

async function responseError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => ({})) as { error?: string; message?: string };
  return payload.error || payload.message || fallback;
}

export async function getProviderSyncStatus(): Promise<ProviderSyncStatus> {
  const response = await fetch(`${APP_CONFIG.apiBaseUrl}/api/v1/sync`, { headers: await authHeaders() });
  if (!response.ok) throw new Error(await responseError(response, "Sync status is unavailable."));
  return normalizeSyncStatus(await response.json());
}

export async function getProviderAuthorizationUrl(provider: SyncProvider) {
  const response = await fetch(`${APP_CONFIG.apiBaseUrl}/api/v1/sync/${provider}/authorize`, { headers: await authHeaders() });
  if (!response.ok) throw new Error(await responseError(response, "This provider cannot be connected right now."));
  const payload = await response.json() as { url?: string };
  if (!payload.url || !/^https:\/\//.test(payload.url)) throw new Error("The provider returned an invalid authorization URL.");
  return payload.url;
}

export async function disconnectProvider(provider: SyncProvider) {
  const response = await fetch(`${APP_CONFIG.apiBaseUrl}/api/v1/sync/${provider}`, { method: "DELETE", headers: await authHeaders() });
  if (!response.ok) throw new Error(await responseError(response, "The provider could not be disconnected."));
}

type SyncProgressInput = { provider: SyncProvider; animeId: number; episode: number; progress: number; status: "watching" | "completed" };

export async function pushProviderProgress(input: SyncProgressInput) {
  const response = await fetch(`${APP_CONFIG.apiBaseUrl}/api/v1/sync/update`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await responseError(response, "Provider progress could not be updated."));
}

export async function pushProviderScore(input: { provider: SyncProvider; animeId: number; score: number }) {
  const response = await fetch(`${APP_CONFIG.apiBaseUrl}/api/v1/sync/score`, {
    method: "PUT",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await responseError(response, "Provider score could not be updated."));
}

export async function importProviderLibrary(provider: SyncProvider) {
  const response = await fetch(`${APP_CONFIG.apiBaseUrl}/api/v1/import/${provider}`, { method: "POST", headers: await authHeaders({ "Content-Type": "application/json" }), body: "{}" });
  const payload = await response.json().catch(() => ({})) as { imported?: number; already?: number; error?: string };
  if (!response.ok) throw new Error(payload.error || "Provider library import failed.");
  return payload;
}

export async function exportProviderLibrary(provider: SyncProvider) {
  const response = await fetch(`${APP_CONFIG.apiBaseUrl}/api/v1/export/${provider}`, { method: "POST", headers: await authHeaders({ "Content-Type": "application/json" }), body: "{}" });
  const payload = await response.json().catch(() => ({})) as { exported?: number; skipped?: number; failed?: number; limited?: boolean; error?: string };
  if (!response.ok) throw new Error(payload.error || "Provider library export failed.");
  return payload;
}
