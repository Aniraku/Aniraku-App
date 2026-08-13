const BACKEND = 'https://api.aniraku.tech'
const SITE = 'https://www.aniraku.tech'
const FALLBACK_IMAGE = `${SITE}/og-image.png`

const BOT_RE = /bot|crawler|spider|googlebot|bingbot|yandex|facebookexternalhit|twitterbot|whatsapp|linkedin|slack|telegram|discord|pinterest|slurp|duckduckbot|baiduspider|youtube|embedly|preview|headless|ia_archiver|applebot|facebook|twitter/i

function escape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, ' ')
}

function getAnimeType(format) {
  if (format === 'MOVIE') return 'Movie'
  if (format === 'OVA' || format === 'ONA' || format === 'SPECIAL') return 'TVEpisode'
  return 'TVSeries'
}

function htmlShell({ title, description, image, url, type, animeType, score, episodes, genres, startDate }) {
  // Build rich JSON-LD structured data
  let jsonld = `{"@context":"https://schema.org","@type":"${animeType || 'WebPage'}","name":"${title}","description":"${description}","url":"${url}","image":"${image}"`
  if (genres && genres.length > 0) jsonld += `,"genre":[${genres.map(g => `"${escape(g)}"`).join(',')}]`
  if (score) jsonld += `,"aggregateRating":{"@type":"AggregateRating","ratingValue":"${(score/10).toFixed(1)}","bestRating":"10","worstRating":"1"}`
  if (episodes) jsonld += `,"numberOfEpisodes":${episodes}`
  if (startDate) jsonld += `,"datePublished":"${startDate}"`
  jsonld += `,"inLanguage":"ja","contentRating":"PG-13"`
  jsonld += `,"provider":{"@type":"Organization","name":"Aniraku","url":"${SITE}"}`
  jsonld += `,"isPartOf":{"@type":"WebSite","name":"Aniraku","url":"${SITE}"}}`

  // Breadcrumb
  const breadcrumb = `{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"${SITE}/"},{"@type":"ListItem","position":2,"name":"Catalog","item":"${SITE}/catalog"},{"@type":"ListItem","position":3,"name":"${title}"}]}`

  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${title}</title>
<meta name="description" content="${description}"/>
<meta name="robots" content="index, follow, max-image-preview:large"/>
<meta name="author" content="Aniraku Contributors"/>
<link rel="canonical" href="${url}"/>
<link rel="preconnect" href="https://s4.anilist.co" crossorigin/>

<meta property="og:type" content="${type}"/>
<meta property="og:url" content="${url}"/>
<meta property="og:title" content="${title}"/>
<meta property="og:description" content="${description}"/>
<meta property="og:image" content="${image}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:image:type" content="image/png"/>
<meta property="og:locale" content="en_US"/>
<meta property="og:site_name" content="Aniraku"/>

<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:url" content="${url}"/>
<meta name="twitter:title" content="${title}"/>
<meta name="twitter:description" content="${description}"/>
<meta name="twitter:image" content="${image}"/>
<meta name="twitter:image:alt" content="${title}"/>
<meta name="twitter:site" content="@sho_islam0311"/>
<meta name="twitter:creator" content="@sho_islam0311"/>

<script type="application/ld+json">${jsonld}</script>
<script type="application/ld+json">${breadcrumb}</script>

</head><body><h1>${title}</h1><p>${description}</p></body></html>`
}

async function fetchAnime(id) {
  const res = await fetch(`${BACKEND}/api/v1/anime/${id}`, {
    headers: { 'User-Agent': 'AnirakuBot/1.0' }
  })
  if (!res.ok) return null
  return res.json()
}

export default async function middleware(request) {
  try {
    const url = new URL(request.url)
    const path = url.pathname

    // Heal historically broken doubled-path URLs: an old canonical bug made
    // every anime/watch URL self-canonicalize to /anime/anime/... (and
    // /watch/watch/...) which itself returned 200. 301 them to the real
    // path so crawlers collapse those URLs instead of chasing canonicals.
    const doubled = path.match(/^\/(anime|watch)\/\1\//)
    if (doubled) {
      return Response.redirect(`${SITE}/${doubled[1]}/${path.replace(doubled[0], '')}`, 301)
    }

    const ua = request.headers.get('user-agent') || ''
    if (!BOT_RE.test(ua)) return

    // /anime/:slug-:id  (slug never contains "/" — this also guarantees a
    // doubled /anime/anime/... path can never match the prerender branch)
    const m = path.match(/^\/anime\/([^/]+)-(\d+)$/)
    if (m) {
      const anime = await fetchAnime(m[2])
      if (anime) {
        const title = escape(anime.title?.english || anime.title?.romaji || anime.title?.userPreferred || `Anime #${m[2]}`)
        const rawDesc = (anime.description || '').replace(/<[^>]*>/g, '').slice(0, 320)
        const desc = escape(rawDesc || `Watch ${title} online — Sub & Dub available.`)
        const image = escape(anime.coverImage?.large || anime.coverImage?.extraLarge || FALLBACK_IMAGE)
        const animeType = getAnimeType(anime.format)
        const animeUrl = `${SITE}${path}`
        return new Response(htmlShell({
          title: `${title} — Watch Online Free | Aniraku`,
          description: desc,
          image,
          url: animeUrl,
          type: 'video.tv_show',
          animeType,
          score: anime.averageScore,
          episodes: anime.episodes,
          genres: anime.genres || [],
          startDate: anime.startDate?.year || '',
        }), {
          headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public,max-age=3600,s-maxage=3600' }
        })
      }
    }

    // /watch/:slug-:id-episode-:ep  (slug never contains "/")
    const m2 = path.match(/^\/watch\/([^/]+)-(\d+)-episode-(\d+)$/)
    if (m2) {
      const anime = await fetchAnime(m2[2])
      if (anime) {
        const ep = m2[3]
        const title = escape(anime.title?.english || anime.title?.romaji || anime.title?.userPreferred || `Anime #${m2[2]}`)
        const rawDesc = (anime.description || '').replace(/<[^>]*>/g, '').slice(0, 320)
        const desc = escape(rawDesc || `Watch ${title} Episode ${ep} online — Sub & Dub available.`)
        const image = escape(anime.coverImage?.large || anime.coverImage?.extraLarge || FALLBACK_IMAGE)
        const watchUrl = `${SITE}${path}`
        const animeUrl = `${SITE}/anime/${m2[1]}-${m2[2]}`

        // VideoObject JSON-LD (no fake duration/uploadDate — misleading
        // values can trigger structured-data spam warnings)
        const videoJsonld = `{"@context":"https://schema.org","@type":"VideoObject","name":"${title} - Episode ${ep}","description":"${desc}","thumbnailUrl":"${image}","contentUrl":"${watchUrl}","embedUrl":"${watchUrl}","provider":{"@type":"Organization","name":"Aniraku","url":"${SITE}"},"isPartOf":{"@type":"TVSeries","name":"${title}","url":"${animeUrl}"}}`

        const watchBreadcrumb = `{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"${SITE}/"},{"@type":"ListItem","position":2,"name":"Catalog","item":"${SITE}/catalog"},{"@type":"ListItem","position":3,"name":"${title}","item":"${animeUrl}"},{"@type":"ListItem","position":4,"name":"Episode ${ep}"}]}`

        return new Response(`<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${title} — Episode ${ep} | Aniraku</title>
<meta name="description" content="${desc}"/>
<meta name="robots" content="index, follow"/>
<link rel="canonical" href="${watchUrl}"/>

<meta property="og:type" content="video.episode"/>
<meta property="og:url" content="${watchUrl}"/>
<meta property="og:title" content="${title} — Episode ${ep} | Aniraku"/>
<meta property="og:description" content="${desc}"/>
<meta property="og:image" content="${image}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:locale" content="en_US"/>
<meta property="og:site_name" content="Aniraku"/>

<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:url" content="${watchUrl}"/>
<meta name="twitter:title" content="${title} — Episode ${ep}"/>
<meta name="twitter:description" content="${desc}"/>
<meta name="twitter:image" content="${image}"/>
<meta name="twitter:site" content="@sho_islam0311"/>

<script type="application/ld+json">${videoJsonld}</script>
<script type="application/ld+json">${watchBreadcrumb}</script>

</head><body><h1>${title} — Episode ${ep}</h1><p>${desc}</p></body></html>`, {
          headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public,max-age=3600,s-maxage=3600' }
        })
      }
    }
  } catch (err) {
    console.error('[middleware] bot prerender failed, falling through to SPA:', err)
    return
  }
}
