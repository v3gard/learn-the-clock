import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { Language } from './i18n'
import { quizText } from './quizText'

type QuizRestartDialogProps = {
  open: boolean
  visible: boolean
  language: Language
  triggerRef: RefObject<HTMLButtonElement | null>
  onCancel: () => void
  onConfirm: () => void
}

export function QuizRestartDialog({ open, visible, language, triggerRef, onCancel, onConfirm }: QuizRestartDialogProps) {
  const dialog = useRef<HTMLDivElement>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)
  const restoreFocus = useRef(false)
  const text = quizText[language]

  useEffect(() => {
    if (!open || !visible) {
      if (visible && restoreFocus.current) triggerRef.current?.focus()
      restoreFocus.current = false
      return
    }
    cancelButton.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (document.querySelector('.toolbar-panel:popover-open')) return
      if (event.key === 'Escape') {
        event.preventDefault()
        restoreFocus.current = true
        onCancel()
      }
      if (event.key !== 'Tab') return

      // Global controls remain available while the quiz content is inert.
      const controls = [
        ...document.querySelectorAll<HTMLButtonElement>('.page-actions button'),
        ...dialog.current!.querySelectorAll<HTMLButtonElement>('button'),
      ]
      const index = controls.findIndex(control => control === document.activeElement)
      const direction = event.shiftKey ? -1 : 1
      event.preventDefault()
      controls[(index + direction + controls.length) % controls.length].focus()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, visible, triggerRef, onCancel])

  function cancel() {
    restoreFocus.current = true
    onCancel()
  }

  if (!open || !visible) return null

  return <div className="dialog-shade">
    <div className="quiz-dialog" ref={dialog} role="dialog" aria-labelledby="confirm-title" aria-describedby="confirm-description">
      <h2 id="confirm-title">{text.confirmTitle}</h2>
      <p id="confirm-description">{text.confirmText}</p>
      <div className="quiz-buttons">
        <button type="button" onClick={onConfirm}>{text.confirm}</button>
        <button type="button" ref={cancelButton} onClick={cancel}>{text.cancel}</button>
      </div>
    </div>
  </div>
}
