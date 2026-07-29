import { cn } from '../../lib/cn'

export function PointsAmount({ points, className }: { points: number; className?: string }) {
  return (
    <span
      className={cn(
        'font-bold tabular-nums',
        points > 0 && 'text-violet-600 dark:text-violet-400',
        points < 0 && 'text-rose-600 dark:text-rose-400',
        className,
      )}
    >
      {points > 0 ? '+' : ''}
      {points} pts
    </span>
  )
}
