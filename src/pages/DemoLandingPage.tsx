import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useDemoMode } from '../store/demoStore'

export function DemoLandingPage() {
  const navigate = useNavigate()
  const enter = useDemoMode((s) => s.enter)

  function pick(role: 'parent' | 'child') {
    enter(role)
    navigate(role === 'parent' ? '/parent' : '/enfant')
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-8"
      >
        <div className="text-center">
          <img
            src="/images/kidsup-logo.png"
            alt="KidsUp"
            className="mx-auto w-64 max-w-[70vw] drop-shadow-[0_8px_24px_rgba(124,31,224,0.35)]"
          />
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            Démo avec une famille fictive — rien n'est enregistré.
          </p>
        </div>

        <div className="grid w-full max-w-md grid-cols-1 gap-4 sm:grid-cols-2">
          <motion.button
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => pick('parent')}
            className="flex flex-col items-center gap-3 rounded-2xl border border-transparent bg-white p-6 text-center shadow-[0_1px_2px_rgb(15_23_42/0.04),0_8px_24px_-12px_rgb(15_23_42/0.08)] transition-all hover:shadow-md dark:bg-slate-900 cursor-pointer"
          >
            <span className="text-4xl" aria-hidden>
              🧑‍🚀
            </span>
            <span className="font-bold">Vue parent</span>
            <span className="text-xs text-slate-400">Tâches, validations, réglages…</span>
          </motion.button>
          <motion.button
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => pick('child')}
            className="flex flex-col items-center gap-3 rounded-2xl border border-transparent bg-white p-6 text-center shadow-[0_1px_2px_rgb(15_23_42/0.04),0_8px_24px_-12px_rgb(15_23_42/0.08)] transition-all hover:shadow-md dark:bg-slate-900 cursor-pointer"
          >
            <span className="text-4xl" aria-hidden>
              🦄
            </span>
            <span className="font-bold">Vue enfant</span>
            <span className="text-xs text-slate-400">Points, badges, boutique…</span>
          </motion.button>
        </div>

        <a href="/" className="text-sm font-semibold text-slate-500 hover:underline dark:text-slate-400">
          ← Retour à la connexion
        </a>
      </motion.div>
    </div>
  )
}
