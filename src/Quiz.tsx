import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { AnalogClock, ReadOnlyDigital } from './Clocks'
import { formatSpokenTime, formatTime } from './clock'
import { translations } from './i18n'
import type { Language } from './i18n'
import { generateQuestions, initialQuiz, quizReducer } from './quizModel'
import type { Question } from './quizModel'
import { quizText } from './quizText'
import { SentenceChoices, TimeChoices } from './QuizAnswers'
import { QuizRestartDialog } from './QuizRestartDialog'
import { useConfetti } from './useConfetti'
import { readPreference, writePreference } from './preferences'

declare global {
  interface Window {
    __E2E_QUIZ_QUESTIONS__?: Question[]
  }
}

export function Quiz({ visible, language }: { visible: boolean; language: Language }) {
  const [state, dispatch] = useReducer(quizReducer, initialQuiz, initialState => ({
    ...initialState,
    language,
    settings: readPreference('quizSettings'),
  }))
  const [confirming, setConfirming] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const newButton = useRef<HTMLButtonElement>(null)
  const celebrated = useRef(new WeakSet<Question[]>())
  const answered = useRef(new WeakSet<Question>())
  const { burst, stopParticles } = useConfetti()
  const cancelRestart = useCallback(() => setConfirming(false), [])
  const labels = quizText[language]
  const text = translations[language]
  const question = state.questions[state.index]
  const ultra = state.settings.difficulty === 'ultra'
  const compact = state.view === 'question'
  const steps = question?.wordSteps?.[state.language]
  const completeSentence = state.parts.every(part => part !== null)
  const correctSentence = !!steps && state.parts.every((part, index) => part === steps[index].word)

  useEffect(() => {
    dispatch({ type: 'language', language })
  }, [language])

  useEffect(() => {
    writePreference('quizSettings', state.settings)
  }, [state.settings])

  useEffect(() => {
    if (!visible) return
    heading.current?.focus()
    return stopParticles
  }, [visible, state.view, state.index, stopParticles])

  useEffect(() => {
    if (visible && state.view === 'results' && state.score === 10 && !celebrated.current.has(state.questions)) {
      celebrated.current.add(state.questions)
      burst(true)
    }
    // A run is celebrated once; translating or resuming results must not replay it.
  }, [visible, state.view, state.questions, state.score, burst])

  useEffect(() => {
    const close = () => setConfirming(false)
    window.addEventListener('hashchange', close)
    return () => window.removeEventListener('hashchange', close)
  }, [])

  if (ultra && state.view === 'question' && !steps) {
    throw new Error('Sentence questions must include phrase and hour choices.')
  }

  function start() {
    const questions = import.meta.env.MODE === 'e2e' && window.__E2E_QUIZ_QUESTIONS__
      ? window.__E2E_QUIZ_QUESTIONS__
      : generateQuestions(state.settings.difficulty)
    dispatch({ type: 'start', questions })
  }

  function back() {
    window.location.assign('#/')
  }

  function answerQuestion(choice: number) {
    if (state.selection !== null || answered.current.has(question)) return
    answered.current.add(question)
    dispatch({ type: 'answer', choice })
    if (choice === question.time) burst()
  }

  function pickSentencePart(part: 0 | 1, choice: string) {
    if (state.selection !== null || state.language !== language) return
    dispatch({ type: 'pick-part', choice, part, language: state.language })
  }

  function confirmSentence(event: MouseEvent<HTMLButtonElement>) {
    if (event.detail > 1 || !completeSentence || state.language !== language) return
    if (state.selection !== null) {
      dispatch({ type: 'next' })
      return
    }
    if (answered.current.has(question)) return
    answered.current.add(question)
    dispatch({ type: 'confirm-sentence', language: state.language })
    if (correctSentence) burst()
  }

  function restart() {
    stopParticles()
    setConfirming(false)
    dispatch({ type: 'setup' })
  }

  const nextLabel = state.index === 9 ? labels.results : labels.next
  let feedback = ''
  if (state.selection !== null) {
    const correct = ultra ? correctSentence : state.selection === question.time
    feedback = correct ? labels.correct : `${labels.incorrect} ${formatSpokenTime(question.time, language)}.`
  }

  return <div className={`quiz${compact ? ' quiz-compact' : ''}`} hidden={!visible}>
    <header>
      <p className="eyebrow">{labels.title}</p>
      <h1 ref={heading} tabIndex={-1}>{state.view === 'results' ? labels.resultTitle : labels.title}</h1>
      {compact && <div className="quiz-progress">
        <p>{labels.question} {state.index + 1} {labels.of} 10</p>
        <p>{labels.score} {state.score}/10</p>
      </div>}
      {state.view === 'setup' && <p className="intro">{labels.intro}</p>}
    </header>
    <div inert={confirming ? true : undefined}>
      {state.view === 'setup' && <section className="quiz-setup">
        <fieldset>
          <legend>{labels.difficulty}</legend>
          {(['easy', 'intermediate', 'hard', 'ultra'] as const).map(difficulty =>
            <button type="button" key={difficulty} aria-pressed={state.settings.difficulty === difficulty}
              onClick={() => dispatch({ type: 'settings', settings: { ...state.settings, difficulty } })}>
              {labels[difficulty]}
            </button>)}
        </fieldset>
        <fieldset>
          <legend>{labels.mode}</legend>
          {(['digital', 'analog', 'both'] as const).map(mode =>
            <button type="button" key={mode} aria-pressed={state.settings.mode === mode}
              onClick={() => dispatch({ type: 'settings', settings: { ...state.settings, mode } })}>
              {labels[mode]}
            </button>)}
        </fieldset>
        <button type="button" className="primary" onClick={start}>{labels.start}</button>
      </section>}
      {state.view === 'question' && <div className="quiz-question compact-layout">
        <div className={`clocks quiz-clocks ${state.settings.mode}`}>
          {state.settings.mode !== 'analog' && <section aria-label={text.digitalTitle}>
            <h2>{text.digitalTitle} <span className="badge">{text.digitalBadge}</span></h2>
            <ReadOnlyDigital time={question.time} label={`${text.digitalTitle}. ${labels.readOnly}`} />
          </section>}
          {state.settings.mode !== 'digital' && <section aria-label={text.analogTitle}>
            <h2>{text.analogTitle} <span className="badge">{text.analogBadge}</span></h2>
            <AnalogClock time={question.time} dialLabel={text.dialLabel} className="clock-face"
              role="img" aria-label={`${text.analogTitle}, ${formatTime(question.time).hours}:${formatTime(question.time).minutes}. ${labels.readOnly}`} />
          </section>}
        </div>
        <div className="compact-answer">
          {ultra && steps
            ? <SentenceChoices steps={steps} parts={state.parts} revealed={state.selection !== null}
                language={language} onPick={pickSentencePart} />
            : <TimeChoices question={question} selection={state.selection} language={language} onAnswer={answerQuestion} />}
          <p className="quiz-feedback" role="status" aria-live="polite" aria-atomic="true">{feedback}</p>
          {ultra && <details className="quiz-help">
            <summary>{labels.help}</summary>
            <div className="quiz-help-content">
              <p>{labels.sentencePreviewHint}</p>
              <p>{labels.languageRestart}</p>
            </div>
          </details>}
          <div className="quiz-buttons quiz-answer-actions">
            {ultra
              ? <button type="button" className="primary confirm-answer" disabled={!completeSentence}
                  aria-disabled={!completeSentence}
                  onKeyDown={event => { if (event.repeat) event.preventDefault() }}
                  onClick={confirmSentence}>
                  {state.selection === null ? labels.confirmAnswer : nextLabel}
                </button>
              : state.selection !== null && <button type="button" className="primary" onClick={() => dispatch({ type: 'next' })}>
                  {nextLabel}
                </button>}
            <button type="button" ref={newButton} onClick={() => setConfirming(true)}>{labels.new}</button>
            <button type="button" data-navigation-control aria-label={labels.back} onClick={back}>{labels.backShort}</button>
          </div>
        </div>
      </div>}
      {state.view === 'results' && <section className="quiz-results">
        <p className="result-score">{labels.score} {state.score}/10</p>
        <p>{state.score === 10 ? labels.perfect : labels.encouragement}</p>
        <div className="quiz-buttons">
          <button type="button" className="primary" onClick={start}>{labels.again}</button>
          <button type="button" onClick={() => dispatch({ type: 'setup' })}>{labels.settings}</button>
        </div>
      </section>}
      {!compact && <div className="quiz-buttons">
        <button type="button" data-navigation-control onClick={back}>{labels.back}</button>
      </div>}
    </div>
    <QuizRestartDialog open={confirming} visible={visible} language={language}
      triggerRef={newButton} onCancel={cancelRestart} onConfirm={restart} />
  </div>
}
