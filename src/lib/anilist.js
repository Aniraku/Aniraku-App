const ANILIST_URL = 'https://graphql.anilist.co'

export async function anilistQuery(query, variables = {}) {
  const body = JSON.stringify({ query, variables })

  // ponytail: backend proxy first — browser-direct AniList is CORS-blocked
  // and still burns the client IP's 90 req/min quota on requests it can't use.
  const apiBase = import.meta.env.VITE_API_URL || ''
  if (apiBase) {
    try {
      const res = await fetch(`${apiBase}/api/v1/anilist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body,
      })
      if (res.ok) {
        const json = await res.json()
        if (json.data) return json
      }
    } catch (e) {
      console.warn('AniList proxy fetch failed:', e)
    }
  }

  // Last resort: direct fetch — only works outside the browser (no CORS).
  try {
    const res = await fetch(ANILIST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body,
    })
    if (res.ok) {
      const json = await res.json()
      if (json.data) return json
    }
  } catch (e) {
    console.warn('AniList direct fetch failed:', e)
  }

  throw new Error('AniList: all methods failed')
}

// --- Queries ---

export const BROWSE_QUERY = `
  query ($page: Int, $perPage: Int, $search: String, $genre: String, $format: MediaFormat, $status: MediaStatus, $season: MediaSeason, $year: Int, $sort: [MediaSort]) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { total lastPage hasNextPage currentPage perPage }
      media(search: $search, genre: $genre, format: $format, status: $status, season: $season, seasonYear: $year, type: ANIME, sort: $sort) {
        id title { romaji english native userPreferred }
        coverImage { extraLarge large medium color }
        bannerImage description(asHtml: false) trailer { id site thumbnail } format status episodes averageScore popularity season seasonYear genres isAdult
        nextAiringEpisode { episode airingAt }
      }
    }
  }
`

export const CATALOG_SHELVES_QUERY = `
  query {
    trending: Page(page: 1, perPage: 18) {
      media(type: ANIME, sort: TRENDING_DESC) {
        id title { romaji english native userPreferred }
        coverImage { extraLarge large medium color }
        bannerImage description(asHtml: false) trailer { id site thumbnail }
        format status episodes averageScore popularity season seasonYear genres isAdult
        nextAiringEpisode { episode airingAt }
      }
    }
    airing: Page(page: 1, perPage: 18) {
      media(type: ANIME, status: RELEASING, sort: POPULARITY_DESC) {
        id title { romaji english native userPreferred }
        coverImage { extraLarge large medium color }
        bannerImage description(asHtml: false) trailer { id site thumbnail }
        format status episodes averageScore popularity season seasonYear genres isAdult
        nextAiringEpisode { episode airingAt }
      }
    }
    popular: Page(page: 1, perPage: 18) {
      media(type: ANIME, sort: POPULARITY_DESC) {
        id title { romaji english native userPreferred }
        coverImage { extraLarge large medium color }
        bannerImage description(asHtml: false) trailer { id site thumbnail }
        format status episodes averageScore popularity season seasonYear genres isAdult
        nextAiringEpisode { episode airingAt }
      }
    }
    movies: Page(page: 1, perPage: 18) {
      media(type: ANIME, format: MOVIE, sort: POPULARITY_DESC) {
        id title { romaji english native userPreferred }
        coverImage { extraLarge large medium color }
        bannerImage description(asHtml: false) trailer { id site thumbnail }
        format status episodes averageScore popularity season seasonYear genres isAdult
        nextAiringEpisode { episode airingAt }
      }
    }
    topRated: Page(page: 1, perPage: 18) {
      media(type: ANIME, sort: SCORE_DESC) {
        id title { romaji english native userPreferred }
        coverImage { extraLarge large medium color }
        bannerImage description(asHtml: false) trailer { id site thumbnail }
        format status episodes averageScore popularity season seasonYear genres isAdult
        nextAiringEpisode { episode airingAt }
      }
    }
  }
`

export const TRENDING_QUERY = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(type: ANIME, sort: TRENDING) {
        id title { romaji english userPreferred }
        coverImage { extraLarge large }
        format episodes averageScore status genres isAdult
      }
    }
  }
`

export const ANIME_DETAIL_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      id idMal title { romaji english native userPreferred }
      coverImage { extraLarge large medium color }
      bannerImage format status episodes duration genres averageScore popularity description season seasonYear
      nextAiringEpisode { episode airingAt }
      relations { edges { relationType node { id title { romaji english } coverImage { large medium } format type } } }
      streamingEpisodes { title thumbnail url }
    }
  }
`

export const RECOMMEND_QUERY = `
  query ($id: Int, $genres: [String], $page: Int, $perPage: Int) {
    Media(id: $id, type: ANIME) { id genres }
    Page(page: $page, perPage: $perPage) {
      media(genre_in: $genres, type: ANIME, sort: SCORE_DESC, id_not: $id) {
        id title { romaji english userPreferred }
        coverImage { extraLarge large medium color }
        format episodes averageScore status genres isAdult
      }
    }
  }
`

export const SCHEDULE_QUERY = `
  query ($weekStart: Int, $weekEnd: Int) {
    Page(perPage: 50) {
      media(type: ANIME, status: RELEASING, sort: POPULARITY_DESC) {
        id title { romaji english userPreferred }
        coverImage { large }
        format genres isAdult
        airingSchedule(notYetAired: true, greaterThan: $weekStart, lessThan: $weekEnd) {
          nodes { episode airingAt timeUntilAiring }
        }
      }
    }
  }
`
