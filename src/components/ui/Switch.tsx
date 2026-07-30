import { motion } from 'framer-motion'
import { cn } from '../../lib/cn'

interface Props {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
}

/** Interrupteur animé — utilisé pour les fonctionnalités activables/désactivables. */
export function Switch({ checked, onChange, label, disabled }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors cursor-pointer',
        'disabled:opacity-50 disabled:pointer-events-none',
        checked ? 'bg-gradient-to-r from-brand-from to-brand-to' : 'bg-slate-300 dark:bg-slate-700',
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className="h-5 w-5 rounded-full bg-white shadow-md"
        style={{ marginLeft: checked ? 'calc(100% - 22px)' : '2px' }}
      />
    </button>
  )
}
