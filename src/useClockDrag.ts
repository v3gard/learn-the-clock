import { useEffect, useRef, useState } from 'react'
import type { Dispatch, PointerEvent } from 'react'
import { createDrag, hitHand, moveDrag, pointerAngle, svgPoint } from './clock'
import type { ClockAction, Drag, Hand } from './clock'

export function useClockDrag(time: number, dispatch: Dispatch<ClockAction>, onDragged?: (hand: Hand) => void, preferredHand?: Hand) {
  const [selectedHand, setSelectedHand] = useState<Hand | null>(null)
  const [activeHand, setActiveHand] = useState<Hand | null>(null)
  const drag = useRef<(Drag & { pointerId: number; initialTime: number; latestTime: number }) | null>(null)
  const face = useRef<SVGSVGElement>(null)

  function endDrag() {
    const current = drag.current
    drag.current = null
    setActiveHand(null)
    if (current && face.current?.hasPointerCapture(current.pointerId)) {
      face.current.releasePointerCapture(current.pointerId)
    }
  }

  useEffect(() => {
    window.addEventListener('hashchange', endDrag)
    return () => window.removeEventListener('hashchange', endDrag)
  }, [])

  useEffect(() => () => {
    const current = drag.current
    if (current && face.current?.hasPointerCapture(current.pointerId)) {
      face.current.releasePointerCapture(current.pointerId)
    }
    drag.current = null
  }, [])

  function eventPosition(event: PointerEvent<SVGSVGElement>) {
    return svgPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect())
  }

  function startDrag(event: PointerEvent<SVGSVGElement>) {
    if (drag.current || event.button !== 0) return
    const position = eventPosition(event)
    const bounds = event.currentTarget.getBoundingClientRect()
    const tolerance = Math.max(18, 22 * 400 / Math.min(bounds.width, bounds.height))
    const hand = hitHand(position, time, preferredHand ?? selectedHand, tolerance)
    const angle = pointerAngle(position)
    if (!hand || angle === null) return

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { ...createDrag(time, hand, angle), pointerId: event.pointerId, initialTime: time, latestTime: time }
    dispatch({ type: 'discard' })
    setActiveHand(hand)
  }

  function updateDrag(event: PointerEvent<SVGSVGElement>) {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return
    const result = moveDrag(drag.current, pointerAngle(eventPosition(event)))
    drag.current = { ...drag.current, ...result.drag, latestTime: result.time }
    dispatch({ type: 'set', time: result.time })
  }

  function finishPointerDrag(event: PointerEvent<SVGSVGElement>) {
    const current = drag.current
    if (current?.pointerId !== event.pointerId) return
    endDrag()
    if (event.type === 'pointerup' && current.latestTime !== current.initialTime) onDragged?.(current.hand)
  }

  function changeTime(action: ClockAction) {
    endDrag()
    dispatch(action)
  }

  return {
    face,
    activeHand,
    highlightedHand: activeHand ?? selectedHand,
    selectHand: setSelectedHand,
    changeTime,
    endDrag,
    pointerHandlers: {
      onPointerDown: startDrag,
      onPointerMove: updateDrag,
      onPointerUp: finishPointerDrag,
      onPointerCancel: finishPointerDrag,
      onLostPointerCapture: finishPointerDrag,
    },
  }
}
