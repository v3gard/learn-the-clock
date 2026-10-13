import { formatSpokenTime } from './clock'
import { defaultLanguage } from './i18n'
import type { Language } from './i18n'

export type Difficulty = 'easy' | 'intermediate' | 'hard' | 'ultra'
export type QuizMode = 'digital' | 'analog' | 'both'
export type Settings = { difficulty: Difficulty; mode: QuizMode }
export type SentenceStep = { word: string; choices: string[] }
export type SentenceSteps = [SentenceStep, SentenceStep]
export type Question = { time: number; choices: number[]; wordSteps?: Record<Language, SentenceSteps> }

export const minutePools: Record<Difficulty, readonly number[]> = {
  easy: [0],
  intermediate: [15, 30, 45],
  hard: [5, 10, 20, 25, 35, 40, 50, 55],
  ultra: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55],
}

export function sentenceParts(time: number, language: Language): [string, string] {
  if (time % 5 !== 0 || time % 60 === 0) {
    throw new RangeError('Sentence questions require a non-whole-hour five-minute time.')
  }
  const words = formatSpokenTime(time, language).toLowerCase().split(' ').slice(language === 'nb' ? 2 : 3)
  const hour = words[words.length - 1]
  if (words.length < 2 || !hour) throw new Error('Time expressions must include a phrase and an hour.')
  return [words.slice(0, -1).join(' '), hour]
}

function vocabulary(language: Language): [string[], string[]] {
  const parts = Array.from({ length: 12 }, (_, hour) =>
    minutePools.ultra.map(minute => sentenceParts(hour * 60 + minute, language))).flat()
  return [
    [...new Set(parts.map(([phrase]) => phrase))],
    [...new Set(parts.map(([, hour]) => hour))],
  ]
}

