import { supabase } from './supabase'
import { API_BASE } from '../config'

// Thin client for the backend MAL / AniList watch-progress sync.
// The backend authenticates these endpoints with the Supabase JWT, so
// every call attaches the current session's access token.

async function authHeaders(extra = {}) {
  const session = await supabase.auth.getSession()
  const token = session.data.session?.access_token
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export async function getSyncStatus() {
  try {
    const res = await fetch(`${API_BASE}/api/v1/sync`, {
      cache: 'no-store',
      headers: await authHeaders(),
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

// Fetch the provider's authorize URL, then hand the browser off to it.
// A plain location redirect can't carry the auth header, so the URL must
// be requested first.
export async function syncAuthorize(provider) {
  try {
    const res = await fetch(`${API_BASE}/api/v1/sync/${provider}/authorize`, {
      headers: await authHeaders(),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.url || null
  } catch {
    return null
  }
}

export async function completeSyncCallback(provider, code, state) {
  try {
    // Provider-agnostic callback: MAL / AniList redirect back with only
    // ?code=&state= (no provider), and the backend resolves the provider
    // from its pending OAuth state store.
    const res = await fetch(`${API_BASE}/api/v1/sync/callback`, {
      method: 'POST',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ code, state }),
    })
    return res.json().catch(() => ({}))
  } catch {
    return { error: 'network' }
  }
}

export async function syncDisconnect(provider) {
  try {
    const res = await fetch(`${API_BASE}/api/v1/sync/${provider}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function updateSyncProgress({
  provider,
  animeId,
  episode,
  progress,
  status,
}) {
  try {
    const res = await fetch(`${API_BASE}/api/v1/sync/update`, {
      method: 'POST',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ provider, animeId, episode, progress, status }),
    })
    if (res.ok) return { ok: true }
    const data = await res.json().catch(() => ({}))
    return { ok: false, error: data?.error || `HTTP ${res.status}` }
  } catch (err) {
    return { ok: false, error: err?.message || 'network error' }
  }
}

// Push a 1-10 anime score (aggregated from episode ratings) to a
// connected provider. Both MAL and AniList only support an anime-level
// score, so the average of the user's episode ratings becomes the score.
export async function updateSyncScore({ provider, animeId, score }) {
  try {
    const res = await fetch(`${API_BASE}/api/v1/sync/score`, {
      method: 'PUT',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ provider, animeId, score }),
    })
    if (res.ok) return { ok: true }
    const data = await res.json().catch(() => ({}))
    return { ok: false, error: data?.error || `HTTP ${res.status}` }
  } catch (err) {
    return { ok: false, error: err?.message || 'network error' }
  }
}

// Episode ratings (own ratings for one anime). Logged-in users store
// them in Supabase via the backend; guests keep them locally.
export async function fetchEpisodeRatings(animeId) {
  try {
    const res = await fetch(`${API_BASE}/api/v1/anime/${animeId}/ratings`, {
      cache: 'no-store',
      headers: await authHeaders(),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data?.ratings) return null
    return Object.fromEntries(
      data.ratings.map((r) => [r.episode_number, r.score])
    )
  } catch {
    return null
  }
}

export async function saveEpisodeRating(animeId, episode, score) {
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/anime/${animeId}/episode/${episode}/rating`,
      {
        method: 'POST',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ score }),
      }
    )
    return res.ok
  } catch {
    return false
  }
}

export const PROVIDER_LABELS = {
  mal: 'MyAnimeList',
  anilist: 'AniList',
}

export const PROVIDER_LOGO = {
  mal: 'M',
  anilist: 'A',
}

// ── Import / Export (provider library ↔ Aniraku favorites) ──
// These reuse the OAuth tokens stored by the sync feature, so the
// provider must be connected in Settings first.

export async function importProviderList(provider) {
  try {
    const res = await fetch(`${API_BASE}/api/v1/import/${provider}`, {
      method: 'POST',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({}),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { error: data.error || 'Import failed' }
    return data
  } catch {
    return { error: 'Could not reach the server' }
  }
}

export async function exportProviderList(provider) {
  try {
    const res = await fetch(`${API_BASE}/api/v1/export/${provider}`, {
      method: 'POST',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({}),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { error: data.error || 'Export failed' }
    return data
  } catch {
    return { error: 'Could not reach the server' }
  }
}

// Human-readable count summary for import/export results.
export function describeImport(r) {
  if (!r) return ''
  const parts = []
  if (r.imported > 0) parts.push(`${r.imported} imported`)
  if (r.already > 0) parts.push(`${r.already} already in your library`)
  return parts.join(' · ') || 'Nothing new to import'
}

export function describeExport(r) {
  if (!r) return ''
  const parts = []
  if (r.exported > 0) parts.push(`${r.exported} added as completed`)
  if (r.skipped > 0) parts.push(`${r.skipped} already completed`)
  if (r.failed > 0) parts.push(`${r.failed} failed`)
  if (r.limited) parts.push('more titles remain — export again to continue')
  return parts.join(' · ') || 'Nothing to export'
}
