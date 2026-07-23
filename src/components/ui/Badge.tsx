import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

const tones = {
  neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  red: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
} as const

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: keyof typeof tones
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
