import { FaBookmark, FaCheck, FaPlay } from "react-icons/fa"
import { C } from "./card.style"
import { Link } from "react-router-dom"
import { generateSlug } from "../../lib/slug"
import { useLocalStorage } from "../../hooks/useLocalStorage"
import { useAuth } from "../../hooks/useAuth"
import { supabase } from "../../lib/supabase"

const Card = ({ data }) => {
  const [bookmarks, setBookmarks] = useLocalStorage('aniraku-bookmarks', [])
  const { user } = useAuth()

  if (!data) return null

  const id = data.id || data.mal_id
  const title = data.title?.english || data.title?.romaji || data.title?.userPreferred || data.title || 'Unknown'
  const poster = data.coverImage?.large || data.images?.jpg?.image_url || ''
  const score = data.averageScore || data.score
  const episodes = data.episodes
  const format = data.format
  const accentColor = data.coverImage?.color || 'var(--accent)'
  const slug = generateSlug(title)
  const numericId = Number(id)
  const isBookmarked = bookmarks.some((bookmark) => Number(bookmark.id) === numericId)

  const toggleBookmark = async (event) => {
    event.preventDefault()
    event.stopPropagation()

    const next = isBookmarked
      ? bookmarks.filter((bookmark) => Number(bookmark.id) !== numericId)
      : [...bookmarks, { id: numericId, title, image: poster }]
    setBookmarks(next)

    try {
      if (user && isBookmarked) {
        await supabase.from('bookmarks').delete().eq('user_id', user.id).eq('anime_id', numericId)
      } else if (user) {
        await supabase.from('bookmarks').upsert({
          user_id: user.id,
          anime_id: numericId,
          title,
          image: poster,
          added_at: Date.now(),
        }, { onConflict: 'user_id,anime_id' })
      }
    } catch {
      // Keep the local mirror usable when the cloud bookmark request is unavailable.
    }
  }

  return (
    <C.Card style={{ '--media-color': accentColor }}>
      <Link to={`/anime/${slug}-${id}`} title={`View ${title} details`}>
        <C.Poster>
          {poster ? (
            <C.Image src={poster} alt={`${title} - Anime Poster`} loading="lazy" />
          ) : (
            <div style={{ width: '100%', height: '100%', background: '#161616', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No Image</div>
          )}
          <C.Overlay>
            <FaPlay size={28} />
          </C.Overlay>
          <C.BookmarkBtn onClick={toggleBookmark} aria-pressed={isBookmarked} aria-label={isBookmarked ? `Remove ${title} from bookmarks` : `Bookmark ${title}`} title={isBookmarked ? 'Remove bookmark' : 'Bookmark'}>
            {isBookmarked ? <FaCheck size={11} /> : <FaBookmark size={12} />}
          </C.BookmarkBtn>
          <C.Badges>
            {score && <C.Badge accent>{score}%</C.Badge>}
            {format && <C.Badge>{format}</C.Badge>}
          </C.Badges>
          {episodes && <C.EpBadge>Ep {episodes}</C.EpBadge>}
          <C.Preview>
            <C.PreviewMeta>
              {format && <span>{format}</span>}
              {episodes && <span>{episodes} eps</span>}
              {score && <span>{score}%</span>}
            </C.PreviewMeta>
            <C.PreviewAction>
              <FaPlay size={10} />
              <span>Open details</span>
            </C.PreviewAction>
          </C.Preview>
        </C.Poster>
      </Link>
      <C.Details>
        <Link to={`/anime/${slug}-${id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <C.Name>{title}</C.Name>
        </Link>
      </C.Details>
    </C.Card>
  )
}

export default Card
