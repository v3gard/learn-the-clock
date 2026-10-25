import { useEffect, useImperativeHandle, useReducer, useState } from 'react'
import type { Dispatch, FocusEvent, KeyboardEvent, ReactNode, Ref } from 'react'
import { AnalogClock, DigitalFrame, LedDigits } from './Clocks'
import { allHandsVisible, clockReducer, formatSpokenTime, formatTime } from './clock'
import type { ClockAction, ClockState, Field, Hand, HandVisibility } from './clock'
import { translations } from './i18n'
import type { Language } from './i18n'
import { quizText } from './quizText'
import { useClockDrag } from './useClockDrag'
import type { TutorialAction } from './useTutorial'

type TimeFieldProps = {
  name: Field
  value: string
  label: string
  state: ClockState
  dispatch: Dispatch<ClockAction>
  onEditing: (editing: boolean) => void
  powered?: boolean
}

function TimeField({ name, value, label, state, dispatch, onEditing, powered = true }: TimeFieldProps) {
  const draft = state.draft?.field === name ? state.draft : null
  const error = draft ? state.error : null

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    onEditing(false)
    const target = event.relatedTarget instanceof Element ? event.relatedTarget : null
    // Toolbar actions preserve drafts; competing time controls discard them.
    if (target?.closest('[data-language-control], [data-navigation-control], [data-personalization-control], [data-support-control], [data-tutorial-control], [data-tutorial-dialog]')) return
    dispatch({ type: target?.closest('[data-time-control]') ? 'discard' : 'commit' })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' && event.key !== 'Escape') return
    event.preventDefault()
    dispatch({ type: event.key === 'Enter' ? 'commit' : 'discard' })
    onEditing(false)
  }

  return <div className={`time-field ${name}`}>
    <label htmlFor={name}>{label}</label>
    <div className={`led-field ${draft ? 'editing' : ''}`}>
      <LedDigits value={value} powered={powered} />
      <input id={name} type="text" inputMode="numeric" autoComplete="off" spellCheck={false}
        aria-invalid={!!error} aria-describedby={error ? 'input-error' : undefined}
        disabled={!powered} value={powered ? (draft ? draft.value : value) : ''}
        onFocus={event => {
          event.currentTarget.select()
          onEditing(true)
        }}
        onChange={event => dispatch({ type: 'edit', field: name, value: event.target.value })}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown} />
    </div>
  </div>
}

export type FreestyleClockHandle = { endDrag: () => void; togglePlayback: () => void }

type FreestyleClockProps = {
  visible: boolean
  language: Language
  running: boolean
  onRunningChange: (running: boolean) => void
  ref?: Ref<FreestyleClockHandle>
  tutorialHand?: Hand
  tutorialSecondHand?: boolean
  onTutorialAction?: (action: TutorialAction) => void
}

export function FreestyleClock({ visible, language, running, onRunningChange, ref, tutorialHand, tutorialSecondHand, onTutorialAction }: FreestyleClockProps) {
  const [state, rawDispatch] = useReducer(clockReducer, { time: 13 * 60 + 37, seconds: 0, draft: null, error: null })
  const [editing, setEditing] = useState(false)
  const [handVisibility, setHandVisibility] = useState<HandVisibility>({ ...allHandsVisible, second: false })
  const visibleHands = tutorialHand ? { ...handVisibility, [tutorialHand]: true } : handVisibility
  const [announcement, setAnnouncement] = useState({ time: state.time, seconds: state.seconds, running: true })
  function dispatch(action: ClockAction) {
    const next = clockReducer(state, action)
    rawDispatch(action)
    if (next.time !== state.time || next.seconds !== state.seconds) {
      setAnnouncement({ time: next.time, seconds: next.seconds, running })
    }
  }
  const { face, activeHand, changeTime, endDrag, pointerHandlers } = useClockDrag(state.time, dispatch, hand => {
    if (hand !== 'second') onTutorialAction?.(hand)
  }, tutorialHand, state.seconds, visibleHands)
  useImperativeHandle(ref, () => ({
    endDrag,
    togglePlayback() {
      changeTime({ type: 'discard' })
      setEditing(false)
      onRunningChange(!running)
      setAnnouncement({ time: state.time, seconds: state.seconds, running: !running })
    },
  }))
  const hasDraft = state.draft !== null
  useEffect(() => {
    if (!visible || !running || editing || hasDraft || activeHand) return
    let lastTick = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      const elapsed = Math.floor((now - lastTick) / 1000)
      if (elapsed < 1) return
      lastTick += elapsed * 1000
      rawDispatch({ type: 'tick', seconds: elapsed })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [visible, running, editing, hasDraft, activeHand])
  const { hours, minutes, seconds } = formatTime(state.time, state.seconds)
  const text = translations[language]

  const dayControls = <DayHalfControls language={language} time={state.time}
    onSelect={half => changeTime({ type: 'half', half })} />
  const handControls = <HandVisibilityControls language={language} visibleHands={visibleHands} tutorialHand={tutorialHand}
    onToggle={hand => {
      endDrag()
      const field = hand === 'hour' ? 'hours' : hand === 'minute' ? 'minutes' : 'seconds'
      if (visibleHands[hand] && state.draft?.field === field) {
        dispatch({ type: 'discard' })
        setEditing(false)
      }
      setHandVisibility(current => ({ ...current, [hand]: !current[hand] }))
      if (hand === 'second') onTutorialAction?.('second-toggle')
    }} />

  return <div className="freestyle" hidden={!visible}>
    <header>
      <p className="eyebrow">
        <span className="wide-eyebrow">{text.eyebrow}</span>
        <span className="short-eyebrow">{quizText[language].short}</span>
      </p>
      <h1>{text.title}</h1>
      <p className="intro">{text.intro}</p>
      <p className="spoken-time">{formatSpokenTime(state.time, language, visibleHands.second ? state.seconds : 0)}</p>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement.running ? text.clockRunning : text.clockPaused} {formatSpokenTime(announcement.time, language, visibleHands.second ? announcement.seconds : 0)}
      </p>
    </header>
    <div className="clocks">
      <section className="digital-section" aria-labelledby="digital-title">
        <h2 id="digital-title">{text.digitalTitle} <span className="badge">{text.digitalBadge}</span></h2>
        <DigitalFrame>
          <TimeField name="hours" value={hours} label={text.fields.hours} state={state} dispatch={dispatch} onEditing={setEditing} powered={visibleHands.hour} />
          <span className="colon" aria-hidden="true">:</span>
          <TimeField name="minutes" value={minutes} label={text.fields.minutes} state={state} dispatch={dispatch} onEditing={setEditing} powered={visibleHands.minute} />
          <span className="colon" aria-hidden="true">:</span>
          <TimeField name="seconds" value={seconds} label={text.fields.seconds} state={state} dispatch={dispatch} onEditing={setEditing} powered={visibleHands.second} />
        </DigitalFrame>
        <TimeAdjustments language={language} onAdjust={delta => {
          changeTime({ type: 'add', delta })
          onTutorialAction?.(delta === 60 ? 'hour-plus' : delta === -60 ? 'hour-minus' : delta === 1 ? 'minute-plus' : 'minute-minus')
        }} />
        <p id="input-error" className="input-error" role="alert">{state.error ? text.errors[state.error] : '\u00a0'}</p>
        <div className="inline-controls">{dayControls}</div>
      </section>
      <section className="analog-section" aria-labelledby="analog-title">
        <h2 id="analog-title">{text.analogTitle} <span className="badge">{text.analogBadge}</span></h2>
        <AnalogClock showDayNight data-tutorial-target="hands" faceRef={face} time={state.time} seconds={state.seconds} visibleHands={visibleHands} highlighted={tutorialHand ?? activeHand} dialLabel={text.dialLabel}
          className={`clock-face ${activeHand ? 'dragging' : ''}`}
          role="group" aria-label={`${text.analogTitle}, ${hours}:${minutes}${visibleHands.second ? `:${seconds}` : ''}. ${text.analogDescription}`}
          {...pointerHandlers} />
        <div className={`inline-controls${tutorialSecondHand ? ' tutorial-hand-controls' : ''}`}>{handControls}</div>
      </section>
    </div>
    <MoreControls label={text.moreControls}>
      <p className="intro">{text.intro}</p>
      {dayControls}
      {handControls}
    </MoreControls>
  </div>
}

