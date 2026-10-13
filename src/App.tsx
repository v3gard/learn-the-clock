import { useEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { translations } from './i18n'
import type { Language } from './i18n'
import { FreestyleClock } from './FreestyleClock'
import type { FreestyleClockHandle } from './FreestyleClock'
import { Quiz } from './Quiz'
import { quizText } from './quizText'
import { Personalization } from './Personalization'
import { Support } from './Support'
import { usePreference } from './preferences'
import './App.css'

const languageFlags = {
  nb: NorwegianFlag,
  en: BritishFlag,
} satisfies Record<keyof typeof quizText, ComponentType>

function App() {
  const [darkMode, setDarkMode] = usePreference('darkMode')
  const [language, setLanguage] = usePreference('language')
  const [quizVisible, setQuizVisible] = useState(() => location.hash === '#/quiz')
  const freestyleClock = useRef<FreestyleClockHandle>(null)
  const text = translations[language]
  const quizLabels = quizText[language]

  useEffect(() => {
    function navigate() {
      setQuizVisible(location.hash === '#/quiz')
    }
    window.addEventListener('hashchange', navigate)
    return () => window.removeEventListener('hashchange', navigate)
  }, [])

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
  }

  return <main>
    <div className="page-actions" role="group" aria-label={text.tools}>
      <NavigationButton language={language} quizVisible={quizVisible} onNavigate={navigate} />
      <LanguageButton language={language} onToggle={() => setLanguage(current => current === 'nb' ? 'en' : 'nb')} />
      <DarkModeButton language={language} darkMode={darkMode} onToggle={() => setDarkMode(current => !current)} />
      <Personalization language={language} />
      <Support language={language} />
    </div>
    <Quiz visible={quizVisible} language={language} />
    <FreestyleClock ref={freestyleClock} visible={!quizVisible} language={language} />
  </main>
}

function NavigationButton({ language, quizVisible, onNavigate }: {
  language: Language
  quizVisible: boolean
  onNavigate: () => void
}) {
  const text = quizText[language]
  const label = quizVisible ? text.back : text.enter

  return <button className="icon-button" type="button" data-navigation-control
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
