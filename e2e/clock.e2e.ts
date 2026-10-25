import { expect, test } from '@playwright/test'
import type { Question } from '../src/quizModel'

const quizFixture = [
  { question: { time: 0, choices: [0, 60, 120] }, digital: '00:00', answer: "The time is twelve o'clock" },
  { question: { time: 60, choices: [180, 60, 240] }, digital: '01:00', answer: "The time is one o'clock" },
  { question: { time: 180, choices: [300, 420, 180] }, digital: '03:00', answer: "The time is three o'clock" },
  { question: { time: 360, choices: [360, 480, 600] }, digital: '06:00', answer: "The time is six o'clock" },
  { question: { time: 660, choices: [60, 660, 180] }, digital: '11:00', answer: "The time is eleven o'clock" },
  { question: { time: 720, choices: [600, 540, 720] }, digital: '12:00', answer: "The time is twelve o'clock" },
  { question: { time: 840, choices: [840, 960, 1080] }, digital: '14:00', answer: "The time is two o'clock" },
  { question: { time: 1020, choices: [900, 1020, 1140] }, digital: '17:00', answer: "The time is five o'clock" },
  { question: { time: 1200, choices: [1320, 1260, 1200] }, digital: '20:00', answer: "The time is eight o'clock" },
  { question: { time: 1380, choices: [1380, 0, 60] }, digital: '23:00', answer: "The time is eleven o'clock" },
] satisfies { question: Question; digital: string; answer: string }[]

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('learn-the-clock.language', JSON.stringify('en'))
    localStorage.setItem('learn-the-clock.tutorialDone', 'true')
  })
})

test('development stays uncached while installation help remains available', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('button', { name: 'Install app', exact: true })).toBeVisible()
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0)
})

test('completes all ten quiz questions with a perfect score', async ({ page }) => {
  await page.addInitScript(questions => {
    window.__E2E_QUIZ_QUESTIONS__ = questions
  }, quizFixture.map(({ question }) => question))
  await page.goto('#/quiz')
  await page.getByRole('button', { name: 'Easy', exact: true }).click()
  await page.getByRole('button', { name: 'Digital', exact: true }).click()
  await page.getByRole('button', { name: 'Start quiz', exact: true }).click()

  for (const [index, fixture] of quizFixture.entries()) {
    await test.step(`Question ${index + 1}: ${fixture.digital}`, async () => {
      await expect(page.getByText(`Question ${index + 1} of 10`, { exact: true })).toBeVisible()
      await expect(page.getByText(`Score ${index}/10`, { exact: true })).toBeVisible()
      await expect(page.getByRole('img', {
        name: `Digital clock. This clock cannot be edited., ${fixture.digital}:00`,
        exact: true,
      })).toBeVisible()
      await expect(page.getByRole('status')).toBeEmpty()
      const choices = page.getByRole('button', { name: /^The time is / })
      await expect(choices).toHaveCount(3)
      await expect(page.getByRole('button', { name: /^(Next question|See results)$/ })).toHaveCount(0)

      await page.getByRole('button', { name: fixture.answer, exact: true }).click()
      await expect(page.getByRole('status')).toHaveText('Correct!')
      await expect(page.locator('.confetti-canvas')).toHaveCount(1)
      await expect(page.getByText(`Score ${index + 1}/10`, { exact: true })).toBeVisible()
      for (const choice of await choices.all()) {
        await expect(choice).toBeDisabled()
      }
      await page.getByRole('button', {
        name: index === 9 ? 'See results' : 'Next question',
        exact: true,
      }).click()
      if (index < 9) await expect(page.locator('.confetti-canvas')).toHaveCount(0)
    })
  }

  await expect(page.getByRole('heading', { name: 'Results', exact: true })).toBeVisible()
  await expect(page.getByText('Score 10/10', { exact: true })).toBeVisible()
  await expect(page.getByText('Congratulations! You got every answer right!', { exact: true })).toBeVisible()
  await expect(page.locator('.confetti-canvas')).toHaveCount(1)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('.confetti-canvas')).toHaveCount(0)
})