const partVocabulary: Record<Language, [string[], string[]]> = {
  nb: vocabulary('nb'),
  en: vocabulary('en'),
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function timeChoices(time: number, difficulty: Difficulty, random: () => number): number[] {
  const hour = Math.floor(time / 60)
  const minute = time % 60
  const otherHours = shuffle(
    Array.from({ length: 24 }, (_, candidate) => candidate)
      .filter(candidate => candidate % 12 !== hour % 12),
    random,
  )
  const wrongHour = otherHours[0] * 60 + minute
  let otherChoice: number
  if (difficulty === 'easy') {
    const secondWrongHour = otherHours.find(candidate => candidate % 12 !== otherHours[0] % 12)!
    otherChoice = secondWrongHour * 60
  } else {
    const otherMinutes = minutePools[difficulty].filter(candidate => candidate !== minute)
    otherChoice = hour * 60 + shuffle(otherMinutes, random)[0]
  }
  return shuffle([time, wrongHour, otherChoice], random)
}

function createSentenceSteps(time: number, language: Language, random: () => number): SentenceSteps {
  const [phrase, hour] = sentenceParts(time, language)

  function createStep(word: string, index: 0 | 1): SentenceStep {
    const alternatives = partVocabulary[language][index].filter(candidate => candidate !== word)
    const distractors = shuffle(alternatives, random).slice(0, 2)
    return { word, choices: shuffle([word, ...distractors], random) }
  }

  return [createStep(phrase, 0), createStep(hour, 1)]
}

export function generateQuestions(difficulty: Difficulty, random = Math.random): Question[] {
  const minutes = minutePools[difficulty]
  const possibleTargets = Array.from({ length: 12 }, (_, hour) =>
    minutes.map(minute => hour * 60 + minute)).flat()
  const targets = shuffle(possibleTargets, random).slice(0, 10)

  return targets.map(target => {
    const hour = Math.floor(target / 60) + (random() >= .5 ? 12 : 0)
    const minute = target % 60
    const time = hour * 60 + minute
    const question: Question = { time, choices: timeChoices(time, difficulty, random) }
    if (difficulty === 'ultra') {
      question.wordSteps = {
        nb: createSentenceSteps(time, 'nb', random),
        en: createSentenceSteps(time, 'en', random),
      }
    }
    return question
  })
}

export type QuizState = {
  settings: Settings
  view: 'setup' | 'question' | 'results'
  questions: Question[]
  index: number
  score: number
  selection: number | [string, string] | null
  language: Language
  parts: [string | null, string | null]
}
const freshSentence: Pick<QuizState, 'parts'> = { parts: [null, null] }
export const initialQuiz: QuizState = {
  settings: { difficulty: 'easy', mode: 'digital' },
  view: 'setup',
  questions: [],
  index: 0,
  score: 0,
  selection: null,
  language: defaultLanguage,
  ...freshSentence,
}

export type QuizAction =
  | { type: 'settings'; settings: Settings }
  | { type: 'start'; questions: Question[] }
  | { type: 'answer'; choice: number }
  | { type: 'pick-part'; choice: string; part: 0 | 1; language: Language }
  | { type: 'confirm-sentence'; language: Language }
  | { type: 'language'; language: Language }
  | { type: 'next' | 'setup' }

function sentenceSteps(state: QuizState, language: Language): SentenceSteps {
  const steps = state.questions[state.index].wordSteps?.[language]
  if (!steps) throw new Error('Sentence questions must include phrase and hour choices.')
  return steps
}

function translateSentencePart(selection: string, original: SentenceStep, translated: SentenceStep): string {
  if (selection === original.word) return translated.word

  // Distractors need not be literal translations; preserve their rank and correctness.
  const originalDistractors = original.choices.filter(choice => choice !== original.word)
  const translatedDistractors = translated.choices.filter(choice => choice !== translated.word)
  const translatedChoice = translatedDistractors[originalDistractors.indexOf(selection)]
  if (translatedChoice === undefined) {
    throw new Error('Submitted sentence parts must match the question choices.')
  }
  return translatedChoice
}

function changeLanguage(state: QuizState, language: Language): QuizState {
  if (state.language === language) return state
  if (state.settings.difficulty !== 'ultra' || !Array.isArray(state.selection)) {
    return { ...state, language, ...freshSentence }
  }

  const original = sentenceSteps(state, state.language)
  const translated = sentenceSteps(state, language)
  const parts: [string, string] = [
    translateSentencePart(state.selection[0], original[0], translated[0]),
    translateSentencePart(state.selection[1], original[1], translated[1]),
  ]
  return { ...state, language, parts, selection: parts }
}

export function quizReducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case 'settings':
      return state.view === 'setup' ? { ...state, settings: action.settings } : state
    case 'start':
      return {
        ...state, view: 'question', questions: action.questions,
        index: 0, score: 0, selection: null, ...freshSentence,
      }
    case 'setup':
      return {
        ...state, view: 'setup', questions: [],
        index: 0, score: 0, selection: null, ...freshSentence,
      }
    case 'language':
      return changeLanguage(state, action.language)
    case 'answer': {
      if (state.view !== 'question' || state.settings.difficulty === 'ultra' || state.selection !== null ||
        !state.questions[state.index].choices.includes(action.choice)) return state
      const correct = action.choice === state.questions[state.index].time
      return { ...state, selection: action.choice, score: state.score + Number(correct) }
    }
    case 'pick-part': {
      if (state.view !== 'question' || state.settings.difficulty !== 'ultra' || state.selection !== null ||
        action.language !== state.language) return state
      const steps = sentenceSteps(state, state.language)
      if (!steps[action.part].choices.includes(action.choice) || state.parts[action.part] === action.choice) return state
      const parts: QuizState['parts'] = [state.parts[0], state.parts[1]]
      parts[action.part] = action.choice
      return { ...state, parts }
    }
    case 'confirm-sentence': {
      if (state.view !== 'question' || state.settings.difficulty !== 'ultra' || state.selection !== null ||
        action.language !== state.language) return state
      const [phrase, hour] = state.parts
      if (phrase === null || hour === null) return state
      const steps = sentenceSteps(state, state.language)
      const correct = phrase === steps[0].word && hour === steps[1].word
      return { ...state, selection: [phrase, hour], score: state.score + Number(correct) }
    }
    case 'next':
      if (state.view !== 'question' || state.selection === null) return state
      if (state.index === state.questions.length - 1) return { ...state, view: 'results' }
      return { ...state, index: state.index + 1, selection: null, ...freshSentence }
  }
}
