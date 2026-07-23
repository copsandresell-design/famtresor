import { cn } from '../../lib/cn'
import { usePhotoUrl } from '../../lib/photos'

interface Props {
  photoId: string
  onClick?: () => void
  className?: string
}

export function PhotoThumb({ photoId, onClick, className }: Props) {
  const url = usePhotoUrl(photoId, 'thumb')
  const cls = cn('h-16 w-16 rounded-lg object-cover bg-slate-200 dark:bg-slate-800', className)
  if (!url) return <span className={cn(cls, 'inline-block animate-pulse')} aria-hidden />
  if (!onClick) return <img src={url} alt="Photo de preuve" className={cls} />
  return (
    <button type="button" onClick={onClick} aria-label="Agrandir la photo" className="cursor-pointer">
      <img src={url} alt="Photo de preuve" className={cn(cls, 'transition-transform hover:scale-105')} />
    </button>
  )
}
