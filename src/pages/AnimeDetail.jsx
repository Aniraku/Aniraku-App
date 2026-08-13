import React, { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { FaPlay, FaStar, FaBookmark, FaRegBookmark, FaCheck } from 'react-icons/fa'
import Footer from '../components/Footer/Footer'
import TrustStrip from '../components/TrustStrip'
import Comments from '../components/Comments/Comments'
import useLocalStorage from '../hooks/useLocalStorage'
import { useAnimeDetails, useSimilar } from '../hooks/useAnime'
import { useAuth } from '../hooks/useAuth'
import { filterAdult, isNsfw, useNsfw, useStreamable } from '../hooks/useNsfw'
import { supabase } from '../lib/supabase'
import { API_BASE } from '../config'
import { extractIdFromSlug, generateSlug } from '../lib/slug'
import { fetchEpisodeRatings } from '../lib/sync'
import styled from 'styled-components'
import { AnimeDetailSkeleton } from '../components/Skeletons/Skeletons'
import { setAnimeDetailSEO } from '../lib/seo'
import { historyEntryKey, subscribeToWatchHistory } from '../lib/watchHistory'

const Page = styled.div`
  min-height: 100vh;
  background: var(--bg);
  color: var(--text-primary);
  position: relative;
  overflow-x: hidden;
`

const PageBackground = styled.div`
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: 0.34;
  background-image:
    linear-gradient(to bottom, rgba(4, 7, 14, 0.16) 0%, rgba(4, 7, 14, 0.72) 58%, var(--bg) 94%),
    url(${p => p.$src});
  background-size: cover;
  background-position: center 18%;
  filter: blur(28px) saturate(1.18) brightness(0.72);
  transform: scale(1.08);
  transition: opacity 240ms ease, filter 240ms ease;
  @media (max-width: 768px) {
    opacity: 0.27;
    background-position: center top;
    filter: blur(22px) saturate(1.1) brightness(0.68);
  }
`

const Banner = styled.div`
  position: relative;
  height: 400px;
  overflow: hidden;
  z-index: 1;
  @media (max-width: 768px) { height: 300px; }
  @media (max-width: 480px) { height: 260px; }
`

const BannerImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: brightness(0.5);
`

const BannerOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.5) 50%, var(--bg) 100%);
`

const BannerContent = styled.div`
  position: absolute;
  bottom: 30px;
  left: 0;
  right: 0;
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 32px;
  display: flex;
  gap: 32px;
  align-items: flex-end;
  @media (max-width: 768px) { gap: 20px; padding: 0 20px; bottom: 20px; }
  @media (max-width: 480px) { gap: 16px; padding: 0 16px; bottom: 16px; }
`

const Cover = styled.img`
  width: 150px;
  height: 210px;
  object-fit: cover;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  flex-shrink: 0;
  @media (max-width: 768px) { width: 110px; height: 155px; }
  @media (max-width: 480px) { width: 90px; height: 127px; border-radius: 6px; }
`

const Info = styled.div`
  flex: 1;
  padding-bottom: 8px;
  min-width: 0;
`

const Title = styled.h1`
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
  @media (max-width: 768px) { font-size: 22px; }
  @media (max-width: 480px) { font-size: 18px; }
`

const Meta = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 8px;
  flex-wrap: wrap;
  align-items: center;
  font-size: 13px;
  color: var(--text-muted);
  @media (max-width: 480px) { font-size: 12px; gap: 8px; }
`

const Score = styled.span`
  color: #ffc107;
  display: flex;
  align-items: center;
  gap: 4px;
`

const Actions = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
`

const WatchBtn = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  background: var(--accent);
  color: var(--bg);
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  text-decoration: none;
  transition: opacity 0.2s;
  min-height: 44px;
  &:hover { opacity: 0.9; }
  @media (max-width: 480px) { padding: 8px 18px; font-size: 13px; min-height: 40px; }
`

const BookmarkBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: var(--bg-elevated);
  color: ${p => p.$active ? 'var(--accent)' : 'var(--text-muted)'};
  border: 1px solid var(--border);
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 44px;
  -webkit-tap-highlight-color: transparent;
  &:hover { border-color: var(--accent); }
  @media (max-width: 480px) { padding: 8px 14px; font-size: 13px; min-height: 40px; }
`

const ProgressHint = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.4;
`

const EpisodeState = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  color: ${({ $rated }) => ($rated ? '#fbbf24' : '#86efac')};
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
`

const EpisodeProgress = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  background: rgba(255,255,255,0.14);
  span {
    display: block;
    height: 100%;
    width: ${({ $value }) => `${Math.max(0, Math.min(100, $value || 0))}%`};
    background: ${({ $complete }) => ($complete ? '#4ade80' : 'var(--accent)')};
  }
`

const RatingBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  border-radius: 5px;
  background: rgba(251,191,36,0.15);
  color: #fbbf24;
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
`

const Content = styled.div`
  max-width: 1100px;
  margin: 0 auto;
  padding: 32px 32px;
  @media (max-width: 768px) { padding: 24px 20px; }
  @media (max-width: 480px) { padding: 20px 16px; }
`

const Section = styled.section`
  margin-bottom: 28px;
  @media (max-width: 480px) { margin-bottom: 20px; }
`

const SectionTitle = styled.h2`
  font-size: 16px;
  margin-bottom: 10px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 8px;
`

const Desc = styled.p`
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.7;
  @media (max-width: 480px) { font-size: 13px; line-height: 1.6; }
`

const GenreRow = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`

const GenreTag = styled(Link)`
  padding: 3px 10px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.2s;
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  &:hover { border-color: var(--accent); color: var(--text-primary); }
  @media (max-width: 480px) { padding: 2px 8px; font-size: 10px; border-radius: 6px; min-height: 26px; }
`

const Tabs = styled.div`
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 20px;
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
  -webkit-overflow-scrolling: touch;
`

const Tab = styled.button`
  padding: 10px 20px;
  background: none;
  border: none;
  border-bottom: 2px solid ${p => p.$active ? 'var(--accent)' : 'transparent'};
  color: ${p => p.$active ? 'var(--text-primary)' : 'var(--text-muted)'};
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.2s, border-color 0.2s;
  min-height: 44px;
  -webkit-tap-highlight-color: transparent;
  &:hover { color: var(--text-primary); }
  @media (max-width: 480px) { padding: 8px 14px; font-size: 13px; min-height: 40px; }
`

const EpisodeList = styled.div`
  max-height: 500px;
  overflow-y: auto;
  background: var(--bg-elevated);
  border-radius: 8px;
  border: 1px solid var(--border);
  scrollbar-width: thin;
  -webkit-overflow-scrolling: touch;
  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
  @media (max-width: 480px) { max-height: 400px; border-radius: 6px; }
`

const EpisodeRow = styled(Link)`
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--border);
  text-decoration: none;
  color: var(--text-muted);
  font-size: 13px;
  transition: background 0.15s;
  min-height: 44px;
  -webkit-tap-highlight-color: transparent;
  &:hover { background: rgba(255,255,255,0.03); }
  &:last-child { border-bottom: none; }
  &:active { background: rgba(255,255,255,0.05); }
  @media (max-width: 480px) { padding: 6px 12px; gap: 10px; font-size: 12px; min-height: 40px; }
