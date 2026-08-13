import { supabase } from './supabase'

export const WATCH_HISTORY_KEY = 'aniraku-watch-history'
export const WATCH_HISTORY_EVENT = 'aniraku:watch-history-changed'

export const historyEntryKey = (entry) =>
  `${String(entry?.animeId ?? entry?.anime_id ?? '')}:${Number(entry?.episode ?? entry?.episode_number ?? 0)}`

const safeRead = () => {
  try {
    const value = JSON.parse(localStorage.getItem(WATCH_HISTORY_KEY) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

const publish = (detail) => {
  window.dispatchEvent(new CustomEvent(WATCH_HISTORY_EVENT, { detail }))
}

export const upsertWatchHistory = (entry) => {
  const current = safeRead()
  const key = historyEntryKey(entry)
  const next = [entry, ...current.filter((item) => historyEntryKey(item) !== key)].slice(0, 100)
  localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(next))
  publish({ type: 'upsert', entries: [entry], keys: [key] })
  return next
}

export const removeWatchHistoryEntries = async ({ entries, userId }) => {
  const keys = new Set((entries || []).map(historyEntryKey))
  if (!keys.size) return []

  const next = safeRead().filter((item) => !keys.has(historyEntryKey(item)))
  localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(next))
  publish({ type: 'remove', keys: [...keys] })

  if (userId) {
    await Promise.all(
      (entries || []).map((entry) =>
        supabase
          .from('watch_history')
          .delete()
          .eq('user_id', userId)
          .eq('anime_id', Number(entry.animeId ?? entry.anime_id))
          .eq('episode_number', Number(entry.episode ?? entry.episode_number))
      )
    )
  }
  return next
}

export const clearWatchHistory = async ({ userId } = {}) => {
  localStorage.removeItem(WATCH_HISTORY_KEY)
  publish({ type: 'clear', keys: [] })
  if (userId) {
    await supabase.from('watch_history').delete().eq('user_id', userId)
  }
}

export const subscribeToWatchHistory = (listener) => {
  const handleChange = (event) => listener(event.detail || {})
  const handleStorage = (event) => {
    if (event.key === WATCH_HISTORY_KEY) listener({ type: 'storage', keys: [] })
  }
  window.addEventListener(WATCH_HISTORY_EVENT, handleChange)
  window.addEventListener('storage', handleStorage)
  return () => {
    window.removeEventListener(WATCH_HISTORY_EVENT, handleChange)
    window.removeEventListener('storage', handleStorage)
  }
}

export const readWatchHistory = safeRead
