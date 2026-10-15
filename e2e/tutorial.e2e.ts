import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const card = (page: Page) => page.getByRole('dialog', { name: 'Try it yourself' })
const progress = (page: Page, step: number) => expect(card(page).getByText(`Step ${step} of 9`, { exact: true })).toBeVisible()

async function acceptWelcome(page: Page) {
  await expect(page.getByRole('dialog', { name: 'Welcome!', exact: true })).toBeVisible()
  await expect(card(page)).toHaveCount(0)
  await expect(page.locator('.tutorial-spotlight')).toHaveCount(0)
  await page.getByRole('button', { name: 'Yes, show me', exact: true }).click()
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('learn-the-clock.language', '"en"')
  })
})

async function dragHand(page: Page, hand: 'hour' | 'minute') {
  const clock = page.locator('.freestyle .clock-face')
  const bounds = await clock.boundingBox()
  if (!bounds) throw new Error('Missing clock bounds')
  const transform = await clock.locator(`.hand.${hand}`).evaluate(line => line.parentElement!.getAttribute('transform')!)
  const angle = Number(transform.match(/rotate\(([\d.]+)/)![1]) * Math.PI / 180
  const radius = bounds.width * (hand === 'hour' ? 80 : 125) / 400
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
  await page.mouse.move(center.x + Math.sin(angle) * radius, center.y - Math.cos(angle) * radius)
  await page.mouse.down()
  await page.mouse.move(center.x + Math.sin(angle + Math.PI / 4) * radius, center.y - Math.cos(angle + Math.PI / 4) * radius, { steps: 12 })
}

for (const phone of [false, true]) {
  test(`first visit teaches real actions and completes into a chosen quiz (${phone ? 'phone' : 'desktop'})`, async ({ page }) => {
    if (phone) await page.setViewportSize({ width: 360, height: 740 })
    await page.goto('#/quiz')
    await expect(page.locator('.quiz')).toBeVisible()
    await acceptWelcome(page)
    await progress(page, 1)
    await expect(page.locator('.freestyle')).toBeVisible()
    await expect.poll(() => page.locator('[data-tutorial-control]').evaluate(button => !!button.closest('[inert]'))).toBe(true)

    await page.locator('.freestyle .clock-face').click({ position: { x: 15, y: 15 } })
    await progress(page, 1)
    await dragHand(page, 'minute')
    await page.mouse.up()
    await page.waitForTimeout(750)
    await progress(page, 1)
    await dragHand(page, 'hour')
    await page.locator('.freestyle .clock-face').dispatchEvent('pointercancel', { pointerId: 1 })
    await page.mouse.up()
    await page.waitForTimeout(750)
    await progress(page, 1)

    await dragHand(page, 'hour')
    await page.waitForTimeout(750)
    await progress(page, 1)
    await page.mouse.up()
    await progress(page, 2)
    await dragHand(page, 'minute')
    await page.mouse.up()
    await progress(page, 3)

    for (const [index, action] of ['hour-plus', 'hour-minus', 'minute-plus', 'minute-minus'].entries()) {
      await page.locator(`[data-tutorial-target="${action}"]`).click()
      await progress(page, index + 4)
    }
    await page.locator('[data-tutorial-target="navigate"]').click()
    await progress(page, 8)
    for (const mode of ['Digital', 'Analog']) {
      await page.getByRole('button', { name: mode, exact: true }).click()
      await progress(page, 8)
    }
    await page.getByRole('button', { name: 'Both', exact: true }).click()
    await progress(page, 9)
    await page.getByRole('button', { name: 'Analog', exact: true }).click()
    await page.getByRole('button', { name: 'Start quiz', exact: true }).click()
    await expect(card(page)).toHaveCount(0)
    await expect(page.locator('.quiz-clocks')).toHaveClass(/analog/)
    await expect(page.getByText('Question 1 of 10', { exact: true })).toBeVisible()
    await expect.poll(() => page.evaluate(() => localStorage.getItem('learn-the-clock.tutorialDone'))).toBe('true')
    await page.reload()
    await expect(card(page)).toHaveCount(0)
  })
}

test('temporary close reappears after reload; opt-out persists and help replays', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Close tutorial for now' }).click()
  await expect(card(page)).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('dialog', { name: 'Welcome!', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(card(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Show tutorial' })).toBeFocused()
  await page.reload()
  await page.getByRole('button', { name: 'No, thanks', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Show tutorial' }).click()
  await acceptWelcome(page)
  await progress(page, 1)
})

test('skipping every step never starts a quiz and still persists completion', async ({ page }) => {
  await page.goto('./')
  await acceptWelcome(page)
  for (let step = 1; step <= 9; step++) {
    await progress(page, step)
    await page.getByRole('button', { name: 'Skip step', exact: true }).click()
  }
  await expect(card(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Start quiz', exact: true })).toBeVisible()
  await expect(page.getByText('Question 1 of 10', { exact: true })).toHaveCount(0)
  await page.reload()
  await expect(card(page)).toHaveCount(0)
})

test('replay protects an unfinished quiz until explicitly confirmed', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'No, thanks', exact: true }).click()
  await page.locator('[data-tutorial-target="navigate"]').click()
  await page.getByRole('button', { name: 'Start quiz', exact: true }).click()
  const question = await page.locator('.quiz-clocks').textContent()
  await page.getByRole('button', { name: 'Show tutorial' }).click()
  await acceptWelcome(page)
  await expect(page.getByRole('dialog', { name: 'Restart your quiz for the tutorial?' })).toBeVisible()
  await page.getByRole('button', { name: 'Keep my quiz' }).click()
  await expect(card(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Show tutorial' })).toBeFocused()
  await expect(page.locator('.quiz-clocks')).toHaveText(question!)
  await expect(page.getByText('Question 1 of 10', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Show tutorial' }).click()
  await acceptWelcome(page)
  await page.getByRole('button', { name: 'Start tutorial', exact: true }).click()
  await progress(page, 1)
  await page.getByRole('button', { name: 'Skip tutorial', exact: true }).click()
  await page.locator('[data-tutorial-target="navigate"]').click()
  await expect(page.getByRole('button', { name: 'Start quiz', exact: true })).toBeVisible()
})

test('phone spotlight keeps targets and keyboard-accessible skips usable', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto('./')
  await acceptWelcome(page)
  for (let step = 1; step <= 9; step++) {
    await progress(page, step)
    await expect.poll(() => page.locator('.tutorial-card').evaluate(panel => {
      const bounds = panel.getBoundingClientRect()
      const spot = document.querySelector('.tutorial-spotlight')!.getBoundingClientRect()
      return bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 0 && bounds.bottom <= innerHeight + 1
        && (bounds.bottom <= spot.top || bounds.top >= spot.bottom || bounds.right <= spot.left || bounds.left >= spot.right)
    })).toBe(true)
    await page.keyboard.press('Tab')
    await expect.poll(() => page.evaluate(() => {
      const focused = document.activeElement
      return !!focused?.closest('.tutorial-card, [data-tutorial-target]')
    })).toBe(true)
    await page.getByRole('button', { name: 'Skip step', exact: true }).click()
  }
  await expect(page.getByRole('button', { name: 'Show tutorial' })).toBeInViewport()
})

test('laptop hand guidance keeps its natural size below the visible digital display', async ({ page }) => {
  await page.goto('./')
  await acceptWelcome(page)
  for (const size of [
    { width: 1280, height: 800 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 900, height: 600 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(size)
    for (const step of [1, 2]) {
      await progress(page, step)
      await expect.poll(() => page.locator('.tutorial-card').evaluate(panel => {
        const guidance = panel.getBoundingClientRect()
        const digital = document.querySelector('.freestyle .digital-frame')!.getBoundingClientRect()
        return guidance.top >= digital.bottom + 15
          && Math.abs(guidance.width - 360) < 1
          && panel.scrollHeight <= panel.clientHeight + 1
          && digital.top >= 0 && digital.bottom <= innerHeight
          && guidance.top >= 0 && guidance.bottom <= innerHeight
      })).toBe(true)
      await expect.poll(() => page.locator('.tutorial-card').evaluate(panel => {
        const bounds = panel.getBoundingClientRect()
        return [...panel.querySelectorAll('.tutorial-buttons button')].every(button => {
          const rect = button.getBoundingClientRect()
          const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
          return rect.top >= bounds.top && rect.bottom <= bounds.bottom && rect.bottom <= innerHeight
            && !!hit && button.contains(hit)
        })
      })).toBe(true)
      if (step === 1) await page.getByRole('button', { name: 'Skip step', exact: true }).click()
    }
    await page.getByRole('button', { name: 'Close tutorial for now' }).click()
    await page.getByRole('button', { name: 'Show tutorial' }).click()
    await acceptWelcome(page)
  }
})

test('Norwegian laptop actions stay visible before and after scrolling the instructions', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 600 })
  await page.addInitScript(() => localStorage.setItem('learn-the-clock.language', '"nb"'))
  await page.goto('./')
  await page.getByRole('button', { name: 'Ja, vis meg', exact: true }).click()
  for (const scrolled of [false, true]) {
    if (scrolled) await page.locator('.tutorial-card').evaluate(panel => { panel.scrollTop = panel.scrollHeight })
    for (const name of ['Hopp over trinn', 'Hopp over veiledningen']) {
      await expect(page.getByRole('button', { name, exact: true })).toBeInViewport({ ratio: 1 })
    }
  }
  await page.getByRole('button', { name: 'Hopp over trinn', exact: true }).click()
  await expect(page.getByText('Trinn 2 av 9', { exact: true })).toBeVisible()
})

test('blocked storage does not prevent session dismissal and replay', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() { throw new DOMException('Blocked', 'SecurityError') },
    })
  })
  await page.goto('./')
  await page.getByRole('button', { name: 'No, thanks', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Show tutorial' }).click()
  await acceptWelcome(page)
  await progress(page, 1)
})

test('navigation away dismisses safely without saving completion', async ({ page }) => {
  await page.goto('./')
  await acceptWelcome(page)
  await progress(page, 1)
  await page.evaluate(() => { location.hash = '#/quiz' })
  await expect(card(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Start quiz', exact: true })).toBeEnabled()
  await page.reload()
  await acceptWelcome(page)
  await progress(page, 1)
})
