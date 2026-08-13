// =============================================================
// Aniraku Client-Side SEO Helper
// Handles dynamic document.title, meta tags, canonical URLs,
// and JSON-LD structured data for SPA route changes.
// =============================================================

import { generateSlug } from './slug';

const SITE = 'https://www.aniraku.tech';

/**
 * Set document title
 */
export function setTitle(title) {
  document.title = title;
  // Also update the <title> tag if it exists
  const titleEl = document.querySelector('title');
  if (titleEl) titleEl.textContent = title;
}

/**
 * Set a meta tag content by name
 */
export function setMeta(name, content) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/**
 * Set a meta tag content by property (og:, twitter:)
 */
export function setMetaProperty(property, content) {
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/**
 * Set canonical URL
 */
export function setCanonical(path) {
  const url = `${SITE}${path}`;
  const el = document.getElementById('canonical-link') || document.querySelector('link[rel="canonical"]');
  if (el) {
    el.href = url;
  }
}

/**
 * Remove all existing JSON-LD scripts and add new ones
 */
export function setStructuredData(dataArray) {
  // Remove existing page-specific structured data (keep site-level ones)
  const existing = document.querySelectorAll('script[data-aniraku-seo="true"]');
  existing.forEach(el => el.remove());

  if (!dataArray || dataArray.length === 0) return;

  dataArray.forEach(data => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-aniraku-seo', 'true');
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
  });
}

/**
 * Escape string for safe HTML/JSON embedding
 */
function escape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, ' ');
}

// =============================================================
// Homepage SEO
// =============================================================
export function setHomepageSEO() {
  setTitle('Aniraku — Free Anime Streaming | Watch Sub & Dub Online');
  setMeta('description', 'Watch anime online for free on Aniraku. Stream the latest anime episodes in HD with subtitles and dubs. Browse top airing, most popular, and trending anime series and movies.');
  setMeta('keywords', 'anime, anime streaming, watch anime free, anime online, anime sub, anime dub, anime HD, free anime streaming, aniraku, anime catalog, anime schedule, top anime, popular anime, airing anime, anime movies, anime series');
  setMeta('robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
  setCanonical('/');

  setMetaProperty('og:title', 'Aniraku — Free Anime Streaming | Watch Sub & Dub Online');
  setMetaProperty('og:description', 'Watch anime online for free on Aniraku. Stream the latest anime episodes in HD with subtitles and dubs.');
  setMetaProperty('og:url', `${SITE}/`);
  setMetaProperty('og:type', 'website');
  setMetaProperty('og:image', `${SITE}/og-image.png`);

  setMetaProperty('twitter:title', 'Aniraku — Free Anime Streaming | Watch Sub & Dub Online');
  setMetaProperty('twitter:description', 'Watch anime online for free on Aniraku. Stream the latest anime episodes in HD with subtitles and dubs.');
  setMetaProperty('twitter:url', `${SITE}/`);
}

// =============================================================
// Anime Detail Page SEO
// =============================================================
export function setAnimeDetailSEO(anime) {
  if (!anime) return;

  const title = anime.title?.english || anime.title?.romaji || 'Unknown Anime';
  const slug = generateSlug(title);
  const desc = (anime.description || '').replace(/<[^>]*>/g, '').slice(0, 280);
  const format = anime.format || 'TV';
  const episodes = anime.episodes || '';
  const genres = (anime.genres || []).join(', ');
  const pubDate = /^\d{4}-\d{2}-\d{2}$/.test(anime.startDate?.fuzzy || '') ? anime.startDate.fuzzy : '';

  // Document title
  setTitle(`${title} — Watch ${format} Online Free | Aniraku`);

  // Meta tags
  setMeta('description', `Watch ${title} online for free on Aniraku. ${format}${episodes ? ` · ${episodes} episodes` : ''}${genres ? ` · ${genres}` : ''}. Stream in HD with subtitles and dub.`);
  setMeta('keywords', `${title}, watch ${title}, ${title} streaming, ${title} online free, ${title} sub, ${title} dub, ${format} anime, ${genres}, anime streaming, aniraku`);
  setMeta('robots', 'index, follow, max-image-preview:large');

  const animeUrl = `/anime/${slug}-${anime.id}`;
  setCanonical(animeUrl);

  // Open Graph
  setMetaProperty('og:title', `${title} — Watch ${format} Online Free | Aniraku`);
  setMetaProperty('og:description', `${desc || `Watch ${title} online for free.`}`);
  setMetaProperty('og:url', `${SITE}${animeUrl}`);
  setMetaProperty('og:type', 'video.tv_show');
  setMetaProperty('og:image', anime.coverImage?.large || anime.coverImage?.medium || `${SITE}/og-image.png`);
  setMetaProperty('og:image:width', '500');
  setMetaProperty('og:image:height', '750');

  // Twitter
  setMetaProperty('twitter:title', `${title} — Watch ${format} Online Free`);
  setMetaProperty('twitter:description', `${desc || `Watch ${title} online for free.`}`);
  setMetaProperty('twitter:url', `${SITE}${animeUrl}`);
  setMetaProperty('twitter:image', anime.coverImage?.medium || `${SITE}/og-image.png`);

  // JSON-LD Structured Data
  const isMovie = format === 'MOVIE';
  const jsonld = {
    "@context": "https://schema.org",
    "@type": isMovie ? "Movie" : "TVSeries",
    "name": title,
    "url": `${SITE}${animeUrl}`,
    "description": desc || `Watch ${title} online for free on Aniraku.`,
    "image": anime.coverImage?.large || anime.coverImage?.medium || `${SITE}/og-image.png`,
    "genre": anime.genres || [],
    ...(pubDate ? { "datePublished": pubDate } : {}),
    "startDate": anime.startDate?.fuzzy || '',
    "endDate": anime.endDate?.fuzzy || '',
    "numberOfEpisodes": anime.episodes || 0,
    "inLanguage": "Japanese",
    "contentRating": "PG-13",
    "provider": {
      "@type": "Organization",
      "name": "Aniraku",
      "url": SITE
    },
    "isPartOf": {
      "@type": "WebSite",
      "name": "Aniraku",
      "url": SITE
    }
  };

  // Breadcrumb
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": `${SITE}/` },
      { "@type": "ListItem", "position": 2, "name": "Catalog", "item": `${SITE}/catalog` },
      { "@type": "ListItem", "position": 3, "name": title }
    ]
  };

  setStructuredData([jsonld, breadcrumb]);
}

