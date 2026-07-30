import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { Button } from '../components/ui/Button'
import { hashSecret, makeSalt } from '../lib/crypto'
import { claimFounderFamily, createNewFamily, signInFamily, signUpFamily } from '../lib/familyAuth'
import { cn } from '../lib/cn'
import { uid } from '../lib/id'
import { supabase } from '../lib/supabase'
import { refreshFamilyMembership, useFamilyAuthStore } from '../store/familyAuthStore'
import type { User } from '../types'

const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-center dark:border-slate-700 dark:bg-slate-800'

/** Écran affiché tant qu'aucune session Supabase Auth n'existe : connexion ou création de
 *  compte parent. Vient AVANT le picker PIN existant (LoginPage), qui ne change pas — voir
 *  App.tsx. Une fois signup ou signin réussi, le statut passe à 'needs-family' ou 'ready'
 *  (voir store/familyAuthStore.ts) et ce composant est automatiquement remplacé. */
function SignInOrUp() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [confirmEmailSent, setConfirmEmailSent] = useState(false)

  async function submit() {
    setPending(true)
    setError(null)
    if (mode === 'signin') {
      const { error } = await signInFamily(email, password)
      if (error) setError(error)
    } else {
      const { error, needsEmailConfirmation } = await signUpFamily(email, password)
      if (error) setError(error)
      else if (needsEmailConfirmation) setConfirmEmailSent(true)
    }
    setPending(false)
  }

  if (confirmEmailSent) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex max-w-sm flex-col items-center gap-4 text-center"
      >
        <span className="text-4xl">📧</span>
        <p className="font-bold">Vérifiez vos emails</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Un email de confirmation a été envoyé à {email}. Cliquez sur le lien qu'il contient, puis revenez ici pour
          vous connecter.
        </p>
        <Button
          variant="ghost"
          onClick={() => {
            setConfirmEmailSent(false)
            setMode('signin')
          }}
        >
          ← Retour à la connexion
        </Button>
      </motion.div>
    )
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex w-full max-w-xs flex-col items-center gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <p className="text-lg font-bold">{mode === 'signin' ? 'Connexion parent' : 'Créer un compte parent'}</p>
      <input
        type="email"
        autoFocus
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        aria-label="Email"
        className={inputClass}
      />
      <input
        type="password"
        required
        minLength={6}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Mot de passe"
        aria-label="Mot de passe"
        className={inputClass}
      />
      {error && <p className="text-sm text-rose-500">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={pending || !email || password.length < 6}>
        {mode === 'signin' ? 'Se connecter' : 'Créer mon compte'}
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          setMode(mode === 'signin' ? 'signup' : 'signin')
          setError(null)
        }}
      >
        {mode === 'signin' ? "Pas encore de compte ? Créer une famille" : 'Déjà un compte ? Se connecter'}
      </Button>
      <a href="/demo" className="text-sm font-semibold text-slate-400 hover:text-slate-600 hover:underline dark:text-slate-500 dark:hover:text-slate-300">
        Voir une démo →
      </a>
    </motion.form>
  )
}

/** Écrit directement (avec attente du résultat) plutôt que via lib/sync.ts `pushRecord`
 *  (fire-and-forget) : la suite du flow (refreshFamilyMembership → bascule vers l'app
 *  normale → init() qui relit sync_users) doit être certaine que ce profil est bien
 *  persisté côté Supabase avant de continuer, sous peine de retomber sur une famille vue
 *  comme "encore vide" à ce moment précis. */
async function createInitialParentUser(name: string, secret: string): Promise<{ error: string | null }> {
  const secretSalt = makeSalt()
  const user: User = {
    id: uid(),
    role: 'parent',
    name,
    secretHash: await hashSecret(secret, secretSalt),
    secretSalt,
    usesDefaultSecret: false,
    avatar: '👤',
    color: '#911DE6',
    createdAt: Date.now(),
    isActive: true,
  }
  const { error } = await supabase
    .from('sync_users')
    .upsert({ id: user.id, data: user, updated_at: new Date().toISOString() })
  return { error: error?.message ?? null }
}

