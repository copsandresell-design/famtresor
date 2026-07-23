import { Camera, Image as ImageIcon, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { AVATAR_EMOJIS } from '../../lib/categories'
import { cn } from '../../lib/cn'
import { addPhoto, deletePhoto } from '../../lib/photos'
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
  const updateAvatar = useStore((s) => s.updateAvatar)
  const toast = useStore((s) => s.toast)
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
    setBusy(true)
    try {
      const id = await addPhoto(pending.file)
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
    if (user.photoId) void deletePhoto(user.photoId)
    updateAvatar(user.id, { photoId: null }, actorId)
    toast('Photo supprimée, retour à l’emoji.')
    onClose()
  }

  function pickEmoji(emoji: string) {
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
              <Button variant="soft" size="sm" onClick={() => cameraRef.current?.click()}>
                <Camera size={16} />
                Prendre une photo
              </Button>
              <Button variant="soft" size="sm" onClick={() => galleryRef.current?.click()}>
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
              {AVATAR_EMOJIS.map((emoji) => (
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
