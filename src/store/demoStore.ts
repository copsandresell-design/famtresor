import { create } from 'zustand'
import {
  demoBadgeDefs,
  demoLogs,
  demoMessages,
  demoNina,
  demoNotifications,
  demoParent,
  demoPenaltyRules,
  demoPointsTransactions,
  demoRankDefs,
  demoRedemptions,
  demoRewardClaims,
  demoSavingsGoals,
  demoSettings,
  demoShopItems,
  demoStreakDefs,
  demoSubmissions,
  demoTasks,
  demoTaskSuggestions,
  demoTransactions,
  demoUsers,
} from '../lib/demoData'
import type { AppNotification, Role, Session } from '../types'
import type { Store } from './useStore'

/**
 * Store de démo : même forme (Store) que le store réel, mais entièrement en mémoire — aucun
 * import de la couche persistance/Supabase (voir lib/sync.ts, lib/storage.ts) n'est utilisé ici,
 * pour garantir qu'aucune donnée démo ne peut jamais atteindre le réseau ni écraser le cache
 * local des vraies données de la famille. Toute action qui écrirait normalement des données est
 * interceptée et affiche un toast plutôt que d'exécuter la vraie logique.
 */

const DEMO_BLOCKED_MESSAGE =
  'Mode démo — cette action est désactivée. Crée ton propre compte pour tout personnaliser !'

const SESSION_FAR_FUTURE = Date.now() + 10 * 365 * 24 * 60 * 60 * 1000
const DEMO_SESSION_FLAG = 'kidsup:demo-active'
const DEMO_ROLE_FLAG = 'kidsup:demo-role'

function buildDemoSession(role: Role): Session {
  return { userId: role === 'parent' ? demoParent.id : demoNina.id, role, expiresAt: SESSION_FAR_FUTURE }
}

/** Rôle choisi avant un rafraîchissement de page en plein milieu de la démo (voir useDemoMode ci-dessous). */
function readStoredDemoRole(): Role | null {
  try {
    const role = sessionStorage.getItem(DEMO_ROLE_FLAG)
    return role === 'parent' || role === 'child' ? role : null
  } catch {
    return null
  }
}

let toastSeq = 0

export const useDemoStore = create<Store>((set, get) => {
  function blockToast() {
    get().toast(DEMO_BLOCKED_MESSAGE, 'error')
  }

  const storedRole = readStoredDemoRole()

  return {
    ready: true,
    users: demoUsers,
    tasks: demoTasks,
    submissions: demoSubmissions,
    transactions: demoTransactions,
    savingsGoals: demoSavingsGoals,
    logs: demoLogs,
    messages: demoMessages,
    notifications: demoNotifications,
    pointsTransactions: demoPointsTransactions,
    rewardClaims: demoRewardClaims,
    penaltyRules: demoPenaltyRules,
    shopItems: demoShopItems,
    redemptions: demoRedemptions,
    streakDefs: demoStreakDefs,
    badgeDefs: demoBadgeDefs,
    rankDefs: demoRankDefs,
    taskSuggestions: demoTaskSuggestions,
    settings: demoSettings,
    session: storedRole ? buildDemoSession(storedRole) : null,
    toasts: [],

    init: async () => {},
    syncFromRemote: async () => {},
    receiveRemoteUpsert: () => {},
    receiveRemoteDelete: () => {},
    receiveRemoteSettings: () => {},

    toast: (message, kind = 'success') => {
      const id = ++toastSeq
      set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }))
      setTimeout(() => get().dismissToast(id), 3500)
    },
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

    // Notifications démo : purement locales à cette session (jamais persistées), donc laissées
    // pleinement fonctionnelles pour une démo plus vivante (marquer lu, tout effacer…).
    receiveNotification: (notif: AppNotification) => {
      set((s) => ({ notifications: [notif, ...s.notifications] }))
    },
    markNotificationRead: (id) =>
      set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
    markAllNotificationsRead: (userId) =>
      set((s) => ({
        notifications: s.notifications.map((n) => (n.userId === userId ? { ...n, read: true } : n)),
      })),
    clearNotifications: (userId) =>
      set((s) => ({ notifications: s.notifications.filter((n) => n.userId !== userId) })),

    login: async () => false,
    // Quitter la démo depuis le bouton "Déconnexion" déjà présent dans les layouts existants.
    logout: () => {
      set({ session: null })
      useDemoMode.getState().exit()
    },
    touchSession: () => {},

    saveTask: () => blockToast(),
    deleteTask: () => blockToast(),
    submitTask: () => {
      blockToast()
      return false
    },
    sendMessage: () => blockToast(),
    sendCustomNotification: () => blockToast(),
    approveSubmission: () => blockToast(),
    rejectSubmission: () => blockToast(),
    applyPenalty: () => {
      blockToast()
      return false
    },
    cancelPenalty: () => blockToast(),
    editPenaltyTransaction: () => {
      blockToast()
      return false
    },
    deletePenaltyTransaction: () => {
      blockToast()
      return false
    },
    revertApproval: () => {
      blockToast()
      return false
    },
    deleteSubmission: () => {
      blockToast()
      return false
    },
    savePenaltyRule: () => blockToast(),
    deletePenaltyRule: () => blockToast(),
    resetBalance: () => blockToast(),
    resetSeason: () => blockToast(),
    updateChild: () => blockToast(),
    updateAvatar: () => blockToast(),
    changeSecret: async () => {
      blockToast()
    },
    updateSettings: () => blockToast(),
    createUser: async () => {
      blockToast()
      return demoParent
    },
    saveStreakDef: () => blockToast(),
    deleteStreakDef: () => blockToast(),
    saveBadgeDef: () => blockToast(),
    deleteBadgeDef: () => blockToast(),
    saveRankDef: () => blockToast(),
    deleteRankDef: () => blockToast(),
    addSavingsGoal: () => blockToast(),
    deleteSavingsGoal: () => blockToast(),
    createShopItem: () => blockToast(),
    updateShopItem: () => blockToast(),
    deleteShopItem: () => blockToast(),
    proposeWish: () => blockToast(),
    approveWish: () => blockToast(),
    rejectWish: () => blockToast(),
    redeemShopItem: () => {
      blockToast()
      return false
    },
    fulfillRedemption: () => blockToast(),
    cancelRedemption: () => blockToast(),
    convertPointsToMoney: () => {
      blockToast()
      return false
    },
    proposeTaskSuggestion: () => blockToast(),
    approveTaskSuggestion: () => blockToast(),
    rejectTaskSuggestion: () => blockToast(),
    giftPoints: () => {
      blockToast()
      return false
    },
    lendPoints: () => {
      blockToast()
      return false
    },
    repayLoan: () => {
      blockToast()
      return false
    },
    adjustPoints: () => {
      blockToast()
      return false
    },
    revokeBadgeClaim: () => {
      blockToast()
      return false
    },
  }
})

