export function useFormatters() {
  function formatCurrency(val: number | string): string {
    return new Intl.NumberFormat('uz-UZ').format(Math.round(Number(val) || 0))
  }

  function formatDate(val: string): string {
    if (!val) return '\u2014'

    return new Date(val).toLocaleString()
  }

  function formatDateShort(val: string): string {
    if (!val) return '\u2014'

    return new Date(val).toLocaleDateString()
  }

  return { formatCurrency, formatDate, formatDateShort }
}
