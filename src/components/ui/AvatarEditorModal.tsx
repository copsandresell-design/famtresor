import { Camera, Image as ImageIcon, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { AVATAR_EMOJIS } from '../../lib/categories'
import { cn } from '../../lib/cn'
import { computeAccess } from '../../lib/access'
import { addPhoto, deletePhoto, removeRemoteProfilePhoto } from '../../lib/photos'
import { useDemoMode } from '../../store/demoStore'
import { useFamilyAuthStore } from '../../store/familyAuthStore'
import { usePremiumUpsellStore } from '../../store/premiumUpsellStore'
import { useActiveThemePack } from '../../store/themePacksStore'
import { useStore } from '../../store/useStore'
import type { User } from '../../types'
import { Button } from './Button'
import { ChildAvatar } from './ChildAvatar'
import { Modal } from './Modal'

interface Props {
  user: User
  actorId: string
  onClose: () => void
}

export function AvatarEditorModal({ user, actorId, onClose }: Props) {
  const demoActive = useDemoMode((s) => s.active)
  const updateAvatar = useStore((s) => s.updateAvatar)
  const toast = useStore((s) => s.toast)
  const isFounder = useFamilyAuthStore((s) => s.isFounder)
  const plan = useFamilyAuthStore((s) => s.plan)
  const showUpsell = usePremiumUpsellStore((s) => s.show)
  // GODCLAUDE phase 3 : avatars emoji par défaut toujours gratuits, photo perso premium.
  const canUsePhoto = demoActive || computeAccess(isFounder, plan, 'custom_avatar_photos')
  // GODCLAUDE phase 5 : emojis du pack cosmétique actif de la famille (repli sur la liste
  // historique en mode démo ou tant que le catalogue n'est pas encore chargé).
  const activePack = useActiveThemePack()
  const emojiChoices = demoActive || !activePack ? AVATAR_EMOJIS : activePack.emojis
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ file: File; url: string } | null>(null)
  const [busy, setBusy] = useState(false)

  function cancelPreview() {
    if (pending) URL.revokeObjectURL(pending.url)
    setPending(null)
  }

  async function confirmPhoto() {
    if (!pending) return
    // Mode démo : ni upload Supabase Storage ni écriture profile_photos — updateAvatar()
    // (voir store/demoStore.ts) affiche déjà le message de blocage, sans appel réseau.
    if (demoActive) {
      updateAvatar(user.id, {}, actorId)
      cancelPreview()
      return
    }
    setBusy(true)
    try {
      // Passe l'userId pour que la photo soit uploadée vers Supabase (sync cross-device)
      // Clé = nom (stable sur tous les appareils, contrairement à l'id local aléatoire)
      const id = await addPhoto(pending.file, user.name)
      if (user.photoId) void deletePhoto(user.photoId)
      updateAvatar(user.id, { photoId: id }, actorId)
      toast('Photo de profil mise à jour !')
      URL.revokeObjectURL(pending.url)
      onClose()
    } catch {
      toast("Impossible de lire cette photo.", 'error')
      setBusy(false)
    }
  }

  function removePhoto() {
    if (demoActive) {
      updateAvatar(user.id, {}, actorId)
      return
    }
    if (user.photoId) void deletePhoto(user.photoId)
    void removeRemoteProfilePhoto(user.name)
    updateAvatar(user.id, { photoId: null }, actorId)
    toast('Photo supprimée, retour à l’emoji.')
    onClose()
  }

  function pickEmoji(emoji: string) {
    if (demoActive) {
      updateAvatar(user.id, {}, actorId)
      return
    }
    void removeRemoteProfilePhoto(user.name)
    updateAvatar(user.id, { avatar: emoji, photoId: null }, actorId)
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={`Avatar de ${user.name}`}>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) setPending({ file, url: URL.createObjectURL(file) })
          e.target.value = ''
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) setPending({ file, url: URL.createObjectURL(file) })
          e.target.value = ''
        }}
      />

      <div className="flex flex-col items-center gap-4">
        {pending ? (
          <>
            <img
              src={pending.url}
              alt="Aperçu de la nouvelle photo"
              className="h-28 w-28 rounded-full object-cover"
            />
            <div className="flex gap-2">
              <Button variant="soft" onClick={cancelPreview} disabled={busy}>
                Annuler
              </Button>
              <Button onClick={() => void confirmPhoto()} disabled={busy}>
                {busy ? 'Compression…' : 'Utiliser cette photo'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <ChildAvatar user={user} size="xl" />
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant="soft"
                size="sm"
                onClick={() =>
                  canUsePhoto
                    ? cameraRef.current?.click()
                    : showUpsell()
                }
              >
                <Camera size={16} />
                Prendre une photo
              </Button>
              <Button
                variant="soft"
                size="sm"
                onClick={() =>
                  canUsePhoto
                    ? galleryRef.current?.click()
                    : showUpsell()
                }
              >
                <ImageIcon size={16} />
                Choisir dans la galerie
              </Button>
              {user.photoId && (
                <Button variant="ghost" size="sm" onClick={removePhoto}>
                  <Trash2 size={16} />
                  Supprimer la photo
                </Button>
              )}
            </div>

            <div className="w-full border-t border-slate-200 pt-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-800">
              ou choisis un emoji
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {emojiChoices.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => pickEmoji(emoji)}
                  aria-pressed={!user.photoId && user.avatar === emoji}
                  className={cn(
                    'rounded-lg p-1.5 text-2xl cursor-pointer',
                    !user.photoId && user.avatar === emoji
                      ? 'bg-amber-200 dark:bg-amber-400/30'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800',
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
