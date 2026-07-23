import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  subMonths,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Amount } from '../../components/ui/Amount'
import { Card } from '../../components/ui/Card'
import { ChildAvatar } from '../../components/ui/ChildAvatar'
import { cn } from '../../lib/cn'
import { formatEuro, formatTime } from '../../lib/format'
import { useStore } from '../../store/useStore'
import { Modal } from '../../components/ui/Modal'

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

export function CalendarPage() {
  const users = useStore((s) => s.users)
  const transactions = useStore((s) => s.transactions)
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const children = users.filter((u) => u.role === 'child' && u.isActive)

  const days = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) }),
    [month],
  )
  const offset = (getDay(startOfMonth(month)) + 6) % 7

  const monthTransactions = transactions.filter((t) => isSameMonth(t.createdAt, month))
  const dayTotal = (day: Date, childId: string) =>
    monthTransactions
      .filter((t) => t.childId === childId && isSameDay(t.createdAt, day))
      .reduce((sum, t) => sum + t.amount, 0)

  const selectedTransactions = selectedDay
    ? transactions
        .filter((t) => isSameDay(t.createdAt, selectedDay))
        .sort((a, b) => a.createdAt - b.createdAt)
    : []
  const selectedTotal = selectedTransactions.reduce((sum, t) => sum + t.amount, 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Calendrier</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonth(subMonths(month, 1))}
            aria-label="Mois précédent"
            className="rounded-lg p-2 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
          >
            <ChevronLeft size={20} />
          </button>
          <p className="w-36 text-center font-display font-bold capitalize">
            {format(month, 'MMMM yyyy', { locale: fr })}
          </p>
          <button
            onClick={() => setMonth(addMonths(month, 1))}
            aria-label="Mois suivant"
            className="rounded-lg p-2 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((day, i) => (
            <p key={i} className="pb-1 text-center text-xs font-bold text-slate-400">
              {day}
            </p>
          ))}
          {Array.from({ length: offset }).map((_, i) => (
            <span key={`pad-${i}`} />
          ))}
          {days.map((day) => {
            const totals = children
              .map((child) => ({ child, total: dayTotal(day, child.id) }))
              .filter((entry) => entry.total !== 0)
            return (
              <button
                key={day.getTime()}
                onClick={() => setSelectedDay(day)}
                className={cn(
                  'flex min-h-16 flex-col items-center gap-0.5 rounded-xl border p-1 pt-1.5 transition-colors cursor-pointer',
                  isToday(day)
                    ? 'border-amber-400 bg-amber-50 dark:bg-amber-400/10'
                    : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800',
                  totals.length === 0 && 'opacity-60',
                )}
              >
                <span className={cn('text-xs', isToday(day) ? 'font-bold' : 'text-slate-500')}>
                  {format(day, 'd')}
                </span>
                {totals.map(({ child, total }) => (
                  <span
                    key={child.id}
                    className="w-full truncate rounded px-0.5 text-[10px] font-bold tabular-nums text-white"
                    style={{ backgroundColor: total >= 0 ? child.color : '#EF4444' }}
                  >
                    {total > 0 ? '+' : ''}
                    {(total / 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}€
                  </span>
                ))}
              </button>
            )
          })}
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        {children.map((child) => (
          <p key={child.id} className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: child.color }} aria-hidden />
            {child.name}
          </p>
        ))}
      </div>

      <Modal
        open={selectedDay !== null}
        onClose={() => setSelectedDay(null)}
        title={selectedDay ? format(selectedDay, 'EEEE d MMMM', { locale: fr }) : ''}
      >
        {selectedTransactions.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">Aucune transaction ce jour-là.</p>
        ) : (
          <>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {selectedTransactions.map((tx) => {
                const child = users.find((u) => u.id === tx.childId)
                const parent = users.find((u) => u.id === tx.createdBy)
                return (
                  <div key={tx.id} className="flex items-center gap-3 py-2.5">
                    {child && <ChildAvatar user={child} size="sm" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{tx.description}</p>
                      <p className="text-xs text-slate-400">
                        {formatTime(tx.createdAt)} · par {parent?.name ?? '?'}
                      </p>
                    </div>
                    <Amount cents={tx.amount} className="text-sm" />
                  </div>
                )
              })}
            </div>
            <p className="mt-3 border-t border-slate-200 pt-3 text-right text-sm font-bold dark:border-slate-800">
              Total du jour : {formatEuro(selectedTotal, { signed: true })}
            </p>
          </>
        )}
      </Modal>
    </div>
  )
}
