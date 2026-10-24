import { describe, expect, test } from 'bun:test'
import {
  clockReducer, createDrag, formatSpokenTime, formatTime, handAngle, hitHand, moveDrag,
  parseField, pointerAngle, setHalf, svgPoint, wrapTime,
} from '../src/clock'
import type { ClockState, Hand } from '../src/clock'

const initial: ClockState = { time: 900, seconds: 0, draft: null, error: null }
const pointAt = (angle: number, radius = 90) => ({
  x: 200 + Math.sin(angle * Math.PI / 180) * radius,
  y: 200 - Math.cos(angle * Math.PI / 180) * radius,
})

describe('Norwegian spoken time', () => {
  test('uses the complete five-minute vocabulary', () => {
    const phrases = [
      'tre', 'fem over tre', 'ti over tre', 'kvart over tre',
      'ti på halv fire', 'fem på halv fire', 'halv fire',
      'fem over halv fire', 'ti over halv fire', 'kvart på fire',
      'ti på fire', 'fem på fire',
    ]
    for (const [index, phrase] of phrases.entries()) {
      expect(formatSpokenTime(900 + index * 5, 'nb')).toBe(`Klokka er ${phrase}`)
      expect(formatSpokenTime(180 + index * 5, 'nb')).toBe(`Klokka er ${phrase}`)
    }
  })
  test('rounds across every boundary and marks only inexact times', () => {
    const ranges = [
      [0, 2, 'tre'], [3, 7, 'fem over tre'], [8, 12, 'ti over tre'],
      [13, 17, 'kvart over tre'], [18, 22, 'ti på halv fire'],
      [23, 27, 'fem på halv fire'], [28, 32, 'halv fire'],
      [33, 37, 'fem over halv fire'], [38, 42, 'ti over halv fire'],
      [43, 47, 'kvart på fire'], [48, 52, 'ti på fire'],
      [53, 57, 'fem på fire'], [58, 59, 'fire'],
    ] as const
    for (const [start, end, phrase] of ranges) {
      for (let minute = start; minute <= end; minute++) {
        const approximation = minute % 5 === 0 ? '' : 'omtrent '
        expect(formatSpokenTime(900 + minute, 'nb')).toBe(`Klokka er ${approximation}${phrase}`)
      }
    }
  })
  test('spells all hours identically in both day halves and rolls over twelve', () => {
    const hours = ['tolv', 'ett', 'to', 'tre', 'fire', 'fem', 'seks', 'sju', 'åtte', 'ni', 'ti', 'elleve']
    for (const [hour, word] of hours.entries()) {
      expect(formatSpokenTime(hour * 60, 'nb')).toBe(`Klokka er ${word}`)
      expect(formatSpokenTime((hour + 12) * 60, 'nb')).toBe(`Klokka er ${word}`)
    }
    for (const hour of [11, 23]) {
      expect(formatSpokenTime(hour * 60 + 55, 'nb')).toBe('Klokka er fem på tolv')
      expect(formatSpokenTime(hour * 60 + 57, 'nb')).toBe('Klokka er omtrent fem på tolv')
      expect(formatSpokenTime(hour * 60 + 58, 'nb')).toBe('Klokka er omtrent tolv')
      expect(formatSpokenTime(hour * 60 + 59, 'nb')).toBe('Klokka er omtrent tolv')
    }
    expect(formatSpokenTime(-1, 'nb')).toBe('Klokka er omtrent tolv')
    expect(formatSpokenTime(1440, 'nb')).toBe('Klokka er tolv')
    for (const time of [NaN, Infinity, -Infinity, 1.5]) {
      expect(() => formatSpokenTime(time, 'nb')).toThrow(RangeError)
    }
  })
  test('uses ett when referring to one in surrounding time expressions', () => {
    for (const hour of [0, 12]) {
      expect(formatSpokenTime(hour * 60 + 20, 'nb')).toBe('Klokka er ti på halv ett')
      expect(formatSpokenTime(hour * 60 + 30, 'nb')).toBe('Klokka er halv ett')
      expect(formatSpokenTime(hour * 60 + 45, 'nb')).toBe('Klokka er kvart på ett')
      expect(formatSpokenTime(hour * 60 + 58, 'nb')).toBe('Klokka er omtrent ett')
    }
    for (const hour of [1, 13]) {
      expect(formatSpokenTime(hour * 60 + 5, 'nb')).toBe('Klokka er fem over ett')
    }
  })
  test('follows only committed time without rounding the clocks or accepting drafts', () => {
    let state = { ...initial, time: 922 }
    for (const value of ['23', '', '60']) {
      state = clockReducer(state, { type: 'edit', field: 'minutes', value })
      expect(formatSpokenTime(state.time, 'nb')).toBe('Klokka er omtrent ti på halv fire')
      expect(state.time).toBe(922)
    }
    state = clockReducer(state, { type: 'commit' })
    expect(formatSpokenTime(state.time, 'nb')).toBe('Klokka er omtrent ti på halv fire')
    state = clockReducer(state, { type: 'edit', field: 'minutes', value: '23' })
    state = clockReducer(state, { type: 'commit' })
    expect(formatSpokenTime(state.time, 'nb')).toBe('Klokka er omtrent fem på halv fire')
    expect(state.time).toBe(923)
    state = clockReducer(state, { type: 'add', delta: 2 })
    expect(formatSpokenTime(state.time, 'nb')).toBe('Klokka er fem på halv fire')
    const moved = moveDrag(createDrag(state.time, 'minute', 150), 156)
    state = clockReducer(state, { type: 'set', time: moved.time })
    expect(state.time).toBe(926)
    expect(formatSpokenTime(state.time, 'nb')).toBe('Klokka er omtrent fem på halv fire')
  })
})

