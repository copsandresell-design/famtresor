import { Camera, Image as ImageIcon, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { addPhoto, deletePhoto } from '../../lib/photos'
import { Button } from '../ui/Button'

export interface PickedPhoto {
  id: string
  url: string
}

interface Props {
  photos: PickedPhoto[]
  onChange: (photos: PickedPhoto[]) => void
  max?: number
}

export function PhotoPicker({ photos, onChange, max = 5 }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function handleFiles(list: FileList | null) {
    if (!list) return
    setBusy(true)
    const added: PickedPhoto[] = []
    for (const file of Array.from(list).slice(0, max - photos.length)) {
      try {
        const id = await addPhoto(file)
        added.push({ id, url: URL.createObjectURL(file) })
      } catch {
        // fichier illisible : on l'ignore
      }
    }
    setBusy(false)
    if (added.length) onChange([...photos, ...added])
  }

  function remove(photo: PickedPhoto) {
    void deletePhoto(photo.id)
    URL.revokeObjectURL(photo.url)
    onChange(photos.filter((p) => p.id !== photo.id))
  }

  return (
    <div className="space-y-3">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          void handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          void handleFiles(e.target.files)
          e.target.value = ''
        }}
      />

      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((photo) => (
            <span key={photo.id} className="relative">
              <img
                src={photo.url}
                alt="Photo de preuve"
                className="h-20 w-20 rounded-xl object-cover"
              />
              <button
                type="button"
                onClick={() => remove(photo)}
                aria-label="Retirer la photo"
                className="absolute -right-1.5 -top-1.5 rounded-full bg-slate-900 p-0.5 text-white shadow cursor-pointer"
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}

      {photos.length < max && (
        <div className="flex gap-2">
          <Button variant="soft" size="sm" disabled={busy} onClick={() => cameraRef.current?.click()}>
            <Camera size={16} />
            Caméra
          </Button>
          <Button variant="soft" size="sm" disabled={busy} onClick={() => galleryRef.current?.click()}>
            <ImageIcon size={16} />
            Galerie
          </Button>
          {busy && <span className="self-center text-xs text-slate-400">Compression…</span>}
        </div>
      )}
    </div>
  )
}
