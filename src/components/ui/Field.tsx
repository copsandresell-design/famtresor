import type { ReactNode } from 'react'

export const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800'

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{label}</span>
      {children}
    </label>
  )
}
