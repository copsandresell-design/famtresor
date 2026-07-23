import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

const euroFmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

export function formatEuro(cents: number, opts?: { signed?: boolean }): string {
  const s = euroFmt.format(cents / 100)
  return opts?.signed && cents > 0 ? `+${s}` : s
}

export function euroToCents(value: string | number): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

export function centsToEuroInput(cents: number): string {
  return (cents / 100).toFixed(2)
}

export function formatDay(ts: number): string {
  return format(ts, 'EEEE d MMMM', { locale: fr })
}

export function formatDateTime(ts: number): string {
  return format(ts, 'dd/MM/yyyy HH:mm', { locale: fr })
}

export function formatDateShort(ts: number): string {
  return format(ts, 'dd/MM', { locale: fr })
}

export function formatTime(ts: number): string {
  return format(ts, 'HH:mm', { locale: fr })
}

export function formatRelative(ts: number): string {
  return formatDistanceToNow(ts, { addSuffix: true, locale: fr })
}