test('local confetti renders, resizes, finishes, and respects reduced motion', async ({ page }) => {
  await page.clock.install()
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.addInitScript(questions => {
    window.__E2E_QUIZ_QUESTIONS__ = questions
  }, quizFixture.map(({ question }) => question))
  await page.goto('#/quiz')
  await page.getByRole('button', { name: 'Easy', exact: true }).click()
  await page.getByRole('button', { name: 'Digital', exact: true }).click()
  await page.getByRole('button', { name: 'Start quiz', exact: true }).click()
  await page.getByRole('button', { name: quizFixture[0].answer, exact: true }).click()

  const canvas = page.locator('.confetti-canvas')
  await expect(canvas).toHaveCount(1)
  await expect(canvas).toHaveAttribute('aria-hidden', 'true')
  await expect(canvas).toHaveCSS('pointer-events', 'none')
  await page.clock.runFor(100)
  expect(await canvas.evaluate(element => {
    if (!(element instanceof HTMLCanvasElement)) throw new Error('Expected a confetti canvas.')
    const context = element.getContext('2d')
    if (!context) throw new Error('Missing confetti drawing context.')
    return context.getImageData(0, 0, element.width, element.height).data.some(value => value !== 0)
  })).toBe(true)

  await page.setViewportSize({ width: 900, height: 700 })
  await expect.poll(() => canvas.evaluate(element => {
    if (!(element instanceof HTMLCanvasElement)) throw new Error('Expected a confetti canvas.')
    const ratio = Math.min(devicePixelRatio || 1, 2)
    return element.width === Math.round(innerWidth * ratio)
      && element.height === Math.round(innerHeight * ratio)
  })).toBe(true)
  await page.clock.runFor(4100)
  await expect(canvas).toHaveCount(1)
  await page.clock.runFor(4000)
  await expect(canvas).toHaveCount(0)

  await page.getByRole('button', { name: 'Next question', exact: true }).click()
  await page.getByRole('button', { name: quizFixture[1].answer, exact: true }).click()
  await expect(canvas).toHaveCount(1)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(canvas).toHaveCount(0)
  await page.getByRole('button', { name: 'Next question', exact: true }).click()
  await page.getByRole('button', { name: quizFixture[2].answer, exact: true }).click()
  await page.clock.runFor(100)
  await expect(canvas).toHaveCount(0)

  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.getByRole('button', { name: 'Next question', exact: true }).click()
  await page.getByRole('button', { name: quizFixture[3].answer, exact: true }).click()
  await expect(canvas).toHaveCount(1)
  await page.goto('#/')
  await expect(canvas).toHaveCount(0)
})

test('dragging both clock hands updates the digital time', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Pause clock', exact: true }).click()
  const hours = page.getByRole('textbox', { name: 'Hours', exact: true })
  const minutes = page.getByRole('textbox', { name: 'Minutes', exact: true })
  await expect(hours).toHaveValue('13')
  await expect(minutes).toHaveValue('37')
  await minutes.fill('00')
  await minutes.press('Enter')
  await hours.fill('03')
  await hours.press('Enter')
  await expect(hours).toHaveValue('03')
  await expect(minutes).toHaveValue('00')

  const clock = page.getByRole('group', { name: /^Analog clock,/ })
  await clock.scrollIntoViewIfNeeded()
  const bounds = await clock.boundingBox()
  if (!bounds) throw new Error('The interactive clock has no bounding box.')
  const size = Math.min(bounds.width, bounds.height)
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }

  await test.step('minute hand: 03:00 to 03:15', async () => {
    const radius = size * 120 / 400
    await page.mouse.move(center.x, center.y - radius)
    await page.mouse.down()
    await page.mouse.move(center.x + radius, center.y, { steps: 12 })
    await expect(hours).toHaveValue('03')
    await expect(minutes).toHaveValue('15')
    await page.mouse.up()
    await expect(hours).toHaveValue('03')
    await expect(minutes).toHaveValue('15')
  })

  await minutes.fill('00')
  await minutes.press('Enter')
  await expect(hours).toHaveValue('03')
  await expect(minutes).toHaveValue('00')

  await test.step('hour hand: 03:00 to 06:00', async () => {
    const radius = size * 80 / 400
    await page.mouse.move(center.x + radius, center.y)
    await page.mouse.down()
    await page.mouse.move(center.x, center.y + radius, { steps: 12 })
    await expect(hours).toHaveValue('06')
    await expect(minutes).toHaveValue('00')
    await page.mouse.up()
    await expect(hours).toHaveValue('06')
    await expect(minutes).toHaveValue('00')
  })
})

