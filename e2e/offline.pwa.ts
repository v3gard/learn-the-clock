/// <reference types="node" />
import { readFile, writeFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const workerFile = new URL('../dist/sw.js', import.meta.url)
let originalWorker: string

test.beforeAll(async () => { originalWorker = await readFile(workerFile, 'utf8') })
test.afterEach(async ({ page }) => {
  await writeFile(workerFile, originalWorker)
  if (test.info().status !== test.info().expectedStatus && !page.isClosed()) {
    const cacheContents = await page.evaluate(async () => {
      const contents: Record<string, string[]> = {}
      for (const name of await caches.keys()) {
        const cache = await caches.open(name)
        contents[name] = (await cache.keys()).map(request => request.url)
      }
      return contents
    })
    await test.info().attach('offline-cache', { body: JSON.stringify(cacheContents, null, 2), contentType: 'application/json' })
  }
})
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('learn-the-clock.tutorialDone', 'true')
  })
})

async function loadReady(page: Page) {
  await page.goto('./')
  await expect(page.getByText('Ready to use offline', { exact: true })).toBeVisible()
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
}

async function publishUpdate(page: Page, broken = false) {
  let source = `${originalWorker}\n// PWA test update: ${test.info().testId}\n`
  if (broken) source = breakPrecache(source)
  // Mutate only the generated artifact, restoring it after each test.
  await writeFile(workerFile, source)
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration()
    if (!registration) throw new Error('Missing PWA registration.')
    await registration.update()
  })
}

function breakPrecache(source: string) {
  const broken = source.replace(/\{[^{}]*"url":"apple-touch-icon.png"[^{}]*\}/, entry => JSON.stringify({
    ...JSON.parse(entry),
    revision: 'broken-test-revision',
    integrity: 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  }))
  expect(broken).not.toBe(source)
  return broken
}

test('publishes scoped install metadata and correctly sized local icons', async ({ page, request, browserName }) => {
  await loadReady(page)
  const manifestLink = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(manifestLink).toBe('/learn-the-clock/manifest.webmanifest')
  const response = await request.get(manifestLink!)
  expect(response.ok()).toBe(true)
  const manifest = await response.json()
  expect(manifest).toMatchObject({
    id: '/learn-the-clock/',
    name: 'Learn the Clock',
    start_url: '/learn-the-clock/',
    scope: '/learn-the-clock/',
    display: 'standalone',
  })
  expect(manifest.orientation).toBeUndefined()
  for (const [file, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]] as const) {
    expect(await page.evaluate(async file => {
      const image = new Image()
      image.src = file
      await image.decode()
      return [image.naturalWidth, image.naturalHeight]
    }, file)).toEqual([size, size])
  }
  expect(await page.evaluate(async () => (await navigator.serviceWorker.ready).scope))
    .toBe('http://127.0.0.1:4175/learn-the-clock/')
  if (browserName === 'chromium') {
    const session = await page.context().newCDPSession(page)
    await expect.poll(async () => (await session.send('Page.getInstallabilityErrors')).installabilityErrors)
      .toEqual([])
    await session.detach()
  }
})

