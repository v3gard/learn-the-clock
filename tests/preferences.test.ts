import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { readPreference, writePreference } from '../src/preferences'

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
const stored = new Map<string, string>()
const storage = {
  getItem: (key: string) => stored.get(key) ?? null,
  setItem: (key: string, value: string) => { stored.set(key, value) },
}
let warn: ReturnType<typeof spyOn<typeof console, 'warn'>>

function setBrowserLanguage(language: string | undefined) {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { language } })
}

beforeEach(() => {
  stored.clear()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  setBrowserLanguage('en-US')
  warn = spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  warn.mockRestore()
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
  else Reflect.deleteProperty(globalThis, 'localStorage')
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
  else Reflect.deleteProperty(globalThis, 'navigator')
})

describe('saved preferences', () => {
  test('defaults to Norwegian only for a Norwegian browser language, not a Norway region', () => {
    for (const [locale, expected] of [
      ['nb', 'nb'], ['nb-NO', 'nb'], ['nn-NO', 'nb'], ['no', 'nb'], ['NO-no', 'nb'],
      ['en-US', 'en'], ['en-NO', 'en'], ['sv-NO', 'en'], ['da-DK', 'en'],
      [undefined, 'en'], ['', 'en'],
    ] as const) {
      setBrowserLanguage(locale)
      expect(readPreference('language')).toBe(expected)
    }
    expect(warn).not.toHaveBeenCalled()
  })

  test('saved language overrides the browser language in either direction', () => {
    setBrowserLanguage('nb-NO')
    writePreference('language', 'en')
    expect(readPreference('language')).toBe('en')

    setBrowserLanguage('en-US')
    writePreference('language', 'nb')
    expect(readPreference('language')).toBe('nb')
    expect(warn).not.toHaveBeenCalled()
  })

  test('uses the Norwegian browser default when a saved language is invalid or malformed', () => {
    setBrowserLanguage('nn-NO')
    for (const invalid of ['"fr"', '{broken']) {
      stored.set('learn-the-clock.language', invalid)
      expect(readPreference('language')).toBe('nb')
    }
    expect(warn).toHaveBeenCalledTimes(2)
  })

  test('restores all preferences independently without changing other applications storage', () => {
    stored.set('another-app.language', '"nb"')
    writePreference('language', 'nb')
    writePreference('darkMode', true)
    writePreference('background', 'space')
    writePreference('quizSettings', { difficulty: 'ultra', mode: 'both' })

    expect(readPreference('language')).toBe('nb')
    expect(readPreference('darkMode')).toBe(true)
    expect(readPreference('background')).toBe('space')
    expect(readPreference('quizSettings')).toEqual({ difficulty: 'ultra', mode: 'both' })
    expect(stored.get('another-app.language')).toBe('"nb"')
    expect([...stored.keys()].filter(key => key.startsWith('learn-the-clock.'))).toHaveLength(4)
    expect(warn).not.toHaveBeenCalled()
  })

  test('uses defaults for missing entries and preserves explicitly saved default values', () => {
    expect(readPreference('language')).toBe('en')
    expect(readPreference('darkMode')).toBe(false)
    expect(readPreference('background')).toBe('current')
    expect(readPreference('quizSettings')).toEqual({ difficulty: 'easy', mode: 'digital' })

    writePreference('darkMode', false)
    writePreference('background', 'current')
    expect(stored.get('learn-the-clock.darkMode')).toBe('false')
    expect(readPreference('darkMode')).toBe(false)
    expect(readPreference('background')).toBe('current')
    expect(warn).not.toHaveBeenCalled()
  })

  test('rejects malformed and unsupported values without discarding other valid preferences', () => {
    writePreference('language', 'en')
    stored.set('learn-the-clock.background', '{broken')
    expect(readPreference('background')).toBe('current')

    stored.set('learn-the-clock.darkMode', '"false"')
    expect(readPreference('darkMode')).toBe(false)

    stored.set('learn-the-clock.language', '"fr"')
    expect(readPreference('language')).toBe('en')
    writePreference('language', 'en')

    for (const invalid of [null, [], {}, { difficulty: 'expert', mode: 'both' }, { difficulty: 'easy', mode: 'unknown' }]) {
      stored.set('learn-the-clock.quizSettings', JSON.stringify(invalid))
      expect(readPreference('quizSettings')).toEqual({ difficulty: 'easy', mode: 'digital' })
    }
    expect(readPreference('language')).toBe('en')
    expect(warn).toHaveBeenCalledTimes(8)
  })

  test('reports blocked storage access and full storage without interrupting the application', () => {
    const denied = new DOMException('Storage access denied', 'SecurityError')
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => { throw denied },
    })
    expect(readPreference('language')).toBe('en')
    expect(() => writePreference('language', 'en')).not.toThrow()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Could not read'), denied)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Could not save'), denied)

    const full = new DOMException('Storage full', 'QuotaExceededError')
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: storage.getItem, setItem: () => { throw full } },
    })
    expect(() => writePreference('background', 'unicorn')).not.toThrow()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Could not save'), full)
  })
})
