import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Language } from './i18n'
import type { QuizMode } from './quizModel'
import { quizText } from './quizText'
import { tutorialText } from './tutorialText'
import { tutorialActions } from './useTutorial'

type Props = {
  language: Language
  step: number | null
  success: boolean
  modes: QuizMode[]
  confirming: boolean
  welcoming: boolean
  onStart: () => void
  onDismiss: () => void
  onSkip: () => void
  onOptOut: () => void
  onConfirm: () => void
  onCancel: () => void
}

type Layout = { left: number; top: number; width: number; height: number; cardTop: number; cardLeft: number; cardHeight: number }

export function Tutorial({ language, step, success, modes, confirming, welcoming, onStart, onDismiss, onSkip, onOptOut, onConfirm, onCancel }: Props) {
  const card = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const wasOpen = useRef(false)
  const returnFocus = useRef<HTMLElement | null>(null)
  const [layout, setLayout] = useState<Layout | null>(null)
  const text = tutorialText[language]
  const action = step === null ? null : tutorialActions[step]
  const targetName = action === 'hour' || action === 'minute' ? 'hands' : action
  const open = step !== null || confirming || welcoming
  const centered = confirming || welcoming

  useEffect(() => {
    if (!open) return
    if (!wasOpen.current) {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    }
    const target = centered ? null : document.querySelector<HTMLElement | SVGSVGElement>(`[data-tutorial-target="${targetName}"]`)
    const panel = card.current!
    const inertNodes: HTMLElement[] = []
    const previousDescription = target?.getAttribute('aria-describedby')

    function isolate(parent: Element) {
      for (const child of parent.children) {
        if (child === panel || child === target || child.classList.contains('tutorial-spotlight')) continue
        if (child.contains(panel) || (target && child.contains(target))) isolate(child)
        else if (child instanceof HTMLElement && !child.inert) {
          child.inert = true
          inertNodes.push(child)
        }
      }
    }
    isolate(document.body)
    target?.setAttribute('aria-describedby', 'tutorial-instruction')
    if (target) document.body.classList.add('tutorial-open')

    function position(fitInViewport = false) {
      if (!target) {
        setLayout(null)
        return
      }
      let rect = target.getBoundingClientRect()
      const width = Math.min(360, window.innerWidth - 24)
      const gap = 16
      const above = rect.top - gap
      const below = window.innerHeight - rect.bottom - gap
      let cardLeft = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))
      let cardTop: number
      let cardHeight: number
      const belowDigital = targetName === 'hands' && window.matchMedia('(min-width: 900px) and (min-height: 600px)').matches
      if (belowDigital) {
        const digital = document.querySelector('.freestyle .digital-frame')!
        const fullHeight = Math.min(panel.scrollHeight + panel.offsetHeight - panel.clientHeight, window.innerHeight - 24)
        if (fitInViewport) {
          const overflow = digital.getBoundingClientRect().bottom + gap + fullHeight - (window.innerHeight - 12)
          if (overflow > 0) window.scrollBy({ top: overflow, behavior: 'instant' })
          rect = target.getBoundingClientRect()
        }
        const digitalRect = digital.getBoundingClientRect()
        cardLeft = Math.max(12, Math.min(digitalRect.left + (digitalRect.width - width) / 2, window.innerWidth - width - 12))
        cardTop = digitalRect.bottom + gap
        cardHeight = window.innerHeight - 24
      } else if (rect.right + gap + width <= window.innerWidth - 12 || rect.left - gap - width >= 12) {
        cardLeft = rect.right + gap + width <= window.innerWidth - 12 ? rect.right + gap : rect.left - gap - width
        cardTop = Math.max(12, Math.min(rect.top, window.innerHeight - panel.scrollHeight - 12))
        cardHeight = window.innerHeight - cardTop - 12
      } else if (below >= above) {
        cardTop = Math.max(12, rect.bottom + gap)
        cardHeight = Math.max(100, window.innerHeight - cardTop - 12)
      } else {
        cardHeight = Math.max(100, above - 12)
        cardTop = Math.max(12, rect.top - gap - Math.min(panel.scrollHeight, cardHeight))
      }
      cardHeight = Math.min(cardHeight, window.innerHeight - 24)
      if (!belowDigital) cardTop = Math.max(12, Math.min(cardTop, window.innerHeight - Math.min(panel.scrollHeight, cardHeight) - 12))
      const next = { left: rect.left, top: rect.top, width: rect.width, height: rect.height, cardTop, cardLeft, cardHeight }
      setLayout(current => current && Object.keys(next).every(key => current[key as keyof Layout] === next[key as keyof Layout]) ? current : next)
    }

    const frame = requestAnimationFrame(() => {
      target?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })
      heading.current?.focus({ preventScroll: true })
      position(true)
    })
    const fit = () => position(true)
    const trackScroll = () => position()
    const observer = new ResizeObserver(fit)
    if (target) observer.observe(target)
    observer.observe(panel)
    window.addEventListener('resize', fit)
    window.addEventListener('scroll', trackScroll, true)

    function guard(event: Event) {
      if (event.target instanceof Node && (panel.contains(event.target) || target?.contains(event.target))) return
      event.preventDefault()
      event.stopPropagation()
    }

    function keyboard(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        if (confirming) onCancel()
        else onDismiss()
      }
      if (event.key !== 'Tab') return
      const controls = [
        ...(target?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)') ?? []),
        ...panel.querySelectorAll<HTMLElement>('button:not(:disabled)'),
      ]
      if (target instanceof HTMLButtonElement) controls.unshift(target)
      const index = controls.findIndex(control => control === document.activeElement)
      event.preventDefault()
      const nextIndex = index < 0 ? (event.shiftKey ? controls.length - 1 : 0)
        : (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length
      controls[nextIndex]?.focus()
    }

    document.addEventListener('pointerdown', guard, true)
    document.addEventListener('click', guard, true)
    document.addEventListener('keydown', keyboard, true)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', fit)
      window.removeEventListener('scroll', trackScroll, true)
      document.removeEventListener('pointerdown', guard, true)
      document.removeEventListener('click', guard, true)
      document.removeEventListener('keydown', keyboard, true)
      inertNodes.forEach(node => { node.inert = false })
      if (previousDescription) target?.setAttribute('aria-describedby', previousDescription)
      else target?.removeAttribute('aria-describedby')
      document.body.classList.remove('tutorial-open')
    }
  }, [open, step, targetName, confirming, centered, onDismiss, onCancel])

  useEffect(() => {
    if (open) {
      wasOpen.current = true
      return
    }
    if (!wasOpen.current) return
    wasOpen.current = false
    const focused = document.activeElement
    if (focused === document.body) {
      const previous = returnFocus.current
      const target = previous?.isConnected && previous !== document.body && previous.getClientRects().length
        ? previous : document.querySelector<HTMLElement>('[data-tutorial-control]')
      target?.focus({ preventScroll: true })
    }
  }, [open])

  if (!open) return null

  return createPortal(<>
    {layout && !centered && <div className="tutorial-spotlight" aria-hidden="true"
      style={{ left: layout.left - 5, top: layout.top - 5, width: layout.width + 10, height: layout.height + 10 }} />}
    {centered && <div className="tutorial-backdrop" />}
    <div ref={card} data-tutorial-dialog className={`tutorial-card${centered ? ' tutorial-confirm' : ''}`} role="dialog"
      aria-labelledby="tutorial-title" aria-describedby="tutorial-instruction"
      style={!centered && layout ? { left: layout.cardLeft, top: layout.cardTop, maxHeight: layout.cardHeight } : undefined}>
      <div className="tutorial-heading">
        <h2 id="tutorial-title" ref={heading} tabIndex={-1}>{confirming ? text.confirmTitle : welcoming ? text.welcome : text.title}</h2>
        {!confirming && <button type="button" aria-label={text.close} onClick={onDismiss}>×</button>}
      </div>
      {!centered && <p className="tutorial-progress">{text.step} {step! + 1} {text.of} {tutorialActions.length}</p>}
      <p id="tutorial-instruction">{confirming ? text.confirmText : welcoming ? text.welcomeText : text.instructions[step!]}</p>
      {!centered && step === 7 && <ul className="tutorial-modes">
        {(['digital', 'analog', 'both'] as const).map(mode => <li key={mode}>
          <span aria-hidden="true">{modes.includes(mode) ? '✓ ' : '○ '}</span>
          {text.modeDescriptions[mode]} {modes.includes(mode) && <strong>({quizText[language][mode]}) ✓</strong>}
        </li>)}
      </ul>}
      {!centered && <p className="tutorial-success" role="status">{success ? text.success : ''}</p>}
      <div className="tutorial-buttons">
        {confirming ? <>
          <button type="button" onClick={onCancel}>{text.cancel}</button>
          <button type="button" className="primary" onClick={onConfirm}>{text.confirm}</button>
        </> : welcoming ? <>
          <button type="button" className="primary" onClick={onStart}>{text.yes}</button>
          <button type="button" onClick={onOptOut}>{text.no}</button>
        </> : <>
          <button type="button" onClick={onSkip}>{text.skip}</button>
          <button type="button" onClick={onOptOut}>{text.optOut}</button>
        </>}
      </div>
    </div>
  </>, document.body)
}
