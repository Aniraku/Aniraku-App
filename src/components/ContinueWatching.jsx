import React, { useMemo, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import styled from 'styled-components'
import { API_BASE } from '../config'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { generateSlug } from '../lib/slug'
import { subscribeToWatchHistory } from '../lib/watchHistory'

const Section = styled.section`
  max-width: 1400px;
  margin: 0 auto;
  padding: 1.5rem 1rem 0.5rem;
`

const Title = styled.h2`
  color: #fff;
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  &::before {
    content: '';
    width: 4px;
    height: 1.1em;
    background: var(--accent);
    border-radius: 2px;
  }
`

const Row = styled.div`
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 8px;
  scrollbar-width: thin;
  &::-webkit-scrollbar { height: 6px; }
  &::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
`

const Card = styled(Link)`
  flex: 0 0 160px;
  background: var(--bg-card);
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--border);
  text-decoration: none;
  color: var(--text-primary);
  transition: transform 0.15s, border-color 0.15s;
  &:hover {
    transform: translateY(-3px);
    border-color: var(--accent);
  }
  @media (max-width: 480px) {
    flex: 0 0 130px;
  }
`

const Thumb = styled.div`
  position: relative;
  height: 100px;
  background: var(--bg-elevated);
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`

const Progress = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  background: rgba(255,255,255,0.15);
  span {
    display: block;
    height: 100%;
    background: var(--accent);
    width: ${p => p.value || 0}%;
  }
`

const Meta = styled.div`
  padding: 8px 10px 10px;
  p {
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  small {
    color: #888;
    font-size: 11px;
  }
`

const ContinueWatching = () => {
  const { user } = useAuth()
  const [serverItems, setServerItems] = useState([])
  const [historyVersion, setHistoryVersion] = useState(0)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled || !session?.access_token) return
      axios.get(`${API_BASE}/api/v1/continue-watching`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).then(r => {
        if (!cancelled && Array.isArray(r.data)) setServerItems(r.data)
      }).catch(() => {})
    })
    return () => { cancelled = true }
  }, [user])

  useEffect(() => subscribeToWatchHistory(() => {
    setHistoryVersion((version) => version + 1)
  }), [])

  const items = useMemo(() => {
    const local = []
    try {
      local.push(...JSON.parse(localStorage.getItem('aniraku-watch-history') || '[]'))
    } catch {}

    const byKey = new Map()
    const merge = (item) => {
      const key = `${item.animeId}-${item.episode || item.episode_number}`
      // History rows occasionally carry the AniList title OBJECT instead of
      // a string (older writes) — normalize so slug generation never sees
      // a non-string (a toLowerCase() on an object crashes the Home page).
      const rawTitle = item.title ?? item.anime_title ?? `Anime ${item.animeId}`
      const title = (typeof rawTitle === 'object' && rawTitle !== null)
        ? (rawTitle.english || rawTitle.romaji || rawTitle.userPreferred || rawTitle.native || `Anime ${item.animeId}`)
        : String(rawTitle)
      const candidate = {
        animeId: item.animeId,
        title,
        image: item.image || item.anime_image || '',
        episode: item.episode || item.episode_number,
        time: item.time ?? item.progress ?? 0,
        duration: item.duration || 0,
        timestamp: item.timestamp || 0,
      }
      const existing = byKey.get(key)
      // Newer write wins, whether it came from this device or another.
      if (!existing || candidate.timestamp > existing.timestamp) byKey.set(key, candidate)
    }
    serverItems.forEach(merge)
    local.forEach(merge)

    const merged = [...byKey.values()]
    merged.sort((a, b) => b.timestamp - a.timestamp)
    return merged.slice(0, 12)
  }, [serverItems, historyVersion])

  if (!items.length) return null

  return (
    <Section>
      <Title>Continue Watching</Title>
      <Row>
        {items.map((h, i) => (
          <Card key={`${h.animeId}-${h.episode}-${i}`} to={`/watch/${generateSlug(h.title)}-${h.animeId}-episode-${h.episode}`}>
            <Thumb>
              {h.image ? <img src={h.image} alt="" loading="lazy" /> : <div style={{ height: '100%', background: '#222' }} />}
              <Progress value={h.duration ? Math.min(100, (h.time / h.duration) * 100) : 30}>
                <span />
              </Progress>
            </Thumb>
            <Meta>
              <p>{h.title || `Anime ${h.animeId}`}</p>
              <small>Ep {h.episode}</small>
            </Meta>
          </Card>
        ))}
      </Row>
    </Section>
  )
}

export default ContinueWatching
