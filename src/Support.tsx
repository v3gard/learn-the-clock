import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { translations } from './i18n'
import type { Language } from './i18n'
import { ToolbarPanelHeading } from './ToolbarPanelHeading'

export function Support({ language }: { language: Language }) {
  const [open, setOpen] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const text = translations[language].support

  return <>
    <SupportButton title={text.title} open={open} />
    {createPortal(<div ref={panel} id="support-panel" className="toolbar-panel support-panel"
      data-support-control popover="auto" role="dialog"
      aria-labelledby="support-title" aria-describedby="support-description"
      onToggle={event => {
        const expanded = event.newState === 'open'
        setOpen(expanded)
        if (expanded) panel.current?.querySelector<HTMLButtonElement>('button')?.focus()
      }}>
      <ToolbarPanelHeading titleId="support-title" title={text.title} closeLabel={text.close}
        onClose={() => panel.current?.hidePopover()} />
      <p id="support-description">{text.description}</p>
      <DonationLink label={text.link} newTabLabel={text.newTab} />
      <p className="support-new-tab">{text.newTab}</p>
    </div>, document.body)}
  </>
}

function SupportButton({ title, open }: { title: string; open: boolean }) {
  return <button className="icon-button support-button" type="button" data-support-control
    popoverTarget="support-panel" aria-label={title} title={title}
    aria-expanded={open} aria-controls="support-panel" aria-haspopup="dialog"
    onPointerDown={event => event.preventDefault()}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 8h12v7a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5ZM17 9h1a3 3 0 0 1 0 6h-1M3 21h17M8 3v2M12 2v3M16 3v2" />
    </svg>
  </button>
}

function DonationLink({ label, newTabLabel }: { label: string; newTabLabel: string }) {
  return <a className="support-link" href="https://www.buymeacoffee.com/v3gard"
    target="_blank" rel="noopener noreferrer" aria-label={`${label}. ${newTabLabel}`}>
    {label}
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3h7v7M21 3l-9 9M10 5H5v14h14v-5" />
    </svg>
  </a>
}