interface DemoModeState {
  active: boolean
  enter: (role: Role) => void
  exit: () => void
}

/**
 * true si l'onglet a déjà une démo en cours (ex: rafraîchi la page sur /parent/reglages en
 * plein milieu de la démo) — sans ça, ce rechargement réévaluerait `active` uniquement à
 * partir de l'URL courante (qui n'est plus /demo à ce stade) et laisserait le store réel
 * s'initialiser normalement (fetch + websocket Supabase) pendant la session d'un invité.
 */
function hasActiveDemoSession(): boolean {
  try {
    return sessionStorage.getItem(DEMO_SESSION_FLAG) === '1'
  } catch {
    return false
  }
}

/**
 * Bascule "mode démo actif ?" — un store séparé et minuscule pour que useStore (voir
 * store/useStore.ts) puisse réagir sans dépendre du contenu du store démo lui-même.
 *
 * `active` démarre déjà à true si l'URL de chargement est /demo (lien partagé, arrivée
 * directe) ou si une démo était déjà en cours dans cet onglet : sans ça, le store réel
 * démarrerait quand même son initialisation Supabase (fetch + websockets realtime) le temps
 * que le visiteur choisisse une vue, exposant brièvement les vraies données de la famille
 * dans les requêtes réseau de cet onglet.
 */
export const useDemoMode = create<DemoModeState>((set) => ({
  active: (typeof window !== 'undefined' && window.location.pathname.startsWith('/demo')) || hasActiveDemoSession(),
  enter: (role) => {
    useDemoStore.setState({ session: buildDemoSession(role) })
    try {
      sessionStorage.setItem(DEMO_SESSION_FLAG, '1')
      sessionStorage.setItem(DEMO_ROLE_FLAG, role)
    } catch {
      // Stockage indisponible (navigation privée…) : la démo reste fonctionnelle pour cet
      // onglet, seule la reprise après un rafraîchissement de page ne serait pas garantie.
    }
    set({ active: true })
  },
  exit: () => {
    try {
      sessionStorage.removeItem(DEMO_SESSION_FLAG)
      sessionStorage.removeItem(DEMO_ROLE_FLAG)
    } catch {
      // idem
    }
    set({ active: false })
  },
}))
