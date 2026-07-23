import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, XCircle } from 'lucide-react'
import { useStore } from '../store/useStore'
import { cn } from '../lib/cn'

export function Toaster() {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.button
            key={toast.id}
            initial={{ y: 16, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={() => dismiss(toast.id)}
            className={cn(
              'pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg cursor-pointer',
              toast.kind === 'success' ? 'bg-emerald-600' : 'bg-rose-600',
            )}
          >
            {toast.kind === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            {toast.message}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  )
}
