import fs from 'fs'
import path from 'path'
import { generateSlug } from '../src/lib/slug.js'

// Prefer the build-time env var (Vercel injects VITE_API_URL), fall back to
// the local .env, then to the production Azure API.
const readEnv = (key) => {
  if (process.env[key]) return process.env[key]
  try {
    const env = fs.readFileSync(path.resolve('.env'), 'utf8')
    const m = env.match(new RegExp(`^${key}=(.*)$`, 'm'))
    return m ? m[1].trim() : ''
  } catch { return '' }
}
const API_BASE = `${readEnv('VITE_API_URL') || 'https://api.aniraku.tech'}/api/v1`
const ANILIST_PROXY = `${API_BASE}/anilist`
const SITE = 'https://www.aniraku.tech'
const OUT_DIR = path.resolve('public')
const PER_PAGE = 50
const CHUNK_SIZE = 1000
const WAKEUP_TIMEOUT_MS = 5 * 60 * 1000  // 5 minutes total
const WAKEUP_POLL_INTERVAL_MS = 30000     // Check every 30 seconds
const FETCH_RETRIES = 3
const FETCH_RETRY_DELAY_MS = 5000

const STATIC_URLS = [
  { loc: '/', freq: 'daily', priority: '1.0' },
  { loc: '/catalog', freq: 'daily', priority: '0.8' },
  { loc: '/schedule', freq: 'weekly', priority: '0.7' },
  { loc: '/random', freq: 'monthly', priority: '0.3' },
  { loc: '/privacy', freq: 'monthly', priority: '0.3' },
  { loc: '/terms', freq: 'monthly', priority: '0.3' },
  { loc: '/dmca', freq: 'monthly', priority: '0.3' },
  { loc: '/license', freq: 'yearly', priority: '0.2' },
]

const GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Ecchi',
  'Fantasy', 'Horror', 'Mahou Shoujo', 'Mecha', 'Music',
  'Mystery', 'Psychological', 'Romance', 'Sci-Fi',
  'Slice of Life', 'Sports', 'Supernatural', 'Thriller',
]

const GENRE_URLS = GENRES.map(g => ({
  loc: `/catalog?genre=${encodeURIComponent(g)}`,
  freq: 'weekly',
  priority: '0.65',
}))

const FILTER_URLS = [
  { loc: '/catalog?format=MOVIE&sort=SCORE_DESC', freq: 'daily', priority: '0.7' },
  { loc: '/catalog?format=TV&sort=SCORE_DESC', freq: 'daily', priority: '0.7' },
  { loc: '/catalog?format=OVA&sort=SCORE_DESC', freq: 'weekly', priority: '0.5' },
  { loc: '/catalog?format=ONA&sort=SCORE_DESC', freq: 'weekly', priority: '0.5' },
  { loc: '/catalog?format=SPECIAL&sort=SCORE_DESC', freq: 'weekly', priority: '0.5' },
  { loc: '/catalog?status=RELEASING', freq: 'daily', priority: '0.7' },
  { loc: '/catalog?status=FINISHED', freq: 'weekly', priority: '0.6' },
  { loc: '/catalog?status=NOT_YET_RELEASED', freq: 'weekly', priority: '0.6' },
  { loc: '/catalog?sort=POPULARITY_DESC', freq: 'daily', priority: '0.75' },
  { loc: '/catalog?sort=SCORE_DESC', freq: 'daily', priority: '0.75' },
  { loc: '/catalog?sort=START_DATE_DESC', freq: 'daily', priority: '0.65' },
  { loc: '/catalog?sort=TITLE_ROMAJI', freq: 'weekly', priority: '0.4' },
]

// GraphQL query matching the frontend's BROWSE_QUERY
const BROWSE_QUERY = `
  query ($page: Int, $perPage: Int, $search: String, $genre: String, $format: MediaFormat, $status: MediaStatus, $season: MediaSeason, $year: Int, $sort: [MediaSort]) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { total lastPage hasNextPage currentPage perPage }
      media(search: $search, genre: $genre, format: $format, status: $status, season: $season, seasonYear: $year, type: ANIME, sort: $sort) {
        id title { romaji english native userPreferred }
        coverImage { extraLarge large medium color }
        bannerImage format status episodes averageScore popularity season seasonYear genres isAdult
        nextAiringEpisode { episode airingAt }
      }
    }
  }
`

