import React from 'react'
import { C } from './card.style'
import { Link } from 'react-router-dom'
import { generateSlug } from '../../lib/slug'

const CardTwo = ({ data }) => {
  if (!data) return null

  const id = data.id || data.mal_id
  const title = data.title?.english || data.title?.romaji || data.title?.userPreferred || data.title || 'Unknown'
  const poster = data.coverImage?.large || data.images?.jpg?.image_url || ''
  const score = data.averageScore || data.score
  const slug = generateSlug(title)

  return (
    <C.Card>
      <Link to={`/anime/${slug}-${id}`}>
        <C.Poster>
          {poster ? <C.Image src={poster} alt={title} /> : <div style={{ width: '100%', height: '100%', background: '#2a2c31', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>No Image</div>}
          <C.InfoL>
            {score && <C.BtnL style={{ background: '#ffc107', color: '#000' }}>{score}%</C.BtnL>}
          </C.InfoL>
          {data.episodes && (
            <C.InfoR>
              <C.BtnR>Ep {data.episodes}</C.BtnR>
            </C.InfoR>
          )}
        </C.Poster>
      </Link>
      <C.Details>
        <C.Name>{title}</C.Name>
        <C.MovieInfo>
          {data.format || data.type || ''} {score ? `• Score: ${score}` : ''}
        </C.MovieInfo>
      </C.Details>
    </C.Card>
  )
}

export default CardTwo
