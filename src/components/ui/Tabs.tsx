import { cn } from '../../lib/cn'

interface Props<T extends string> {
  tabs: Array<{ id: T; label: string; count?: number }>
  active: T
  onChange: (id: T) => void
}

export function Tabs<T extends string>({ tabs, active, onChange }: Props<T>) {
  return (
    <div role="tablist" className="flex gap-1 rounded-xl bg-slate-200/70 p-1 dark:bg-slate-800">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors cursor-pointer',
            active === tab.id
              ? 'bg-white shadow-sm dark:bg-slate-900'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
          )}
        >
          {tab.label}
          {tab.count !== undefined && tab.count > 0 && (
            <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 text-xs text-slate-900">{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}
