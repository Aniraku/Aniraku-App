const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = 'http://localhost:4176';
const viewports = [
  { name: 'iphone', width: 375, height: 812, isMobile: true },
  { name: 'android', width: 412, height: 915, isMobile: true },
  { name: 'tablet', width: 768, height: 1024, isMobile: false },
  { name: 'desktop', width: 1440, height: 900, isMobile: false },
];
const routes = [
  { name: 'home', path: '/' },
  { name: 'catalog', path: '/catalog' },
  { name: 'schedule', path: '/schedule' },
  { name: 'detail', path: '/anime/attack-on-titan-16498' },
  { name: 'watch', path: '/watch/attack-on-titan-16498-episode-1' },
];

(async () => {
  const outputDir = path.resolve(__dirname, '../../responsive_audit');
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const results = [];

  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.isMobile, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    for (const route of routes) {
      const record = { viewport: viewport.name, route: route.name, url: `${baseUrl}${route.path}` };
      try {
        await page.goto(record.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(1800);
        const metrics = await page.evaluate(() => ({
          viewportWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          bodyWidth: document.body.scrollWidth,
          horizontalOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > window.innerWidth + 2,
          visibleTrustLinks: Array.from(document.querySelectorAll('a')).filter((a) => /Open source|Client, not a media host|Your data, explained|Community standards/.test(a.textContent || '')).length,
          activeNavCount: document.querySelectorAll('[aria-current="page"]').length,
        }));
        Object.assign(record, metrics);
        await page.screenshot({ path: path.join(outputDir, `${viewport.name}-${route.name}.png`), fullPage: false });
      } catch (error) {
        record.error = error.message;
      }
      results.push(record);
    }
    await context.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify({ results, pageErrors: [] }, null, 2));
  console.log(JSON.stringify(results, null, 2));
})();
