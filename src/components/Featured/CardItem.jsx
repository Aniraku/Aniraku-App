import React from 'react'
import { Link } from 'react-router-dom'
import { F } from './featured.style'
import { generateSlug } from '../../lib/slug'

const CardItem = ({ data }) => {
  const title = data.title?.english || data.title?.romaji || data.title_english || data.title || 'Unknown'
  const image = data.coverImage?.large || data.images?.webp?.image_url || ''
  const episodes = data.episodes || '?'
  const format = data.format || data.type || ''
  const slug = generateSlug(title)

  return (
    <Link to={`/anime/${slug}-${data.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <F.CardItem>
        <F.PosterDiv>
          <F.Img src={image} alt={title} />
        </F.PosterDiv>
        <F.DetailsWrapper>
          <F.Name>{title}</F.Name>
          <F.Details>
            {format} • Ep {episodes}
          </F.Details>
        </F.DetailsWrapper>
      </F.CardItem>
    </Link>
  )
}

export default CardItem