function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function urlEntry(loc, lastmod, freq, priority) {
  return `  <url>
    <loc>${SITE}${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${freq}</changefreq>
    <priority>${priority}</priority>
  </url>`
}

function writeSitemap(filePath, urls) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, xml, 'utf-8')
  return Buffer.byteLength(xml, 'utf-8')
}

function writeSitemapIndex(filePath, children) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${children.join('\n')}
</sitemapindex>`
  fs.writeFileSync(filePath, xml, 'utf-8')
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Send a GraphQL query to the AniList proxy endpoint.
 */
async function graphqlFetch(query, variables = {}) {
  const res = await fetch(ANILIST_PROXY, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) return null
  const json = await res.json()
  if (json.data) return json.data
  return null
}

/**
 * Wake-up ping: fetch 1 item from the backend to trigger cold start.
 */
async function wakeUpPing() {
  try {
    const data = await graphqlFetch(BROWSE_QUERY, {
      page: 1,
      perPage: 1,
      type: 'ANIME',
      sort: ['POPULARITY_DESC'],
    })
    return data !== null && data.Page !== undefined
  } catch {
    return false
  }
}

/**
 * Wait until the backend wakes up, polling every WAKEUP_POLL_INTERVAL_MS
 * for up to WAKEUP_TIMEOUT_MS.
 */
async function waitForBackend() {
  const startTime = Date.now()
  let attempt = 0

  while (Date.now() - startTime < WAKEUP_TIMEOUT_MS) {
    attempt++
    const elapsed = Math.round((Date.now() - startTime) / 1000)
    process.stdout.write(`  Waiting for backend... attempt ${attempt} (${elapsed}s elapsed)\r`)

    const alive = await wakeUpPing()
    if (alive) {
      console.log(`  Backend is awake after ${elapsed}s!`)
      return true
    }

    await sleep(WAKEUP_POLL_INTERVAL_MS)
  }

  const totalElapsed = Math.round((Date.now() - startTime) / 1000)
  console.log(`  Backend did not respond within ${WAKEUP_TIMEOUT_MS / 1000}s (${totalElapsed}s).`)
  return false
}

/**
 * Fetch a single page of anime from the backend.
 */
async function fetchPage(page) {
  for (let attempt = 1; attempt <= FETCH_RETRIES; attempt++) {
    try {
      const data = await graphqlFetch(BROWSE_QUERY, {
        page,
        perPage: PER_PAGE,
        sort: ['POPULARITY_DESC'],
      })

      if (data && data.Page && data.Page.media) {
        return data.Page
      }

      if (attempt < FETCH_RETRIES) {
        console.error(`  page ${page} returned empty, retry ${attempt}/${FETCH_RETRIES} in ${FETCH_RETRY_DELAY_MS / 1000}s...`)
        await sleep(FETCH_RETRY_DELAY_MS)
      } else {
        console.error(`  page ${page} failed after ${FETCH_RETRIES} attempts, skipping`)
        return null
      }
    } catch (err) {
      if (attempt < FETCH_RETRIES) {
        console.error(`  page ${page} error: ${err.message}, retry ${attempt}/${FETCH_RETRIES} in ${FETCH_RETRY_DELAY_MS / 1000}s...`)
        await sleep(FETCH_RETRY_DELAY_MS)
      } else {
        console.error(`  page ${page} error: ${err.message} after ${FETCH_RETRIES} attempts, skipping`)
        return null
      }
    }
  }
  return null
}

async function fetchAllPages() {
  const first = await fetchPage(1)
  if (!first || !first.media) {
    console.error('Could not fetch first page.')
    return []
  }

  const media = [...first.media]
  const pageInfo = first.pageInfo || {}
  const lastPage = pageInfo.lastPage || 1
  const total = pageInfo.total || 0
  console.log(`  page 1/${lastPage} — ${first.media.length} items, total ${total}`)

  for (let page = 2; page <= lastPage; page++) {
    const data = await fetchPage(page)
    if (data && data.media) {
      media.push(...data.media)
    }
    if (page % 10 === 0) console.log(`  page ${page}/${lastPage} — ${media.length} items so far`)
  }

  return media
}

const today = new Date().toISOString().slice(0, 10)

console.log('Generating sitemaps...')
console.log(`Backend proxy: ${ANILIST_PROXY}`)

// Step 1: Wake up the backend (wait up to 5 minutes)
console.log('\n--- Step 1: Waking up backend (max 5 min wait) ---')
const backendReady = await waitForBackend()

if (!backendReady) {
  console.log('\nBackend is still asleep. Generating static-only sitemap.')

  const staticUrls = STATIC_URLS.map(u => urlEntry(u.loc, today, u.freq, u.priority))
  const staticSize = writeSitemap(path.join(OUT_DIR, 'sitemaps', 'static.xml'), staticUrls)
  console.log(`  sitemaps/static.xml — ${staticUrls.length} URLs, ${staticSize} bytes`)

  const genreUrls = [
    ...GENRE_URLS.map(u => urlEntry(u.loc, today, u.freq, u.priority)),
    ...FILTER_URLS.map(u => urlEntry(u.loc, today, u.freq, u.priority)),
  ]
  const genreSize = writeSitemap(path.join(OUT_DIR, 'sitemaps', 'genres.xml'), genreUrls)
  console.log(`  sitemaps/genres.xml — ${genreUrls.length} URLs, ${genreSize} bytes`)

  const childIndexes = [
    { loc: '/sitemaps/static.xml', lastmod: today },
    { loc: '/sitemaps/genres.xml', lastmod: today },
  ]
  const indexChildren = childIndexes.map(c =>
    `  <sitemap>
    <loc>${SITE}${c.loc}</loc>
    <lastmod>${c.lastmod}</lastmod>
  </sitemap>`
  )
  writeSitemapIndex(path.join(OUT_DIR, 'sitemap.xml'), indexChildren)
  console.log(`  sitemap.xml (index) — ${childIndexes.length} children`)
  console.log('\nDone (backend unavailable — no anime pages included).')
  process.exit(0)
}

// Step 2: Fetch all anime pages
console.log('\n--- Step 2: Fetching anime catalog ---')
const media = await fetchAllPages()
console.log(`Fetched ${media.length} anime entries`)

// Write static sitemap
const staticUrls = STATIC_URLS.map(u => urlEntry(u.loc, today, u.freq, u.priority))
const staticSize = writeSitemap(path.join(OUT_DIR, 'sitemaps', 'static.xml'), staticUrls)
console.log(`  sitemaps/static.xml — ${staticUrls.length} URLs, ${staticSize} bytes`)

// Write genre/filter sitemap
const genreUrls = [
  ...GENRE_URLS.map(u => urlEntry(u.loc, today, u.freq, u.priority)),
  ...FILTER_URLS.map(u => urlEntry(u.loc, today, u.freq, u.priority)),
]
const genreSize = writeSitemap(path.join(OUT_DIR, 'sitemaps', 'genres.xml'), genreUrls)
console.log(`  sitemaps/genres.xml — ${genreUrls.length} URLs, ${genreSize} bytes`)

// Write anime chunk sitemaps
const seen = new Set()
const uniqueMedia = media.filter(item => {
  if (!item.id || seen.has(item.id)) return false
  seen.add(item.id)
  return true
})

const chunks = []
for (let i = 0; i < uniqueMedia.length; i += CHUNK_SIZE) {
  chunks.push(uniqueMedia.slice(i, i + CHUNK_SIZE))
}

const childIndexes = [
  { loc: '/sitemaps/static.xml', lastmod: today },
  { loc: '/sitemaps/genres.xml', lastmod: today },
]

for (let i = 0; i < chunks.length; i++) {
  const name = `anime-${i + 1}.xml`
  const urls = chunks[i].map(item => {
    const t = item.title?.english || item.title?.romaji || ''
    const slug = generateSlug(t)
    return urlEntry(`/anime/${slug}-${item.id}`, today, 'monthly', '0.6')
  })
  const size = writeSitemap(path.join(OUT_DIR, 'sitemaps', name), urls)
  console.log(`  sitemaps/${name} — ${urls.length} URLs, ${size} bytes`)
  childIndexes.push({ loc: `/sitemaps/${name}`, lastmod: today })
}

// Write sitemap index
const indexChildren = childIndexes.map(c =>
  `  <sitemap>
    <loc>${SITE}${c.loc}</loc>
    <lastmod>${c.lastmod}</lastmod>
  </sitemap>`
)
writeSitemapIndex(path.join(OUT_DIR, 'sitemap.xml'), indexChildren)
console.log(`  sitemap.xml (index) — ${childIndexes.length} children`)
console.log(`\nDone. ${uniqueMedia.length} anime across ${chunks.length} chunk(s).`)
