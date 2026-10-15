import { useImperativeHandle, useReducer } from 'react'
import type { Dispatch, FocusEvent, KeyboardEvent, ReactNode, Ref } from 'react'
import { AnalogClock, DigitalFrame, LedDigits } from './Clocks'
import { clockReducer, formatSpokenTime, formatTime } from './clock'
import type { ClockAction, ClockState, Field, Hand } from './clock'
import { translations } from './i18n'
import type { Language } from './i18n'
import { quizText } from './quizText'
import { useClockDrag } from './useClockDrag'

type TimeFieldProps = {
  name: Field
  value: string
  label: string
  state: ClockState
  dispatch: Dispatch<ClockAction>
}

function TimeField({ name, value, label, state, dispatch }: TimeFieldProps) {
  const draft = state.draft?.field === name ? state.draft : null
  const error = draft ? state.error : null

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    const target = event.relatedTarget instanceof Element ? event.relatedTarget : null
    // Toolbar actions preserve drafts; competing time controls discard them.
    if (target?.closest('[data-language-control], [data-navigation-control], [data-personalization-control], [data-support-control]')) return
    dispatch({ type: target?.closest('[data-time-control]') ? 'discard' : 'commit' })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' && event.key !== 'Escape') return
    event.preventDefault()
    dispatch({ type: event.key === 'Enter' ? 'commit' : 'discard' })
  }

  return <div className={`time-field ${name}`}>
    <label htmlFor={name}>{label}</label>
    <div className={`led-field ${draft ? 'editing' : ''}`}>
      <LedDigits value={value} />
      <input id={name} type="text" inputMode="numeric" autoComplete="off" spellCheck={false}
        aria-invalid={!!error} aria-describedby={error ? 'input-error' : undefined}
        value={draft ? draft.value : value}
        onFocus={event => event.currentTarget.select()}
        onChange={event => dispatch({ type: 'edit', field: name, value: event.target.value })}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown} />
    </div>
  </div>
}

export type FreestyleClockHandle = { endDrag: () => void }

type FreestyleClockProps = {
  visible: boolean
  language: Language
  ref?: Ref<FreestyleClockHandle>
}

export function FreestyleClock({ visible, language, ref }: FreestyleClockProps) {
  const [state, dispatch] = useReducer(clockReducer, { time: 13 * 60 + 37, draft: null, error: null })
  const { face, activeHand, highlightedHand, selectHand, changeTime, endDrag, pointerHandlers } = useClockDrag(state.time, dispatch)
  useImperativeHandle(ref, () => ({ endDrag }))
  const { hours, minutes } = formatTime(state.time)
  const text = translations[language]

  const dayControls = <DayHalfControls language={language} time={state.time}
    onSelect={half => changeTime({ type: 'half', half })} />
  const handControls = <HandSelectionControls language={language} highlightedHand={highlightedHand} onSelect={selectHand} />

  return <div className="freestyle" hidden={!visible}>
    <header>
      <p className="eyebrow">
        <span className="wide-eyebrow">{text.eyebrow}</span>
        <span className="short-eyebrow">{quizText[language].short}</span>
      </p>
      <h1>{text.title}</h1>
      <p className="intro">{text.intro}</p>
      <p className="spoken-time" aria-live="polite" aria-atomic="true">{formatSpokenTime(state.time, language)}</p>
    </header>
    <div className="clocks">
      <section className="digital-section" aria-labelledby="digital-title">
        <h2 id="digital-title">{text.digitalTitle} <span className="badge">{text.digitalBadge}</span></h2>
        <DigitalFrame>
          <TimeField name="hours" value={hours} label={text.fields.hours} state={state} dispatch={dispatch} />
          <span className="colon" aria-hidden="true">:</span>
          <TimeField name="minutes" value={minutes} label={text.fields.minutes} state={state} dispatch={dispatch} />
        </DigitalFrame>
        <TimeAdjustments language={language} onAdjust={delta => changeTime({ type: 'add', delta })} />
        <p id="input-error" className="input-error" role="alert">{state.error ? text.errors[state.error] : '\u00a0'}</p>
        <div className="inline-controls">{dayControls}</div>
      </section>
      <section className="analog-section" aria-labelledby="analog-title">
        <h2 id="analog-title">{text.analogTitle} <span className="badge">{text.analogBadge}</span></h2>
        <AnalogClock faceRef={face} time={state.time} highlighted={highlightedHand} dialLabel={text.dialLabel}
          className={`clock-face ${activeHand ? 'dragging' : ''}`}
          role="group" aria-label={`${text.analogTitle}, ${hours}:${minutes}. ${text.analogDescription}`}
          {...pointerHandlers} />
        <div className="inline-controls">{handControls}</div>
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

function HandSelectionControls({ language, highlightedHand, onSelect }: {
  language: Language
  highlightedHand: Hand | null
  onSelect: (hand: Hand) => void
}) {
  const text = translations[language]

  return <>
    <fieldset className="hand-selection"><legend>{text.handSelection}</legend>
      {(['hour', 'minute'] as const).map(hand => <button key={hand} type="button"
        className={hand} aria-pressed={highlightedHand === hand}
        onClick={() => onSelect(hand)}><span className="color-dot" />
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
