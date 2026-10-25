import { defaultLanguage } from './i18n'
import type { Language } from './i18n'

export type Hand = 'hour' | 'minute' | 'second'
export type HandVisibility = Record<Hand, boolean>
export const allHandsVisible: HandVisibility = { hour: true, minute: true, second: true }
export type Field = 'hours' | 'minutes' | 'seconds'
export type Point = { x: number; y: number }

const spokenHours: Record<Language, string[]> = {
  nb: ['tolv', 'ett', 'to', 'tre', 'fire', 'fem', 'seks', 'sju', 'åtte', 'ni', 'ti', 'elleve'],
  en: ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven'],
}

export const wrapTime = (time: number) => ((time % 1440) + 1440) % 1440
export const formatTime = (time: number, seconds = 0) => ({
  hours: String(Math.floor(time / 60)).padStart(2, '0'),
  minutes: String(time % 60).padStart(2, '0'),
  seconds: String(seconds).padStart(2, '0'),
})

export function formatSpokenTime(time: number, language: Language = defaultLanguage, seconds = 0): string {
  if (!Number.isInteger(time)) throw new RangeError('Time must be a whole number of minutes.')
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 59) throw new RangeError('Seconds must be an integer from 0 to 59.')
  const actual = wrapTime(time)
  if (seconds !== 0) {
    const hours = Math.floor(actual / 60)
    const minutes = actual % 60
    return language === 'nb'
      ? `Klokka er ${hours} ${hours === 1 ? 'time' : 'timer'}, ${minutes} ${minutes === 1 ? 'minutt' : 'minutter'} og ${seconds} ${seconds === 1 ? 'sekund' : 'sekunder'}`
      : `The time is ${hours} ${hours === 1 ? 'hour' : 'hours'}, ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} and ${seconds} ${seconds === 1 ? 'second' : 'seconds'}`
  }
  const rounded = wrapTime(Math.round(actual / 5) * 5)
  const hours = spokenHours[language]
  const hour = Math.floor(rounded / 60) % 12
  const current = hours[hour]
  const next = hours[(hour + 1) % 12]
  const phrases = language === 'nb' ? [
    current, `fem over ${current}`, `ti over ${current}`, `kvart over ${current}`,
    `ti på halv ${next}`, `fem på halv ${next}`, `halv ${next}`,
    `fem over halv ${next}`, `ti over halv ${next}`, `kvart på ${next}`,
    `ti på ${next}`, `fem på ${next}`,
  ] : [
    `${current} o'clock`, `five past ${current}`, `ten past ${current}`, `quarter past ${current}`,
    `twenty past ${current}`, `twenty-five past ${current}`, `half past ${current}`,
    `twenty-five to ${next}`, `twenty to ${next}`, `quarter to ${next}`,
    `ten to ${next}`, `five to ${next}`,
  ]
  const prefix = language === 'nb' ? 'Klokka er ' : 'The time is '
  const approximateWord = language === 'nb' ? 'omtrent ' : 'about '
  const approximation = actual % 5 === 0 ? '' : approximateWord
  return `${prefix}${approximation}${phrases[rounded % 60 / 5]}`
}

export function setHalf(time: number, half: 0 | 1) {
  return time % 720 + half * 720
}

export function parseField(field: Field, value: string): number | null {
  if (!/^\d{1,2}$/.test(value)) return null
  const number = Number(value)
  return number <= (field === 'hours' ? 23 : 59) ? number : null
}

export type ClockState = {
  time: number
  seconds: number
  draft: { field: Field; value: string } | null
  error: Field | null
}

export type ClockAction =
  | { type: 'edit'; field: Field; value: string }
  | { type: 'commit' | 'discard' }
  | { type: 'add'; delta: number }
  | { type: 'half'; half: 0 | 1 }
  | { type: 'set'; time: number; seconds?: number }
  | { type: 'tick'; seconds: number }

