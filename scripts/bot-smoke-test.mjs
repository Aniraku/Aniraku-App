// Bot-UA smoke test — guards against the SEC-01 class of regression where the
// Vercel edge middleware crashes for crawlers/link-preview bots (500) while
// real browsers still get 200. Any future middleware change must keep all of
// these returning 200.
//
// Usage: node scripts/bot-smoke-test.mjs [baseUrl]
//   baseUrl defaults to https://www.aniraku.tech
//   Set SMOKE_TEST_PATHS to override the path list (comma-separated).

const base = process.argv[2] || process.env.SMOKE_TEST_BASE_URL || 'https://www.aniraku.tech'
const paths = (process.env.SMOKE_TEST_PATHS || '/,/anime/demon-slayer-16498,/watch/demon-slayer-16498-episode-1,/robots.txt,/manifest.json')
  .split(',')
  .filter(Boolean)

const bots = [
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Twitterbot/1.0',
  'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
]

const failures = []
const total = paths.length * bots.length
let checked = 0

const status = (code) => code >= 200 && code < 300

for (const path of paths) {
  const url = new URL(path, base).toString()
  for (const ua of bots) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': ua, 'Accept': 'text/html,*/*' }, redirect: 'manual' })
      checked++
      if (!status(res.status)) {
        failures.push({ url, ua, status: res.status, xVercelError: res.headers.get('x-vercel-error') })
      }
    } catch (err) {
      checked++
      failures.push({ url, ua, status: 'network-error', error: err.message })
    }
  }
}

if (failures.length > 0) {
  console.error(`\nBot smoke test FAILED: ${failures.length}/${checked} requests non-2xx\n`)
  for (const f of failures) {
    console.error(`  ${f.status} ${f.url}\n    UA: ${f.ua}\n    ${f.xVercelError ? 'x-vercel-error: ' + f.xVercelError : (f.error || '')}\n`)
  }
  process.exit(1)
}

console.log(`Bot smoke test passed: ${checked}/${checked} requests returned 2xx against ${base}`)
