import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'
import { API_BASE } from '../config'

const LOCAL_KEY = 'aniraku-nsfw-enabled'

const readLocal = () => {
  try { return localStorage.getItem(LOCAL_KEY) === 'true' } catch { return false }
}

// Shared per-account NSFW state: every useNsfw instance subscribes to one
// module-level value so N instances on a page fire a single user_settings
// query and stay in sync when the toggle flips anywhere.
const shared = {
  userId: null,
  value: null,
  pending: null,
  listeners: new Set(),
}

const publish = (v) => {
  shared.value = v
  shared.listeners.forEach(l => l(v))
}

// Per-account NSFW preference. Stored in user_settings (key: nsfw_enabled)
// when signed in; falls back to localStorage for guests so the toggle still
// works without an account. Default is off.
export const useNsfw = () => {
  const { user, loading } = useAuth()
  // When a session exists the account value (user_settings) is authoritative,
  // so never seed from localStorage — a stale key left by a guest session or
  // another account would flash the wrong state before the DB answers. Guests
  // (auth resolved, no user) still read the device key.
  const [nsfwEnabled, setNsfwEnabled] = useState(() => {
    if (shared.userId === (user?.id || null) && shared.value !== null) return shared.value
    return !user && !loading ? readLocal() : false
  })

  useEffect(() => {
    const uid = user?.id || null
    if (shared.userId !== uid) {
      shared.userId = uid
      shared.value = null
      shared.pending = null
    }
    const listener = (v) => setNsfwEnabled(v)
    shared.listeners.add(listener)
    if (shared.value !== null) {
      setNsfwEnabled(shared.value)
      return () => { shared.listeners.delete(listener) }
    }
    if (!user && !loading) {
      publish(readLocal())
      return () => { shared.listeners.delete(listener) }
    }
    if (!user) {
      return () => { shared.listeners.delete(listener) }
    }
    let cancelled = false
    const query = shared.pending || supabase.from('user_settings')
      .select('value')
      .eq('user_id', user.id)
      .eq('key', 'nsfw_enabled')
      .maybeSingle()
    shared.pending = query
    query
      .then(({ data }) => {
        if (cancelled || shared.userId !== uid) return
        publish(data?.value === true)
      })
      .catch(() => {})
      .finally(() => {
        if (shared.pending === query) shared.pending = null
      })
    return () => { cancelled = true; shared.listeners.delete(listener) }
  }, [user, loading])

  const updateNsfw = useCallback(async (enabled) => {
    publish(enabled)
    if (user) {
      // Account-backed: the DB row is the source of truth, and a stale device
      // key must never leak into another session, so drop it on save.
      try { localStorage.removeItem(LOCAL_KEY) } catch {}
      await supabase.from('user_settings').upsert(
        { user_id: user.id, key: 'nsfw_enabled', value: enabled },
        { onConflict: 'user_id,key' },
      )
    } else {
      try { localStorage.setItem(LOCAL_KEY, String(enabled)) } catch {}
    }
  }, [user])

  const toggleNsfw = useCallback(() => updateNsfw(!nsfwEnabled), [nsfwEnabled, updateNsfw])

  return { nsfwEnabled, toggleNsfw, updateNsfw }
}

// A title counts as NSFW only when it carries the Hentai genre on AniList.
// isAdult alone is too broad — AniList flags some non-hentai series as adult.
export const isNsfw = (item) =>
  Array.isArray(item?.genres) && item.genres.some(g => g.toLowerCase() === 'hentai')

// filterAdult drops hentai titles from a result list when the account has
// NSFW content disabled. Everything else always passes through.
export const filterAdult = (items, nsfwEnabled) => {
  if (nsfwEnabled || !Array.isArray(items)) return items
  return items.filter(item => !isNsfw(item))
}

// Most hentai on AniList has no Miruro stream — surface only what can play.
// The backend probe actually resolves + reachability-verifies a real source,
// so a "playable" result means the first episode really can stream. Results
// are cached per anime so re-renders and repeated views cost nothing.
// TTLs: a positive probe stays trusted for 30m (streams rarely vanish), but
// a negative one only 5m — negatives usually mean Miruro was momentarily
// down (Cloudflare challenge, 502), so hentai listings must recover quickly
// instead of hiding titles off one bad probe.
const streamCache = new Map() // id -> { promise, playable, at }
const STREAM_TTL_PLAYABLE = 30 * 60 * 1000
const STREAM_TTL_MISSING = 5 * 60 * 1000

function hasMiruroStreams(id) {
  if (!id) return Promise.resolve(false)
  const now = Date.now()
  const hit = streamCache.get(id)
  if (hit) {
    const ttl = hit.playable ? STREAM_TTL_PLAYABLE : STREAM_TTL_MISSING
    if (now - hit.at < ttl) return Promise.resolve(hit.playable)
    streamCache.delete(id)
  }
  const entry = { promise: null, playable: false, at: now }
  entry.promise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/miruro/probe/${id}`)
      if (!res.ok) return false
      const d = await res.json()
      return d?.playable === true
    } catch {
      return false
    }
  })().then(v => {
    entry.playable = !!v
    return !!v
  })
  // Shared promise: concurrent callers await the same in-flight probe.
  streamCache.set(id, entry)
  return entry.promise
}

// useStreamable keeps normal anime as-is and drops hentai entries that have
// no playable Miruro stream (checked against the backend, cached). When NSFW
// is disabled it drops all hentai, mirroring filterAdult.
export const useStreamable = (items) => {
  const { nsfwEnabled } = useNsfw()
  const list = useMemo(() => (Array.isArray(items) ? items : []), [items])
  const rest = useMemo(() => list.filter(it => !isNsfw(it)), [list])
  const adult = useMemo(() => list.filter(isNsfw), [list])
  const [extra, setExtra] = useState([])

  useEffect(() => {
    if (!nsfwEnabled || adult.length === 0) {
      setExtra(prev => (prev.length ? [] : prev))
      return
    }
    let cancelled = false
    Promise.all(adult.map(async it => ((await hasMiruroStreams(it.id)) ? it : null)))
      .then(kept => {
        if (cancelled) return
        const next = kept.filter(Boolean)
        setExtra(prev => prev.length === next.length && prev.every((p, i) => p.id === next[i].id) ? prev : next)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [nsfwEnabled, adult])

  return nsfwEnabled ? [...rest, ...extra] : rest
}