// =============================================================
// Watch Page SEO
// =============================================================
export function setWatchSEO(anime, episodeNumber) {
  if (!anime) return;

  const title = anime.title?.english || anime.title?.romaji || 'Unknown Anime';
  const epNum = episodeNumber || 1;
  const desc = (anime.description || '').replace(/<[^>]*>/g, '').slice(0, 280);

  setTitle(`Watch ${title} Episode ${epNum} Online Free — Aniraku`);
  setMeta('description', `Watch ${title} Episode ${epNum} online for free on Aniraku. Stream in HD with subtitles and dub support.`);
  setMeta('keywords', `${title}, ${title} episode ${epNum}, watch ${title} episode ${epNum} online, ${title} streaming, anime streaming, watch anime free, aniraku`);
  setMeta('robots', 'index, follow');

  const watchSlug = generateSlug(title);
  const watchUrl = `/watch/${watchSlug}-${anime.id}-episode-${epNum}`;
  setCanonical(watchUrl);

  // Open Graph
  setMetaProperty('og:title', `Watch ${title} Episode ${epNum} Online Free — Aniraku`);
  setMetaProperty('og:description', `Watch ${title} Episode ${epNum} online for free. Stream in HD with subtitles and dub support.`);
  setMetaProperty('og:url', `${SITE}${watchUrl}`);
  setMetaProperty('og:type', 'video.episode');
  setMetaProperty('og:image', anime.coverImage?.large || anime.coverImage?.medium || `${SITE}/og-image.png`);
  setMetaProperty('og:image:width', '500');
  setMetaProperty('og:image:height', '750');

  // Twitter
  setMetaProperty('twitter:title', `Watch ${title} Episode ${epNum} Online Free`);
  setMetaProperty('twitter:description', `Watch ${title} Episode ${epNum} online for free. Stream in HD with subtitles and dub support.`);
  setMetaProperty('twitter:url', `${SITE}${watchUrl}`);
  setMetaProperty('twitter:image', anime.coverImage?.medium || `${SITE}/og-image.png`);

  // JSON-LD VideoObject
  const jsonld = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": `${title} — Episode ${epNum}`,
    "description": `Watch ${title} Episode ${epNum} online on Aniraku. Free anime streaming with subtitles and dub support.`,
    "thumbnailUrl": anime.coverImage?.large || anime.coverImage?.medium || `${SITE}/og-image.png`,
    ...(anime.duration ? { "duration": `PT${anime.duration}M` } : {}),
    "interactionStatistic": {
      "@type": "InteractionCounter",
      "interactionType": "https://schema.org/WatchAction"
    },
    "provider": {
      "@type": "Organization",
      "name": "Aniraku",
      "url": SITE
    },
    "isPartOf": {
      "@type": "TVSeries",
      "name": title,
      "url": `${SITE}/anime/${watchSlug}-${anime.id}`
    }
  };

  // Breadcrumb
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": `${SITE}/` },
      { "@type": "ListItem", "position": 2, "name": "Catalog", "item": `${SITE}/catalog` },
      { "@type": "ListItem", "position": 3, "name": title, "item": `${SITE}/anime/${watchSlug}-${anime.id}` },
      { "@type": "ListItem", "position": 4, "name": `Episode ${epNum}` }
    ]
  };

  setStructuredData([jsonld, breadcrumb]);
}

