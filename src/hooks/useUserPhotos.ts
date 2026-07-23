import { useEffect, useState } from 'react'
import { usePhotoUrl } from '../lib/photos'

/**
 * Hook pour récupérer la photo d'un utilisateur (via localStorage sync)
 * Se met à jour quand une photo change (même sur un autre onglet/session)
 */
export function useUserPhoto(userId: string): string | undefined {
  const [photoId, setPhotoId] = useState<string | undefined>()
  const photoUrl = usePhotoUrl(photoId, 'thumb')

  useEffect(() => {
    // Charge la photo depuis localStorage
    const loadPhoto = () => {
      try {
        const photoIndex = JSON.parse(localStorage.getItem('famtresor_user_photos') || '{}')
        const id = photoIndex[userId]
        setPhotoId(id || undefined)
      } catch (e) {
        console.warn('Failed to load photo from localStorage:', e)
      }
    }

    loadPhoto()

    // Écoute les changements de photos (même depuis d'autres onglets)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'famtresor_user_photos') {
        loadPhoto()
      }
    }

    // Écoute les événements custom (changement dans le même onglet)
    const handlePhotoUpdate = (e: Event) => {
      const event = e as CustomEvent<{ userId: string; photoId: string }>
      if (event.detail.userId === userId) {
        setPhotoId(event.detail.photoId)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('famtresor:photo-updated', handlePhotoUpdate)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('famtresor:photo-updated', handlePhotoUpdate)
    }
  }, [userId])

  return photoUrl
}
