import localforage from 'localforage'
import { useEffect, useState } from 'react'
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

/** Compresse (max 1280px, JPEG 0.8) + miniature 240px, stocke dans IndexedDB + localStorage, retourne l'id. */
export async function addPhoto(file: File, userId?: string): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const [full, thumb] = await Promise.all([drawScaled(bitmap, 1280, 0.8), drawScaled(bitmap, 240, 0.7)])
  bitmap.close()
  const photoId = uid()
  const photo: StoredPhoto = { id: photoId, full, thumb, createdAt: Date.now() }

  // Stocke dans IndexedDB
  await photosDb.setItem(photoId, photo)

  // Si userId fourni, sauvegarde aussi dans localStorage pour sync cross-tab/session
  if (userId) {
    try {
      // Crée une clé unique user->photoId dans localStorage
      const photoIndex = JSON.parse(localStorage.getItem('famtresor_user_photos') || '{}')
      photoIndex[userId] = photoId
      localStorage.setItem('famtresor_user_photos', JSON.stringify(photoIndex))

      // Déclenche événement custom pour synchro cross-tab
      window.dispatchEvent(new CustomEvent('famtresor:photo-updated', { detail: { userId, photoId } }))
    } catch (e) {
      console.warn('localStorage sync failed:', e)
    }
  }

  return photoId
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
