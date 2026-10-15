import { useCallback, useEffect, useState } from 'react'
import { usePreference } from './preferences'
import type { QuizMode } from './quizModel'

export const tutorialActions = ['hour', 'minute', 'hour-plus', 'hour-minus', 'minute-plus', 'minute-minus', 'navigate', 'modes', 'start'] as const
export type TutorialAction = typeof tutorialActions[number] | 'digital' | 'analog' | 'both'

export function useTutorial() {
  const [done, setDone] = usePreference('tutorialDone')
  const [step, setStep] = useState<number | null>(null)
  const [welcoming, setWelcoming] = useState(() => !done)
  const [success, setSuccess] = useState(false)
  const [modes, setModes] = useState<QuizMode[]>([])
  const [notice, setNotice] = useState(false)

  const dismiss = useCallback(() => {
    setStep(null)
    setWelcoming(false)
    setSuccess(false)
  }, [])

  const finish = useCallback(() => {
    setDone(true)
    setNotice(true)
    dismiss()
  }, [setDone, dismiss])

  const next = useCallback(() => {
    if (step === tutorialActions.length - 1) finish()
    else {
      setStep(current => current === null ? null : current + 1)
      setSuccess(false)
    }
  }, [step, finish])

  useEffect(() => {
    if (!success) return
    const timer = window.setTimeout(next, 650)
    return () => window.clearTimeout(timer)
  }, [success, next])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(false), 5000)
    return () => window.clearTimeout(timer)
  }, [notice])

  function complete(action: TutorialAction) {
    if (step === null || success) return
    if (step === 7 && (action === 'digital' || action === 'analog' || action === 'both')) {
      const visited = [...new Set([...modes, action])]
      setModes(visited)
      if (visited.length === 3) setSuccess(true)
    } else if (tutorialActions[step] === action) {
      if (action === 'start') finish()
      else setSuccess(true)
    }
  }

  function begin() {
    setWelcoming(false)
    setModes([])
    setSuccess(false)
    setNotice(false)
    setStep(0)
  }

  function optOut() {
    setDone(true)
    dismiss()
  }

  function showWelcome() {
    dismiss()
    setNotice(false)
    setWelcoming(true)
  }

  return { step, welcoming, success, modes, notice, complete, next, begin, showWelcome, dismiss, optOut }
}
