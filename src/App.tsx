import { useCallback, useEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { translations } from './i18n'
import type { Language } from './i18n'
import { FreestyleClock } from './FreestyleClock'
import type { FreestyleClockHandle } from './FreestyleClock'
import { Quiz } from './Quiz'
import type { QuizHandle } from './Quiz'
import { quizText } from './quizText'
import { Personalization } from './Personalization'
import { Support } from './Support'
import { usePreference } from './preferences'
import { Tutorial } from './Tutorial'
import { tutorialActions, useTutorial } from './useTutorial'
import { tutorialText } from './tutorialText'
import './App.css'

const languageFlags = {
  nb: NorwegianFlag,
  en: BritishFlag,
} satisfies Record<keyof typeof quizText, ComponentType>

function App() {
  const [darkMode, setDarkMode] = usePreference('darkMode')
  const [language, setLanguage] = usePreference('language')
  const tutorial = useTutorial()
  const { step, success, dismiss } = tutorial
  const tutorialAction = step === null ? null : tutorialActions[step]
  const [quizVisible, setQuizVisible] = useState(() => tutorial.step === null && location.hash === '#/quiz')
  const [confirmTutorial, setConfirmTutorial] = useState(false)
  const [clockRunning, setClockRunning] = useState(true)
  const freestyleClock = useRef<FreestyleClockHandle>(null)
  const quiz = useRef<QuizHandle>(null)
  const text = translations[language]
  const quizLabels = quizText[language]
  const cancelTutorial = useCallback(() => {
    setConfirmTutorial(false)
    dismiss()
  }, [dismiss])

  useEffect(() => {
    freestyleClock.current?.endDrag()
    if (tutorialAction === 'hour') window.location.assign('#/')
    if (tutorialAction === 'modes' || tutorialAction === 'start') window.location.assign('#/quiz')
  }, [tutorialAction])

  useEffect(() => {
    function navigate() {
      const nextQuizVisible = location.hash === '#/quiz'
      setQuizVisible(nextQuizVisible)
      const expectedQuiz = tutorialAction === 'modes' || tutorialAction === 'start' || (tutorialAction === 'navigate' && success)
      if (step !== null && nextQuizVisible !== expectedQuiz) dismiss()
    }
    window.addEventListener('hashchange', navigate)
    return () => window.removeEventListener('hashchange', navigate)
  }, [step, tutorialAction, success, dismiss])

  useEffect(() => {
    document.documentElement.lang = language
    document.title = quizVisible ? `${quizLabels.title} — ${text.title}` : text.title
    document.querySelector('meta[name="description"]')?.setAttribute('content', quizVisible ? quizLabels.intro : text.description)
  }, [language, text.title, text.description, quizVisible, quizLabels.title, quizLabels.intro])

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
    return () => { delete document.documentElement.dataset.theme }
  }, [darkMode])

  function navigate() {
    freestyleClock.current?.endDrag()
    window.location.assign(quizVisible ? '#/' : '#/quiz')
    if (!quizVisible) tutorial.complete('navigate')
  }

  function beginTutorial() {
    freestyleClock.current?.endDrag()
    quiz.current?.prepareTutorial()
    setConfirmTutorial(false)
    tutorial.begin()
    setQuizVisible(false)
    window.location.assign('#/')
  }

  function requestTutorial() {
    document.querySelectorAll<HTMLElement>('.toolbar-panel:popover-open').forEach(panel => panel.hidePopover())
    tutorial.showWelcome()
  }

  function acceptTutorial() {
    if (quiz.current?.hasUnfinishedQuiz()) setConfirmTutorial(true)
    else beginTutorial()
  }

  return <main>
    <div className="page-actions" role="group" aria-label={text.tools}>
      <NavigationButton language={language} quizVisible={quizVisible} onNavigate={navigate} />
      {!quizVisible && <button type="button" className="icon-button clock-playback" data-time-control data-tutorial-target="playback"
        aria-label={clockRunning ? text.pauseClock : text.resumeClock}
        title={clockRunning ? text.pauseClock : text.resumeClock}
        onClick={() => {
          freestyleClock.current?.togglePlayback()
          tutorial.complete('playback')
        }}>
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          {clockRunning
            ? <><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></>
            : <path d="M8 5v14l11-7z" />}
        </svg>
      </button>}
      <LanguageButton language={language} onToggle={() => setLanguage(current => current === 'nb' ? 'en' : 'nb')} />
      <DarkModeButton language={language} darkMode={darkMode} onToggle={() => setDarkMode(current => !current)} />
      <Personalization language={language} />
      <Support language={language} />
      <button type="button" className="icon-button" data-tutorial-control
        aria-label={tutorialText[language].help} title={tutorialText[language].help}
        onPointerDown={event => event.preventDefault()} onClick={event => {
          event.currentTarget.focus({ preventScroll: true })
          requestTutorial()
        }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 2v1" />
        </svg>
      </button>
    </div>
    <Quiz ref={quiz} visible={quizVisible} language={language} onTutorialAction={tutorial.complete} />
    <FreestyleClock ref={freestyleClock} visible={!quizVisible} language={language} running={clockRunning} onRunningChange={setClockRunning}
      tutorialHand={tutorialAction === 'hour' || tutorialAction === 'minute' ? tutorialAction : undefined}
      tutorialSecondHand={tutorialAction === 'second-toggle'}
      onTutorialAction={tutorial.complete} />
    <Tutorial language={language} step={tutorial.step} success={tutorial.success} modes={tutorial.modes}
      welcoming={tutorial.welcoming} onStart={acceptTutorial}
      confirming={confirmTutorial} onDismiss={tutorial.dismiss} onSkip={tutorial.next}
      onOptOut={tutorial.optOut} onConfirm={beginTutorial} onCancel={cancelTutorial} />
    {tutorial.notice && <p className="tutorial-notice" role="status">{tutorialText[language].done}</p>}
  </main>
}

