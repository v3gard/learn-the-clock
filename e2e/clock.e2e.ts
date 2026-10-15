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
        name: `Digital clock. This clock cannot be edited., ${fixture.digital}`,
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
