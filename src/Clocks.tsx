import type { ReactNode, Ref, SVGProps } from 'react'
import { allHandsVisible, formatTime, handAngle } from './clock'
import type { Hand, HandVisibility } from './clock'

const segments = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg']

export function LedDigits({ value, powered = true }: { value: string; powered?: boolean }) {
  return <span className="led-digits" aria-hidden="true">
    {[...value].map((digit, index) => <LedDigit digit={digit} powered={powered} key={index} />)}
  </span>
}

function LedDigit({ digit, powered }: { digit: string; powered: boolean }) {
  const litSegments = powered ? segments[Number(digit)] : ''

  return <span className="led-digit">
    {[...'abcdefg'].map(segment =>
      <i key={segment} className={`segment ${segment} ${litSegments?.includes(segment) ? 'lit' : ''}`} />)}
  </span>
}

export function DigitalFrame({ children }: { children: ReactNode }) {
  return <div className="digital-frame"><div className="digital-display">{children}</div></div>
}

export function ReadOnlyDigital({ time, label }: { time: number; label: string }) {
  const { hours, minutes, seconds } = formatTime(time)
  return <div role="img" aria-label={`${label}, ${hours}:${minutes}:${seconds}`}>
    <DigitalFrame>
      <ReadOnlyTimeField field="hours" value={hours} />
      <span className="colon" aria-hidden="true">:</span>
      <ReadOnlyTimeField field="minutes" value={minutes} />
      <span className="colon" aria-hidden="true">:</span>
      <ReadOnlyTimeField field="seconds" value={seconds} />
    </DigitalFrame>
  </div>
}

function ReadOnlyTimeField({ field, value }: { field: 'hours' | 'minutes' | 'seconds'; value: string }) {
  return <div className={`time-field ${field}`}><div className="led-field"><LedDigits value={value} /></div></div>
}

export function AnalogClock({ time, seconds = 0, visibleHands = allHandsVisible, highlighted, dialLabel, faceRef, ...props }: {
  time: number; seconds?: number; visibleHands?: HandVisibility; highlighted?: Hand | null; dialLabel: string; faceRef?: Ref<SVGSVGElement>
} & SVGProps<SVGSVGElement>) {
  return <svg ref={faceRef} viewBox="0 0 400 400" {...props}>
    <circle className="rim" cx="200" cy="200" r="194" />
    <circle className="dial" cx="200" cy="200" r="183" />
    <ClockTicks />
    <ClockNumbers />
    <text className="dial-label" x="200" y="264">{dialLabel}</text>
    {(['hour', 'minute', 'second'] as const).filter(hand => visibleHands[hand]).map(hand =>
      <ClockHand key={hand} hand={hand} time={time} seconds={seconds} highlighted={highlighted === hand} />)}
    <circle className="pin" cx="200" cy="200" r="11" />
    <circle className="pin-center" cx="200" cy="200" r="4" />
  </svg>
}

function ClockTicks() {
  return <>
    {Array.from({ length: 60 }, (_, tick) => <line key={tick}
      x1="200" y1="25" x2="200" y2={tick % 5 === 0 ? 42 : 33}
      transform={`rotate(${tick * 6} 200 200)`} className={tick % 5 === 0 ? 'major-tick' : 'minor-tick'} />)}
  </>
}

function ClockNumbers() {
  return <>
    {Array.from({ length: 12 }, (_, index) => {
      const angle = index * Math.PI / 6
      return <g key={index}>
        <text className="hour-number" x={200 + Math.sin(angle) * 129} y={200 - Math.cos(angle) * 129}>{index || 12}</text>
        <text className="minute-number" x={200 + Math.sin(angle) * 150} y={200 - Math.cos(angle) * 150}>{String(index * 5).padStart(2, '0')}</text>
      </g>
    })}
  </>
}

function ClockHand({ hand, time, seconds, highlighted }: { hand: Hand; time: number; seconds: number; highlighted: boolean }) {
  const tipY = hand === 'hour' ? 97 : hand === 'minute' ? 50 : 34

  return <g transform={`rotate(${handAngle(time, hand, seconds)} 200 200)`}>
    {highlighted && <line className="hand-halo" x1="200" y1="200" x2="200" y2={tipY} />}
    <line className={`hand ${hand}`} x1="200" y1="214" x2="200" y2={tipY} />
  </g>
}