/** Une fois authentifié mais sans famille encore (juste après un signup) : choisir entre
 *  créer une toute nouvelle famille, ou rejoindre une famille existante via un code. */
function ChooseFamily() {
  const [choice, setChoice] = useState<'new' | 'join' | null>(null)
  const [familyName, setFamilyName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submitNewFamily() {
    setPending(true)
    setError(null)
    const { error } = await createNewFamily(familyName.trim())
    if (error) {
      setError(error)
      setPending(false)
      return
    }
    const { error: userError } = await createInitialParentUser(displayName.trim(), secret)
    if (userError) {
      setError(userError)
      setPending(false)
      return
    }
    await refreshFamilyMembership()
    setPending(false)
  }

  async function submitJoin() {
    setPending(true)
    setError(null)
    const { error } = await claimFounderFamily(code.trim())
    if (error) {
      setError(error)
      setPending(false)
      return
    }
    await refreshFamilyMembership()
    setPending(false)
  }

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-6">
      <p className="text-center text-lg font-bold">Bienvenue ! Une dernière étape</p>
      <AnimatePresence mode="wait">
        {!choice && (
          <motion.div
            key="pick"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <button
              onClick={() => setChoice('new')}
              className="flex flex-col items-center gap-2 rounded-2xl border border-transparent bg-white p-6 text-center shadow-sm hover:shadow-md dark:bg-slate-900 cursor-pointer"
            >
              <span className="text-3xl">🆕</span>
              <span className="font-bold">Nouvelle famille</span>
              <span className="text-xs text-slate-400">Je démarre de zéro</span>
            </button>
            <button
              onClick={() => setChoice('join')}
              className="flex flex-col items-center gap-2 rounded-2xl border border-transparent bg-white p-6 text-center shadow-sm hover:shadow-md dark:bg-slate-900 cursor-pointer"
            >
              <span className="text-3xl">🔑</span>
              <span className="font-bold">J'ai un code</span>
              <span className="text-xs text-slate-400">Rejoindre une famille existante</span>
            </button>
          </motion.div>
        )}

        {choice === 'new' && (
          <motion.form
            key="new"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex w-full flex-col items-center gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              void submitNewFamily()
            }}
          >
            <input
              autoFocus
              required
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              placeholder="Nom de la famille"
              className={cn(inputClass)}
            />
            <input
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Votre prénom"
              className={cn(inputClass)}
            />
            <input
              type="password"
              required
              minLength={4}
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Code secret / mot de passe (dans l'app)"
              className={cn(inputClass)}
            />
            {error && <p className="text-sm text-rose-500">{error}</p>}
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={pending || !familyName || !displayName || secret.length < 4}
            >
              Créer ma famille
            </Button>
            <Button type="button" variant="ghost" onClick={() => setChoice(null)}>
              ← Retour
            </Button>
          </motion.form>
        )}

        {choice === 'join' && (
          <motion.form
            key="join"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex w-full flex-col items-center gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              void submitJoin()
            }}
          >
            <input
              autoFocus
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Code de rattachement"
              className={cn(inputClass)}
            />
            {error && <p className="text-sm text-rose-500">{error}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={pending || !code}>
              Rejoindre
            </Button>
            <Button type="button" variant="ghost" onClick={() => setChoice(null)}>
              ← Retour
            </Button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  )
}

export function FamilyAuthScreen() {
  const status = useFamilyAuthStore((s) => s.status)

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-10">
      <img
        src="/images/kidsup-logo.png"
        alt="KidsUp"
        className="mx-auto w-56 max-w-[60vw] drop-shadow-[0_8px_24px_rgba(124,31,224,0.35)]"
      />
      {status === 'needs-family' ? <ChooseFamily /> : <SignInOrUp />}
    </div>
  )
}
