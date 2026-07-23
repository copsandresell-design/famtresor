import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'success' | 'danger' | 'soft' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-blue-500 via-violet-500 to-pink-500 text-white shadow-md shadow-violet-500/25 hover:brightness-110 hover:-translate-y-px',
  success:
    'bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-md shadow-emerald-500/25 hover:brightness-110 hover:-translate-y-px',
  danger:
    'bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-md shadow-rose-500/25 hover:brightness-110 hover:-translate-y-px',
  soft: 'bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600',
  ghost: 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700',
}

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-lg gap-1.5',
  md: 'px-4 py-2 text-sm rounded-xl gap-2',
  lg: 'px-6 py-3 text-base rounded-xl gap-2',
}

interface Props extends HTMLMotionProps<'button'> {
  variant?: Variant
  size?: Size
}

export function Button({ variant = 'primary', size = 'md', className, type = 'button', ...props }: Props) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      type={type}
      className={cn(
        'inline-flex items-center justify-center font-semibold transition-all',
        'disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
}
