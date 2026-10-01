import AsyncStorage from "@react-native-async-storage/async-storage";
import { APP_CONFIG } from "@/lib/app-config";
import { supabase } from "@/lib/supabase";
import type { SyncProvider } from "@/components/provider-mark";
import { normalizeSyncStatus, type ProviderSyncStatus } from "@/lib/provider-sync-contract";
import { LIST_STATUSES, LIST_STATUS_LABELS } from "@/lib/list-status";

// Library import/export — exact port of Miruro `src/lib/sync.ts`
// (provider library ↔ Aniraku favorites), adapted to Expo / React Native:
// AsyncStorage replaces localStorage, global setTimeout replaces
// window.setTimeout, APP_CONFIG.apiBaseUrl replaces API_BASE.
// Backend is shared (`/api/v1/import|export/{provider}`), so payloads match.

export const PROVIDER_LABELS: Record<SyncProvider, string> = {
  mal: "MyAnimeList",
  anilist: "AniList",
};

async function authHeaders(extra: Record<string, string> = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in to synchronize your library.");
  return { ...extra, Authorization: `Bearer ${token}` };
}

/** Miruro `authHeaders` semantics: never throws, omits Bearer for guests. */
async function authHeadersOptional(
  extra: Record<string, string> = {},
): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return { ...extra, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  } catch {
    return { ...extra };
  }
}

async function responseError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
  };
  return payload.error || payload.message || fallback;
}

export async function getProviderSyncStatus(): Promise<ProviderSyncStatus> {
  const response = await fetch(`${APP_CONFIG.apiBaseUrl}/api/v1/sync`, {
    headers: await authHeaders(),
  });
  if (!response.ok)
    throw new Error(await responseError(response, "Sync status is unavailable."));
  return normalizeSyncStatus(await response.json());
}

/** Miruro `getSyncStatus`: nullable, never throws (Library tab inline handling). */
export async function getSyncStatus(): Promise<ProviderSyncStatus | null> {
  try {
    const response = await fetch(`${APP_CONFIG.apiBaseUrl}/api/v1/sync`, {
      headers: await authHeadersOptional(),
    });
    if (!response.ok) return null;
    return normalizeSyncStatus(await response.json());
  } catch {
    return null;
  }
}