test('seconds tick, pause during edits, resume without catch-up, and stay quiet', async ({ page }) => {
    await page.clock.install()
    await page.goto('./')
    await page.getByRole('button', { name: 'Second hand', exact: true }).click()
  const playback = page.locator('.clock-playback')
  await expect(playback).toHaveText('')
  await expect(playback.locator('svg')).toHaveAttribute('aria-hidden', 'true')
  await expect(playback.locator('rect')).toHaveCount(2)
    const hours = page.getByRole('textbox', { name: 'Hours', exact: true })
    const minutes = page.getByRole('textbox', { name: 'Minutes', exact: true })
    const seconds = page.getByRole('textbox', { name: 'Seconds', exact: true })
    const announcements = page.locator('.freestyle [aria-live="polite"]')
    const initialAnnouncement = await announcements.textContent()
    await page.clock.runFor(2000)
    await expect(seconds).toHaveValue('02')
    await expect(announcements).toHaveText(initialAnnouncement!)
    await expect(page.locator('.hand.second')).toHaveCSS('stroke', 'rgb(37, 99, 196)')

    await seconds.focus()
    await page.clock.runFor(3000)
    await expect(seconds).toHaveValue('02')
    await seconds.fill('59')
    await seconds.press('Enter')
    await page.clock.runFor(1000)
    await expect(seconds).toHaveValue('00')
    await expect(minutes).toHaveValue('38')

    await page.getByRole('button', { name: 'Pause clock', exact: true }).click()
    await expect(playback.locator('path')).toHaveCount(1)
    await expect(playback).toHaveAttribute('title', 'Resume clock')
    await hours.fill('23')
    await hours.press('Enter')
    await minutes.fill('59')
    await minutes.press('Enter')
    await seconds.fill('59')
    await seconds.press('Enter')
    await page.clock.runFor(10000)
    await expect(seconds).toHaveValue('59')
    await page.getByRole('button', { name: 'Resume clock', exact: true }).click()
    await expect(playback.locator('rect')).toHaveCount(2)
    await expect(playback).toHaveAttribute('title', 'Pause clock')
    await expect(seconds).toHaveValue('59')
    await page.clock.runFor(1000)
    await expect(hours).toHaveValue('00')
    await expect(minutes).toHaveValue('00')
    await expect(seconds).toHaveValue('00')

    await seconds.fill('60')
    await seconds.press('Enter')
    await expect(page.getByRole('alert')).toHaveText('Enter seconds from 0 to 59.')
    await page.clock.runFor(2000)
    await expect(seconds).toHaveValue('60')
    await seconds.press('Escape')
    await page.clock.runFor(1000)
    await expect(seconds).toHaveValue('01')
    await minutes.fill('12')
    await minutes.press('Enter')
    await expect(seconds).toHaveValue('00')
  })

  test('dragging an isolated second hand carries and borrows across midnight', async ({ page }) => {
    await page.clock.install()
    await page.goto('./')
    await page.getByRole('button', { name: 'Pause clock', exact: true }).click()
    await page.getByRole('button', { name: 'Second hand', exact: true }).click()
    const hours = page.getByRole('textbox', { name: 'Hours', exact: true })
    const minutes = page.getByRole('textbox', { name: 'Minutes', exact: true })
    const seconds = page.getByRole('textbox', { name: 'Seconds', exact: true })
    for (const [field, value] of [[hours, '23'], [minutes, '59'], [seconds, '59']] as const) {
      await field.fill(value)
      await field.press('Enter')
    }
    await page.getByRole('button', { name: 'Hour hand', exact: true }).click()
    await page.getByRole('button', { name: 'Minute hand', exact: true }).click()
    const clock = page.getByRole('group', { name: /^Analog clock,/ })
    await clock.scrollIntoViewIfNeeded()
    const bounds = await clock.boundingBox()
    if (!bounds) throw new Error('The interactive clock has no bounding box.')
    const radius = Math.min(bounds.width, bounds.height) * 130 / 400
    const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
    const angle = -6 * Math.PI / 180
    await page.mouse.move(center.x + Math.sin(angle) * radius, center.y - Math.cos(angle) * radius)
    await page.mouse.down()
    await page.mouse.move(center.x, center.y - radius, { steps: 6 })
    await expect(clock).toHaveAttribute('aria-label', /^Analog clock, 00:00:00\./)
    await expect(hours).toBeDisabled()
    await expect(minutes).toBeDisabled()
    await expect(seconds).toHaveValue('00')
    await page.mouse.move(center.x + Math.sin(angle) * radius, center.y - Math.cos(angle) * radius, { steps: 6 })
    await page.mouse.up()
    await expect(clock).toHaveAttribute('aria-label', /^Analog clock, 23:59:59\./)
    await expect(seconds).toHaveValue('59')

    await page.getByRole('button', { name: 'Resume clock', exact: true }).click()
    await page.mouse.move(center.x + Math.sin(angle) * radius, center.y - Math.cos(angle) * radius)
    await page.mouse.down()
    await page.mouse.move(center.x, center.y - radius, { steps: 6 })
    await page.clock.runFor(5000)
    await expect(seconds).toHaveValue('00')
    await page.mouse.up()
    await page.clock.runFor(1000)
    await expect(seconds).toHaveValue('01')
  })

  test('quiz clocks include seconds but never tick or change their answers', async ({ page }) => {
    await page.clock.install()
    await page.addInitScript(questions => { window.__E2E_QUIZ_QUESTIONS__ = questions }, quizFixture.map(({ question }) => question))
    await page.goto('#/quiz')
    await page.getByRole('button', { name: 'Easy', exact: true }).click()
    await page.getByRole('button', { name: 'Both', exact: true }).click()
    await page.getByRole('button', { name: 'Start quiz', exact: true }).click()
    const digital = page.getByRole('img', { name: 'Digital clock. This clock cannot be edited., 00:00:00', exact: true })
    const secondHand = page.locator('.quiz .hand.second')
    await expect(digital).toBeVisible()
    await page.clock.runFor(65000)
    await expect(digital).toBeVisible()
    await expect(secondHand.locator('..')).toHaveAttribute('transform', 'rotate(0 200 200)')
    await page.getByRole('button', { name: quizFixture[0].answer, exact: true }).click()
    await expect(page.getByRole('status')).toHaveText('Correct!')
  })

