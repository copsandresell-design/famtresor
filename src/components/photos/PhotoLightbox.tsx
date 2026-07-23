import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { usePhotoUrl } from '../../lib/photos'

interface Props {
  photoIds: string[]
  startIndex: number
  onClose: () => void
}

export function PhotoLightbox({ photoIds, startIndex, onClose }: Props) {
  const [index, setIndex] = useState(startIndex)
  const url = usePhotoUrl(photoIds[index], 'full')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(photoIds.length - 1, i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [photoIds.length, onClose])

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Photo en plein écran"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/90 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        aria-label="Fermer"
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 cursor-pointer"
      >
        <X size={22} />
      </button>

      {index > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setIndex(index - 1)
          }}
          aria-label="Photo précédente"
          className="absolute left-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 cursor-pointer"
        >
          <ChevronLeft size={26} />
        </button>
      )}

      <AnimatePresence mode="wait">
        {url && (
          <motion.img
            key={index}
            src={url}
            alt={`Photo ${index + 1} sur ${photoIds.length}`}
            className="max-h-[85dvh] max-w-full rounded-xl object-contain"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </AnimatePresence>

      {index < photoIds.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setIndex(index + 1)
          }}
          aria-label="Photo suivante"
          className="absolute right-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 cursor-pointer"
        >
          <ChevronRight size={26} />
        </button>
      )}

      {photoIds.length > 1 && (
        <p className="absolute bottom-4 text-sm font-semibold text-white/70">
          {index + 1} / {photoIds.length}
        </p>
      )}
    </motion.div>
  )
}
