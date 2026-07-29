import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ChildAvatar } from '../../components/ui/ChildAvatar'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { EmptyState } from '../../components/ui/EmptyState'
import { Field, inputCls } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Tabs } from '../../components/ui/Tabs'
import { cn } from '../../lib/cn'
import { formatRelative } from '../../lib/format'
import { SHOP_CATEGORIES, SHOP_CATEGORY_KEYS, SHOP_EXAMPLES, SHOP_ICON_LIBRARY } from '../../lib/shopCatalog'
import { useCurrentUser, useStore } from '../../store/useStore'
import type { ShopCategory, ShopItem } from '../../types'

/** true = illimité (case cochée), false = quantité précise saisie à côté. */
function StockField({
  stock,
  onChange,
}: {
  stock: string
  onChange: (value: string) => void
}) {
  const unlimited = stock === ''
  return (
    <Field label="Stock disponible">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={unlimited}
            onChange={(e) => onChange(e.target.checked ? '' : '5')}
            className="h-4 w-4 accent-amber-500"
          />
          Illimité
        </label>
        {!unlimited && (
          <input
            className={inputCls}
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={stock}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </div>
    </Field>
  )
}

function CreateItemModal({ onClose }: { onClose: () => void }) {
  const user = useCurrentUser()
  const createShopItem = useStore((s) => s.createShopItem)
  const toast = useStore((s) => s.toast)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<ShopCategory>('cinema')
  const [icon, setIcon] = useState(SHOP_ICON_LIBRARY.cinema[0])
  const [cost, setCost] = useState('50')
  const [stock, setStock] = useState('')

  if (!user) return null

  function pickExample(ex: (typeof SHOP_EXAMPLES)[number]) {
    setTitle(ex.title)
    setCategory(ex.category)
    setIcon(ex.icon)
  }

  function submit() {
    const points = parseInt(cost, 10)
    if (!title.trim() || !Number.isFinite(points) || points <= 0) {
      toast('Titre et coût en points valides requis.', 'error')
      return
    }
    const stockValue = stock === '' ? undefined : Math.max(0, parseInt(stock, 10) || 0)
    createShopItem({ title: title.trim(), icon, category, cost: points, stock: stockValue }, user!.id)
    toast('Lot ajouté à la boutique !')
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="Nouveau lot" wide>
      <div className="space-y-4">
        <Field label="Exemples rapides">
          <div className="flex flex-wrap gap-2">
            {SHOP_EXAMPLES.map((ex) => (
              <button
                key={ex.title}
                type="button"
                onClick={() => pickExample(ex)}
                className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 cursor-pointer"
              >
                {ex.icon} {ex.title}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Titre *">
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ex : Soirée ciné"
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
        <Field label="Coût en points *">
          <input
            className={inputCls}
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
        </Field>
        <StockField stock={stock} onChange={setStock} />
        <Button className="w-full" onClick={submit}>
          Ajouter à la boutique
        </Button>
      </div>
    </Modal>
  )
}

function EditItemModal({ item, onClose }: { item: ShopItem; onClose: () => void }) {
  const user = useCurrentUser()
  const updateShopItem = useStore((s) => s.updateShopItem)
  const toast = useStore((s) => s.toast)
  const [cost, setCost] = useState(String(item.cost ?? 0))
  const [stock, setStock] = useState(item.stock === undefined ? '' : String(item.stock))

  if (!user) return null

  function submit() {
    const points = parseInt(cost, 10)
    if (!Number.isFinite(points) || points <= 0) {
      toast('Coût en points invalide.', 'error')
      return
    }
    const stockValue = stock === '' ? undefined : Math.max(0, parseInt(stock, 10) || 0)
    updateShopItem(item.id, { cost: points, stock: stockValue }, user!.id)
    toast('Lot mis à jour.')
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={`Modifier « ${item.title} »`}>
      <div className="space-y-4">
        <Field label="Coût en points *">
          <input
            className={inputCls}
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            autoFocus
          />
        </Field>
        <StockField stock={stock} onChange={setStock} />
        {item.stock === 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Ce lot est actuellement épuisé — augmente le stock pour le remettre en vente.
          </p>
        )}
        <Button className="w-full" onClick={submit}>
          Enregistrer
        </Button>
      </div>
    </Modal>
  )
}

function ApproveWishModal({ item, onClose }: { item: ShopItem; onClose: () => void }) {
  const user = useCurrentUser()
  const approveWish = useStore((s) => s.approveWish)
  const toast = useStore((s) => s.toast)
  const [cost, setCost] = useState('50')
  const [stock, setStock] = useState('')

  if (!user) return null

  function submit() {
    const points = parseInt(cost, 10)
    if (!Number.isFinite(points) || points <= 0) {
      toast('Coût en points invalide.', 'error')
      return
    }
    const stockValue = stock === '' ? undefined : Math.max(0, parseInt(stock, 10) || 0)
    approveWish(item.id, points, user!.id, stockValue)
    toast('Vœu accepté et ajouté à la boutique !')
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={`Accepter « ${item.title} »`}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">Fixe le coût en points pour ce lot.</p>
        <Field label="Coût en points *">
          <input
            className={inputCls}
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            autoFocus
          />
        </Field>
        <StockField stock={stock} onChange={setStock} />
        <Button className="w-full" onClick={submit}>
          Ajouter à la boutique
        </Button>
      </div>
    </Modal>
  )
}

export function ShopPage() {
  const user = useCurrentUser()
  const users = useStore((s) => s.users)
  const shopItems = useStore((s) => s.shopItems)
  const redemptions = useStore((s) => s.redemptions)
  const deleteShopItem = useStore((s) => s.deleteShopItem)
  const rejectWish = useStore((s) => s.rejectWish)
  const fulfillRedemption = useStore((s) => s.fulfillRedemption)
  const cancelRedemption = useStore((s) => s.cancelRedemption)
  const toast = useStore((s) => s.toast)

  const [tab, setTab] = useState<'catalogue' | 'voeux' | 'echanges'>('catalogue')
  const [creating, setCreating] = useState(false)
  const [editingItem, setEditingItem] = useState<ShopItem | null>(null)
  const [approvingWish, setApprovingWish] = useState<ShopItem | null>(null)
  const [deletingItem, setDeletingItem] = useState<ShopItem | null>(null)

  if (!user) return null

  const catalogue = shopItems.filter((i) => i.status === 'active')
  const wishes = shopItems.filter((i) => i.status === 'proposed')
  const pendingRedemptions = redemptions.filter((r) => r.status === 'pending')
  const historyRedemptions = redemptions.filter((r) => r.status !== 'pending').slice(0, 20)

  const nameOf = (id?: string) => users.find((u) => u.id === id)?.name ?? '?'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">Boutique</h1>
        <Button onClick={() => setCreating(true)}>
          <Plus size={18} />
          Nouveau lot
        </Button>
      </div>

      <Tabs
        tabs={[
          { id: 'catalogue', label: 'Catalogue' },
          { id: 'voeux', label: 'Vœux', count: wishes.length },
          { id: 'echanges', label: 'Échanges', count: pendingRedemptions.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'catalogue' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {catalogue.map((item) => {
            const outOfStock = item.stock === 0
            return (
              <Card key={item.id} className={cn('flex items-center gap-3 p-4', outOfStock && 'opacity-60')}>
                <span className="text-3xl" aria-hidden>
                  {item.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{item.title}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <Badge>{SHOP_CATEGORIES[item.category].label}</Badge>
                    {outOfStock ? (
                      <Badge tone="red">Épuisé</Badge>
                    ) : (
                      item.stock !== undefined && <Badge tone="amber">Stock : {item.stock}</Badge>
                    )}
                  </div>
                </div>
                <span className="font-bold text-violet-600 dark:text-violet-400">{item.cost} pts</span>
                <button
                  onClick={() => setEditingItem(item)}
                  aria-label="Modifier ce lot"
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => setDeletingItem(item)}
                  aria-label="Retirer ce lot"
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/40"
                >
                  <Trash2 size={16} />
                </button>
              </Card>
            )
          })}
          {catalogue.length === 0 && <EmptyState emoji="🎁" text="Aucun lot pour l'instant. Ajoutes-en un !" />}
        </div>
      )}

      {tab === 'voeux' && (
        <div className="space-y-3">
          {wishes.map((item) => (
            <Card key={item.id} className="flex items-center gap-3 p-4">
              <span className="text-3xl" aria-hidden>
                {item.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{item.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Proposé par {nameOf(item.proposedBy)} · {formatRelative(item.createdAt)}
                </p>
              </div>
              <Button
                size="sm"
                variant="soft"
                onClick={() => {
                  rejectWish(item.id, user.id)
                  toast('Vœu refusé.')
                }}
              >
                <X size={16} />
              </Button>
              <Button size="sm" variant="success" onClick={() => setApprovingWish(item)}>
                <Check size={16} />
                Accepter
              </Button>
            </Card>
          ))}
          {wishes.length === 0 && <EmptyState emoji="💭" text="Aucun vœu en attente." />}
        </div>
      )}

      {tab === 'echanges' && (
        <div className="space-y-5">
          <div>
            <h2 className="mb-3 text-lg font-bold">En attente de remise</h2>
            <div className="space-y-3">
              {pendingRedemptions.map((r) => {
                const child = users.find((u) => u.id === r.childId)
                return (
                  <Card key={r.id} className="flex items-center gap-3 p-4">
                    {child && <ChildAvatar user={child} size="sm" />}
                    <span className="text-2xl" aria-hidden>
                      {r.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{r.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {r.cost} pts · {formatRelative(r.requestedAt)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="soft"
                      onClick={() => {
                        cancelRedemption(r.id, user.id)
                        toast('Échange annulé, points remboursés.')
                      }}
                    >
                      Annuler
                    </Button>
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => {
                        fulfillRedemption(r.id, user.id)
                        toast('Lot marqué comme remis.')
                      }}
                    >
                      Remis !
                    </Button>
                  </Card>
                )
              })}
              {pendingRedemptions.length === 0 && <EmptyState emoji="✅" text="Rien à remettre pour l'instant." />}
            </div>
          </div>

          {historyRedemptions.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-bold">Historique</h2>
              <Card className="divide-y divide-slate-100 dark:divide-slate-800">
                {historyRedemptions.map((r) => {
                  const child = users.find((u) => u.id === r.childId)
                  return (
                    <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                      {child && <ChildAvatar user={child} size="sm" />}
                      <p className="min-w-0 flex-1 truncate text-sm">
                        {r.icon} {r.title}
                      </p>
                      <Badge tone={r.status === 'fulfilled' ? 'green' : 'neutral'}>
                        {r.status === 'fulfilled' ? 'Remis' : 'Annulé'}
                      </Badge>
                    </div>
                  )
                })}
              </Card>
            </div>
          )}
        </div>
      )}

      {creating && <CreateItemModal onClose={() => setCreating(false)} />}
      {editingItem && <EditItemModal item={editingItem} onClose={() => setEditingItem(null)} />}
      {approvingWish && <ApproveWishModal item={approvingWish} onClose={() => setApprovingWish(null)} />}

      <ConfirmModal
        open={deletingItem !== null}
        onClose={() => setDeletingItem(null)}
        title="Retirer ce lot"
        message={`« ${deletingItem?.title} » sera retiré de la boutique.`}
        confirmLabel="Retirer"
        danger
        onConfirm={() => {
          if (deletingItem) deleteShopItem(deletingItem.id, user.id)
        }}
      />
    </div>
  )
}
