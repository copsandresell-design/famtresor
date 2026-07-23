import { useEffect, useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'

// Types de notifications
export type Notification = {
  id: string
  type: 'submission' | 'approval' | 'rejection' | 'badge'
  title: string
  message: string
  childName: string
  taskName: string
  icon: string
  timestamp: Date
}

// Callback quand une demande est créée
let notificationCallbacks: ((notif: Notification) => void)[] = []

export const subscribeToNotifications = (callback: (notif: Notification) => void) => {
  notificationCallbacks.push(callback)
  return () => {
    notificationCallbacks = notificationCallbacks.filter(cb => cb !== callback)
  }
}

// Hook pour écouter les soumissions de tâches (parents reçoivent notifs)
export const useSubmissionNotifications = (userId: string, userType: 'parent' | 'child') => {
  useEffect(() => {
    if (userType !== 'parent') return // Seuls les parents reçoivent les notifs

    // Subscribe aux nouvelles soumissions
    const subscription = supabase
      .from('submissions')
      .on('INSERT', async (payload) => {
        const submission = payload.new as any

        // Récupère les infos de l'enfant et de la tâche
        const { data: childData } = await supabase
          .from('users')
          .select('name')
          .eq('id', submission.child_id)
          .single()

        const { data: taskData } = await supabase
          .from('tasks')
          .select('title, icon')
          .eq('id', submission.task_id)
          .single()

        const childName = childData?.name || 'Enfant'
        const taskName = taskData?.title || 'Tâche'
        const icon = taskData?.icon || '📋'

        // Crée notification
        const notification: Notification = {
          id: submission.id,
          type: 'submission',
          title: `${childName} a complété une tâche!`,
          message: `"${taskName}" ${submission.is_initiative ? '(initiative!) ' : ''}${icon}`,
          childName,
          taskName,
          icon,
          timestamp: new Date()
        }

        // Broadcast à tous les listeners
        notificationCallbacks.forEach(cb => cb(notification))

        // Play sound (optionnel)
        playNotificationSound()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [userId, userType])
}

// Hook pour notifications d'approbation (enfants reçoivent quand parent approuve)
export const useApprovalNotifications = (userId: string, userType: 'parent' | 'child') => {
  useEffect(() => {
    if (userType !== 'child') return // Seuls les enfants reçoivent les approbations

    // Subscribe aux mises à jour de soumissions (approbations)
    const subscription = supabase
      .from('submissions')
      .on('UPDATE', async (payload) => {
        const submission = payload.new as any

        // Si c'est mon submission et status = approved
        if (submission.child_id === userId && submission.status === 'approved') {
          const { data: taskData } = await supabase
            .from('tasks')
            .select('title, amount, icon')
            .eq('id', submission.task_id)
            .single()

          const taskName = taskData?.title || 'Tâche'
          const amount = taskData?.amount || 0
          const icon = taskData?.icon || '✅'
          const bonus = submission.is_initiative ? 0.5 : 0

          const notification: Notification = {
            id: submission.id,
            type: 'approval',
            title: `✅ Validée!`,
            message: `${taskName} ${icon} +${amount}€${bonus > 0 ? ` (+${bonus}€ bonus!)` : ''}`,
            childName: '',
            taskName,
            icon,
            timestamp: new Date()
          }

          notificationCallbacks.forEach(cb => cb(notification))
          playNotificationSound('success')
        }

        // Si c'est mon submission et status = rejected
        if (submission.child_id === userId && submission.status === 'rejected') {
          const { data: taskData } = await supabase
            .from('tasks')
            .select('title, icon')
            .eq('id', submission.task_id)
            .single()

          const taskName = taskData?.title || 'Tâche'
          const icon = taskData?.icon || '❌'

          const notification: Notification = {
            id: submission.id,
            type: 'rejection',
            title: `❌ Refusée`,
            message: `${taskName} ${icon} - ${submission.rejection_reason || 'Pas validée'}`,
            childName: '',
            taskName,
            icon,
            timestamp: new Date()
          }

          notificationCallbacks.forEach(cb => cb(notification))
          playNotificationSound('error')
        }
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [userId, userType])
}

// Helper: joue un son
function playNotificationSound(type: 'success' | 'error' | 'default' = 'default') {
  // Utilise Web Audio API pour créer des sons simples
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    if (type === 'success') {
      oscillator.frequency.value = 600 // Hz
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.3)
    } else if (type === 'error') {
      oscillator.frequency.value = 400
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.2)
    } else {
      oscillator.frequency.value = 500
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15)
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.15)
    }
  } catch (e) {
    // Silence si Web Audio pas supporté
    console.debug('Audio notification skipped:', e);
  }
}

// Hook simple pour afficher les notifications (à utiliser dans un composant de layout)
export const useNotificationDisplay = () => {
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    const unsubscribe = subscribeToNotifications((notif) => {
      setNotifications(prev => [...prev, notif])

      // Auto-remove après 5 secondes
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== notif.id))
      }, 5000)
    })

    return unsubscribe
  }, [])

  return notifications
}
