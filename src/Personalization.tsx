import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { translations } from './i18n'
import type { Language } from './i18n'
import { ToolbarPanelHeading } from './ToolbarPanelHeading'
import { usePreference } from './preferences'
import type { Background } from './preferences'

const backgrounds = ['current', 'unicorn', 'space'] as const
const decorations = {
  current: [],
  unicorn: ['🦄', '🌈', '✨'],
  space: ['🪐', '🚀', '🌙'],
} satisfies Record<Background, string[]>

export function Personalization({ language }: { language: Language }) {
  const [background, setBackground] = usePreference('background')
  const [open, setOpen] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const text = translations[language].personalization

  useEffect(() => {
    document.documentElement.dataset.background = background
    return () => { delete document.documentElement.dataset.background }
  }, [background])

  return <>
    <PersonalizationButton title={text.title} open={open} />
    {createPortal(<>
      <div ref={panel} id="personalization-panel" className="toolbar-panel personalization-panel"
        data-personalization-control
        popover="auto" role="dialog" aria-labelledby="personalization-title"
        onToggle={event => {
          const expanded = event.newState === 'open'
          setOpen(expanded)
          if (expanded) panel.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus()
        }}>
        <ToolbarPanelHeading titleId="personalization-title" title={text.title} closeLabel={text.close}
          onClose={() => panel.current?.hidePopover()} />
        <p>{text.description}</p>
        <div className="background-options" role="group" aria-label={text.title}>
          {backgrounds.map(option => <button type="button" key={option}
            aria-pressed={background === option} onClick={() => setBackground(option)}>
            <span className="background-swatch" data-background={option} aria-hidden="true">
              {decorations[option].slice(0, 2).join('')}
            </span>
            <span>{text[option]}</span>
            <span className="background-selected" aria-hidden="true">{background === option ? '✓' : ''}</span>
          </button>)}
        </div>
      </div>
      <BackgroundDecoration background={background} />
    </>, document.body)}
  </>
}

function PersonalizationButton({ title, open }: { title: string; open: boolean }) {
  return <button className="icon-button personalization-button" type="button"
    data-personalization-control popoverTarget="personalization-panel"
    aria-label={title} title={title} aria-expanded={open}
    aria-controls="personalization-panel" aria-haspopup="dialog"
    onPointerDown={event => event.preventDefault()}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.5-3.3 1.5 1.5 0 0 1 1.1-2.5H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3Z" />
      <circle cx="7.5" cy="10" r=".8" /><circle cx="10" cy="6.8" r=".8" />
      <circle cx="14" cy="6.8" r=".8" /><circle cx="17" cy="10" r=".8" />
    </svg>
  </button>
}

function BackgroundDecoration({ background }: { background: Background }) {
  return <div className="background-decoration" data-background={background} aria-hidden="true">
    {decorations[background].map((decoration, index) =>
      <span className={`decoration-${index}`} key={decoration}>{decoration}</span>)}
  </div>
}
