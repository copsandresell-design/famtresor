import { cn } from '../../lib/cn'
import { childGradient } from '../../lib/colors'
import { usePhotoUrl } from '../../lib/photos'
import { useProfilePhotos } from '../../hooks/useProfilePhotos'
import type { User } from '../../types'

const sizes = {
  sm: { outer: 'h-9 w-9', text: 'text-base' },
  md: { outer: 'h-12 w-12', text: 'text-xl' },
  lg: { outer: 'h-[4.5rem] w-[4.5rem]', text: 'text-3xl' },
  xl: { outer: 'h-28 w-28', text: 'text-5xl' },
}

interface Props {
  user: User
  size?: keyof typeof sizes
  /** Si fourni, l'avatar devient cliquable (ex : ouvrir l'édition de photo). */
  onClick?: () => void
}

export function ChildAvatar({ user, size = 'md', onClick }: Props) {
  const localPhotoUrl = usePhotoUrl(user.photoId, 'thumb')
  const { photos: supabasePhotos } = useProfilePhotos()

  // Priorité: Supabase real-time sync > Local IndexedDB
  const photoUrl = supabasePhotos[user.id] || localPhotoUrl

  const visual = (
    <span
      aria-hidden
      className={cn('inline-flex shrink-0 rounded-full p-[3px]', sizes[size].outer)}
      style={{ background: childGradient(user.color) }}
    >
      {photoUrl ? (
        <img src={photoUrl} alt="" className="h-full w-full rounded-full object-cover" />
      ) : (
        <span
          className={cn(
            'flex h-full w-full items-center justify-center rounded-full bg-white dark:bg-slate-900',
            sizes[size].text,
          )}
        >
          {user.avatar}
        </span>
      )}
    </span>
  )

  if (!onClick) return visual

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Changer l'avatar de ${user.name}`}
      className="cursor-pointer rounded-full transition-transform hover:scale-105"
    >
      {visual}
    </button>
  )
}