export async function getProviderAuthorizationUrl(provider: SyncProvider) {
  const response = await fetch(
    `${APP_CONFIG.apiBaseUrl}/api/v1/sync/${provider}/authorize`,
    { headers: await authHeaders() },
  );
  if (!response.ok)
    throw new Error(
      await responseError(response, "This provider cannot be connected right now."),
    );
  const payload = (await response.json()) as { url?: string };
  if (!payload.url || !/^https:\/\//.test(payload.url))
    throw new Error("The provider returned an invalid authorization URL.");
  return payload.url;
}

/** Miruro `syncAuthorize`: nullable URL, never throws. */
export async function syncAuthorize(provider: SyncProvider): Promise<string | null> {
  try {
    return await getProviderAuthorizationUrl(provider);
  } catch {
    return null;
  }
}

/** Miruro `completeSyncCallback`: provider-agnostic, backend resolves provider from OAuth state. */
export async function completeSyncCallback(
  _provider: string,
  code: string,
  state: string,
): Promise<Record<string, unknown>> {
  try {
    const response = await fetch(`${APP_CONFIG.apiBaseUrl}/api/v1/sync/callback`, {
      method: "POST",
      headers: await authHeadersOptional({ "Content-Type": "application/json" }),
      body: JSON.stringify({ code, state }),
    });
    return (await response.json().catch(() => ({}))) as Record<string, unknown>;
  } catch {
    return { error: "network" };
  }
}

export async function disconnectProvider(provider: SyncProvider) {
  const response = await fetch(`${APP_CONFIG.apiBaseUrl}/api/v1/sync/${provider}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!response.ok)
    throw new Error(await responseError(response, "The provider could not be disconnected."));
}

/** Miruro `syncDisconnect`: boolean, never throws. */
export async function syncDisconnect(provider: SyncProvider): Promise<boolean> {
  try {
    await disconnectProvider(provider);
    return true;
  } catch {
    return false;
  }
}

type SyncProgressInput = {
  provider: SyncProvider;
  animeId: number;
  episode: number;
  progress: number;
  status: "watching" | "completed";
};

export async function pushProviderProgress(input: SyncProgressInput) {
  const response = await fetch(`${APP_CONFIG.apiBaseUrl}/api/v1/sync/update`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!response.ok)
    throw new Error(await responseError(response, "Provider progress could not be updated."));
}

export async function pushProviderScore(input: {
  provider: SyncProvider;
  animeId: number;
  score: number;
}) {
  const response = await fetch(`${APP_CONFIG.apiBaseUrl}/api/v1/sync/score`, {
    method: "PUT",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!response.ok)
    throw new Error(await responseError(response, "Provider score could not be updated."));
}

// ── Import / Export (provider library ↔ Aniraku favorites) ──
// Reuse the OAuth tokens stored by sync; provider must be connected first.
// UNFILTERED — full library pushes/pulls with no rating filter.

export interface ImportResult {
  error?: string;
  imported?: number;
  already?: number;
  episodes?: number;
  scores?: number;
  total?: number;
  unmapped?: number;
  limited?: boolean;
  /** Per-status title counts, when the backend reports them. */
  statuses?: Record<string, number>;
  /** Existing rows whose list status the import refreshed. */
  statuses_updated?: number;
}

export interface ExportResult {
  error?: string;
  exported?: number;
  scores?: number;
  skipped?: number;
  failed?: number;
  total?: number;
  limited?: boolean;
  /** Per-status title counts, when the backend reports them. */
  statuses?: Record<string, number>;
}

/** Miruro `importProviderList`: never throws, `{error}` on failure. */
export async function importProviderList(provider: SyncProvider): Promise<ImportResult> {
  try {
    const response = await fetch(`${APP_CONFIG.apiBaseUrl}/api/v1/import/${provider}`, {
      method: "POST",
      headers: await authHeadersOptional({ "Content-Type": "application/json" }),
      body: JSON.stringify({}),
    });
    const data = (await response.json().catch(() => ({}))) as ImportResult;
    if (!response.ok) return { error: data.error || "Import failed" };
    return data;
  } catch {
    return { error: "Could not reach the server" };
  }
}

/** True when an export error payload/status smells like provider throttling. */
export function isRateLimitError(message: string | undefined): boolean {
  if (!message) return false;
  return /429|too many requests|rate[\s-_]*limit/i.test(message);
}

/** Parse a `Retry-After` header (delta-seconds or HTTP-date) into ms. */
export function parseRetryAfterMs(value: string | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;
  const when = Date.parse(trimmed);
  if (!Number.isNaN(when)) return Math.max(0, when - Date.now());
  return null;
}

const EXPORT_ATTEMPTS = 5;
const EXPORT_RETRY_MAX_MS = 120000;

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Miruro `exportProviderList`: 5 attempts, honors Retry-After on 429, exponential backoff. */
export async function exportProviderList(provider: SyncProvider): Promise<ExportResult> {
  for (let attempt = 0; attempt < EXPORT_ATTEMPTS; attempt += 1) {
    const last = attempt === EXPORT_ATTEMPTS - 1;
    try {
      const response = await fetch(`${APP_CONFIG.apiBaseUrl}/api/v1/export/${provider}`, {
        method: "POST",
        headers: await authHeadersOptional({ "Content-Type": "application/json" }),
        body: JSON.stringify({}),
      });
      const data = (await response.json().catch(() => ({}))) as ExportResult;
      if (response.ok) return data;
      const retryable =
        response.status === 408 || response.status === 429 || response.status >= 500;
      if (!retryable || last) {
        return { error: (data as { error?: string }).error || "Export failed" };
      }
      const headerWait =
        response.status === 429
          ? parseRetryAfterMs(response.headers.get("Retry-After"))
          : null;
      const backoff = 1000 * 2 ** attempt;
      await sleepMs(Math.min(EXPORT_RETRY_MAX_MS, Math.max(0, headerWait ?? backoff)));
    } catch {
      if (last) return { error: "Could not reach the server" };
      await sleepMs(Math.min(EXPORT_RETRY_MAX_MS, 1000 * 2 ** attempt));
    }
  }
  return { error: "Export failed" };
}

// Throwing wrappers preserve the existing react-query contract
// (`useProviderSync` shows `error.message`); success payloads are now full.
export async function importProviderLibrary(provider: SyncProvider) {
  const result = await importProviderList(provider);
  if (result.error) throw new Error(result.error);
  return result;
}

export async function exportProviderLibrary(provider: SyncProvider) {
  const result = await exportProviderList(provider);
  if (result.error) throw new Error(result.error);
  return result;
}

// Human-readable count summary for import/export results.
export function describeImport(r: ImportResult | null | undefined): string {
  if (!r) return "";
  if (r.error) return r.error;
  const parts: string[] = [];
  if ((r.imported ?? 0) > 0) parts.push(`${r.imported} imported`);
  if ((r.already ?? 0) > 0) parts.push(`${r.already} already in your library`);
  if ((r.episodes ?? 0) > 0) parts.push(`${r.episodes} episodes of progress`);
  if ((r.scores ?? 0) > 0) parts.push(`${r.scores} scores`);
  if ((r.unmapped ?? 0) > 0) parts.push(`${r.unmapped} had no Aniraku match`);
  const statusLine = describeStatusBreakdown(r.statuses);
  if (statusLine) parts.push(statusLine);
  if ((r.statuses_updated ?? 0) > 0) parts.push(`${r.statuses_updated} statuses refreshed`);
  if (r.limited) parts.push("more episodes remain — import again to continue");
  return parts.join(" · ") || "Nothing new to import";
}

export function describeExport(r: ExportResult | null | undefined): string {
  if (!r) return "";
  if (r.error) return r.error;
  const parts: string[] = [];
  if ((r.exported ?? 0) > 0) parts.push(`${r.exported} titles updated`);
  if ((r.scores ?? 0) > 0) parts.push(`${r.scores} scores`);
  // Skipped = provider already matched our status + progress (not merely
  // "completed") — see the backend diff-then-write.
  if ((r.skipped ?? 0) > 0) parts.push(`${r.skipped} already up to date`);
  if ((r.failed ?? 0) > 0) parts.push(`${r.failed} failed`);
  const statusLine = describeStatusBreakdown(r.statuses);
  if (statusLine) parts.push(statusLine);
  if (r.limited) parts.push("more titles remain — export again to continue");
  return parts.join(" · ") || "Nothing to export";
}

/** "3 Watching · 2 Plan to Watch" style breakdown for import/export. */
export function describeStatusBreakdown(
  statuses: Record<string, number> | null | undefined,
): string {
  if (!statuses || typeof statuses !== "object") return "";
  const parts: string[] = [];
  for (const status of LIST_STATUSES) {
    const count = Math.floor(Number(statuses[status] ?? 0)) || 0;
    if (count > 0) parts.push(`${count} ${LIST_STATUS_LABELS[status]}`);
  }
  return parts.join(" · ");
}

// ── Background export runner (rate-limited, Supabase-notified) ──
// Miruro `src/lib/sync.ts` runner, RN-adapted: job state persists in
// AsyncStorage (one slot per provider); a reload marks a mid-flight job
// `interrupted` (chunks are idempotent server-side via skipped/already
// handling, so re-running is safe). Terminal state inserts a Supabase
// `notifications` row (`export_complete` / `export_failed`) so the Alerts
// tab notifies even after navigating away.

export type ExportJobStatus = "running" | "done" | "error" | "interrupted";

export interface ExportJobState {
  provider: string;
  status: ExportJobStatus;
  startedAt: number;
  updatedAt: number;
  chunks: number;
  exported: number;
  scores: number;
  skipped: number;
  failed: number;
  /** Final human-readable line (terminal states only). */
  message?: string;
  /** Transient progress line (e.g. rate-limit waits). Cleared on progress. */
  note?: string;
}

export type ExportJobs = Record<string, ExportJobState>;

export const EXPORT_JOB_KEY = "aniraku:export-job";
// AniList allows 30 req/min; exports run at a conservative 10 batched
// requests/min (one chunk POST per 6s) so backend bursts stay under the cap.
const EXPORT_MIN_INTERVAL_MS = 6000;
const EXPORT_PACE_MAX_MS = 120000;
const EXPORT_ENTRIES_PER_MINUTE = 30;
// AniList's documented window is 60s; wait a full window + margin when the
// provider throttles us, then retry the SAME chunk (up to the cap below).
const EXPORT_RATE_WAIT_MS = 65000;
const EXPORT_RATE_RETRIES = 8;

let exportJobInFlight = false;
let exportJobs: ExportJobs = {};
const exportJobListeners = new Set<(jobs: ExportJobs) => void>();

async function hydrateExportJobs(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(EXPORT_JOB_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, ExportJobState>;
    let changed = false;
    for (const [provider, job] of Object.entries(parsed)) {
      if (!job || typeof job !== "object") continue;
      exportJobs[provider] = {
        ...job,
        provider,
        status: job.status === "running" ? "interrupted" : job.status,
        updatedAt: Date.now(),
      };
      changed = true;
    }
    if (changed) emitExportJobs();
  } catch {
    // Corrupt / unavailable storage — start clean, memory-only.
  }
}

void hydrateExportJobs();

async function persistExportJobs(): Promise<void> {
  try {
    await AsyncStorage.setItem(EXPORT_JOB_KEY, JSON.stringify(exportJobs));
  } catch {
    // Storage unavailable — memory-only.
  }
}

function emitExportJobs(): void {
  exportJobListeners.forEach((listener) => {
    try {
      listener(exportJobs);
    } catch {
      // A broken listener must not break the store.
    }
  });
}

function setExportJob(next: ExportJobState): void {
  exportJobs = { ...exportJobs, [next.provider]: next };
  void persistExportJobs();
  emitExportJobs();
}

/** Snapshot of the background export jobs, keyed by provider. */
export function getExportJobs(): ExportJobs {
  return exportJobs;
}

/** Subscribe to export-job updates; fires immediately with current jobs. */
export function subscribeExportJobs(listener: (jobs: ExportJobs) => void): () => void {
  exportJobListeners.add(listener);
  try {
    listener(exportJobs);
  } catch {
    // Ignore listener errors.
  }
  return () => {
    exportJobListeners.delete(listener);
  };
}

export function exportPaceDelayMs(entries: number): number {
  const paced = Math.round((Math.max(0, entries) / EXPORT_ENTRIES_PER_MINUTE) * 60000);
  return Math.min(EXPORT_PACE_MAX_MS, Math.max(EXPORT_MIN_INTERVAL_MS, paced));
}

async function notifyExportFinished(
  provider: string,
  totals: { exported: number; scores: number; skipped: number; failed: number },
  error?: string,
): Promise<string> {
  const label = PROVIDER_LABELS[provider as SyncProvider] ?? provider;
  const message = error
    ? `Export to ${label} stopped after ${totals.exported} titles: ${error} — run export again to continue`
    : `Export to ${label} finished: ${describeExport({ ...totals, limited: false })}`;
  try {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user.id;
    if (uid) {
      await supabase.from("notifications").insert({
        user_id: uid,
        type: error ? "export_failed" : "export_complete",
        message,
        anime_id: null,
      });
    }
  } catch {
    // Notification insert is best-effort; the Alerts tab refresh still runs
    // when the caller invalidates `["notifications"]`.
  }
  return message;
}

/**
 * Run the provider export in the background: loops chunk POSTs while the
 * backend answers `limited`, pacing chunk requests at 10 batched req/min.
 * Non-blocking — resolves with the terminal snapshot; progress flows through
 * subscribeExportJobs and completion lands in the notifications table.
 */
export async function runExportJob(provider: SyncProvider): Promise<ExportJobState> {
  const current = exportJobs[provider];
  if (exportJobInFlight || current?.status === "running") {
    return (
      current ?? {
        provider,
        status: "running",
        startedAt: Date.now(),
        updatedAt: Date.now(),
        chunks: 0,
        exported: 0,
        scores: 0,
        skipped: 0,
        failed: 0,
      }
    );
  }
  exportJobInFlight = true;
  const startedAt = Date.now();
  const totals = { exported: 0, scores: 0, skipped: 0, failed: 0 };
  let chunks = 0;
  let rateWaits = 0;
  const progress = (note?: string): ExportJobState => ({
    provider,
    status: "running",
    startedAt,
    updatedAt: Date.now(),
    chunks,
    ...totals,
    ...(note ? { note } : {}),
  });
  setExportJob(progress());
  try {
    for (;;) {
      const chunk = await exportProviderList(provider);
      chunks += 1;
      if (chunk.error) {
        // Provider throttling is transient: wait out the rate window and
        // retry the same chunk instead of failing the whole job.
        if (isRateLimitError(chunk.error) && rateWaits < EXPORT_RATE_RETRIES) {
          rateWaits += 1;
          setExportJob(
            progress(
              `Rate limited by ${PROVIDER_LABELS[provider] ?? provider} — ` +
                `waiting ${Math.round(EXPORT_RATE_WAIT_MS / 1000)}s before ` +
                `retrying (attempt ${rateWaits}/${EXPORT_RATE_RETRIES})…`,
            ),
          );
          await sleepMs(EXPORT_RATE_WAIT_MS);
          continue;
        }
        const message = await notifyExportFinished(provider, totals, chunk.error);
        const terminal: ExportJobState = {
          ...progress(),
          status: "error",
          message,
        };
        setExportJob(terminal);
        return terminal;
      }
      rateWaits = 0; // a clean chunk resets the throttle budget
      totals.exported += chunk.exported ?? 0;
      totals.scores += chunk.scores ?? 0;
      totals.skipped += chunk.skipped ?? 0;
      totals.failed += chunk.failed ?? 0;
      if (!chunk.limited) {
        const message = await notifyExportFinished(provider, totals);
        const terminal: ExportJobState = {
          ...progress(),
          status: "done",
          message,
        };
        setExportJob(terminal);
        return terminal;
      }
      setExportJob(progress());
      await sleepMs(exportPaceDelayMs(chunk.exported ?? EXPORT_ENTRIES_PER_MINUTE));
    }
  } finally {
    exportJobInFlight = false;
  }
}

/** Fire-and-forget wrapper for UI handlers. */
export function startExportJob(provider: SyncProvider): ExportJobState {
  void runExportJob(provider);
  const snapshot = getExportJobs()[provider];
  return (
    snapshot ?? {
      provider,
      status: "running",
      startedAt: Date.now(),
      updatedAt: Date.now(),
      chunks: 0,
      exported: 0,
      scores: 0,
      skipped: 0,
      failed: 0,
    }
  );
}