describe('English spoken time', () => {
  test('uses English when no language is specified', () => {
    expect(formatSpokenTime(935)).toBe('The time is twenty-five to four')
  })
  test('uses natural English expressions rather than translating Norwegian literally', () => {
    const phrases = [
      "three o'clock", 'five past three', 'ten past three', 'quarter past three',
      'twenty past three', 'twenty-five past three', 'half past three',
      'twenty-five to four', 'twenty to four', 'quarter to four',
      'ten to four', 'five to four',
    ]
    for (const [index, phrase] of phrases.entries()) {
      for (const hour of [3, 15]) {
        expect(formatSpokenTime(hour * 60 + index * 5, 'en')).toBe(`The time is ${phrase}`)
      }
    }
  })
  test('preserves caption-only rounding across hour and day boundaries', () => {
    const cases = [
      [900, "The time is three o'clock"],
      [902, "The time is about three o'clock"],
      [903, 'The time is about five past three'],
      [922, 'The time is about twenty past three'],
      [923, 'The time is about twenty-five past three'],
      [932, 'The time is about half past three'],
      [933, 'The time is about twenty-five to four'],
      [957, 'The time is about five to four'],
      [958, "The time is about four o'clock"],
      [1439, "The time is about twelve o'clock"],
      [0, "The time is twelve o'clock"],
      [720, "The time is twelve o'clock"],
      [60, "The time is one o'clock"],
      [780, "The time is one o'clock"],
    ] as const
    for (const [time, expected] of cases) expect(formatSpokenTime(time, 'en')).toBe(expected)
    for (const time of [NaN, Infinity, 1.5]) {
      expect(() => formatSpokenTime(time, 'en')).toThrow(RangeError)
    }
  })
  test('changing language leaves committed time, invalid drafts, and error identity intact', () => {
    const edited = clockReducer({ ...initial, time: 935 }, { type: 'edit', field: 'minutes', value: '60' })
    const invalid = clockReducer(edited, { type: 'commit' })
    expect(invalid.error).toBe('minutes')
    expect(formatSpokenTime(invalid.time, 'en')).toBe('The time is twenty-five to four')
    expect(formatSpokenTime(invalid.time, 'nb')).toBe('Klokka er fem over halv fire')
    expect(invalid).toEqual({ time: 935, seconds: 0, draft: { field: 'minutes', value: '60' }, error: 'minutes' })
  })
})

