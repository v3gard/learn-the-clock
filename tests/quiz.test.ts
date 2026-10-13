import { describe, expect, test } from 'bun:test'
import { formatSpokenTime } from '../src/clock'
import { generateQuestions, initialQuiz, quizReducer, sentenceParts } from '../src/quizModel'
import type { Difficulty } from '../src/quizModel'

const seeded = (seed: number) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
  return seed / 4294967296
}
describe('finite quiz generation', () => {
  for (const [difficulty, pool] of [
    ['easy', [0]], ['intermediate', [15, 30, 45]], ['hard', [5, 10, 20, 25, 35, 40, 50, 55]],
  ] as [Difficulty, number[]][]) {
    test(`${difficulty}: ten unique targets, bilingual answers and prescribed distractors`, () => {
      for (const random of [() => 0, () => 1, () => .999999999, seeded(0), seeded(42), seeded(815)]) {
        let calls = 0
        const questions = generateQuestions(difficulty, () => { calls++; return random() })
        expect(calls).toBeLessThan(1000)
        expect(questions).toHaveLength(10)
        expect(new Set(questions.map(q => q.time % 720)).size).toBe(10)
        for (const { time, choices } of questions) {
          expect(time).toBeGreaterThanOrEqual(0)
          expect(time).toBeLessThan(1440)
          expect(pool).toContain(time % 60)
          expect(choices).toHaveLength(3)
          expect(new Set(choices).size).toBe(3)
          const wrong = choices.filter(choice => choice !== time)
          expect(wrong).toHaveLength(2)
          for (const language of ['nb', 'en'] as const) {
            const labels = choices.map(choice => formatSpokenTime(choice, language))
            expect(new Set(labels).size).toBe(3)
            expect(labels.filter(label => label === formatSpokenTime(time, language))).toHaveLength(1)
          }
          if (difficulty === 'easy') {
            expect(new Set(choices.map(choice => Math.floor(choice / 60) % 12)).size).toBe(3)
            expect(choices.every(choice => choice % 60 === 0)).toBe(true)
          } else {
            expect(wrong.filter(choice => choice % 60 === time % 60 &&
              Math.floor(choice / 60) % 12 !== Math.floor(time / 60) % 12)).toHaveLength(1)
            expect(wrong.filter(choice => Math.floor(choice / 60) === Math.floor(time / 60) &&
              choice % 60 !== time % 60 && pool.includes(choice % 60))).toHaveLength(1)
          }
        }
      }
    })
  }
  test('seeded runs are reproducible, fresh, shuffle answers and reach all hours', () => {
    expect(generateQuestions('hard', seeded(42))).toEqual(generateQuestions('hard', seeded(42)))
    expect(generateQuestions('hard', seeded(42))).not.toEqual(generateQuestions('hard', seeded(43)))
    const hours = new Set<number>()
    const positions = new Set<number>()
    for (let seed = 0; seed < 100; seed++) {
      for (const q of generateQuestions('hard', seeded(seed))) {
        hours.add(Math.floor(q.time / 60))
        positions.add(q.choices.indexOf(q.time))
      }
    }
    expect(hours.size).toBe(24)
    expect(positions.size).toBe(3)
  })
})
describe('sentence-building difficulty', () => {
  test('groups all qualifiers before the hour into one choice in both languages', () => {
    expect(sentenceParts(915, 'nb')).toEqual(['kvart over', 'tre'])
    expect(sentenceParts(905, 'nb')).toEqual(['fem over', 'tre'])
    expect(sentenceParts(920, 'nb')).toEqual(['ti på halv', 'fire'])
    expect(sentenceParts(930, 'nb')).toEqual(['halv', 'fire'])
    expect(sentenceParts(935, 'nb')).toEqual(['fem over halv', 'fire'])
    expect(sentenceParts(945, 'nb')).toEqual(['kvart på', 'fire'])
    expect(sentenceParts(915, 'en')).toEqual(['quarter past', 'three'])
    expect(sentenceParts(925, 'en')).toEqual(['twenty-five past', 'three'])
    expect(sentenceParts(935, 'en')).toEqual(['twenty-five to', 'four'])
    for (const time of [0, 780, 916, NaN, Infinity]) {
      expect(() => sentenceParts(time, 'nb')).toThrow(RangeError)
    }
  })
  test('generates ten unique non-whole-hour times with exactly two steps and category-specific choices', () => {
    const minutes = new Set<number>()
    const positions = new Set<number>()
    for (const random of [() => 0, () => 1, seeded(42), seeded(815)]) {
      let calls = 0
      const questions = generateQuestions('ultra', () => { calls++; return random() })
      expect(calls).toBeLessThan(10000)
      expect(questions).toHaveLength(10)
      expect(new Set(questions.map(question => question.time % 720)).size).toBe(10)
      for (const question of questions) {
        expect(question.time % 5).toBe(0)
        expect(question.time % 60).not.toBe(0)
        for (const language of ['nb', 'en'] as const) {
          const steps = question.wordSteps![language]
          expect(steps).toHaveLength(2)
          expect(steps.map(step => step.word)).toEqual(sentenceParts(question.time, language))
          expect(steps.map(step => step.word).join(' ')).toBe(
            formatSpokenTime(question.time, language).toLowerCase().replace(language === 'nb' ? 'klokka er ' : 'the time is ', ''),
          )
          for (const [index, step] of steps.entries()) {
            expect(step.choices).toHaveLength(3)
            expect(new Set(step.choices).size).toBe(3)
            expect(step.choices.filter(word => word === step.word)).toHaveLength(1)
            for (const prefixWord of language === 'nb' ? ['klokka', 'er'] : ['the', 'time', 'is']) {
              expect(step.choices).not.toContain(prefixWord)
            }
            for (const choice of step.choices) {
              if (index === 0) expect(choice.includes(' ') || choice === 'halv').toBe(true)
              else expect(choice).toMatch(language === 'nb'
                ? /^(ett|to|tre|fire|fem|seks|sju|åtte|ni|ti|elleve|tolv)$/
                : /^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)$/)
            }
            positions.add(step.choices.indexOf(step.word))
          }
        }
      }
    }
    for (let seed = 0; seed < 10; seed++) {
      generateQuestions('ultra', seeded(seed)).forEach(question => minutes.add(question.time % 60))
    }
    expect([...minutes].sort((a, b) => a - b)).toEqual([5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55])
    expect(positions.size).toBe(3)
  })
  test('allows either selection first and unlimited experimentation, scoring only on explicit confirmation', () => {
    let state = quizReducer(initialQuiz, { type: 'settings', settings: { difficulty: 'ultra', mode: 'both' } })
    state = quizReducer(state, { type: 'language', language: 'nb' })
    state = quizReducer(state, { type: 'start', questions: generateQuestions('ultra', seeded(4)) })
    const question = state.questions[0]
    const steps = question.wordSteps!.nb
    expect(quizReducer(state, { type: 'answer', choice: question.time })).toBe(state)
    expect(quizReducer(state, { type: 'pick-part', part: 0, language: 'nb', choice: 'not-an-option' })).toBe(state)
    expect(quizReducer(state, { type: 'confirm-sentence', language: 'nb' })).toBe(state)
    state = quizReducer(state, { type: 'pick-part', part: 1, language: 'nb', choice: steps[1].word })
    expect(state.parts).toEqual([null, steps[1].word])
    expect(quizReducer(state, { type: 'confirm-sentence', language: 'nb' })).toBe(state)
    for (const part of [0, 1] as const) {
      for (const choice of steps[part].choices) {
        state = quizReducer(state, { type: 'pick-part', part, language: 'nb', choice })
        expect(state.parts[part]).toBe(choice)
        expect(state.selection).toBeNull()
        expect(state.score).toBe(0)
        expect(quizReducer(state, { type: 'next' })).toBe(state)
      }
      state = quizReducer(state, { type: 'pick-part', part, language: 'nb', choice: steps[part].word })
    }
    const confirm = { type: 'confirm-sentence', language: 'nb' } as const
    expect(state.score).toBe(0)
    state = quizReducer(state, confirm)
    expect(state.selection).toEqual(steps.map(step => step.word))
    expect(state.score).toBe(1)
    expect(quizReducer(state, confirm)).toBe(state)
    expect(quizReducer(state, { type: 'pick-part', part: 0, language: 'nb', choice: steps[0].choices.find(choice => choice !== steps[0].word)! })).toBe(state)
    const next = quizReducer(state, { type: 'next' })
    expect(next.parts).toEqual([null, null])
    expect(next.selection).toBeNull()
  })
  test('pending choices clear on language change without penalties; a confirmed correct answer stays locked and translated', () => {
    let state = quizReducer(initialQuiz, { type: 'settings', settings: { difficulty: 'ultra', mode: 'digital' } })
    state = quizReducer(state, { type: 'language', language: 'nb' })
    state = quizReducer(state, { type: 'start', questions: generateQuestions('ultra', () => 1) })
    const question = state.questions[0]
    const wrong = question.wordSteps!.nb[0].choices.find(choice => choice !== question.wordSteps!.nb[0].word)!
    state = quizReducer(state, { type: 'pick-part', part: 0, language: 'nb', choice: wrong })
    state = quizReducer(state, { type: 'language', language: 'en' })
    expect(state.parts).toEqual([null, null])
    expect(quizReducer(state, { type: 'pick-part', part: 0, language: 'nb', choice: wrong })).toBe(state)
    expect(quizReducer(state, { type: 'confirm-sentence', language: 'nb' })).toBe(state)
    const steps = question.wordSteps!.en
    for (const part of [0, 1] as const) {
      state = quizReducer(state, { type: 'pick-part', part, language: 'en', choice: steps[part].word })
    }
    expect(state.selection).toBeNull()
    expect(state.score).toBe(0)
    expect(quizReducer(state, { type: 'next' })).toBe(state)
    const answer = { type: 'confirm-sentence', language: 'en' } as const
    state = quizReducer(state, answer)
    expect(state.selection).toEqual(['five past', 'twelve'])
    expect(state.score).toBe(1)
    expect(quizReducer(state, answer)).toBe(state)
    state = quizReducer(state, { type: 'language', language: 'nb' })
    expect(state.parts).toEqual(['fem over', 'tolv'])
    expect(state.selection).toEqual(state.parts)
    expect(state.score).toBe(1)
  })
  test('a wrong confirmed answer locks both groups and remains wrong when translated', () => {
    let state = quizReducer(initialQuiz, { type: 'settings', settings: { difficulty: 'ultra', mode: 'digital' } })
    state = quizReducer(state, { type: 'language', language: 'nb' })
    state = quizReducer(state, { type: 'start', questions: generateQuestions('ultra', seeded(7)) })
    const question = state.questions[0]
    const steps = question.wordSteps!.nb
    const wrong = steps[0].choices.find(word => word !== steps[0].word)!
    state = quizReducer(state, { type: 'pick-part', part: 0, language: 'nb', choice: wrong })
    state = quizReducer(state, { type: 'pick-part', part: 1, language: 'nb', choice: steps[1].word })
    expect(state.selection).toBeNull()
    expect(quizReducer(state, { type: 'next' })).toBe(state)
    state = quizReducer(state, { type: 'confirm-sentence', language: 'nb' })
    expect(state.score).toBe(0)
    expect(state.selection).toEqual([wrong, steps[1].word])
    expect(quizReducer(state, { type: 'pick-part', part: 0, language: 'nb', choice: steps[0].word })).toBe(state)
    expect(quizReducer(state, { type: 'confirm-sentence', language: 'nb' })).toBe(state)
    state = quizReducer(state, { type: 'language', language: 'en' })
    expect(state.parts[0]).not.toBe(question.wordSteps!.en[0].word)
    expect(question.wordSteps!.en[0].choices).toContain(state.parts[0])
    expect(state.parts[1]).toBe(question.wordSteps!.en[1].word)
    expect(state.selection).toEqual(state.parts)
    expect(state.score).toBe(0)
    expect(state.questions[0]).toBe(question)
    state = quizReducer(state, { type: 'language', language: 'nb' })
    expect(state.parts).toEqual([wrong, steps[1].word])
    expect(state.score).toBe(0)
    expect(state.selection).toEqual(state.parts)
  })
  test('every submitted sentence choice survives a language round trip without rescoring', () => {
    const questions = generateQuestions('ultra', seeded(19))
    for (const language of ['nb', 'en'] as const) {
      const translatedLanguage = language === 'nb' ? 'en' : 'nb'
      const steps = questions[0].wordSteps![language]
      for (const phrase of steps[0].choices) {
        for (const hour of steps[1].choices) {
          let state = quizReducer(initialQuiz, {
            type: 'settings', settings: { difficulty: 'ultra', mode: 'both' },
          })
          state = quizReducer(state, { type: 'language', language })
          state = quizReducer(state, { type: 'start', questions })
          state = quizReducer(state, { type: 'pick-part', part: 0, choice: phrase, language })
          state = quizReducer(state, { type: 'pick-part', part: 1, choice: hour, language })
          state = quizReducer(state, { type: 'confirm-sentence', language })
          const submitted = state

          state = quizReducer(state, { type: 'language', language: translatedLanguage })
          const translatedSteps = questions[0].wordSteps![translatedLanguage]
          for (const part of [0, 1] as const) {
            expect(translatedSteps[part].choices).toContain(state.parts[part])
            expect(state.parts[part] === translatedSteps[part].word)
              .toBe(submitted.parts[part] === steps[part].word)
          }
          expect(state.selection).toEqual(state.parts)
          expect(state.score).toBe(submitted.score)
          expect(quizReducer(state, { type: 'confirm-sentence', language: translatedLanguage })).toBe(state)

          state = quizReducer(state, { type: 'language', language })
          expect(state).toEqual(submitted)
        }
      }
    }
  })
  test('scores complete ten-question runs and resets sentence progress for replay', () => {
    for (const language of ['nb', 'en'] as const) {
      for (const correctCount of [0, 6, 10]) {
        let state = quizReducer(initialQuiz, { type: 'settings', settings: { difficulty: 'ultra', mode: 'analog' } })
        state = quizReducer(state, { type: 'language', language })
        state = quizReducer(state, { type: 'start', questions: generateQuestions('ultra', seeded(27)) })
        for (let index = 0; index < 10; index++) {
          const steps = state.questions[index].wordSteps![language]
          for (const part of [0, 1] as const) {
            const choice = part === 0 && index >= correctCount
              ? steps[part].choices.find(choice => choice !== steps[part].word)! : steps[part].word
            state = quizReducer(state, { type: 'pick-part', part, language, choice })
          }
          expect(state.score).toBe(Math.min(index, correctCount))
          state = quizReducer(state, { type: 'confirm-sentence', language })
          expect(state.score).toBe(Math.min(index + 1, correctCount))
          expect(quizReducer(state, { type: 'confirm-sentence', language })).toBe(state)
          state = quizReducer(state, { type: 'next' })
        }
        expect(state.view).toBe('results')
        expect(state.score).toBe(correctCount)
        const sameLanguage = quizReducer(state, { type: 'language', language })
        expect(sameLanguage).toBe(state)
        const replay = quizReducer(state, { type: 'start', questions: generateQuestions('ultra', seeded(28)) })
        expect(replay.language).toBe(language)
        expect(replay.settings).toEqual(state.settings)
        expect(replay.parts).toEqual([null, null])
        expect(replay.score).toBe(0)
      }
    }
  })
})
describe('quiz transitions', () => {
  test('guards unanswered next, invalid/repeated answers and rapid next actions', () => {
    const questions = generateQuestions('easy', seeded(1))
    const state = quizReducer(initialQuiz, { type: 'start', questions })
    expect(quizReducer(state, { type: 'next' })).toBe(state)
    expect(quizReducer(state, { type: 'answer', choice: -1 })).toBe(state)
    const correct = quizReducer(state, { type: 'answer', choice: questions[0].time })
    expect(correct.score).toBe(1)
    expect(quizReducer(correct, { type: 'answer', choice: questions[0].time })).toBe(correct)
    expect(quizReducer(correct, { type: 'answer', choice: questions[0].choices.find(c => c !== questions[0].time)! })).toBe(correct)
    const next = quizReducer(correct, { type: 'next' })
    expect(next.index).toBe(1)
    expect(next.selection).toBeNull()
    expect(quizReducer(next, { type: 'next' })).toBe(next)
    const wrong = quizReducer(next, { type: 'answer', choice: questions[1].choices.find(c => c !== questions[1].time)! })
    expect(wrong.score).toBe(1)
    expect(quizReducer(wrong, { type: 'answer', choice: questions[1].time })).toBe(wrong)
    expect(quizReducer(wrong, { type: 'settings', settings: { difficulty: 'hard', mode: 'both' } })).toBe(wrong)
  })
  test('full runs cap score, show results only after ten attempts, replay/reset retain settings', () => {
    const settings = { difficulty: 'intermediate', mode: 'both' } as const
    for (const correctCount of [0, 6, 10]) {
      let state = quizReducer(initialQuiz, { type: 'settings', settings })
      state = quizReducer(state, { type: 'start', questions: generateQuestions(settings.difficulty, seeded(17)) })
      for (let i = 0; i < 10; i++) {
        const q = state.questions[i]
        state = quizReducer(state, { type: 'answer', choice: i < correctCount ? q.time : q.choices.find(c => c !== q.time)! })
        expect(state.view).toBe('question')
        state = quizReducer(state, { type: 'next' })
        expect(state.view).toBe(i === 9 ? 'results' : 'question')
      }
      expect(state.score).toBe(correctCount)
      expect(quizReducer(state, { type: 'next' })).toBe(state)
      expect(quizReducer(state, { type: 'answer', choice: state.questions[9].time })).toBe(state)
      const replay = quizReducer(state, { type: 'start', questions: generateQuestions(settings.difficulty, seeded(18)) })
      expect(replay.settings).toEqual(settings)
      expect(replay.score).toBe(0)
      expect(replay.index).toBe(0)
      expect(replay.selection).toBeNull()
      expect(replay.questions).not.toEqual(state.questions)
      const setup = quizReducer(state, { type: 'setup' })
      expect(setup.view).toBe('setup')
      expect(setup.settings).toEqual(settings)
      expect(setup.questions).toHaveLength(0)
    }
  })
})