function NavigationButton({ language, quizVisible, onNavigate }: {
  language: Language
  quizVisible: boolean
  onNavigate: () => void
}) {
  const text = quizText[language]
  const label = quizVisible ? text.back : text.enter

  return <button className="icon-button" type="button" data-navigation-control data-tutorial-target="navigate"
    aria-label={label} title={label}
    onPointerDown={event => event.preventDefault()}
    onClick={onNavigate}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      {quizVisible ? <><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></>
        : <><path d="M5 4h14v16H5zM8 8h8M8 12h4" /><path d="m13 16 2 2 4-4" /></>}
    </svg>
  </button>
}

function LanguageButton({ language, onToggle }: { language: Language; onToggle: () => void }) {
  const text = translations[language]
  const Flag = languageFlags[language]

  return <button className="icon-button language-button" type="button" data-language-control
    aria-label={text.languageAction} title={text.languageAction}
    onPointerDown={event => event.preventDefault()}
    onClick={onToggle}>
    <Flag />
  </button>
}

function NorwegianFlag() {
  return <svg viewBox="0 0 22 16" aria-hidden="true">
    <path fill="#ba0c2f" d="M0 0h22v16H0z" />
    <path fill="#fff" d="M6 0h4v16H6zM0 6h22v4H0z" />
    <path fill="#00205b" d="M7 0h2v16H7zM0 7h22v2H0z" />
  </svg>
}

function BritishFlag() {
  return <svg viewBox="0 0 60 30" aria-hidden="true">
    <defs><clipPath id="flag-diagonals">
      <path d="M30 15h30v15z M30 15v15H0z M30 15H0V0z M30 15V0h30z" />
    </clipPath></defs>
    <path fill="#012169" d="M0 0h60v30H0z" />
    <path stroke="#fff" strokeWidth="6" d="m0 0 60 30m0-30L0 30" />
    <path stroke="#c8102e" strokeWidth="4" clipPath="url(#flag-diagonals)" d="m0 0 60 30m0-30L0 30" />
    <path stroke="#fff" strokeWidth="10" d="M30 0v30M0 15h60" />
    <path stroke="#c8102e" strokeWidth="6" d="M30 0v30M0 15h60" />
  </svg>
}

function DarkModeButton({ language, darkMode, onToggle }: {
  language: Language
  darkMode: boolean
  onToggle: () => void
}) {
  const text = translations[language]

  return <button className="icon-button" type="button" aria-label={text.darkMode}
    aria-pressed={darkMode} title={darkMode ? text.lightModeAction : text.darkModeAction}
    onClick={onToggle}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {darkMode ? <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
      </> : <path d="M20.8 13A9 9 0 0 1 11 3.2 9 9 0 1 0 20.8 13Z" />}
    </svg>
  </button>
}

export default App
