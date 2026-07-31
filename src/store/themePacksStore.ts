import { create } from 'zustand'
import { fetchActivePackId, fetchOwnedPackIds, fetchThemePacks, type ThemePack } from '../lib/themePacks'

// GODCLAUDE phase 5 : chargé une fois la famille connue (voir App.tsx), consulté par
// AvatarEditorModal/ChildrenPage (emojis/couleurs disponibles pour un avatar) et par la
// section "Apparence" des réglages (achat/sélection de pack).
interface ThemePacksState {
  packs: ThemePack[]
  ownedPackIds: Set<string>
  activePackId: string
  loaded: boolean
}

export const useThemePacksStore = create<ThemePacksState>(() => ({
  packs: [],
  ownedPackIds: new Set(),
  activePackId: 'espace',
  loaded: false,
}))

export async function refreshThemePacks(familyId: string): Promise<void> {
  const [packs, ownedPackIds, activePackId] = await Promise.all([
    fetchThemePacks(),
    fetchOwnedPackIds(familyId),
    fetchActivePackId(familyId),
  ])
  useThemePacksStore.setState({ packs, ownedPackIds, activePackId, loaded: true })
}

/** Le pack actuellement actif pour la famille — retombe sur le premier pack marqué "défaut"
 *  (ou une liste vide de secours) tant que le catalogue n'a pas encore été chargé. */
export function useActiveThemePack(): ThemePack | null {
  const packs = useThemePacksStore((s) => s.packs)
  const activePackId = useThemePacksStore((s) => s.activePackId)
  return packs.find((p) => p.id === activePackId) ?? packs.find((p) => p.isDefault) ?? null
}
