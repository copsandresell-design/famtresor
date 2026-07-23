import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl bg-white shadow-sm border border-slate-200/70 dark:bg-slate-900 dark:border-slate-800',
        className,
      )}
      {...props}
    />
  )
}
