import { useEffect, useState, useCallback } from 'react'
import { supabase, type Database } from '../lib/supabase'

export const useProfilePhotos = () => {
  const [photos, setPhotos] = useState<Record<string, string>>({}) // userId -> photoUrl
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Fetch all profile photos
    const fetchPhotos = async () => {
      try {
        const { data, error: err } = await supabase
          .from('profile_photos')
          .select('user_id, photo_url')

        if (err) throw err

        const photoMap = (data || []).reduce((acc, { user_id, photo_url }) => {
          acc[user_id] = photo_url
          return acc
        }, {} as Record<string, string>)

        setPhotos(photoMap)
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    }

    fetchPhotos()

    // Subscribe to real-time updates - avec ID unique pour éviter les doublons
    const channelName = `profile-photos-${Math.random()}`
    const channel = supabase.channel(channelName)

    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profile_photos' },
        (payload: any) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const { user_id, photo_url } = payload.new as Database['public']['Tables']['profile_photos']['Row']
            setPhotos(prev => ({
              ...prev,
              [user_id]: photo_url
            }))
          } else if (payload.eventType === 'DELETE') {
            // Nécessite REPLICA IDENTITY FULL sur la table pour recevoir user_id
            const userId = (payload.old as { user_id?: string } | undefined)?.user_id
            if (userId) {
              setPhotos(prev => {
                const next = { ...prev }
                delete next[userId]
                return next
              })
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const uploadProfilePhoto = useCallback(async (userId: string, file: File) => {
    try {
      // Compress image
      const compressed = await compressImage(file)

      // Generate unique filename
      const timestamp = Date.now()
      const filename = `${userId}-${timestamp}.webp`
      const filePath = `profile-photos/${filename}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('famtresor-photos')
        .upload(filePath, compressed, {
          upsert: true,
          contentType: 'image/webp'
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data } = supabase.storage
        .from('famtresor-photos')
        .getPublicUrl(filePath)

      const photoUrl = data.publicUrl

      // Update or insert profile_photos record
      const { error: dbError } = await supabase
        .from('profile_photos')
        .upsert(
          {
            user_id: userId,
            photo_url: photoUrl,
            uploaded_at: new Date().toISOString()
          },
          { onConflict: 'user_id' }
        )

      if (dbError) throw dbError

      return photoUrl
    } catch (e) {
      const errorMsg = (e as Error).message
      setError(errorMsg)
      throw e
    }
  }, [])

  const deleteProfilePhoto = useCallback(async (userId: string) => {
    try {
      // Delete from DB
      const { error: dbError } = await supabase
        .from('profile_photos')
        .delete()
        .eq('user_id', userId)

      if (dbError) throw dbError

      setPhotos(prev => {
        const updated = { ...prev }
        delete updated[userId]
        return updated
      })
    } catch (e) {
      const errorMsg = (e as Error).message
      setError(errorMsg)
      throw e
    }
  }, [])

  const getPhotoUrl = useCallback((userId: string): string | null => {
    return photos[userId] || null
  }, [photos])

  return {
    photos,
    loading,
    error,
    uploadProfilePhoto,
    deleteProfilePhoto,
    getPhotoUrl
  }
}

// Helper: compress image
async function compressImage(file: File, maxWidth = 500, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      const img = new Image()

      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        // Resize if needed
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Failed to get canvas context'))

        ctx.drawImage(img, 0, 0, width, height)

        // Convert to webp blob
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Failed to compress image'))
            resolve(blob)
          },
          'image/webp',
          quality
        )
      }

      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = e.target?.result as string
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}
