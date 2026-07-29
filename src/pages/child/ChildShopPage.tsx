import { ArrowRightLeft, Plus, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Field, inputCls } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { celebrate } from '../../lib/confetti'
import { cn } from '../../lib/cn'
import { formatEuro, formatRelative } from '../../lib/format'
import { computePoints } from '../../lib/points'
import { SHOP_CATEGORIES, SHOP_CATEGORY_KEYS, SHOP_ICON_LIBRARY } from '../../lib/shopCatalog'
import { useCurrentUser, useStore } from '../../store/useStore'
import type { ShopCategory } from '../../types'

function ProposeWishModal({ childId, onClose }: { childId: string; onClose: () => void }) {
  const proposeWish = useStore((s) => s.proposeWish)
  const toast = useStore((s) => s.toast)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<ShopCategory>('cadeau')
  const [icon, setIcon] = useState(SHOP_ICON_LIBRARY.cadeau[0])

  function submit() {
    if (!title.trim()) {
      toast('Donne un nom à ton vœu.', 'error')
      return
    }
    proposeWish(childId, title, icon, category)
    toast('Vœu envoyé à tes parents ! 🎁')
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="Proposer un vœu">
      <div className="space-y-4">
        <Field label="Ce que tu aimerais">
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ex : Aller à la patinoire"
            maxLength={40}
            autoFocus
          />
        </Field>
        <Field label="Catégorie">
          <select
            className={inputCls}
            value={category}
            onChange={(e) => {
              const cat = e.target.value as ShopCategory
              setCategory(cat)
              setIcon(SHOP_ICON_LIBRARY[cat][0])
            }}
          >
            {SHOP_CATEGORY_KEYS.map((key) => (
              <option key={key} value={key}>
                {SHOP_CATEGORIES[key].emoji} {SHOP_CATEGORIES[key].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Icône">
          <div className="flex flex-wrap gap-1.5">
            {SHOP_ICON_LIBRARY[category].map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setIcon(emoji)}
                aria-pressed={icon === emoji}
                className={cn(
                  'rounded-lg p-1.5 text-xl cursor-pointer',
                  icon === emoji ? 'bg-amber-200 dark:bg-amber-400/30' : 'hover:bg-slate-100 dark:hover:bg-slate-800',
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </Field>
        <Button className="w-full" onClick={submit}>
          Envoyer à mes parents
        </Button>
      </div>
    </Modal>
  )
}

function ConvertPointsModal({
  childId,
  points,
  pointsPerEuro,
  onClose,
}: {
  childId: string
  points: number
  pointsPerEuro: number
  onClose: () => void
}) {
  const convertPointsToMoney = useStore((s) => s.convertPointsToMoney)
  const [amount, setAmount] = useState(String(points))

  const requested = parseInt(amount, 10) || 0
  const euros = Math.round((requested / pointsPerEuro) * 100)

  return (
    <Modal open onClose={onClose} title="Convertir des points en argent">
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Taux actuel : {pointsPerEuro} points = 1 €. Tu as {points} points.
        </p>
        <Field label="Points à convertir">
          <input
            className={inputCls}
            type="number"
            min="1"
            max={points}
            step="1"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <p className="text-sm font-bold">Tu recevras {formatEuro(euros)}</p>
        <Button
          className="w-full"
          disabled={requested <= 0 || requested > points}
          onClick={() => {
            const ok = convertPointsToMoney(childId, requested, childId)
            if (ok) onClose()
          }}
        >
          Convertir
        </Button>
      </div>
    </Modal>
  )
}

export function ChildShopPage() {
  const user = useCurrentUser()
  const shopItems = useStore((s) => s.shopItems)
  const redemptions = useStore((s) => s.redemptions)
  const pointsTransactions = useStore((s) => s.pointsTransactions)
  const settings = useStore((s) => s.settings)
  const redeemShopItem = useStore((s) => s.redeemShopItem)
  const toast = useStore((s) => s.toast)

  const [proposing, setProposing] = useState(false)
  const [converting, setConverting] = useState(false)

  if (!user) return null

  const points = computePoints(pointsTransactions, user.id)
  const catalogue = shopItems.filter((i) => i.status === 'active')
  const myWishes = shopItems.filter((i) => i.status === 'proposed' && i.proposedBy === user.id)
  const myRedemptions = redemptions.filter((r) => r.childId === user.id).slice(0, 10)

  return (
    <div className="space-y-6">
      <Card className="flex flex-col items-center gap-2 bg-gradient-to-br from-violet-500 to-fuchsia-500 p-6 text-center text-white shadow-lg">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-white/85">
          <Sparkles size={16} aria-hidden />
          Mes points
        </p>
        <p className="font-display text-5xl font-bold">{points}</p>
        <Button variant="soft" size="sm" className="mt-1 bg-white/20 text-white hover:bg-white/30" onClick={() => setConverting(true)}>
          <ArrowRightLeft size={16} />
          Convertir en argent
        </Button>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Catalogue</h2>
        <Button variant="soft" size="sm" onClick={() => setProposing(true)}>
          <Plus size={16} />
          Proposer un vœu
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {catalogue.map((item) => {
          const canAfford = item.cost !== undefined && points >= item.cost
          return (
            <Card key={item.id} className="flex items-center gap-3 p-4">
              <span className="text-3xl" aria-hidden>
                {item.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{item.title}</p>
                <p className="text-xs font-semibold text-violet-600 dark:text-violet-400">{item.cost} pts</p>
              </div>
              <Button
                size="sm"
                variant={canAfford ? 'success' : 'soft'}
                disabled={!canAfford}
                onClick={() => {
                  const ok = redeemShopItem(user.id, item.id, user.id)
                  if (ok) {
                    celebrate(['#8B5CF6', '#EC4899'])
                    toast('Demandé ! Un parent va te le remettre. 🎁')
                  }
                }}
              >
                Échanger
              </Button>
            </Card>
          )
        })}
        {catalogue.length === 0 && <EmptyState emoji="🎁" text="La boutique est vide pour l'instant." />}
      </div>

      {myWishes.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Mes vœux en attente</h2>
          <Card className="divide-y divide-slate-100 dark:divide-slate-800">
            {myWishes.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-xl" aria-hidden>
                  {item.icon}
                </span>
                <p className="min-w-0 flex-1 truncate text-sm font-semibold">{item.title}</p>
                <Badge tone="amber">En attente</Badge>
              </div>
            ))}
          </Card>
        </section>
      )}

      {myRedemptions.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Mes échanges</h2>
          <Card className="divide-y divide-slate-100 dark:divide-slate-800">
            {myRedemptions.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-xl" aria-hidden>
                  {r.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.title}</p>
                  <p className="text-xs text-slate-400">{formatRelative(r.requestedAt)}</p>
                </div>
                <Badge tone={r.status === 'fulfilled' ? 'green' : r.status === 'cancelled' ? 'neutral' : 'amber'}>
                  {r.status === 'fulfilled' ? 'Remis ✅' : r.status === 'cancelled' ? 'Annulé' : 'En attente'}
                </Badge>
              </div>
            ))}
          </Card>
        </section>
      )}

      {proposing && <ProposeWishModal childId={user.id} onClose={() => setProposing(false)} />}
      {converting && (
        <ConvertPointsModal
          childId={user.id}
          points={points}
          pointsPerEuro={settings.pointsPerEuro}
          onClose={() => setConverting(false)}
        />
      )}
    </div>
  )
}
