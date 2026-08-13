import React from "react";
import { FaChevronLeft, FaChevronRight, FaPlayCircle, FaClock } from "react-icons/fa";
import { Navigation, Pagination, Autoplay } from "swiper/modules";
import "swiper/swiper-bundle.css";
import { H } from "./hero.style";
import { useTrendingAnime } from "../../hooks/useAnime";
import { filterAdult, useNsfw, useStreamable } from "../../hooks/useNsfw";
import { generateSlug } from "../../lib/slug";
import { L } from "../Loader/loader.style";

const SkeletonSlide = () => (
  <H.Slides>
    <H.ImgContainer>
      <L.Skeleton style={{ position: "absolute", inset: 0, borderRadius: 0 }} />
    </H.ImgContainer>
    <H.Content>
      <L.Skeleton style={{ width: 80, height: 20, borderRadius: 999 }} />
      <L.Skeleton style={{ width: "62%", maxWidth: 460, height: 44, borderRadius: 8, marginTop: 18 }} />
      <H.Icons>
        <L.Skeleton style={{ width: 72, height: 16, borderRadius: 6 }} />
        <L.Skeleton style={{ width: 72, height: 16, borderRadius: 6 }} />
      </H.Icons>
      <L.Skeleton style={{ width: "78%", maxWidth: 500, height: 52, borderRadius: 8 }} />
      <H.WatchBtn>
        <L.Skeleton style={{ width: 150, height: 44, borderRadius: 999 }} />
      </H.WatchBtn>
    </H.Content>
  </H.Slides>
);

const Hero = () => {
  const { data, isFetched } = useTrendingAnime();
  const items = useStreamable(filterAdult(Array.isArray(data) ? data : [], useNsfw().nsfwEnabled));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!isFetched) {
    return (
      <H.Swiper
        slidesPerView={1}
        pagination={{ clickable: true }}
        direction="horizontal"
        loop={false}
        modules={[Pagination]}
        className="swiper"
      >
        <SkeletonSlide />
      </H.Swiper>
    );
  }

  if (items.length === 0) {
    return (
      <H.Swiper
        slidesPerView={1}
        pagination={{ clickable: true }}
        direction="horizontal"
        loop={false}
        modules={[Pagination]}
        className="swiper"
      >
        <H.Slides>
          <H.Content style={{ width: '100%', textAlign: 'center', justifyContent: 'center', alignItems: 'center' }}>
            <H.Title style={{ color: '#fff', fontSize: 24 }}>No trending anime available</H.Title>
            <H.Description style={{ color: '#aaa' }}>Check back later for updates.</H.Description>
          </H.Content>
        </H.Slides>
      </H.Swiper>
    );
  }

  return (
    <H.Swiper
      slidesPerView={1}
      pagination={{ clickable: true }}
      direction="horizontal"
      loop={items.length > 1}
      autoplay={reducedMotion ? false : { delay: 5000, disableOnInteraction: false }}
      modules={[Navigation, Pagination, Autoplay]}
      className="swiper"
      navigation={{ nextEl: ".btn-next", prevEl: ".btn-prev" }}
    >
      {items.slice(0, 5).map((item, idx) => (
        <H.Slides key={item.id || idx}>
          <H.ImgContainer>
            <H.Img src={item.coverImage?.large || item.coverImage?.extraLarge || ''} alt={item.title?.english || item.title?.romaji || ''} />
          </H.ImgContainer>
          <H.Content>
            <H.Rank><p>#{idx + 1} Spotlight</p></H.Rank>
            <H.Title>{item.title?.english || item.title?.romaji || item.title?.userPreferred}</H.Title>
            <H.Icons>
              <H.Icon><FaPlayCircle size={12} /> {item.format || 'TV'}</H.Icon>
              <H.Icon><FaClock size={12} /> {item.episodes || '?'} eps</H.Icon>
              {item.averageScore > 0 && <H.IconSpan>HD</H.IconSpan>}
            </H.Icons>
            <H.Description>{(item.description || '').replace(/<[^>]*>/g, '').slice(0, 200)}...</H.Description>
            <H.WatchBtn>
              <H.WatchLink to={`/watch/${generateSlug(item.title?.english || item.title?.romaji || '')}-${item.id}-episode-1`}><FaPlayCircle /> Watch Now</H.WatchLink>
              <H.DetailLink to={`/anime/${generateSlug(item.title?.english || item.title?.romaji || '')}-${item.id}`}>Detail <FaChevronRight size={12} /></H.DetailLink>
            </H.WatchBtn>
          </H.Content>
        </H.Slides>
      ))}
      <button type="button" className="btn-prev" aria-label="Previous"><FaChevronLeft /></button>
      <button type="button" className="btn-next" aria-label="Next"><FaChevronRight /></button>
    </H.Swiper>
  );
};

export default Hero;
