import { cn } from '../../lib/cn'
import { childGradient } from '../../lib/colors'
import type { User } from '../../types'

const sizes = {
  sm: { outer: 'h-9 w-9', text: 'text-base' },
  md: { outer: 'h-12 w-12', text: 'text-xl' },
  lg: { outer: 'h-[4.5rem] w-[4.5rem]', text: 'text-3xl' },
  xl: { outer: 'h-28 w-28', text: 'text-5xl' },
}

export function ChildAvatar({ user, size = 'md' }: { user: User; size?: keyof typeof sizes }) {
  return (
    <span
      aria-hidden
      className={cn('inline-flex shrink-0 rounded-full p-[3px]', sizes[size].outer)}
      style={{ background: childGradient(user.color) }}
    >
      <span
        className={cn(
          'flex h-full w-full items-center justify-center rounded-full bg-white dark:bg-slate-900',
          sizes[size].text,
        )}
      >
        {user.avatar}
      </span>
    </span>
  )
}
