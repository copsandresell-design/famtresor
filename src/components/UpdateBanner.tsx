import { AnimatePresence, motion } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { applyPwaUpdate, isUpdateAvailable, subscribePwaUpdate } from '../lib/pwaUpdate'

/** Bandeau persistant (pas un toast) : la mise à jour reste proposée tant qu'on ne l'applique pas. */
export function UpdateBanner() {
  const [available, setAvailable] = useState(isUpdateAvailable)

  useEffect(() => subscribePwaUpdate(() => setAvailable(true)), [])

  return (
    <AnimatePresence>
      {available && (
        <motion.div
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: 'spring', damping: 24, stiffness: 300 }}
          className="fixed inset-x-0 top-0 z-[70] flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg"
        >
          <RefreshCw size={16} aria-hidden />
          Nouvelle version disponible
          <button
            onClick={applyPwaUpdate}
            className="rounded-full bg-white/20 px-3 py-1 font-bold hover:bg-white/30 cursor-pointer"
          >
            Mettre à jour
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