describe('one committed time', () => {
  test('minute changes carry and borrow across hours and midnight', () => {
    for (const [time, delta, expected] of [[959, 1, 960], [960, -1, 959], [1439, 1, 0], [0, -1, 1439]]) {
      expect(clockReducer({ ...initial, time }, { type: 'add', delta }).time).toBe(expected)
    }
    expect(wrapTime(-2881)).toBe(1439)
    expect(formatTime(0)).toEqual({ hours: '00', minutes: '00', seconds: '00' })
  })
  test('half selector preserves minutes and is idempotent', () => {
    expect(setHalf(215, 1)).toBe(935)
    expect(setHalf(935, 0)).toBe(215)
    expect(setHalf(935, 1)).toBe(935)
    expect(setHalf(1439, 0)).toBe(719)
  })
  test('valid entries commit just one field and restore leading zeroes', () => {
    const draft = clockReducer({ ...initial, time: 935 }, { type: 'edit', field: 'hours', value: '2' })
    const committed = clockReducer(draft, { type: 'commit' })
    expect(committed).toEqual({ time: 155, seconds: 0, draft: null, error: null })
    expect(formatTime(committed.time)).toEqual({ hours: '02', minutes: '35', seconds: '00' })
    expect(clockReducer(clockReducer(committed, { type: 'edit', field: 'minutes', value: '7' }), { type: 'commit' }).time).toBe(127)
  })
  test('invalid or empty drafts never clamp or change shared time', () => {
    for (const field of ['hours', 'minutes'] as const) {
      for (const value of ['', ' ', '-1', '1.5', 'abc', '123', field === 'hours' ? '24' : '60']) {
        expect(parseField(field, value)).toBeNull()
        const draft = clockReducer(initial, { type: 'edit', field, value })
        const result = clockReducer(draft, { type: 'commit' })
        expect(result.time).toBe(900)
        expect(result.error).toBeTruthy()
        expect(result.draft?.value).toBe(value)
        expect(clockReducer(result, { type: 'add', delta: 1 })).toEqual({ time: 901, seconds: 0, draft: null, error: null })
      }
    }
  })

  describe('seconds', () => {
    test('ticks carry through midnight and account for delayed updates', () => {
      const state = { ...initial, time: 1439, seconds: 59 }
      expect(clockReducer(state, { type: 'tick', seconds: 1 })).toEqual({ ...initial, time: 0 })
      expect(clockReducer(state, { type: 'tick', seconds: 122 })).toEqual({ ...initial, time: 2, seconds: 1 })
      const draft = clockReducer(state, { type: 'edit', field: 'seconds', value: '12' })
      expect(clockReducer(draft, { type: 'tick', seconds: 10 })).toEqual(draft)
    })

    test('edits seconds exactly, rejects invalid drafts, and resets on minute/hour edits', () => {
      const state = { ...initial, seconds: 42 }
      const edit = (field: 'hours' | 'minutes' | 'seconds', value: string) =>
        clockReducer(clockReducer(state, { type: 'edit', field, value }), { type: 'commit' })
      expect(edit('seconds', '7')).toEqual({ ...state, seconds: 7 })
      expect(edit('seconds', '60')).toMatchObject({ time: state.time, seconds: 42, error: 'seconds' })
      expect(edit('hours', '4')).toEqual({ ...initial, time: 240 })
      expect(edit('minutes', '5')).toEqual({ ...initial, time: 905 })
      expect(clockReducer(state, { type: 'discard' })).toEqual(state)
      expect(formatTime(197, 24)).toEqual({ hours: '03', minutes: '17', seconds: '24' })
    })

    test('describes nonzero seconds precisely in both languages', () => {
      expect(formatSpokenTime(197, 'en', 24)).toBe('The time is 3 hours, 17 minutes and 24 seconds')
      expect(formatSpokenTime(61, 'nb', 1)).toBe('Klokka er 1 time, 1 minutt og 1 sekund')
      expect(formatSpokenTime(180, 'en', 0)).toBe("The time is three o'clock")
      for (const seconds of [-1, 60, 1.5, NaN, Infinity]) {
        expect(() => formatSpokenTime(0, 'en', seconds)).toThrow(RangeError)
      }
    })

    test('second-hand dragging snaps, carries, borrows, and supports overlap selection', () => {
      expect(moveDrag(createDrag(1439, 'second', -6, 59), 0)).toMatchObject({ time: 0, seconds: 0 })
      expect(moveDrag(createDrag(0, 'second', 0), -6)).toMatchObject({ time: 1439, seconds: 59 })
      expect(moveDrag(createDrag(180, 'second', 0), 2)).toMatchObject({ time: 180, seconds: 0 })
      expect(moveDrag(createDrag(180, 'second', 0), 4)).toMatchObject({ time: 180, seconds: 1 })
      expect(handAngle(0, 'second', 24)).toBe(144)
      expect(handAngle(0, 'minute', 30)).toBe(3)
      expect(hitHand(pointAt(0), 0, 'second')).toBe('second')
      expect(hitHand(pointAt(90, 160), 0, null, 18, 15)).toBe('second')
      let result = moveDrag(createDrag(0, 'second', 0), 90)
      for (let step = 2; step <= 8; step++) result = moveDrag(result.drag, step * 90 % 360)
      expect(result).toMatchObject({ time: 2, seconds: 0 })
    })
  })
  test('Escape and competing controls discard even valid unfinished drafts', () => {
    const draft = clockReducer(initial, { type: 'edit', field: 'hours', value: '9' })
    expect(clockReducer(draft, { type: 'discard' })).toEqual(initial)
    expect(clockReducer(draft, { type: 'add', delta: -60 }).time).toBe(840)
    expect(clockReducer(draft, { type: 'half', half: 0 }).time).toBe(180)
    expect(clockReducer(draft, { type: 'set', time: 0 })).toEqual({ ...initial, time: 0 })
    // Blur onto a time control discards rather than committing before its click.
    expect(clockReducer(clockReducer(draft, { type: 'discard' }), { type: 'add', delta: 1 }).time).toBe(901)
  })
})

