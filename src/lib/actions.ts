export const ACTION_LABELS: Record<string, string> = {
  seed: 'Initialisation',
  login: 'Connexion',
  task_created: 'Tâche créée',
  task_updated: 'Tâche modifiée',
  task_deleted: 'Tâche supprimée',
  task_submitted: 'Tâche signalée',
  submission_approved: 'Tâche validée',
  submission_rejected: 'Tâche refusée',
  penalty_applied: 'Pénalité appliquée',
  penalty_cancelled: 'Pénalité annulée',
  balance_adjusted: 'Ajustement de solde',
  balance_reset: 'Solde réinitialisé',
  child_updated: 'Profil enfant modifié',
  secret_changed: 'Code modifié',
  settings_updated: 'Réglages modifiés',
  message_sent: 'Message envoyé',
  avatar_changed: 'Avatar modifié',
}

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action
}
