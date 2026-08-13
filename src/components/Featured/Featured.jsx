import React from 'react'
import Card from './Card'
import { F } from './featured.style'
import { useAiring, usePopular } from '../../hooks/useAnime'

const Featured = () => {
  const { data: airing = [] } = useAiring()
  const { data: popular = [] } = usePopular()

  return (
    <F.Container>
      <Card name="Top Airing" data={(airing || []).slice(0, 8)} link="/top-airing" />
      <Card name="Most Popular" data={(popular || []).slice(0, 8)} />
    </F.Container>
  )
}

export default Featured