describe('analog interaction', () => {
  test('hidden hands never intercept drags, including preferred overlapping hands', () => {
    const visible = { hour: true, minute: false, second: false }
    expect(hitHand(pointAt(0), 0, 'minute', 18, 0, visible)).toBe('hour')
    expect(hitHand(pointAt(0), 0, null, 18, 0, { ...visible, hour: false })).toBeNull()
    expect(hitHand(pointAt(0), 0, 'hour', 18, 0, { hour: false, minute: false, second: true })).toBe('second')
    expect(hitHand(pointAt(90), 900, null, 18, 30, { hour: false, minute: true, second: true })).toBeNull()
  })

  test('hour position continuously reflects minutes', () => {
    expect(handAngle(930, 'hour')).toBe(105)
    expect(handAngle(930, 'minute')).toBe(180)
  })
  test('default overlap priority, explicit selection, and empty face', () => {
    expect(hitHand(pointAt(0), 0, null)).toBe('minute')
    expect(hitHand(pointAt(0), 0, 'hour')).toBe('hour')
    expect(hitHand(pointAt(0, 145), 0, 'hour')).toBe('minute')
    expect(hitHand(pointAt(90), 900, 'minute')).toBe('hour')
    expect(hitHand(pointAt(220, 150), 900, null)).toBeNull()
    expect(hitHand({ x: 200, y: 200 }, 900, null)).toBeNull()
    expect(hitHand(pointAt(7, 100), 0, null)).toBe('minute')
  })
  test('coordinate conversion handles resize and letterboxing', () => {
    expect(svgPoint(210, 120, { left: 10, top: 20, width: 400, height: 200 })).toEqual({ x: 200, y: 200 })
    expect(svgPoint(110, 220, { left: 10, top: 20, width: 200, height: 400 })).toEqual({ x: 200, y: 200 })
    expect(svgPoint(100, 25, { left: 0, top: 0, width: 200, height: 200 })).toEqual({ x: 200, y: 50 })
  })
  test('grab offset does not jump, and fractional deltas do not drift', () => {
    let drag = createDrag(900, 'minute', 7)
    expect(moveDrag(drag, 7).time).toBe(900)
    const hour = createDrag(930, 'hour', 113)
    expect(moveDrag(hour, 113).time).toBe(930)
    expect(moveDrag(hour, 113.2).time).toBe(930)
    expect(moveDrag(hour, 113.3).time).toBe(931)
    expect(moveDrag(hour, 128).time).toBe(960)
    expect(moveDrag(drag, 10).time).toBe(901)
    for (let angle = 7.1; angle < 13.01; angle += .1) drag = moveDrag(drag, angle).drag
    expect(moveDrag(drag, 13).time).toBe(901)
    expect(moveDrag(drag, 7).time).toBe(900)
  })
  for (const hand of ['hour', 'minute'] as Hand[]) {
    for (const direction of [-1, 1]) {
      test(`${hand} unwraps repeated revolutions in direction ${direction}`, () => {
        let drag = createDrag(1430, hand, 170)
        let result = moveDrag(drag, 170)
        for (let step = 1; step <= 36; step++) {
          const angle = pointerAngle(pointAt(170 + step * 30 * direction))!
          result = moveDrag(drag, angle)
          drag = result.drag
          expect(result.time).toBe(wrapTime(1430 + step * direction * (hand === 'hour' ? 60 : 5)))
        }
        expect(result.time).toBe(wrapTime(1430 + direction * (hand === 'hour' ? 2160 : 180)))
      })
    }
  }
  test('dead zone holds and safely reanchors on exit', () => {
    let result = moveDrag(createDrag(900, 'minute', 0), 60)
    expect(result.time).toBe(910)
    result = moveDrag(result.drag, pointerAngle({ x: 203, y: 204 }))
    expect(result.time).toBe(910)
    result = moveDrag(result.drag, -120)
    expect(result.time).toBe(910)
    expect(moveDrag(result.drag, -60).time).toBe(920)
  })
})
