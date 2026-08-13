import React from 'react'
import { Pagination, Navigation } from 'swiper/modules'
import { S } from './swiper.style'
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa'
import { useTrendingAnime } from '../../hooks/useAnime'
import { generateSlug } from '../../lib/slug'

const skeletonItems = Array.from({ length: 6 }, (_, i) => i)

const MultiSwiper = () => {
  const { data, isFetched } = useTrendingAnime()
  const items = Array.isArray(data) ? data : []

  return (
    <S.SwiperContainer>
      <S.Swiper
        slidesPerView={3}
        spaceBetween={15}
        breakpoints={{
          479: { spaceBetween: 15 },
          640: { slidesPerView: 3, spaceBetween: 15 },
          900: { slidesPerView: 4, spaceBetween: 15 },
          1300: { slidesPerView: 6, spaceBetween: 15 },
        }}
        modules={[Pagination, Navigation]}
        navigation={{ nextEl: '.btn-nextTwo', prevEl: '.btn-prevTwo' }}
      >
        {isFetched
          ? items.map((item, idx) => (
            <S.SwiperSlide key={item.id || idx}>
              <S.Item>
                <S.Number>
                  <S.SpanNum>{idx + 1 >= 10 ? idx + 1 : '0' + (idx + 1)}</S.SpanNum>
                  <S.ItemName>{item.title?.english || item.title?.romaji || item.title?.userPreferred}</S.ItemName>
                </S.Number>
                <S.LinkImg to={`/anime/${generateSlug(item.title?.english || item.title?.romaji || '')}-${item.id}`}>
                  <S.SwiperImg src={item.coverImage?.large || item.coverImage?.extraLarge || ''} alt="" />
                </S.LinkImg>
              </S.Item>
            </S.SwiperSlide>
          ))
          : skeletonItems.map((i) => (
            <S.SwiperSlide key={`skeleton-${i}`}>
              <S.Item>
                <S.Number>
                  <S.SpanNum style={{ opacity: 0.3, background: '#2a2a2a', borderRadius: '4px', display: 'inline-block', width: '20px' }}>&nbsp;</S.SpanNum>
                  <S.ItemName style={{ opacity: 0.3, background: '#2a2a2a', borderRadius: '4px', display: 'inline-block', width: '80px', height: '14px' }}>&nbsp;</S.ItemName>
                </S.Number>
                <div style={{ width: '100%', aspectRatio: '3/4', background: '#2a2a2a', borderRadius: '8px' }} />
              </S.Item>
            </S.SwiperSlide>
          ))
        }
      </S.Swiper>
      <S.NavBtn>
        <button type="button" className="btn-nextTwo" aria-label="Next"><FaChevronRight /></button>
        <button type="button" className="btn-prevTwo" aria-label="Previous"><FaChevronLeft /></button>
      </S.NavBtn>
    </S.SwiperContainer>
  )
}

export default MultiSwiper
