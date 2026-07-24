import localforage from 'localforage'
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { uid } from './id'

export const photosDb = localforage.createInstance({ name: 'famtresor', storeName: 'photos' })

export interface StoredPhoto {
  id: string
  full: Blob
  thumb: Blob
  createdAt: number
  supabaseUrl?: string // URL Supabase pour sync cross-device
}

async function drawScaled(bitmap: ImageBitmap, maxSize: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Compression impossible'))),
      'image/jpeg',
      quality,
    )
  })
}

/** Compresse (max 1280px, JPEG 0.8) + miniature 240px, stocke dans IndexedDB + Supabase, retourne l'id. */
export async function addPhoto(file: File, userId?: string): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const [full, thumb] = await Promise.all([drawScaled(bitmap, 1280, 0.8), drawScaled(bitmap, 240, 0.7)])
  bitmap.close()
  const photoId = uid()
  const photo: StoredPhoto = { id: photoId, full, thumb, createdAt: Date.now() }

  // Stocke dans IndexedDB
  await photosDb.setItem(photoId, photo)

  // Si userId fourni, upload aussi vers Supabase pour sync cross-device
  if (userId) {
    try {
      const timestamp = Date.now()
      const filename = `${userId}-${timestamp}.jpeg`
      const filePath = `profile-photos/${filename}`

      console.log('📸 Photo sync : démarrage', { userId, fileSize: full.size, filePath })

      // Upload la version full à Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('famtresor-photos')
        .upload(filePath, full, {
          contentType: 'image/jpeg',
          upsert: true,
        })

      if (uploadError) {
        console.error('❌ Photo sync : upload Storage échoué', {
          userId,
          filePath,
          error: uploadError.message,
        })
        throw uploadError
      }

      const { data } = supabase.storage.from('famtresor-photos').getPublicUrl(filePath)
      const photoUrl = data.publicUrl
      console.log('✅ Photo sync : Storage OK', { photoUrl })

      // Sauvegarde dans profile_photos table pour Supabase real-time sync
      const { error: dbError } = await supabase
        .from('profile_photos')
        .upsert(
          {
            user_id: userId,
            photo_url: photoUrl,
            uploaded_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        )

      if (dbError) {
        console.error('❌ Photo sync : upsert profile_photos échoué', {
          userId,
          photoUrl,
          error: dbError.message,
          details: dbError.details,
          hint: dbError.hint,
        })
        throw dbError
      }

      console.log('✅ Photo sync : upsert profile_photos OK', { userId })
      photo.supabaseUrl = photoUrl
      await photosDb.setItem(photoId, photo)
    } catch (e) {
      console.error('❌ Photo sync : échec, la photo reste locale uniquement', {
        userId,
        error: e instanceof Error ? e.message : e,
      })
    }
  }

  return photoId
}

/** Supprime la photo de profil distante (table profile_photos) pour ce user. */
export async function removeRemoteProfilePhoto(userId: string): Promise<void> {
  const { error } = await supabase.from('profile_photos').delete().eq('user_id', userId)
  if (error) {
    console.error('❌ Photo sync : suppression profile_photos échouée', {
      userId,
      error: error.message,
    })
  } else {
    console.log('✅ Photo sync : photo distante supprimée', { userId })
  }
}

export async function getPhoto(id: string): Promise<StoredPhoto | null> {
  return photosDb.getItem<StoredPhoto>(id)
}

export async function deletePhoto(id: string): Promise<void> {
  await photosDb.removeItem(id)
}

/** URL objet (révoquée automatiquement) pour afficher une photo stockée. */
export function usePhotoUrl(id: string | undefined, kind: 'thumb' | 'full' = 'thumb'): string | undefined {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!id) return
    let objectUrl: string | undefined
    let alive = true
    void getPhoto(id).then((photo) => {
      if (photo && alive) {
        objectUrl = URL.createObjectURL(kind === 'thumb' ? photo.thumb : photo.full)
        setUrl(objectUrl)
      }
    })
    return () => {
      alive = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [id, kind])
  return url
}
