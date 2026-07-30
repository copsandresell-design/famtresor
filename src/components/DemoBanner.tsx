import { useNavigate } from 'react-router-dom'
import { useDemoMode } from '../store/demoStore'

/**
 * Rappel permanent qu'on est en mode démo (voir store/demoStore.ts) : volontairement dans le
 * flux normal de la page (pas fixed) pour ne jamais risquer de recouvrir le header, comme
 * l'a fait la status bar iOS avant son correctif (voir ParentLayout/ChildLayout).
 */
export function DemoBanner() {
  const active = useDemoMode((s) => s.active)
  const exit = useDemoMode((s) => s.exit)
  const navigate = useNavigate()

  if (!active) return null

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-1.5 text-center text-xs font-semibold text-white">
      <span>🎬 Mode démo — données fictives, aucune modification n'est sauvegardée</span>
      <button
        onClick={() => {
          exit()
          navigate('/')
        }}
        className="shrink-0 rounded-full bg-white/20 px-2.5 py-1 font-bold hover:bg-white/30 cursor-pointer"
      >
        Quitter la démo
      </button>
    </div>
  )
}