// =============================================================
// Catalog Page SEO
// =============================================================
export function setCatalogSEO(searchParams) {
  const genre = searchParams.get('genre');
  const format = searchParams.get('format');
  const status = searchParams.get('status');
  const sort = searchParams.get('sort');
  const search = searchParams.get('search');
  const page = searchParams.get('page');

  let title = 'Anime Catalog — Browse & Watch Free | Aniraku';
  let description = 'Browse the complete anime catalog on Aniraku. Watch anime online for free with subtitles and dubs.';
  let keywords = 'anime catalog, browse anime, anime streaming, watch anime free, aniraku';

  if (genre) {
    title = `${genre} Anime — Watch Free Online | Aniraku`;
    description = `Browse and watch ${genre} anime online for free on Aniraku. Stream the best ${genre.toLowerCase()} anime series and movies in HD.`;
    keywords = `${genre}, ${genre} anime, watch ${genre} anime, ${genre} anime online, ${genre} anime streaming, anime catalog, aniraku`;
  } else if (format === 'MOVIE') {
    title = 'Anime Movies — Watch Free Online | Aniraku';
    description = 'Browse and watch anime movies online for free on Aniraku. Stream the best anime films in HD.';
    keywords = 'anime movies, watch anime movies, anime films, anime movies online free, aniraku';
  } else if (format === 'TV') {
    title = 'Anime TV Series — Watch Free Online | Aniraku';
    description = 'Browse and watch anime TV series online for free on Aniraku.';
    keywords = 'anime tv series, anime shows, watch anime series, anime series online free, aniraku';
  } else if (status === 'RELEASING') {
    title = 'Airing Anime — Currently Airing This Season | Aniraku';
    description = 'Check what anime is currently airing this season on Aniraku. Watch the latest episodes in HD.';
    keywords = 'airing anime, currently airing anime, anime this season, new anime episodes, aniraku';
  } else if (sort === 'POPULARITY_DESC') {
    title = 'Most Popular Anime — Top Anime of All Time | Aniraku';
    description = 'Discover the most popular anime of all time on Aniraku. Browse top-rated anime series and movies.';
    keywords = 'popular anime, top anime, best anime, most popular anime series, aniraku';
  } else if (sort === 'SCORE_DESC') {
    title = 'Top Rated Anime — Highest Scored Anime | Aniraku';
    description = 'Browse the highest rated anime on Aniraku. Watch the best anime series and movies ranked by score.';
    keywords = 'top rated anime, highest rated anime, best anime, anime rankings, aniraku';
  } else if (search) {
    title = `Search: ${search} — Anime Results | Aniraku`;
    description = `Search results for "${search}" on Aniraku. Find and watch anime online for free.`;
    keywords = `${search}, anime search, ${search} anime, watch anime, aniraku`;
  }

  setTitle(title);
  setMeta('description', description);
  setMeta('keywords', keywords);
  setMeta('robots', 'index, follow');

  // Build canonical with current params
  const path = window.location.pathname + window.location.search;
  setCanonical(path);

  // Open Graph
  setMetaProperty('og:title', title);
  setMetaProperty('og:description', description);
  setMetaProperty('og:url', `${SITE}${path}`);
  setMetaProperty('og:type', 'website');

  // Twitter
  setMetaProperty('twitter:title', title);
  setMetaProperty('twitter:description', description);
}

// =============================================================
// Schedule Page SEO
// =============================================================
export function setScheduleSEO() {
  setTitle('Anime Airing Schedule — What\'s On This Season | Aniraku');
  setMeta('description', 'Check the latest anime airing schedule on Aniraku. Find out what anime episodes are airing today and this season.');
  setMeta('keywords', 'anime schedule, anime airing, anime calendar, what anime is airing, anime today, anime this season, aniraku');
  setMeta('robots', 'index, follow');
  setCanonical('/schedule');

  setMetaProperty('og:title', 'Anime Airing Schedule — What\'s On This Season | Aniraku');
  setMetaProperty('og:description', 'Check the latest anime airing schedule on Aniraku.');
  setMetaProperty('og:url', `${SITE}/schedule`);
  setMetaProperty('og:type', 'website');
}

// =============================================================
// Static Page SEO (Privacy, Terms, DMCA, License)
// =============================================================
export function setStaticPageSEO(pageTitle, path) {
  setTitle(`${pageTitle} | Aniraku`);
  setMeta('description', `${pageTitle} page for Aniraku — Free Anime Streaming Platform.`);
  setMeta('robots', 'index, follow');
  setCanonical(path);

  setMetaProperty('og:title', `${pageTitle} | Aniraku`);
  setMetaProperty('og:description', `${pageTitle} page for Aniraku.`);
  setMetaProperty('og:url', `${SITE}${path}`);
  setMetaProperty('og:type', 'website');
}