`

const EpThumb = styled.img`
  width: 60px;
  height: 34px;
  object-fit: contain;
  border-radius: 4px;
  flex-shrink: 0;
  background: var(--bg-card);
  @media (max-width: 480px) { width: 50px; height: 28px; }
`

const EpNum = styled.span`
  width: 24px;
  text-align: right;
  font-weight: 600;
  font-size: 12px;
  color: var(--text-muted);
  flex-shrink: 0;
`

const EpBadge = styled.span`
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  flex-shrink: 0;
  background: ${({ $type }) => ($type === 'filler' ? 'rgba(234,179,8,0.15)' : 'rgba(99,102,241,0.15)')};
  color: ${({ $type }) => ($type === 'filler' ? '#fde68a' : '#a5b4fc')};
`

const FilterBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  margin-bottom: 12px;
  background: ${({ $active }) => ($active ? 'rgba(99,102,241,0.18)' : 'var(--bg-elevated)')};
  color: ${({ $active }) => ($active ? '#a5b4fc' : 'var(--text-muted)')};
  border: 1px solid ${({ $active }) => ($active ? 'rgba(99,102,241,0.45)' : 'var(--border)')};
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  min-height: 30px;
  -webkit-tap-highlight-color: transparent;
  &:hover { border-color: var(--accent); }
`

