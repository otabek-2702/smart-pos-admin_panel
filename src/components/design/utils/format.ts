/**
 * Number/currency formatters — port of .tmp-design-bundle/project/app/format.js.
 * UZS, U+202F (narrow no-break space) thousands grouping, abbreviate large
 * values (1 240 000 -> 1.24M). Used by the design components.
 */
const NB = ' '

function group(intStr: string): string {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, NB)
}

export function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n))
    return '—'
  const neg = n < 0
  const s = group(Math.round(Math.abs(n)).toString())

  return (neg ? '-' : '') + s
}

export function fmtAbbr(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n))
    return '—'
  const neg = n < 0
  const a = Math.abs(n)
  const trim = (x: number) => x.toFixed(2).replace(/\.?0+$/, '')
  const trim1 = (x: number) => x.toFixed(1).replace(/\.0$/, '')
  let out: string
  if (a >= 1e9)
    out = `${trim(a / 1e9)}B`
  else if (a >= 1e6)
    out = `${trim(a / 1e6)}M`
  else if (a >= 1e3)
    out = `${trim1(a / 1e3)}K`
  else
    out = String(Math.round(a))

  return (neg ? '-' : '') + out
}

export function fmtMoney(n: number | null | undefined, opts?: { unit?: boolean }): string {
  const v = fmtNum(n)
  if (v === '—')
    return v

  return opts?.unit ? `${v}${NB}UZS` : v
}

export function fmtMoneyAbbr(n: number | null | undefined, opts?: { unit?: boolean }): string {
  const v = fmtAbbr(n)
  if (v === '—')
    return v

  return opts?.unit ? `${v}${NB}UZS` : v
}

export function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n))
    return '—'

  return n.toFixed(digits).replace(/\.?0+$/, '') + '%'
}

export function fmtDelta(n: number | null | undefined, digits?: number): string {
  if (n === null || n === undefined || Number.isNaN(n))
    return '—'
  const s = fmtPct(Math.abs(n), digits)

  return (n > 0 ? '+' : n < 0 ? '−' : '') + s
}

function parseDate(d: Date | string | number | null | undefined): Date | null {
  if (d === null || d === undefined || d === '')
    return null
  const x = d instanceof Date ? d : new Date(d)

  return Number.isNaN(x.getTime()) ? null : x
}

export function fmtTime(d: Date | string | number | null | undefined): string {
  const x = parseDate(d)
  if (!x)
    return '—'
  const p = (v: number) => v < 10 ? `0${v}` : `${v}`

  return `${p(x.getHours())}:${p(x.getMinutes())}`
}

export function fmtDate(d: Date | string | number | null | undefined): string {
  const x = parseDate(d)
  if (!x)
    return '—'
  const p = (v: number) => v < 10 ? `0${v}` : `${v}`

  return `${p(x.getDate())}.${p(x.getMonth() + 1)}.${x.getFullYear()}`
}

export function fmtDateTime(d: Date | string | number | null | undefined): string {
  const x = parseDate(d)
  if (!x)
    return '—'
  const p = (v: number) => v < 10 ? `0${v}` : `${v}`

  return `${fmtDate(x)}, ${p(x.getHours())}:${p(x.getMinutes())}`
}

export { NB }
