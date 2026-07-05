/* ============================================================
   UZS currency formatting for the Compare Periods page.
   Space thousand-separators, K/M/B abbreviation, integer math only.
   ============================================================ */

function spaceGroups(intAbs: number): string {
  return Math.round(intAbs).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/** 12345000 -> "12 345 000" */
export function fmtUZS(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const sign = n < 0 ? '−' : ''
  return `${sign}${spaceGroups(Math.abs(n))}`
}

/** 12345000 -> "12 345 000 so'm" */
export function fmtUZSUnit(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return `${fmtUZS(n)} so'm`
}

/** 12345000 -> "12.3M", 450000 -> "450K" (for chart axes/compact chips) */
export function abbrUZS(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const sign = n < 0 ? '−' : ''
  const abs = Math.abs(n)
  const trim = (v: number) => String(Math.round(v * 10) / 10)
  if (abs >= 1e9) return `${sign}${trim(abs / 1e9)}B`
  if (abs >= 1e6) return `${sign}${trim(abs / 1e6)}M`
  if (abs >= 1e3) return `${sign}${trim(abs / 1e3)}K`
  return `${sign}${Math.round(abs)}`
}

/** Plain integer with space groups (orders, items counts). */
export function fmtInt(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const sign = n < 0 ? '−' : ''
  return `${sign}${spaceGroups(Math.abs(n))}`
}

/** 12.234 -> "+12.2%" / -8.4 -> "−8.4%" / null -> "New" / 0 -> "—" */
export function fmtPct(pct: number | null, opts: { newLabel?: string, zeroDash?: boolean } = {}): string {
  if (pct === null) return opts.newLabel ?? 'New'
  if (pct === 0) return opts.zeroDash === false ? '0.0%' : '—'
  const rounded = Math.round(pct * 10) / 10
  const sign = rounded > 0 ? '+' : '−'
  return `${sign}${Math.abs(rounded).toFixed(1)}%`
}

export function useCurrency() {
  return { fmtUZS, fmtUZSUnit, abbrUZS, fmtInt, fmtPct }
}
