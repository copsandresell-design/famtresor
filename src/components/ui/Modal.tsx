import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  wide?: boolean
}

export function Modal({ open, onClose, title, children, wide }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-slate-950/50" onClick={onClose} aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: 32, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 32, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className={cn(
              'relative w-full max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900',
              wide ? 'sm:max-w-2xl' : 'sm:max-w-md',
            )}
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold">{title}</h2>
              <button
                onClick={onClose}
                aria-label="Fermer"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
