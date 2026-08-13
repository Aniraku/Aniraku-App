# SEO Gap Analysis — Aniraku

## What Already Exists (Good)
- Google site verification is already in place (meta tag)
- Basic robots.txt exists
- Sitemap generation script exists (generate-sitemap.js)
- Vite build with Vercel hosting
- Middleware.js handles bot-facing SEO shells for /anime/:id and /watch/:id
- Basic Open Graph tags in index.html
- JSON-LD WebSite + Organization in index.html
- PWA manifest.json
- Footer with A-Z links and internal navigation

## Critical SEO Gaps

### 1. index.html Meta Tags — WEAK
- Description is too short and generic
- Keywords are minimal (only 9)
- OG title is just "Aniraku — Anime Streaming" (not descriptive)
- Missing alt text on OG images (SVG format may not render well on some platforms)
- No preconnect to AniList CDN for images
- No prefetch/preload hints for critical resources

### 2. robots.txt — NEEDS IMPROVEMENT
- `Disallow: /*?*` blocks ALL query-param pages (genre pages, sorted pages, search results)
- This means Google CANNOT crawl genre pages, which are key SEO landing pages
- Missing genre pages from crawl access
- Missing image sitemap reference

### 3. Sitemap — INCOMPLETE
- Only covers static pages + /home + /random
- /catalog not included
- No genre pages
- No /top-airing, /most-popular, /movies, /tv-series redirects
- Generate-sitemap script doesn't include genre/filter pages

### 4. Dynamic Page Metadata — MISSING
- No client-side document.title updates for anime pages
- No dynamic meta description updates per page
- No canonical URL updates per page (only basic seo.js)
- No JSON-LD structured data on anime detail or watch pages
- No breadcrumbs

### 5. Internal Linking — WEAK
- No genre pages in footer (only browse links)
- No "Related Anime" or "Similar Anime" internal links
- Genre chips on homepage are good but not enough
- No breadcrumb navigation anywhere
- Watch pages don't link back with descriptive anchor text

### 6. Content/On-Page SEO
- Homepage has no <h1> tag
- Catalog page has no <h1>
- Watch page <h1> is good but no surrounding content for crawlers
- No alt text on anime cover images
- No loading="lazy" on all images consistently
- No descriptive anchor text on navigation links

### 7. Performance/Technical SEO
- No service worker for PWA
- No <link rel="preload"> for critical fonts
- CSP may block some crawler resources
- No structured data beyond basic WebSite schema
- No hreflang tags

### 8. Missing Pages/Features
- No 404 page (custom error page exists but not optimized)
- No /genre/:genre pages (just redirects to catalog)
- No blog/news section
- No RSS feed

## Priority Fixes (What to Implement)
1. Enhanced robots.txt (remove /*?* disallow)
2. Better index.html meta tags
3. Enhanced sitemap generation (include genre/filter pages)
4. Client-side SEO helper (dynamic title, meta, canonical, JSON-LD)
5. Anime detail page JSON-LD (TVSeries/Movie schema)
6. Watch page JSON-LD (VideoObject schema)
7. Enhanced vercel.json headers (caching)
8. Genre pages in footer
9. Alt text on images
10. Homepage <h1> and content structure