test('relaunches both routes offline, retains preferences, and starts a fresh quiz', async ({ page, context }) => {
  await loadReady(page)
  await page.locator('[data-language-control]').click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'nb')
  await page.locator('.page-actions button[aria-pressed]').click()
  await page.evaluate(() => { localStorage.setItem('learn-the-clock.background', '"space"') })
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'nb')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('.background-decoration')).toHaveAttribute('data-background', 'space')
  await expect(page.getByText('Klar til bruk uten internett', { exact: true })).toHaveCount(0)
  await expect(page.locator('.pwa-notice')).toHaveCount(0)
  await page.locator('.page-actions [data-navigation-control]').click()
  await page.locator('.quiz-setup > .primary').click()
  await expect(page.locator('.quiz-progress')).toBeVisible()
  await page.close()

  const relaunched = await context.newPage()
  const response = await relaunched.goto('http://127.0.0.1:4175/learn-the-clock/#/quiz')
  expect(response?.fromServiceWorker()).toBe(true)
  await expect(relaunched.locator('html')).toHaveAttribute('lang', 'nb')
  await expect(relaunched.locator('.quiz-setup')).toBeVisible()
  await expect(relaunched.locator('.quiz-progress')).toHaveCount(0)
  await relaunched.locator('.quiz-setup > .primary').click()
  await expect(relaunched.locator('.quiz-progress')).toBeVisible()
  await relaunched.reload()
  await expect(relaunched.locator('.quiz-setup')).toBeVisible()
  await relaunched.locator('.page-actions [data-navigation-control]').click()
  await expect(relaunched.locator('.freestyle')).toBeVisible()
  await expect(relaunched.locator('.clock-face').filter({ visible: true })).toBeVisible()
})

