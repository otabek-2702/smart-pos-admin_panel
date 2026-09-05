const UNKNOWN_PRICE_NOTE_MARKER = 'temporary unknown-price placeholder'

export function supplierItemHasKnownPrice(row: any): boolean {
  const price = Number(row?.price)
  const notes = String(row?.notes ?? '').toLocaleLowerCase('en-US')

  return Number.isFinite(price) && !notes.includes(UNKNOWN_PRICE_NOTE_MARKER)
}