for (const phone of [false, true]) {
  test(`hand visibility toggles independently without changing time or quizzes (${phone ? 'phone' : 'desktop'})`, async ({ page }) => {
    await page.clock.install()
    if (phone) await page.setViewportSize({ width: 360, height: 740 })
    await page.goto('./')
    if (phone) await page.getByText('More controls', { exact: true }).click()
    const hands = ['hour', 'minute', 'second'] as const
    const analog = page.locator('.freestyle .clock-face')
    const secondToggle = page.getByRole('button', { name: 'Second hand', exact: true })
    await expect(secondToggle).toHaveAttribute('aria-pressed', 'false')
    await expect(analog.locator('.hand.second')).toHaveCount(0)
    await expect(page.getByRole('textbox', { name: 'Seconds', exact: true })).toBeDisabled()
    await expect(page.locator('.freestyle .time-field.seconds .segment.lit')).toHaveCount(0)
    await expect(page.locator('.freestyle .spoken-time')).not.toContainText('second')
    await secondToggle.click()
    await expect(page.getByRole('textbox', { name: 'Seconds', exact: true })).toHaveValue('00')
    for (const hand of hands) {
      const field = hand === 'hour' ? 'Hours' : hand === 'minute' ? 'Minutes' : 'Seconds'
      const input = page.getByRole('textbox', { name: field, exact: true })
      const button = page.getByRole('button', { name: `${hand[0].toUpperCase()}${hand.slice(1)} hand`, exact: true })
      await expect(button).toHaveAttribute('aria-pressed', 'true')
      if (hand === 'hour') {
        await input.fill('24')
        await input.press('Enter')
        await expect(page.getByRole('alert')).toHaveText('Enter hours from 0 to 23.')
      }
      await button.click()
      await expect(button).toHaveAttribute('aria-pressed', 'false')
      await expect(analog.locator(`.hand.${hand}`)).toHaveCount(0)
      await expect(analog.locator('.hand')).toHaveCount(2)
      await expect(input).toBeDisabled()
      await expect(input).toHaveValue('')
      await expect(page.getByRole('alert')).toHaveText('\u00a0')
      const segments = page.locator(`.freestyle .time-field.${field.toLowerCase()} .segment`)
      await expect(segments).toHaveCount(14)
      await expect(page.locator(`.freestyle .time-field.${field.toLowerCase()} .segment.lit`)).toHaveCount(0)
      await expect(segments.first()).toHaveCSS('opacity', '0.055')
      await expect(page.locator('.freestyle .digital-display .colon')).toHaveCount(2)
      await button.press('Space')
      await expect(button).toHaveAttribute('aria-pressed', 'true')
      await expect(analog.locator(`.hand.${hand}`)).toHaveCount(1)
      await expect(input).toBeEnabled()
      await expect(input).toHaveValue(hand === 'hour' ? '13' : hand === 'minute' ? '37' : '00')
      await expect(page.locator(`.freestyle .time-field.${field.toLowerCase()} .segment.lit`)).not.toHaveCount(0)
      if (hand === 'minute') {
        await expect(page.getByRole('textbox', { name: 'Minutes', exact: true })).toHaveValue('37')
        await expect(page.locator('.freestyle .digital-display .colon')).toHaveCount(2)
      }
    }
    for (const hand of hands) {
      await page.getByRole('button', { name: `${hand[0].toUpperCase()}${hand.slice(1)} hand`, exact: true }).click()
    }
    await expect(analog.locator('.hand')).toHaveCount(0)
    await expect(page.locator('.freestyle .hand-halo')).toHaveCount(0)
    await page.clock.runFor(2000)
    await expect(page.getByRole('textbox', { name: 'Seconds', exact: true })).toBeDisabled()
    await expect(page.getByRole('textbox', { name: 'Minutes', exact: true })).toBeDisabled()
    await expect(page.getByRole('textbox', { name: 'Hours', exact: true })).toBeDisabled()
    await expect(page.locator('.freestyle .segment.lit')).toHaveCount(0)

    if (phone) await page.getByText('More controls', { exact: true }).click()
    await page.locator('[data-tutorial-target="navigate"]').click()
    await page.getByRole('button', { name: 'Both', exact: true }).click()
    await page.getByRole('button', { name: 'Start quiz', exact: true }).click()
    await expect(page.locator('.quiz .hand')).toHaveCount(3)
    await page.locator('[data-tutorial-target="navigate"]').click()
    await expect(analog.locator('.hand')).toHaveCount(0)
    if (phone) await page.getByText('More controls', { exact: true }).click()
    await page.getByRole('button', { name: 'Second hand', exact: true }).click()
    await expect(analog.locator('.hand.second')).toHaveCount(1)
    await expect(page.getByRole('textbox', { name: 'Seconds', exact: true })).toHaveValue('02')
    await expect(analog.locator('.hand.second').locator('..')).toHaveAttribute('transform', 'rotate(12 200 200)')
    await page.getByRole('button', { name: 'Minute hand', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Minutes', exact: true })).toHaveValue('37')

    await page.reload()
    await expect(analog.locator('.hand')).toHaveCount(2)
    if (phone) await page.getByText('More controls', { exact: true }).click()
    for (const hand of hands) {
      await expect(page.getByRole('button', { name: `${hand[0].toUpperCase()}${hand.slice(1)} hand`, exact: true })).toHaveAttribute('aria-pressed', hand === 'second' ? 'false' : 'true')
    }
  })
}

test('hidden minutes discard invalid drafts and keep advancing internally', async ({ page }) => {
  await page.clock.install()
  await page.goto('./')
  await page.getByRole('button', { name: 'Pause clock', exact: true }).click()
  await page.getByRole('button', { name: 'Second hand', exact: true }).click()
  const minutes = page.getByRole('textbox', { name: 'Minutes', exact: true })
  const seconds = page.getByRole('textbox', { name: 'Seconds', exact: true })
  await minutes.fill('59')
  await minutes.press('Enter')
  await seconds.fill('59')
  await seconds.press('Enter')
  await minutes.fill('60')
  await minutes.press('Enter')
  await expect(page.getByRole('alert')).toHaveText('Enter minutes from 0 to 59.')
  await page.getByRole('button', { name: 'Minute hand', exact: true }).click()
  await expect(minutes).toBeDisabled()
  await expect(minutes).toHaveValue('')
  await expect(seconds).toHaveValue('59')
  await expect(page.getByRole('alert')).toHaveText('\u00a0')
  await page.getByRole('button', { name: 'Resume clock', exact: true }).click()
  await page.clock.runFor(1000)
  await expect(page.getByRole('textbox', { name: 'Hours', exact: true })).toHaveValue('14')
  await expect(seconds).toHaveValue('00')
  await page.getByRole('button', { name: 'Second hand', exact: true }).click()
  await expect(page.locator('.freestyle .digital-display .colon')).toHaveCount(2)
  await page.getByRole('button', { name: 'Minute hand', exact: true }).click()
  await expect(minutes).toHaveValue('00')
  await expect(page.locator('.freestyle .digital-display .colon')).toHaveCount(2)
})

test('playback control stays in the top toolbar beside the language button', async ({ page }) => {
  await page.goto('./')
  const playback = page.locator('.page-actions .clock-playback')
  await expect(playback).toHaveAccessibleName('Pause clock')
  for (const width of [320, 360, 1280]) {
    await page.setViewportSize({ width, height: 740 })
    await expect.poll(() => page.locator('.page-actions').evaluate(toolbar => {
      const bounds = toolbar.getBoundingClientRect()
      const pause = toolbar.querySelector('.clock-playback')!.getBoundingClientRect()
      const flag = toolbar.querySelector('.language-button')!.getBoundingClientRect()
      return bounds.left >= 0 && bounds.right <= innerWidth
        && pause.top === flag.top && pause.bottom === flag.bottom
    })).toBe(true)
  }
  await playback.click()
  await expect(playback).toHaveAccessibleName('Resume clock')
  await page.getByRole('button', { name: 'Go to quiz', exact: true }).click()
  await expect(playback).toHaveCount(0)
  await page.locator('[data-tutorial-target="navigate"]').click()
  await expect(playback).toHaveAccessibleName('Resume clock')
  await playback.click()
  await expect(playback).toHaveAccessibleName('Pause clock')
})

for (const language of ['en', 'nb'] as const) {
  test(`hiding seconds turns off LEDs and omits seconds from literary time (${language})`, async ({ page }) => {
    await page.clock.install()
    await page.addInitScript(value => localStorage.setItem('learn-the-clock.language', JSON.stringify(value)), language)
    await page.goto('./')
    const norwegian = language === 'nb'
    const pause = norwegian ? 'Sett klokka på pause' : 'Pause clock'
    const resume = norwegian ? 'Start klokka igjen' : 'Resume clock'
    await page.getByRole('button', { name: pause, exact: true }).click()
    const hours = page.getByRole('textbox', { name: norwegian ? 'Timer' : 'Hours', exact: true })
    const minutes = page.getByRole('textbox', { name: norwegian ? 'Minutter' : 'Minutes', exact: true })
    const seconds = page.getByRole('textbox', { name: norwegian ? 'Sekunder' : 'Seconds', exact: true })
    const toggle = page.getByRole('button', { name: norwegian ? 'Sekundviser' : 'Second hand', exact: true })
    await toggle.click()
    for (const [field, value] of [[hours, '03'], [minutes, '15'], [seconds, '24']] as const) {
      await field.fill(value)
      await field.press('Enter')
    }
    const caption = page.locator('.freestyle .spoken-time')
    const announcement = page.locator('.freestyle [aria-live="polite"]')
    await expect(caption).toContainText(norwegian ? '24 sekunder' : '24 seconds')
    await toggle.click()
    await expect(seconds).toBeDisabled()
    await expect(seconds).toHaveValue('')
    await expect(page.locator('.freestyle .time-field.seconds .segment')).toHaveCount(14)
    await expect(page.locator('.freestyle .time-field.seconds .segment.lit')).toHaveCount(0)
    await expect(page.locator('.freestyle .digital-display .colon')).toHaveCount(2)
    await expect(caption).toHaveText(norwegian ? 'Klokka er kvart over tre' : 'The time is quarter past three')
    await expect(announcement).not.toContainText(norwegian ? 'sekund' : 'second')
    await expect(page.locator('.freestyle .clock-face')).toHaveAttribute('aria-label', /, 03:15\./)
    await toggle.click()
    await expect(seconds).toHaveValue('24')
    await expect(caption).toContainText(norwegian ? '24 sekunder' : '24 seconds')

    await seconds.fill('60')
    await seconds.press('Enter')
    await expect(page.getByRole('alert')).toContainText('59')
    await toggle.click()
    await expect(page.getByRole('alert')).toHaveText('\u00a0')
    await page.getByRole('button', { name: resume, exact: true }).click()
    await page.clock.runFor(36000)
    await expect(minutes).toHaveValue('16')
    await expect(seconds).toBeDisabled()
    await expect(caption).not.toContainText(norwegian ? 'sekund' : 'second')
    await toggle.click()
    await expect(seconds).toHaveValue('00')
    await expect(page.locator('.freestyle .digital-display .colon')).toHaveCount(2)
  })
}
