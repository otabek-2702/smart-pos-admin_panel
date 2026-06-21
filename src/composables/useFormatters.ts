import { fmtDateTime, fmtNum } from '@/components/design/utils/format'

export function useFormatters() {
  function formatCurrency(val: number | string): string {
    return fmtNum(Math.round(Number(val) || 0))
  }

  function formatDate(val: string): string {
    if (!val)
      return '—'

    return fmtDateTime(val)
  }

  function formatDateShort(val: string): string {
    if (!val)
      return '—'

    return new Date(val).toLocaleDateString()
  }

  return { formatCurrency, formatDate, formatDateShort }
}
