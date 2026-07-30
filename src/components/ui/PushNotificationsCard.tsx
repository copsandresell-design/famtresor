import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { getPushPermission, isPushSupported, isSubscribedToPush, subscribeToPush, unsubscribeFromPush } from '../../lib/push'
import { useDemoMode } from '../../store/demoStore'
import { useStore } from '../../store/useStore'
import { Button } from './Button'
import { Card } from './Card'

/** Carte "Activer les notifications" — à placer dans Réglages (parent) et Profil (enfant). */
export function PushNotificationsCard({ userId }: { userId: string }) {
  const demoActive = useDemoMode((s) => s.active)
  const toast = useStore((s) => s.toast)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const supported = isPushSupported()
  const denied = getPushPermission() === 'denied'

  useEffect(() => {
    if (!supported) return
    void isSubscribedToPush().then(setSubscribed)
  }, [supported])

  if (!supported) return null

  async function toggle() {
    // Mode démo : ni permission navigateur ni écriture Supabase (push_subscriptions) — voir
    // store/demoStore.ts pour le même principe appliqué aux actions du store.
    if (demoActive) {
      toast('Mode démo — cette action est désactivée. Crée ton propre compte pour tout personnaliser !', 'error')
      return
    }
    setLoading(true)
    try {
      if (subscribed) {
        await unsubscribeFromPush()
        setSubscribed(false)
        toast('Notifications désactivées sur cet appareil.')
      } else {
        const ok = await subscribeToPush(userId)
        setSubscribed(ok)
        toast(
          ok
            ? 'Notifications activées : tu recevras les alertes même app fermée.'
            : "Impossible d'activer les notifications (permission refusée ?).",
          ok ? 'success' : 'error',
        )
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="space-y-3 p-5">
      <h2 className="font-bold">Notifications</h2>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Reçois une alerte sur ce téléphone même quand l'app est fermée.
      </p>
      {denied && !subscribed && (
        <p className="text-xs text-rose-500">
          Notifications bloquées dans les réglages du navigateur/téléphone pour ce site : autorise-les puis
          réessaie.
        </p>
      )}
      <div className="flex justify-end">
        <Button variant={subscribed ? 'soft' : 'primary'} onClick={() => void toggle()} disabled={loading}>
          {subscribed ? <BellOff size={18} /> : <Bell size={18} />}
          {subscribed ? 'Désactiver sur cet appareil' : 'Activer les notifications'}
        </Button>
      </div>
    </Card>
  )
}
