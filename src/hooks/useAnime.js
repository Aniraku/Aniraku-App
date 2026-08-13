import { useQuery } from '@tanstack/react-query'
import { anilistQuery, BROWSE_QUERY, ANIME_DETAIL_QUERY, RECOMMEND_QUERY } from '../lib/anilist'

async function browse(variables) {
  const { data } = await anilistQuery(BROWSE_QUERY, variables)
  return data.Page.media || []
}

async function fetchHomePageData() {
  const { data } = await anilistQuery(`
    query {
      trending: Page(page: 1, perPage: 10) {
        media(type: ANIME, sort: TRENDING_DESC) {
          id title { romaji english native userPreferred }
          coverImage { extraLarge large medium color }
          bannerImage description(asHtml: false) nextAiringEpisode { episode airingAt }
          format status episodes averageScore popularity genres isAdult
        }
      }
      airing: Page(page: 1, perPage: 20) {
        media(type: ANIME, status: RELEASING, sort: POPULARITY_DESC) {
          id title { romaji english native userPreferred }
          coverImage { extraLarge large medium color }
          bannerImage description(asHtml: false) nextAiringEpisode { episode airingAt }
          format status episodes averageScore popularity genres isAdult
        }
      }
      movies: Page(page: 1, perPage: 20) {
        media(type: ANIME, format: MOVIE, sort: SCORE_DESC) {
          id title { romaji english native userPreferred }
          coverImage { extraLarge large medium color }
          bannerImage description(asHtml: false) nextAiringEpisode { episode airingAt }
          format status episodes averageScore popularity genres isAdult
        }
      }
      topTV: Page(page: 1, perPage: 20) {
        media(type: ANIME, format: TV, sort: SCORE_DESC) {
          id title { romaji english native userPreferred }
          coverImage { extraLarge large medium color }
          bannerImage description(asHtml: false) nextAiringEpisode { episode airingAt }
          format status episodes averageScore popularity genres isAdult
        }
      }
    }
  `, {})
  return {
    trending: data.trending.media,
    airing: data.airing.media,
    movies: data.movies.media,
    topTV: data.topTV.media,
  }
}

export function useTrendingAnime() {
  return useQuery(['trending'], async () => {
    return browse({ page: 1, perPage: 10, sort: ['TRENDING'] })
  }, { staleTime: 300000, cacheTime: Infinity })
}

export function usePopular() {
  return useQuery(['popular'], async () => {
    return browse({ page: 1, perPage: 20, sort: ['POPULARITY_DESC'] })
  }, { staleTime: 300000, cacheTime: Infinity })
}

export function useAiring() {
  return useQuery(['airing'], async () => {
    return browse({ page: 1, perPage: 20, status: 'RELEASING', sort: ['POPULARITY_DESC'] })
  }, { staleTime: 300000, cacheTime: Infinity })
}

export function useMovies() {
  return useQuery(['movies'], async () => {
    return browse({ page: 1, perPage: 20, format: 'MOVIE', sort: ['SCORE_DESC'] })
  }, { staleTime: 300000, cacheTime: Infinity })
}

export function useSeries() {
  return useQuery(['series'], async () => {
    return browse({ page: 1, perPage: 20, format: 'TV', sort: ['SCORE_DESC'] })
  }, { staleTime: 300000, cacheTime: Infinity })
}

// Combined home page data - single request for all sections
export function useHomePageData() {
  return useQuery(['homepage'], fetchHomePageData, { 
    staleTime: 300000, 
    cacheTime: Infinity,
    // Prefetch next pages for instant navigation
    // onSuccess: () => {
    //   queryClient.prefetchQuery(['popular', 2], () => browse({ page: 2, perPage: 20, sort: ['POPULARITY_DESC'] }))
    // }
  })
}

export function useGenre({ genre }) {
  return useQuery(['genres', genre], async () => {
    return browse({ page: 1, perPage: 20, genre })
  }, { staleTime: 300000, cacheTime: Infinity })
}

export function useAnimeDetails(id) {
  return useQuery(['anime', id], async () => {
    const { data } = await anilistQuery(ANIME_DETAIL_QUERY, { id: parseInt(id) })
    return data.Media
  }, { enabled: !!id, staleTime: 300000 })
}

export function useSimilar(id) {
  return useQuery(['similar', id], async () => {
    const { data } = await anilistQuery(RECOMMEND_QUERY, { id: parseInt(id), genres: [], page: 1, perPage: 12 })
    const genres = data.Media?.genres || []
    if (!genres.length) return []
    const { data: d2 } = await anilistQuery(RECOMMEND_QUERY, { id: parseInt(id), genres, page: 1, perPage: 12 })
    return d2.Page.media || []
  }, { enabled: !!id, staleTime: 300000 })
}

export function useAnimeEpisodes(id) {
  return useQuery(['episodes', id], async () => {
    const { data } = await anilistQuery(ANIME_DETAIL_QUERY, { id: parseInt(id) })
    const media = data.Media
    if (!media) return []
    const count = media.episodes || 12
    return Array.from({ length: count }, (_, i) => ({
      number: i + 1,
      title: `Episode ${i + 1}`,
      thumbnail: media.coverImage?.medium || '',
    }))
  }, { enabled: !!id, staleTime: 300000 })
}
