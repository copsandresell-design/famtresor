import { useState } from 'react'
import { cn } from '../lib/cn'
import { Button } from './ui/Button'
import { Modal } from './ui/Modal'

interface Step {
  emoji: string
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    emoji: '👋',
    title: 'Bienvenue sur KidsUp',
    body: "Un rapide tour pour comprendre comment ça marche — moins d'une minute !",
  },
  {
    emoji: '🎯',
    title: 'Les points',
    body: 'Chaque tâche accomplie rapporte des points. Ils servent de monnaie dans la Boutique.',
  },
  {
    emoji: '✅',
    title: 'Valider une tâche',
    body: "L'enfant signale une tâche terminée, un parent la valide (ou la refuse) — les points sont crédités à la validation.",
  },
  {
    emoji: '🏅',
    title: 'Badges & séries',
    body: 'La régularité est récompensée : des badges à débloquer, et des séries de jours consécutifs qui rapportent des bonus.',
  },
  {
    emoji: '🎁',
    title: 'La boutique',
    body: 'Les points s’échangent contre des récompenses (sorties, écran, cadeaux…) définies par les parents.',
  },
  {
    emoji: '🚀',
    title: "C'est parti !",
    body: "Explore l'app à ton rythme — tout reste modifiable depuis les Réglages, et tu peux revoir ce tour quand tu veux.",
  },
]

interface Props {
  /** Clé localStorage propre à cet utilisateur (réel ou démo) — n'affiche le tour qu'une fois. */
  storageKey: string
  /** Ouvre automatiquement au montage si pas encore vu (pages d'accueil). Mettre à false pour un simple bouton "Revoir". */
  autoShow?: boolean
  /** Forcer l'affichage (ex: "Revoir le tutoriel" depuis Réglages), même si déjà vu. */
  forceOpen?: boolean
  onDismiss?: () => void
}

export function OnboardingTour({ storageKey, autoShow = true, forceOpen, onDismiss }: Props) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === '1'
    } catch {
      return false
    }
  })
  const [step, setStep] = useState(0)

  const open = forceOpen || (autoShow && !dismissed)

  function finish() {
    try {
      localStorage.setItem(storageKey, '1')
    } catch {
      // Stockage indisponible (navigation privée…) : tant pis, le tour réapparaîtra la prochaine fois.
    }
    setDismissed(true)
    setStep(0)
    onDismiss?.()
  }

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <Modal open={open} onClose={finish} title={current.title}>
      <div className="space-y-5 text-center">
        <span className="block text-5xl" aria-hidden>
          {current.emoji}
        </span>
        <p className="text-sm text-slate-600 dark:text-slate-300">{current.body}</p>
        <div className="flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 w-1.5 rounded-full transition-colors',
                i === step ? 'bg-brand-from' : 'bg-slate-300 dark:bg-slate-700',
              )}
            />
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 pt-2">
          <Button variant="ghost" size="sm" onClick={finish}>
            Passer
          </Button>
          <Button size="sm" onClick={() => (isLast ? finish() : setStep((s) => s + 1))}>
            {isLast ? "C'est compris !" : 'Suivant'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
