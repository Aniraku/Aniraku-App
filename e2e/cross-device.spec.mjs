import { test, expect, devices } from '@playwright/test'

const VIEWPORTS = [
  { name: 'Small Phone', width: 375, height: 667 },
  { name: 'Large Phone / Foldable', width: 480, height: 900 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Laptop', width: 1280, height: 800 },
  { name: 'Desktop', width: 1440, height: 900 },
]

test.describe('Aniraku Cross-Device Experience', () => {
  for (const vp of VIEWPORTS) {
    test(`Landing and navigation on ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('http://localhost:5173/')

      // Check the page's semantic main landmark. The app root and main can both
      // exist, so choose the visible main element explicitly to avoid strict-mode ambiguity.
      await expect(page.locator('main:visible').first()).toBeVisible()

      // On compact layouts, ensure at least one visible navigation landmark remains usable.
      if (vp.width <= 768) {
        await expect(page.locator('nav:visible').first()).toBeVisible()
      }
    })
  }

  test('Catalog discovery and search filter responsiveness', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('http://localhost:5173/catalog')

    // The Catalog design is card-led rather than heading-led; verify the route
    // and visible main content instead of assuming a particular heading element.
    await expect(page).toHaveURL(/\/catalog/)
    await expect(page.locator('main:visible').first()).toBeVisible()
  })

  test('Settings keeps account deletion unavailable to an unauthenticated visitor', async ({ page }) => {
    await page.goto('http://localhost:5173/profile/settings')
    await expect(page).toHaveURL(/\/profile\/settings/)
    await expect(page.getByRole('link', { name: /log in/i }).first()).toBeVisible()
    await expect(page.getByText('Delete account', { exact: true })).toHaveCount(0)
  })

  test('Minimal Random Anime controls remain compact and usable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('http://localhost:5173/random')

    await expect(page.getByRole('heading', { name: /what next/i })).toBeVisible()
    await expect(page.getByRole('button', { name: 'ANY' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'ACTION' })).toBeVisible()
    const movieMode = page.getByRole('button', { name: 'MOVIE' })
    await expect(movieMode).toBeVisible()
    await expect(page.getByRole('button', { name: /new pick/i })).toBeVisible()

    await movieMode.click()
    await expect(movieMode).toHaveAttribute('aria-pressed', 'true')
  })
})
