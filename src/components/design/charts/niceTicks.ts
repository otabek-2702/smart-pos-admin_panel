/**
 * Pick "nice" axis ticks that span [0, max] with ~`count` divisions.
 * Direct port of niceTicks(max, count) in
 * .tmp-alpha-design/alpha-design-source/charts.svg.jsx (lines 39-50).
 *
 * Algorithm:
 *   raw  = max / count
 *   mag  = 10^floor(log10(raw))
 *   norm = raw / mag
 *   step in {1, 2, 2.5, 5, 10} * mag picked by norm bucket
 *   top  = ceil(max / step) * step
 *   ticks = [0, step, 2*step, ..., top]
 */
export function niceTicks(max: number, count: number): { ticks: number[]; top: number } {
  const raw = max / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / mag
  let step: number
  if (norm <= 1)
    step = 1
  else if (norm <= 2)
    step = 2
  else if (norm <= 2.5)
    step = 2.5
  else if (norm <= 5)
    step = 5
  else
    step = 10
  step *= mag
  const top = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= top + 1e-6; v += step)
    ticks.push(v)

  return { ticks, top }
}
