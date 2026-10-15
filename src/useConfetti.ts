import { useCallback, useEffect, useRef } from 'react'

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  rotation: number
  spin: number
  age: number
  lifetime: number
  color: string
  round: boolean
}

const colors = ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d']

export function useConfetti() {
  const cleanup = useRef<(() => void) | null>(null)

  const stopParticles = useCallback(() => {
    cleanup.current?.()
    cleanup.current = null
  }, [])

  useEffect(() => stopParticles, [stopParticles])

  const burst = useCallback((finale = false) => {
    stopParticles()
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    if (motion.matches) return

    const element = document.createElement('canvas')
    const drawingContext = element.getContext('2d')
    if (!drawingContext) throw new Error('Confetti requires a 2D canvas context.')
    const context = drawingContext
    element.className = 'confetti-canvas'
    element.setAttribute('aria-hidden', 'true')
    document.body.append(element)

    let width = 0
    let height = 0
    let frame = 0
    let particles: Particle[] = []
    const start = performance.now()
    let previous = start
    let nextLaunch = start + 80

    function resize() {
      width = window.innerWidth
      height = window.innerHeight
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      element.width = Math.round(width * ratio)
      element.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }

    function launch(x: number, y: number, count: number, spread: number,
      speed: number, lifetime: number, angle = 90) {
      for (let index = 0; index < count; index++) {
        const direction = (angle + (Math.random() - .5) * spread) * Math.PI / 180
        const velocity = speed * (.5 + Math.random() * .5)
        particles.push({
          x: x * width, y: y * height,
          vx: Math.cos(direction) * velocity,
          vy: -Math.sin(direction) * velocity,
          rotation: Math.random() * Math.PI * 2,
          spin: (Math.random() - .5) * 12,
          age: 0, lifetime,
          color: colors[Math.floor(Math.random() * colors.length)],
          round: Math.random() < .5,
        })
      }
    }

    function onMotionChange() {
      if (motion.matches) stopParticles()
    }

    cleanup.current = () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      motion.removeEventListener('change', onMotionChange)
      element.remove()
      particles = []
    }
    window.addEventListener('resize', resize)
    motion.addEventListener('change', onMotionChange)
    resize()
    launch(.5, .35, finale ? 360 : 120, finale ? 160 : 120, 1350, finale ? 3 : 2)

    if (finale) {
      for (const side of [0, 1]) {
        launch(side, .65, 100, 80, 1500, 3, side === 0 ? 60 : 120)
      }
      for (let column = 0; column < 3; column++) {
        launch((column + .5) / 3, 1, 60, 100, 900, 3)
      }
    }

    function animate(now: number) {
      if (motion.matches) {
        stopParticles()
        return
      }
      if (now - start < 4000 && now >= nextLaunch) {
        if (finale) {
          for (let column = 0; column < 3; column++) {
            launch((column + Math.random()) / 3, -.04, 10, 70, 120, 4, 270)
          }
        } else {
          launch(Math.random(), 0, 7, 120, 360, 100 / 60)
        }
        nextLaunch = now + 80
      }

      const elapsed = (now - previous) / 1000
      const delta = Math.min(elapsed, .05)
      previous = now
      context.clearRect(0, 0, width, height)
      particles = particles.filter(particle => {
        particle.age += elapsed
        if (particle.age >= particle.lifetime) return false
        const drag = Math.exp(-2.2 * delta)
        particle.vx *= drag
        particle.vy = particle.vy * drag + (finale ? 800 : 1000) * delta
        particle.x += particle.vx * delta
        particle.y += particle.vy * delta
        particle.rotation += particle.spin * delta

        context.save()
        context.translate(particle.x, particle.y)
        context.rotate(particle.rotation)
        context.scale(1, Math.cos(particle.age * 12 + particle.spin))
        context.globalAlpha = Math.min(1, (particle.lifetime - particle.age) * 2)
        context.fillStyle = particle.color
        if (particle.round) {
          context.beginPath()
          context.ellipse(0, 0, 4, 3, 0, 0, Math.PI * 2)
          context.fill()
        } else {
          context.fillRect(-4, -3, 8, 6)
        }
        context.restore()
        return true
      })

      if (now - start >= 4000 && particles.length === 0) stopParticles()
      else frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
  }, [stopParticles])

  return { burst, stopParticles }
}
