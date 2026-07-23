function escapeCell(cell: string): string {
  return /[";\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell
}

export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCell).join(';')).join('\n')
}

export function downloadCsv(filename: string, rows: string[][]): void {
  const blob = new Blob([`﻿${toCsv(rows)}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
