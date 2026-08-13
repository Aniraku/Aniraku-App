import React from 'react'
import { T } from './trending.style'
import MultiSwiper from '../MultiSwiper/MultiSwiper'

const Trending = () => {
  return (
    <T.Container>
      <T.HeadingWrapper>
        <T.Heading>Trending</T.Heading>
      </T.HeadingWrapper>
      <MultiSwiper />
    </T.Container>
  )
}

export default Trending