const Spinner = styled.div`
  width: 48px;
  height: 48px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  @keyframes spin { to { transform: rotate(360deg); } }
`

const Center = styled.div`
  min-height: 80vh;
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
`

const EPISODE_RATINGS_LS_KEY = 'aniraku-episode-ratings'

function normalizeActivityRow(row) {
  const rawEpisode = row?.episode ?? row?.episode_number
  const episode = Number(rawEpisode)
  if (!Number.isInteger(episode) || episode < 1) return null
  const rawTime = row?.time ?? row?.progress ?? 0
  const rawDuration = row?.duration ?? 0
  const time = Math.max(0, Number(rawTime) || 0)
  const duration = Math.max(0, Number(rawDuration) || 0)
  const timestampValue = row?.timestamp
  const timestamp = typeof timestampValue === 'number'
    ? timestampValue
    : Number(timestampValue) || Date.parse(timestampValue || '') || 0
  return {
    animeId: row?.animeId ?? row?.anime_id,
    episode,
    time,
    duration,
    timestamp,
    completed: row?.completed === true || row?.status === 'completed' || duration <= 0 || (duration > 0 && time >= Math.max(duration - 5, duration * 0.9)),
  }
}

function mergeActivityRows(rows) {
  const byEpisode = new Map()
  rows.forEach((row) => {
    const normalized = normalizeActivityRow(row)
    if (!normalized) return
    const previous = byEpisode.get(normalized.episode)
    if (!previous || normalized.timestamp >= previous.timestamp) {
      byEpisode.set(normalized.episode, normalized)
    }
  })
  return [...byEpisode.values()].sort((a, b) => b.timestamp - a.timestamp)
}

const RELATION_LABELS = {
  PREQUEL: 'Prequel', SEQUEL: 'Sequel', SIDE_STORY: 'Side Story',
  SPIN_OFF: 'Spin Off', SUMMARY: 'Summary', ALTERNATIVE: 'Alternative',
  ADAPTATION: 'Adaptation', CHARACTER: 'Character', OTHER: 'Other',
  PARENT: 'Parent', COMPANION: 'Companion', INCLUDES: 'Includes', GIFTED_FROM: 'Based On',
}

const CardLink = styled(Link)`
  text-decoration: none;
  display: block;
  -webkit-tap-highlight-color: transparent;
`

const CardInner = styled.div`
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-card);
  aspect-ratio: 16/10;
  @media (max-width: 480px) { border-radius: 6px; }
`

const CardImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: filter 0.3s;
  ${CardLink}:hover & { filter: brightness(1.15); }
  @media (hover: none) { transition: none; }
`

const CardGradient = styled.div`
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 50%);
`

const CardBadge = styled.span`
  position: absolute;
  top: 6px;
  left: 6px;
  background: ${p => p.$variant === 'score' ? 'rgba(0,0,0,0.8)' : 'rgba(99,102,241,0.9)'};
  color: ${p => p.$variant === 'score' ? '#ffc107' : '#fff'};
  font-size: ${p => p.$variant === 'score' ? '10px' : '9px'};
  font-weight: 700;
  padding: ${p => p.$variant === 'score' ? '2px 6px' : '2px 7px'};
  border-radius: 3px;
  ${p => p.$variant === 'score' ? '' : 'text-transform: uppercase; letter-spacing: 0.3px;'}
  z-index: 1;
  @media (max-width: 480px) {
    font-size: ${p => p.$variant === 'score' ? '9px' : '8px'};
    padding: ${p => p.$variant === 'score' ? '1px 5px' : '1px 5px'};
  }
`

const CardTitle = styled.p`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20px 8px 8px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
  margin: 0;
  @media (max-width: 480px) { font-size: 11px; padding: 16px 6px 6px; }
`

const CardMeta = styled.div`
  position: absolute;
  bottom: 28px;
  left: 8px;
  display: flex;
  gap: 6px;
  font-size: 10px;
  color: rgba(255,255,255,0.7);
  @media (max-width: 480px) { bottom: 24px; left: 6px; font-size: 9px; gap: 4px; }
