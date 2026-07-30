import { motion } from 'framer-motion'

/** Fond décoratif discret (deux halos dégradés qui dérivent lentement) derrière tout le contenu. */
export function AmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      <motion.div
        className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-gradient-to-br from-brand-from to-fuchsia-600 opacity-10 blur-3xl dark:opacity-20"
        animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-40 -right-28 h-[28rem] w-[28rem] rounded-full bg-gradient-to-br from-brand-to to-amber-300 opacity-10 blur-3xl dark:opacity-15"
        animate={{ x: [0, -25, 0], y: [0, -15, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute left-1/3 top-1/2 h-72 w-72 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 opacity-0 blur-3xl dark:opacity-10"
        animate={{ x: [0, 20, 0], y: [0, -30, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}
