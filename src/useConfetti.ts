import { useCallback, useRef } from 'react'
import confetti from 'canvas-confetti'

export function useConfetti() {
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const fire = useRef<ReturnType<typeof confetti.create> | null>(null)
  const timers = useRef<ReturnType<typeof setInterval>[]>([])

  const stopParticles = useCallback(() => {
    timers.current.forEach(clearInterval)
    timers.current = []
    fire.current?.reset()
    canvas.current?.remove()
    canvas.current = null
    fire.current = null
  }, [])

  const burst = useCallback((finale = false) => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    stopParticles()
    const element = document.createElement('canvas')
    element.className = 'confetti-canvas'
    element.setAttribute('aria-hidden', 'true')
    document.body.append(element)
    canvas.current = element
    fire.current = confetti.create(element, { resize: true, disableForReducedMotion: true })
    const launch = fire.current
    const end = performance.now() + 4000
    const animation = launch({
      origin: { x: .5, y: .35 },
      particleCount: finale ? 360 : 120,
      spread: finale ? 160 : 120,
      ticks: finale ? 180 : 120,
    })

    if (finale) {
      for (const side of [0, 1]) {
        void launch({
          origin: { x: side, y: .65 }, angle: side === 0 ? 60 : 120,
          particleCount: 100, spread: 80, startVelocity: 50, ticks: 180,
        })
      }
      for (let column = 0; column < 3; column++) {
        void launch({
          origin: { x: (column + .5) / 3, y: 1 }, particleCount: 60,
          spread: 100, startVelocity: 30, ticks: 180,
        })
      }
    }

    const timer = setInterval(() => {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        stopParticles()
        return
      }
      if (performance.now() >= end) {
        clearInterval(timer)
        timers.current = timers.current.filter(current => current !== timer)
        return
      }
      if (finale) {
        for (let column = 0; column < 3; column++) {
          void launch({
            origin: { x: (column + Math.random()) / 3, y: -.04 }, angle: 270,
            particleCount: 10, spread: 70, startVelocity: 4, gravity: .8, ticks: 240,
          })
        }
      } else {
        void launch({
          origin: { x: Math.random(), y: 0 }, particleCount: 7,
          spread: 120, startVelocity: 12, gravity: 1, ticks: 100,
        })
      }
    }, 80)
    timers.current.push(timer)
    void animation?.then(() => {
      if (canvas.current === element) stopParticles()
    })
  }, [stopParticles])

  return { burst, stopParticles }
}