`

const Grid = styled.div`
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  @media (max-width: 480px) {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  @media (min-width: 768px) and (max-width: 1024px) {
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  @media (min-width: 1025px) {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 16px;
  }
`

const NsfwCard = styled.div`
  text-align: center;
  padding: 40px;
  max-width: 400px;
  background: var(--bg-elevated);
  border-radius: 16px;
  border: 1px solid var(--border);
  margin: 0 16px;
  @media (max-width: 480px) { padding: 28px 20px; border-radius: 12px; margin: 0 12px; }
`

const NsfwBtn = styled.button`
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 10px 24px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  min-height: 44px;
  -webkit-tap-highlight-color: transparent;
`

const OutlineLink = styled(Link)`
  background: transparent;
  color: var(--text-muted);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 24px;
  font-size: 14px;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  min-height: 44px;
`

const RelationCard = ({ r }) => {
  const item = r?.node || r
  if (!item?.id) return null
  const t = item.title?.english || item.title?.romaji || item.title?.userPreferred || 'Unknown'
  const label = RELATION_LABELS[r?.relationType] || r?.relationType?.replace('_', ' ') || ''
  return (
    <CardLink to={`/anime/${generateSlug(t)}-${item.id}`}>
      <CardInner>
        <CardImg src={item.coverImage?.large || ''} alt={t} loading="lazy" />
        <CardGradient />
        <CardBadge>{label}</CardBadge>
        <CardTitle>{t}</CardTitle>
      </CardInner>
    </CardLink>
  )
}

const RecCard = ({ item }) => {
  const t = item.title?.english || item.title?.romaji || 'Unknown'
  return (
    <CardLink to={`/anime/${generateSlug(t)}-${item.id}`}>
      <CardInner>
        <CardImg src={item.coverImage?.large || ''} alt={t} loading="lazy" />
        <CardGradient />
        {item.averageScore > 0 && (
          <CardBadge $variant="score">★ {item.averageScore}%</CardBadge>
        )}
        <CardTitle>{t}</CardTitle>
        <CardMeta>
          {item.format && <span>{item.format.replace('_', ' ')}</span>}
          {item.episodes && <span>{item.episodes} ep</span>}
        </CardMeta>
      </CardInner>
    </CardLink>
  )
}

const AnimeDetail = () => {
  const { slugId } = useParams()
  const navigate = useNavigate()
  const id = extractIdFromSlug(slugId)
  const { user } = useAuth()
  const { nsfwEnabled } = useNsfw()
  const [bookmarks, setBookmarks] = useLocalStorage('aniraku-bookmarks', [])
  const [activeTab, setActiveTab] = useState('episodes')
  const [episodes, setEpisodes] = useState([])
  const [episodesFallback, setEpisodesFallback] = useState(false)
  const [hideFillers, setHideFillers] = useState(false)
  const [watchHistory, setWatchHistory] = useState([])
  const [episodeRatings, setEpisodeRatings] = useState({})

  const { data: anime, isLoading } = useAnimeDetails(id)
  const { data: similar } = useSimilar(id)
  const similarList = useStreamable(filterAdult(similar || [], nsfwEnabled))
  const isBookmarked = bookmarks.some(b => b.id === parseInt(id))

  // Bookmarks live in Supabase when signed in (cloud source of truth);
  // localStorage only mirrors them. On login, push any guest-only local
  // bookmarks up to the cloud once, then load cloud data as truth.
  React.useEffect(() => {
    if (!user) return
    let cancelled = false
    supabase.from('bookmarks').select('anime_id,title,image').eq('user_id', user.id)
      .then(async ({ data }) => {
        if (cancelled) return
        const mapped = (data || []).map(b => ({ id: b.anime_id, title: b.title, image: b.image }))
        const cloudIds = new Set(mapped.map(m => m.id))
        let local = []
        try {
          local = JSON.parse(localStorage.getItem('aniraku-bookmarks') || '[]')
        } catch {}
        const localOnly = local.filter(l => !cloudIds.has(l.id))
        if (localOnly.length) {
          await supabase.from('bookmarks').upsert(localOnly.map(l => ({
            user_id: user.id,
            anime_id: l.id,
            title: l.title || '',
            image: l.image || '',
            added_at: Date.now(),
          })), { onConflict: 'user_id,anime_id' })
        }
        if (cancelled) return
        setBookmarks([...mapped, ...localOnly])
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user, setBookmarks])

  React.useEffect(() => {
    if (!anime) return undefined
    const title = anime.title?.english || anime.title?.romaji || anime.title?.userPreferred || 'Unknown Anime'
    const canonicalPath = `/anime/${generateSlug(title)}-${anime.id}`
    setAnimeDetailSEO(anime)
    if (window.location.pathname !== canonicalPath) {
      navigate(canonicalPath, { replace: true })
    }
    return undefined
  }, [anime, navigate])

  React.useEffect(() => subscribeToWatchHistory((detail) => {
    if (detail.type === 'clear') {
      setWatchHistory([])
      return
    }
    if (detail.type === 'remove' && detail.keys?.length) {
      const removed = new Set(detail.keys)
      setWatchHistory((prev) => prev.filter((row) => !removed.has(historyEntryKey({ animeId: id, episode: row.episode }))))
    }
  }), [id])

  React.useEffect(() => {
    if (!id) return undefined
    let cancelled = false
    let localRows = []
    try {
      localRows = JSON.parse(localStorage.getItem('aniraku-watch-history') || '[]')
        .filter((row) => String(row.animeId ?? row.anime_id) === String(id))
    } catch {}

    const loadHistory = async () => {
      let cloudRows = []
      if (user) {
        try {
          const { data } = await supabase
            .from('watch_history')
            .select('episode_number, progress, duration, timestamp')
            .eq('user_id', user.id)
            .eq('anime_id', parseInt(id, 10))
          cloudRows = data || []
        } catch {}
      }
      if (!cancelled) setWatchHistory(mergeActivityRows([...localRows, ...cloudRows]))
    }

    loadHistory()
    return () => { cancelled = true }
  }, [id, user])

  React.useEffect(() => {
    if (!id) return undefined
    let cancelled = false
    setEpisodeRatings({})
    if (user) {
      fetchEpisodeRatings(id).then((ratings) => {
        if (!cancelled) setEpisodeRatings(ratings || {})
      })
    } else {
      try {
        const stored = JSON.parse(localStorage.getItem(`${EPISODE_RATINGS_LS_KEY}-${id}`) || '{}')
        if (!cancelled) setEpisodeRatings(stored || {})
      } catch {
        if (!cancelled) setEpisodeRatings({})
      }
    }
    return () => { cancelled = true }
  }, [id, user])

  const relations = React.useMemo(() => {
    if (!anime?.relations?.edges) return []
    return anime.relations.edges
      .filter(e => e.node?.id && ['ADAPTATION', 'SEQUEL', 'PREQUEL', 'SPIN_OFF', 'SIDE_STORY'].includes(e.relationType))
      .map(e => ({ ...e.node, relationType: e.relationType }))
  }, [anime])

  React.useEffect(() => {
    if (!anime) return undefined
    const controller = new AbortController()
    let cancelled = false

    const fallbackEpisodes = () => {
      // Prioritize AniList's real streaming episode metadata (titles + thumbnails)
      if (Array.isArray(anime?.streamingEpisodes) && anime.streamingEpisodes.length > 0) {
        return anime.streamingEpisodes.map((ep, i) => {
          // AniList titles often look like "Episode 1 - Title" or "1: Title"
          // We'll try to extract just the title if possible, otherwise use as-is.
          const cleanTitle = ep.title?.replace(/^(Episode\s+\d+\s*-\s*|\d+:\s*)/i, '') || `Episode ${i + 1}`
          return {
            number: i + 1,
            title: cleanTitle,
            thumbnail: ep.thumbnail || anime.coverImage?.large || anime.coverImage?.medium || '',
            url: ep.url,
          }
        })
      }
      // Movies are one playable item even when AniList omits `episodes`.
      if (!anime?.episodes && anime?.format === 'MOVIE') {
        return [{
          number: 1,
          title: title || 'Movie',
          thumbnail: anime.coverImage?.medium || anime.coverImage?.large || '',
        }]
      }
      // Absolute last resort: generic list if AniList also has no metadata
      if (!anime?.episodes) return []
      return Array.from({ length: anime.episodes }, (_, i) => ({
        number: i + 1,
        title: `Episode ${i + 1}`,
        thumbnail: anime.coverImage?.medium || anime.coverImage?.large || '',
      }))
    }

    const loadEpisodes = async () => {
      setEpisodesFallback(false)
      try {
        let response
        let lastError
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            response = await fetch(`${API_BASE}/api/v1/anime/${id}/episodes`, {
              signal: controller.signal,
              headers: { Accept: 'application/json' },
            })
            if (response.ok) break
            lastError = new Error(`Episode API returned ${response.status}`)
          } catch (error) {
            if (error?.name === 'AbortError') return
            lastError = error
          }
          if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 350))
        }

        if (!response?.ok) throw lastError || new Error('Episode API unavailable')
        const epData = await response.json()
        const eps = Array.isArray(epData?.episodes)
          ? epData.episodes.filter(Boolean).map((ep, index) => {
            const num = index + 1
            return {
              ...ep,
              number: num,
              title: (ep.title && ep.title.toLowerCase() === `episode ${ep.number}`) 
                ? `Episode ${num}` 
                : ep.title,
            }
          })
          : []
        if (!cancelled) {
          setEpisodes(eps.length > 0 ? eps : fallbackEpisodes())
          setEpisodesFallback(eps.length === 0)
        }
      } catch (error) {
        if (error?.name === 'AbortError' || cancelled) return
        const fallback = fallbackEpisodes()
        setEpisodes(fallback)
        setEpisodesFallback(fallback.length > 0)
      }
    }

    loadEpisodes()
    setActiveTab('episodes')
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [anime, id])

  const toggleBookmark = () => {
    const numericId = parseInt(id)
    if (isBookmarked) {
      setBookmarks(bookmarks.filter(b => b.id !== numericId))
      if (user) {
        supabase.from('bookmarks').delete().eq('user_id', user.id).eq('anime_id', numericId).then()
      }
    } else if (anime) {
      setBookmarks([...bookmarks, {
        id: numericId,
        title: anime.title?.english || anime.title?.romaji || 'Unknown',
        image: anime.coverImage?.large || '',
      }])
      if (user) {
        supabase.from('bookmarks').upsert({
          user_id: user.id,
          anime_id: numericId,
          title: anime.title?.english || anime.title?.romaji || 'Unknown',
          image: anime.coverImage?.large || '',
          added_at: Date.now(),
        }, { onConflict: 'user_id,anime_id' }).then()
      }
    }
  }

  if (isLoading) return <AnimeDetailSkeleton />

  if (!anime) return (
    <>
      <Center>
        <div style={{ textAlign: 'center', padding: '0 20px' }}>
          <p style={{ fontSize: 18, marginBottom: 12, color: 'var(--text-muted)' }}>Anime not found</p>
          <Link to="/home" style={{ color: 'var(--accent)', fontSize: 14 }}>Back to Home</Link>
        </div>
      </Center>
    </>
  )

  if (isNsfw(anime) && !nsfwEnabled) return (
    <>
      <Center>
        <NsfwCard>
          <div style={{ fontSize: 48, marginBottom: 16 }}>18+</div>
          <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
            Mature Content
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>
            This title contains adult content. Enable NSFW content in your settings to view it.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <NsfwBtn as={Link} to="/profile/settings">Open Settings</NsfwBtn>
            <OutlineLink to="/home">Go Back</OutlineLink>
          </div>
        </NsfwCard>
      </Center>
    </>
  )

  const title = anime.title?.english || anime.title?.romaji || 'Unknown'
  const desc = (anime.description || '').replace(/<[^>]*>/g, '').slice(0, 500)
  const isMovie = anime.format === 'MOVIE'
  const hasEpisodes = episodes.length > 0
  const hasRelations = relations.length > 0
  const activityByEpisode = new Map(watchHistory.map((row) => [row.episode, row]))
  const watchedEpisodes = new Set(watchHistory.map((row) => row.episode))
  const completedEpisodes = new Set(
    watchHistory.filter((row) => row.completed).map((row) => row.episode)
  )
  const hasProgress = watchHistory.some((row) => row.time > 0)
  const hasWatchActivity = hasProgress || watchedEpisodes.size > 0
  const expectedEpisodeCount = isMovie ? 1 : Number(anime.episodes) || episodes.length
  const nextUnwatched = episodes.find((ep) => !watchedEpisodes.has(Number(ep.number)))
  const highestWatched = Math.max(0, ...[...watchedEpisodes].map(Number))
  const highestCompleted = Math.max(0, ...[...completedEpisodes].map(Number))
  const latestPartial = Math.max(
    0,
    ...watchHistory.filter((row) => !row.completed && row.time > 0).map((row) => row.episode)
  )
  const firstEpisodeNumber = nextUnwatched?.number || 1
  const nextEpisodeNumber = highestCompleted > 0
    ? highestCompleted + 1
    : (highestWatched > 0 ? highestWatched + 1 : firstEpisodeNumber)
  const resumeEpisode = latestPartial > highestCompleted ? latestPartial : nextEpisodeNumber
  const partialEpisode = watchHistory.find((row) => row.episode === resumeEpisode && !row.completed && row.time > 0)
  const allEpisodesComplete = hasEpisodes && episodes.length >= expectedEpisodeCount && episodes.every((ep) => completedEpisodes.has(Number(ep.number)))
  const actionMode = allEpisodesComplete ? 'rewatch' : hasWatchActivity ? 'continue' : 'watch'
  const actionEpisode = actionMode === 'continue'
    ? resumeEpisode
    : actionMode === 'rewatch'
      ? 1
      : firstEpisodeNumber
  const actionLabel = actionMode === 'rewatch'
    ? 'Rewatch'
    : actionMode === 'continue'
      ? `Continue Episode ${actionEpisode}`
      : 'Watch Now'
  const actionHint = actionMode === 'rewatch'
    ? 'You completed this title. Start again from Episode 1.'
    : actionMode === 'continue'
      ? `Resume from Episode ${actionEpisode}${partialEpisode?.time ? ` at ${Math.floor(partialEpisode.time / 60)}:${String(Math.floor(partialEpisode.time % 60)).padStart(2, '0')}` : ''}.`
      : ''
  const hiddenEpCount = episodes.filter(ep => ep.filler || ep.recap).length
  const visibleEps = hideFillers
    ? episodes.filter(ep => !ep.filler && !ep.recap)
    : episodes
  const tabs = []
  if (hasEpisodes) {
    tabs.push({
      key: 'episodes',
      label: isMovie
        ? 'Movie'
        : `Episodes (${visibleEps.length}${hideFillers ? ` of ${episodes.length}` : ''})`,
    })
  }
  if (hasRelations) tabs.push({ key: 'relations', label: 'Relations' })

  return (
    <Page className="anime-detail-page">
      <PageBackground $src={anime.bannerImage || anime.coverImage?.extraLarge || anime.coverImage?.large || ''} />
      <main style={{ position: 'relative', zIndex: 1 }}>
      <Banner>
        <BannerImg src={anime.bannerImage || anime.coverImage?.extraLarge || anime.coverImage?.large || ''} alt="" />
        <BannerOverlay />
        <BannerContent>
          <Cover src={anime.coverImage?.large || ''} alt={title} />
          <Info>
            <Title>{title}</Title>
            <Meta>
              {!!anime.averageScore && <Score><FaStar /> {anime.averageScore}%</Score>}
              {!!anime.format && <span>{anime.format}</span>}
              {!isMovie && !!anime.episodes && <span>{anime.episodes} episodes</span>}
              {!!anime.status && <span>{anime.status}</span>}
            </Meta>
            <Actions>
              {hasEpisodes && (
                <WatchBtn to={`/watch/${generateSlug(title)}-${id}-episode-${actionEpisode}`}>
                  <FaPlay /> {actionLabel}
                </WatchBtn>
              )}
              <BookmarkBtn $active={isBookmarked} onClick={toggleBookmark}>
                {isBookmarked ? <FaBookmark /> : <FaRegBookmark />} {isBookmarked ? 'Bookmarked' : 'Bookmark'}
              </BookmarkBtn>
              {actionHint && <ProgressHint>{actionHint}</ProgressHint>}
            </Actions>
          </Info>
        </BannerContent>
      </Banner>

      <Content>
        {desc && (
          <Section>
            <SectionTitle>Synopsis</SectionTitle>
            <Desc>{desc}{(anime.description || '').length > 500 ? '...' : ''}</Desc>
          </Section>
        )}

        {anime.genres?.length > 0 && (
          <Section>
            <GenreRow>
              {anime.genres.map(g => (
                <GenreTag key={g} to={`/catalog?genre=${encodeURIComponent(g)}`}>{g}</GenreTag>
              ))}
            </GenreRow>
          </Section>
        )}

        {tabs.length > 0 && (
          <Section>
            <Tabs>
              {tabs.map(t => (
                <Tab key={t.key} $active={activeTab === t.key} onClick={() => setActiveTab(t.key)}>
                  {t.label}
                </Tab>
              ))}
            </Tabs>

            {activeTab === 'episodes' && hasEpisodes && (
              <>
                {episodesFallback && (
                  <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.25)', color: '#fde68a', fontSize: 12 }} role="status">
                    Detailed episode metadata is temporarily unavailable, so the standard episode list is being shown. The title, poster, and episode count come from AniList; playback availability is resolved separately from third-party sources.
                  </div>
                )}
                {hiddenEpCount > 0 && (
                  <FilterBtn $active={hideFillers} onClick={() => setHideFillers(p => !p)}>
                    {hideFillers ? '✓ Showing canon only' : 'Hide filler & recap'}
                  </FilterBtn>
                )}
                <EpisodeList>
                  {visibleEps.map((ep, i) => {
                    // Preserve the episode's canonical source position even when
                    // filler/recap filtering hides earlier rows.
                    const num = Number(ep.number) || episodes.indexOf(ep) + 1 || i + 1
                    const activity = activityByEpisode.get(num)
                    const rated = Number(episodeRatings[num]) || 0
                    const progress = activity
                      ? activity.duration > 0
                        ? Math.min(100, (activity.time / activity.duration) * 100)
                        : activity.completed ? 100 : 0
                      : 0
                    return (
                      <EpisodeRow
                        key={num}
                        to={`/watch/${generateSlug(title)}-${id}-episode-${num}`}
                        data-watched={activity ? 'true' : 'false'}
                      >
                        <EpThumb src={ep.thumbnail || ''} alt="" loading="lazy" />
                        <EpNum>{num}</EpNum>
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ep.title || `Episode ${num}`}
                        </span>
                        {!!ep.filler && <EpBadge $type="filler">FILLER</EpBadge>}
                        {!!ep.recap && <EpBadge $type="recap">RECAP</EpBadge>}
                        {activity && <EpisodeState title={activity.completed ? 'Completed' : 'In progress'}><FaCheck size={9} /> {activity.completed ? 'Watched' : 'In progress'}</EpisodeState>}
                        {rated > 0 && <RatingBadge title={`You rated this episode ${rated}/10`}><FaStar size={8} /> {rated}/10</RatingBadge>}
                        <FaPlay size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        {activity && <EpisodeProgress $value={progress} $complete={activity.completed}><span /></EpisodeProgress>}
                      </EpisodeRow>
                    )
                  })}
                </EpisodeList>
                {visibleEps.length === 0 && (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '12px 0' }}>
                    No canon episodes listed. Switch back to see all episodes.
                  </p>
                )}
              </>
            )}

            {activeTab === 'relations' && hasRelations && (
              <Grid>
                {relations.map(r => <RelationCard key={r.id} r={{ node: r, relationType: r.relationType || '' }} />)}
              </Grid>
            )}
          </Section>
        )}

        <TrustStrip />
        <Section>
          <Comments animeId={anime.id} />
        </Section>

        {similarList?.length > 0 && (
          <Section>
            <SectionTitle>Similar Anime</SectionTitle>
            <Grid>
              {similarList.map(item => <RecCard key={item.id} item={item} />)}
            </Grid>
          </Section>
        )}
      </Content>
      </main>
      <Footer />
    </Page>
  )
}

export default AnimeDetail