test('provides localized installation help, native install action, and a fitting mobile toolbar', async ({ page }) => {
  await loadReady(page)
  for (const width of [320, 390, 844]) {
    await page.setViewportSize({ width, height: 700 })
    const bounds = await page.locator('.page-actions').boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
  await page.getByRole('button', { name: 'Install app', exact: true }).click()
  const help = page.getByRole('dialog', { name: 'Install app', exact: true })
  await expect(help).toContainText('browser menu')
  await expect(help.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(help).not.toBeVisible()
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true })
    Object.assign(event, {
      prompt: async () => { document.body.dataset.installPrompted = 'true' },
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    })
    window.dispatchEvent(event)
  })
  await page.getByRole('button', { name: 'Install app', exact: true }).click()
  await help.getByRole('button', { name: 'Install', exact: true }).click()
  await expect(page.locator('body')).toHaveAttribute('data-install-prompted', 'true')
  await expect(help.getByRole('button', { name: 'Install', exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.locator('[data-language-control]').click()
  await page.getByRole('button', { name: 'Installer appen', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Installer appen', exact: true })).toContainText('nettlesermenyen')
})

test('gives Apple installation guidance and hides the install entry in standalone mode', async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    baseURL,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
    locale: 'en-GB',
  })
  try {
    await context.addInitScript(() => { localStorage.setItem('learn-the-clock.tutorialDone', 'true') })
    const page = await context.newPage()
    await loadReady(page)
    await page.getByRole('button', { name: 'Install app', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Install app', exact: true })).toContainText('Safari, tap Share')
    await page.addInitScript(() => {
      const matchMedia = window.matchMedia.bind(window)
      window.matchMedia = query => {
        const media = matchMedia(query)
        if (query === '(display-mode: standalone)') Object.defineProperty(media, 'matches', { value: true })
        return media
      }
    })
    await page.reload()
    await expect(page.locator('[data-install-control]')).toHaveCount(0)
    await publishUpdate(page)
    await expect(page.locator('.pwa-notice')).toContainText('An app update is ready.')
  } finally {
    await context.close()
  }
})

test('never interrupts a quiz and blocks explicit updates until other app windows close', async ({ page, context }) => {
  await loadReady(page)
  await page.locator('.page-actions [data-navigation-control]').click()
  await page.getByRole('button', { name: 'Start quiz', exact: true }).click()
  const quiz = await page.locator('.quiz-progress').innerText()
  const other = await context.newPage()
  await other.goto('http://127.0.0.1:4175/learn-the-clock/#/quiz')
  await other.getByRole('button', { name: 'Start quiz', exact: true }).click()
  const otherQuiz = await other.locator('.quiz-progress').innerText()
  let reloads = 0
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) reloads++ })
  let otherReloads = 0
  other.on('framenavigated', frame => { if (frame === other.mainFrame()) otherReloads++ })
  await publishUpdate(page)
  await expect(page.locator('.pwa-notice')).toContainText('An app update is ready.')
  await expect(page.locator('.quiz-progress')).toHaveText(quiz, { useInnerText: true })
  expect(reloads).toBe(0)
  await page.getByRole('button', { name: 'Update app', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Keep playing', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Update app', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Update app', exact: true }).click()
  await page.getByRole('button', { name: 'Update and reload', exact: true }).click()
  await expect(page.locator('.pwa-notice')).toContainText('Close other Learn the Clock')
  expect(reloads).toBe(0)
  expect(otherReloads).toBe(0)
  await expect(other.locator('.quiz-progress')).toHaveText(otherQuiz, { useInnerText: true })
  expect(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(true)
  await other.close()
  await page.getByRole('button', { name: 'Update app', exact: true }).click()
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Update and reload', exact: true }).click(),
  ])
  await expect(page.locator('.quiz-setup')).toBeVisible()
  expect(reloads).toBe(1)
  expect(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(false)
})

test('checks for updates on a throttled return to the app without offline nagging', async ({ page, context }) => {
  await loadReady(page)
  await page.clock.setFixedTime(new Date(Date.now() + 65 * 60 * 1000))
  await context.setOffline(true)
  await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')) })
  await expect(page.getByText('The app update could not finish.', { exact: false })).toHaveCount(0)
  await context.setOffline(false)
  await writeFile(workerFile, `${originalWorker}\n// Update on return to app\n`)
  await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')) })
  await expect(page.locator('.pwa-notice')).toContainText('An app update is ready.')
})

test('reports failed initial caching without claiming readiness and retries successfully', async ({ page }) => {
  await writeFile(workerFile, breakPrecache(originalWorker))
  await page.goto('./')
  await expect(page.locator('.pwa-notice')).toContainText('Offline setup could not finish.')
  await expect(page.getByText('Ready to use offline', { exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('learn-the-clock.offlineReadyNotified'))).toBeNull()
  await expect(page.locator('.freestyle')).toBeVisible()
  const otherCache = 'learn-the-clock-precache-v2-http://127.0.0.1:4175/other-app/'
  await page.evaluate(async name => {
    const cache = await caches.open(name)
    await cache.put('/other-app/', new Response('Other app data'))
  }, otherCache)
  await writeFile(workerFile, originalWorker)
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByText('Ready to use offline', { exact: true })).toBeVisible()
  expect(await page.evaluate(async name => {
    const cache = await caches.open(name)
    return (await cache.match('/other-app/'))?.text()
  }, otherCache)).toBe('Other app data')
})

test('preserves the cached app after a failed update and offers a successful retry', async ({ page, context }) => {
  await loadReady(page)
  await publishUpdate(page, true)
  await expect(page.locator('.pwa-notice')).toContainText('The app update could not finish.')
  await context.setOffline(true)
  const offline = await context.newPage()
  await offline.goto('http://127.0.0.1:4175/learn-the-clock/')
  await expect(offline.locator('.freestyle')).toBeVisible()
  await offline.close()
  await context.setOffline(false)
  await writeFile(workerFile, `${originalWorker}\n// Recovered PWA update\n`)
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.locator('.pwa-notice')).toContainText('An app update is ready.')
})

test('detects and repairs missing offline assets without clearing a working cache', async ({ page, context }) => {
  await loadReady(page)
  const missingKey = await page.evaluate(async () => {
    const name = (await caches.keys()).find(name => name.startsWith('learn-the-clock-'))
    if (!name) throw new Error('Missing offline cache.')
    const cache = await caches.open(name)
    const key = (await cache.keys()).find(request => new URL(request.url).pathname.endsWith('/app-icon.svg'))
    if (!key) throw new Error('Missing cached icon.')
    await cache.delete(key)
    return { cache: name, url: key.url }
  })
  await page.reload()
  await expect(page.locator('.pwa-notice')).toContainText('Offline setup could not finish.')
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.locator('.pwa-notice')).toHaveCount(0)
  expect(await page.evaluate(async key => !!await (await caches.open(key.cache)).match(key.url), missingKey)).toBe(true)
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('.freestyle')).toBeVisible()
})
