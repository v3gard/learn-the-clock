import { useEffect, useState } from 'react'
import { defaultLanguage } from './i18n'
import type { Language } from './i18n'
import { initialQuiz } from './quizModel'
import type { Settings } from './quizModel'

export type Background = 'current' | 'unicorn' | 'space'

type Preferences = {
  language: Language
  darkMode: boolean
  background: Background
  quizSettings: Settings
  tutorialDone: boolean
}

function defaultPreferences(): Preferences {
  const browserLanguage = globalThis.navigator?.language?.split('-')[0].toLowerCase()
  const prefersNorwegian = browserLanguage === 'nb' || browserLanguage === 'nn' || browserLanguage === 'no'

  return {
    language: prefersNorwegian ? 'nb' : defaultLanguage,
    darkMode: false,
    background: 'current',
    quizSettings: initialQuiz.settings,
    tutorialDone: false,
  }
}

const validators: { [Key in keyof Preferences]: (value: unknown) => value is Preferences[Key] } = {
  language: (value): value is Language => value === 'nb' || value === 'en',
  darkMode: (value): value is boolean => typeof value === 'boolean',
  tutorialDone: (value): value is boolean => typeof value === 'boolean',
  background: (value): value is Background => value === 'current' || value === 'unicorn' || value === 'space',
  quizSettings: (value): value is Settings => {
    if (typeof value !== 'object' || value === null) return false
    return 'difficulty' in value && 'mode' in value
      && (value.difficulty === 'easy' || value.difficulty === 'intermediate' || value.difficulty === 'hard' || value.difficulty === 'ultra')
      && (value.mode === 'digital' || value.mode === 'analog' || value.mode === 'both')
  },
}

function storageKey(key: keyof Preferences) {
  return `learn-the-clock.${key}`
}

export function readPreference<Key extends keyof Preferences>(key: Key): Preferences[Key] {
  const defaults = defaultPreferences()
  let stored: string | null
  try {
    stored = localStorage.getItem(storageKey(key))
  } catch (error) {
    console.warn(`Could not read saved preference "${key}". Using the default for this session.`, error)
    return defaults[key]
  }
  if (stored === null) return defaults[key]

  let value: unknown
  try {
    value = JSON.parse(stored)
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    console.warn(`Ignoring malformed saved preference "${key}".`, error)
    return defaults[key]
  }
  if (!validators[key](value)) {
    console.warn(`Ignoring invalid saved preference "${key}".`)
    return defaults[key]
  }
  return value
}

export function writePreference<Key extends keyof Preferences>(key: Key, value: Preferences[Key]) {
  const serialized = JSON.stringify(value)
  try {
    localStorage.setItem(storageKey(key), serialized)
  } catch (error) {
    console.warn(`Could not save preference "${key}". Changes will only apply to this session.`, error)
  }
}

export function usePreference<Key extends keyof Preferences>(key: Key) {
  const [value, setValue] = useState(() => readPreference(key))

  useEffect(() => {
    writePreference(key, value)
  }, [key, value])

  return [value, setValue] as const
}
