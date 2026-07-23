import { AnimatePresence, motion } from 'framer-motion'
import { Delete } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../lib/cn'
import { useStore } from '../store/useStore'
import { ChildAvatar } from '../components/ui/ChildAvatar'
import { Button } from '../components/ui/Button'
import type { User } from '../types'

function PinPad({ user, onBack }: { user: User; onBack: () => void }) {
  const login = useStore((s) => s.login)
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  async function press(digit: string) {
    if (pin.length >= 4) return
    const next = pin + digit
    setPin(next)
    if (next.length === 4) {
      const ok = await login(user.id, next)
      if (!ok) {
        setError(true)
        setPin('')
        setTimeout(() => setError(false), 600)
      }
    }
  }

  return (
    <motion.div
      key="pin"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-5"
    >
      <ChildAvatar user={user} size="lg" />
      <p className="text-lg font-bold">Salut {user.name} ! Ton code secret ?</p>
      <motion.div
        animate={error ? { x: [0, -10, 10, -8, 8, 0] } : {}}
        transition={{ duration: 0.45 }}
        className="flex gap-3"
        aria-label="Code PIN"
      >
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              'h-4 w-4 rounded-full border-2 transition-colors',
              i < pin.length ? 'border-transparent' : 'border-slate-300 dark:border-slate-600',
              error && 'border-rose-500',
            )}
            style={i < pin.length ? { backgroundColor: user.color } : undefined}
          />
        ))}
      </motion.div>
      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <motion.button
            key={d}
            whileTap={{ scale: 0.9 }}
            onClick={() => press(d)}
            className="h-16 w-16 rounded-2xl bg-white text-2xl font-bold shadow-sm hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 cursor-pointer"
          >
            {d}
          </motion.button>
        ))}
        <span />
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => press('0')}
          className="h-16 w-16 rounded-2xl bg-white text-2xl font-bold shadow-sm hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 cursor-pointer"
        >
          0
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setPin(pin.slice(0, -1))}
          aria-label="Effacer"
          className="flex h-16 w-16 items-center justify-center rounded-2xl text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer"
        >
          <Delete size={26} />
        </motion.button>
      </div>
      {user.usesDefaultSecret && (
        <p className="text-xs text-slate-400">Code par défaut : voir le README ou demander à un parent</p>
      )}
      <Button variant="ghost" onClick={onBack}>
        ← Changer de profil
      </Button>
    </motion.div>
  )
}

function PasswordForm({ user, onBack }: { user: User; onBack: () => void }) {
  const login = useStore((s) => s.login)
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

  async function submit() {
    const ok = await login(user.id, password)
    if (!ok) {
      setError(true)
      setPassword('')
      setTimeout(() => setError(false), 600)
    }
  }

  return (
    <motion.form
      key="password"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex w-full max-w-xs flex-col items-center gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <ChildAvatar user={user} size="lg" />
      <p className="text-lg font-bold">Bonjour {user.name}</p>
      <motion.input
        animate={error ? { x: [0, -10, 10, -8, 8, 0] } : {}}
        transition={{ duration: 0.45 }}
        type="password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Mot de passe"
        aria-label="Mot de passe"
        className={cn(
          'w-full rounded-xl border bg-white px-4 py-3 text-center text-lg dark:bg-slate-800',
          error ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700',
        )}
      />
      {user.usesDefaultSecret && (
        <p className="text-xs text-slate-400">Mot de passe par défaut : « parent » — à changer dans Réglages</p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={!password}>
        Se connecter
      </Button>
      <Button variant="ghost" onClick={onBack}>
        ← Changer de profil
      </Button>
    </motion.form>
  )
}

export function LoginPage() {
  const users = useStore((s) => s.users).filter((u) => u.isActive)
  const [selected, setSelected] = useState<User | null>(null)

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-10">
      <AnimatePresence mode="wait">
        {!selected ? (
          <motion.div
            key="picker"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-8"
          >
            <div className="text-center">
              <p className="text-5xl" aria-hidden>
                💰
              </p>
              <h1 className="mt-2 text-3xl font-black">FamTrésor</h1>
              <p className="mt-1 text-slate-500 dark:text-slate-400">Vous êtes qui ?</p>
            </div>
            <div className="grid w-full max-w-md grid-cols-2 gap-4">
              {users.map((user) => (
                <motion.button
                  key={user.id}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setSelected(user)}
                  className="flex flex-col items-center gap-3 rounded-2xl bg-white p-6 shadow-sm hover:shadow-md dark:bg-slate-900 cursor-pointer"
                >
                  <ChildAvatar user={user} size="lg" />
                  <span className="font-bold">{user.name}</span>
                  <span className="text-xs text-slate-400">
                    {user.role === 'parent' ? 'Parent' : 'Enfant'}
                  </span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        ) : selected.role === 'child' ? (
          <PinPad user={selected} onBack={() => setSelected(null)} />
        ) : (
          <PasswordForm user={selected} onBack={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}
