export function EmptyState({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center text-slate-500 dark:text-slate-400">
      <span className="text-4xl" aria-hidden>
        {emoji}
      </span>
      <p className="text-sm">{text}</p>
    </div>
  )
}