function DayHalfControls({ language, time, onSelect }: {
  language: Language
  time: number
  onSelect: (half: 0 | 1) => void
}) {
  const text = translations[language]

  return <>
    <fieldset className="day-half"><legend>{text.dayHalf}</legend>
      {([0, 1] as const).map(half => <button key={half} type="button" data-time-control
        aria-pressed={Math.floor(time / 720) === half}
        onPointerDown={event => event.preventDefault()}
        onClick={() => onSelect(half)}>
        {half === 0 ? text.firstHalf : text.secondHalf}<small>{half === 0 ? '00–11' : '12–23'}</small>
      </button>)}
    </fieldset>
    <p className="hint">{text.inputHint}</p>
  </>
}

function HandVisibilityControls({ language, visibleHands, tutorialHand, onToggle }: {
  language: Language
  visibleHands: HandVisibility
  tutorialHand?: Hand
  onToggle: (hand: Hand) => void
}) {
  const text = translations[language]

  return <>
    <fieldset className="hand-visibility"><legend>{text.handVisibility}</legend>
      {(['hour', 'minute', 'second'] as const).map(hand => <button key={hand} type="button"
        data-tutorial-target={hand === 'second' ? 'second-toggle' : undefined}
        className={hand} aria-pressed={visibleHands[hand]} disabled={hand === tutorialHand}
        onClick={() => onToggle(hand)}><span className="color-dot" />
        {text.hands[hand]}
      </button>)}
    </fieldset>
    <p className="hint">{text.handHint}</p>
  </>
}

function TimeAdjustments({ language, onAdjust }: { language: Language; onAdjust: (delta: number) => void }) {
  const text = translations[language]

  return <div className="adjustments">
    {(['hours', 'minutes'] as const).map(name => <div className={`adjustment ${name}`} key={name}>
      <span>{text.fields[name]}</span>
      <div>{[-1, 1].map(direction => <button key={direction} type="button" data-time-control
        data-tutorial-target={`${name === 'hours' ? 'hour' : 'minute'}-${direction < 0 ? 'minus' : 'plus'}`}
        aria-label={text.adjustments[name][direction < 0 ? 'subtract' : 'add']}
        onPointerDown={event => event.preventDefault()}
        onClick={() => onAdjust(direction * (name === 'hours' ? 60 : 1))}>
        {direction < 0 ? '−' : '+'}
      </button>)}</div>
    </div>)}
  </div>
}

function MoreControls({ label, children }: { label: string; children: ReactNode }) {
  function closeOnEscape(event: KeyboardEvent<HTMLDetailsElement>) {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.currentTarget.open = false
    event.currentTarget.querySelector('summary')?.focus()
  }

  return <details className="more-controls" onKeyDown={closeOnEscape}>
    <summary>{label}</summary>
    <div className="more-controls-panel">{children}</div>
  </details>
}
