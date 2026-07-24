import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04),0_8px_24px_-12px_rgb(15_23_42/0.08)]',
        'border border-slate-200/70 transition-shadow duration-200',
        'dark:bg-slate-900 dark:border-slate-800/80 dark:shadow-[0_1px_2px_rgb(0_0_0/0.2),0_8px_24px_-12px_rgb(0_0_0/0.4)]',
        className,
      )}
      {...props}
    />
  )
}
