import { useRef, type PointerEvent } from 'react'

/** Minimum horizontal travel, in px, for a swipe. */
const DISTANCE = 56

/**
 * Horizontal touch swipes. Spread the returned handlers on an element that
 * also has `touch-action: pan-y pinch-zoom`, so vertical scrolling stays with
 * the browser and horizontal gestures reach these handlers. A swipe must be
 * mostly horizontal; mouse and pen input is ignored.
 */
export function useSwipe(onSwipe: (direction: 'left' | 'right') => void) {
  const start = useRef<{ id: number; x: number; y: number } | null>(null)

  return {
    onPointerDown(event: PointerEvent) {
      if (event.pointerType !== 'touch' || !event.isPrimary) return
      start.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
    },
    onPointerUp(event: PointerEvent) {
      const from = start.current
      start.current = null
      if (!from || from.id !== event.pointerId) return
      const dx = event.clientX - from.x
      const dy = event.clientY - from.y
      if (Math.abs(dx) >= DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.5) onSwipe(dx < 0 ? 'left' : 'right')
    },
    onPointerCancel() {
      start.current = null
    },
  }
}
