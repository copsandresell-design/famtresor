import { animate } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { prefersReducedMotion } from '../../lib/confetti'
import { formatEuro } from '../../lib/format'

export function AnimatedBalance({ cents, className }: { cents: number; className?: string }) {
  const [display, setDisplay] = useState(cents)
  const previous = useRef(cents)

  useEffect(() => {
    if (previous.current === cents) return
    if (prefersReducedMotion()) {
      setDisplay(cents)
      previous.current = cents
      return
    }
    const controls = animate(previous.current, cents, {
      duration: 0.8,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(Math.round(v)),
    })
    previous.current = cents
    return () => controls.stop()
  }, [cents])

  return <span className={cn('tabular-nums', className)}>{formatEuro(display)}</span>
}
