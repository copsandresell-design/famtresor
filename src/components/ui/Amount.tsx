import { cn } from '../../lib/cn'
import { formatEuro } from '../../lib/format'

export function Amount({ cents, className }: { cents: number; className?: string }) {
  return (
    <span
      className={cn(
        'font-bold tabular-nums',
        cents > 0 && 'text-emerald-600 dark:text-emerald-400',
        cents < 0 && 'text-rose-600 dark:text-rose-400',
        className,
      )}
    >
      {formatEuro(cents, { signed: true })}
    </span>
  )
}