export function clockReducer(state: ClockState, action: ClockAction): ClockState {
  switch (action.type) {
    case 'edit':
      return { ...state, draft: { field: action.field, value: action.value }, error: null }
    case 'commit': {
      if (!state.draft) return { ...state, draft: null, error: null }
      const { field, value } = state.draft
      const number = parseField(field, value)
      if (number === null) return { ...state, error: field }

      const time = field === 'seconds' ? state.time : field === 'hours'
        ? number * 60 + state.time % 60
        : Math.floor(state.time / 60) * 60 + number
      return { time, seconds: field === 'seconds' ? number : 0, draft: null, error: null }
    }
    case 'discard':
      return { ...state, draft: null, error: null }
    case 'add':
      return { time: wrapTime(state.time + action.delta), seconds: 0, draft: null, error: null }
    case 'half':
      return { time: setHalf(state.time, action.half), seconds: 0, draft: null, error: null }
    case 'set':
      return { time: wrapTime(action.time), seconds: action.seconds ?? 0, draft: null, error: null }
    case 'tick': {
      if (state.draft) return state
      const seconds = state.seconds + action.seconds
      return { ...state, time: wrapTime(state.time + Math.floor(seconds / 60)), seconds: seconds % 60 }
    }
  }
}

export function handAngle(time: number, hand: Hand, seconds = 0) {
  if (hand === 'second') return seconds * 6
  const minutesPerRevolution = hand === 'hour' ? 720 : 60
  return ((time + seconds / 60) % minutesPerRevolution) * 360 / minutesPerRevolution
}

export function svgPoint(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }): Point {
  const size = Math.min(rect.width, rect.height)
  return {
    x: (clientX - rect.left - (rect.width - size) / 2) * 400 / size,
    y: (clientY - rect.top - (rect.height - size) / 2) * 400 / size,
  }
}

export function pointerAngle(point: Point): number | null {
  const x = point.x - 200
  const y = point.y - 200
  if (Math.hypot(x, y) < 20) return null
  return Math.atan2(x, -y) * 180 / Math.PI
}

export function hitHand(point: Point, time: number, selected: Hand | null, tolerance = 18, seconds = 0, visibleHands: HandVisibility = allHandsVisible): Hand | null {
  if (pointerAngle(point) === null) return null
  function hits(hand: Hand) {
    const angle = handAngle(time, hand, seconds) * Math.PI / 180
    const x = point.x - 200
    const y = point.y - 200
    const distanceAlongHand = x * Math.sin(angle) - y * Math.cos(angle)
    const distanceAcrossHand = x * Math.cos(angle) + y * Math.sin(angle)
    const length = hand === 'hour' ? 103 : hand === 'minute' ? 150 : 166
    const nearestPointOnHand = Math.max(0, Math.min(length, distanceAlongHand))
    return Math.hypot(distanceAcrossHand, distanceAlongHand - nearestPointOnHand) <= tolerance
  }
  const first = selected ?? 'minute'
  const hands: Hand[] = [first, ...(['minute', 'hour', 'second'] as const).filter(hand => hand !== first)]
  for (const hand of hands) if (visibleHands[hand] && hits(hand)) return hand
  return null
}

export type Drag = { start: number; hand: Hand; previous: number | null; delta: number }

export function createDrag(time: number, hand: Hand, angle: number, seconds = 0): Drag {
  return { start: time + (hand === 'second' ? seconds / 60 : 0), hand, previous: angle, delta: 0 }
}

export function moveDrag(drag: Drag, angle: number | null): { drag: Drag; time: number; seconds: number } {
  // Re-anchor after the center dead zone; an undefined angle must never create a jump.
  const step = angle === null || drag.previous === null ? 0
    : ((angle - drag.previous + 540) % 360) - 180
  const next = { ...drag, previous: angle, delta: drag.delta + step }
  const secondsPerRevolution = next.hand === 'hour' ? 43200 : next.hand === 'minute' ? 3600 : 60
  const snap = next.hand === 'second' ? 1 : 60
  const rounded = Math.round((next.start * 60 + next.delta * secondsPerRevolution / 360) / snap) * snap
  const totalSeconds = ((rounded % 86400) + 86400) % 86400
  return { drag: next, time: Math.floor(totalSeconds / 60), seconds: totalSeconds % 60 }
}
