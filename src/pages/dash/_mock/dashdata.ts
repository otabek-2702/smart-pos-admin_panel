/* ============================================================
   ALPHA POS — dashboard mock data (rich, for 5 dashboards)
   Representative values consistent with the rest of the product.
   Ported from .tmp-handoff-v3/pos-admin-panel/project/app/dashdata.js
   ============================================================ */

// ---------- types ----------
export interface ChannelDay {
  label: string
  values: { hall: number; delivery: number; pickup: number }
}

export interface CategoryDatum {
  label: string
  value: number
  color: string
}

export interface ParetoDatum {
  label: string
  value: number
}

export interface ProductTrend {
  name: string
  units: number
  revenue: number
  delta: number
  spark: number[]
}

export interface StaffMember {
  name: string
  initials: string
  revenue: number
  orders: number
  aov: number
  speed: number
  accuracy: number
  upsell: number
  attendance: number
  hours: number
}

export interface FunnelStage {
  label: string
  value: number
  color: string
}

export type TableStatus = 'free' | 'seated' | 'reserved' | 'cleaning'

export interface TableCell {
  n: number
  status: TableStatus
  guests: number
  mins: number
}

export type LiveFeedType = 'HALL' | 'DELIVERY' | 'PICKUP'
export type LiveFeedStatus = 'PREPARING' | 'READY' | 'COMPLETED'

export interface LiveFeedItem {
  id: number
  type: LiveFeedType
  info: string
  total: number
  ts: number
  status: LiveFeedStatus
}

export interface PrepByCategoryRow {
  label: string
  mins: number
  target: number
  orders: number
}

// ---------- helpers ----------
function genTrend(days: number, base: number, vol: number, growth: number): number[] {
  const out: number[] = []
  let v = base
  for (let i = 0; i < days; i++) {
    v = v * (1 + (Math.sin(i / 3) * vol + (Math.random() - 0.5) * vol)) + growth
    out.push(Math.max(0, Math.round(v)))
  }
  return out
}

// ---------- day labels (30 days, anchored to 2026-06-24 per source) ----------
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const dayLabels: string[] = (() => {
  const out: string[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(2026, 5, 24 - i)
    out.push(`${d.getDate()} ${MONTH_ABBR[d.getMonth()]}`)
  }
  return out
})()

// ---------- 30-day series ----------
export const revenue30: number[] = genTrend(30, 11_000_000, 0.06, 180_000)
export const orders30: number[] = revenue30.map(r => Math.round(r / (95_000 + Math.random() * 18_000)))
export const aov30: number[] = revenue30.map((r, i) => Math.round(r / orders30[i]))
export const expense30: number[] = revenue30.map(r => Math.round(r * (0.38 + Math.random() * 0.05)))
export const lastMonthRev: number[] = genTrend(30, 9_800_000, 0.06, 120_000)

// ---------- hour x weekday heatmap (rows=days, cols=hours 10..23) ----------
export const HM_HOURS: string[] = (() => {
  const out: string[] = []
  for (let h = 10; h <= 23; h++) out.push(h < 10 ? `0${h}` : String(h))
  return out
})()

export const HM_DAYS: string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const heatMatrix: number[][] = HM_DAYS.map((_d, di) =>
  HM_HOURS.map((_h, hi) => {
    const peakLunch = Math.exp(-Math.pow(hi - 3, 2) / 4)
    const peakDinner = Math.exp(-Math.pow(hi - 9, 2) / 5) * 1.3
    const weekend = di >= 4 ? 1.4 : 1
    return Math.round((peakLunch + peakDinner) * 22 * weekend + Math.random() * 4)
  })
)

// ---------- channel split per day (last 7d, stacked) ----------
export const channelDays: ChannelDay[] = dayLabels.slice(-7).map(lab => ({
  label: lab.split(' ')[0],
  values: {
    hall: 6_500_000 + Math.random() * 2_500_000,
    delivery: 2_800_000 + Math.random() * 1_500_000,
    pickup: 1_400_000 + Math.random() * 900_000,
  },
}))

// ---------- categories ----------
export const categories: CategoryDatum[] = [
  { label: 'Pizza', value: 24_800_000, color: 'var(--c1)' },
  { label: 'Lavash', value: 18_200_000, color: 'var(--c2)' },
  { label: 'Kebab', value: 15_600_000, color: 'var(--c3)' },
  { label: 'Hot Dogs', value: 8_900_000, color: 'var(--c4)' },
  { label: 'Drinks', value: 6_400_000, color: 'var(--c5)' },
  { label: 'Sides', value: 4_200_000, color: 'var(--primary-hover)' },
  { label: 'Desserts', value: 2_600_000, color: 'var(--success)' },
]

// ---------- products ----------
export const productPareto: ParetoDatum[] = [
  { label: 'Pitsa tovuqli katta', value: 19_550_000 },
  { label: 'Non kabob big', value: 15_120_000 },
  { label: 'Lavash halapino', value: 12_240_000 },
  { label: 'Toster', value: 8_960_000 },
  { label: 'Lester', value: 6_400_000 },
  { label: 'Hot Dog Halapeno', value: 4_200_000 },
  { label: 'Lavash katta', value: 3_100_000 },
  { label: 'Tandir Lavash', value: 1_800_000 },
]

export const productTrends: ProductTrend[] = [
  { name: 'Pitsa tovuqli katta', units: 312, revenue: 19_550_000, delta: 14.2, spark: genTrend(14, 60, 0.1, 1) },
  { name: 'Non kabob big', units: 286, revenue: 15_120_000, delta: 8.4, spark: genTrend(14, 52, 0.12, 0.5) },
  { name: 'Lavash halapino', units: 401, revenue: 12_240_000, delta: -3.1, spark: genTrend(14, 70, 0.1, -0.4) },
  { name: 'Toster', units: 332, revenue: 8_960_000, delta: 5.6, spark: genTrend(14, 55, 0.12, 0.3) },
  { name: 'Lester', units: 298, revenue: 6_400_000, delta: 22.5, spark: genTrend(14, 30, 0.14, 1.6) },
  { name: 'Hot Dog Halapeno', units: 190, revenue: 4_200_000, delta: -8.2, spark: genTrend(14, 40, 0.12, -0.8) },
]

// ---------- staff / cashiers ----------
export const staff: StaffMember[] = [
  { name: 'Ruxsora Smart', initials: 'R', revenue: 28_400_000, orders: 268, aov: 105_970, speed: 88, accuracy: 96, upsell: 72, attendance: 98, hours: 168 },
  { name: 'Umida Smart', initials: 'U', revenue: 24_100_000, orders: 231, aov: 104_329, speed: 82, accuracy: 94, upsell: 65, attendance: 95, hours: 160 },
  { name: 'Aziz Karimov', initials: 'A', revenue: 19_800_000, orders: 204, aov: 97_058, speed: 91, accuracy: 89, upsell: 58, attendance: 92, hours: 152 },
  { name: 'Dilnoza Saidova', initials: 'D', revenue: 17_600_000, orders: 188, aov: 93_617, speed: 79, accuracy: 97, upsell: 80, attendance: 99, hours: 165 },
  { name: 'Bek Toshev', initials: 'B', revenue: 12_300_000, orders: 142, aov: 86_620, speed: 74, accuracy: 85, upsell: 49, attendance: 88, hours: 138 },
]

// ---------- funnel ----------
export const funnelData: FunnelStage[] = [
  { label: 'Orders placed', value: 2555, color: 'var(--c1)' },
  { label: 'Accepted by kitchen', value: 2488, color: 'var(--c4)' },
  { label: 'Prepared', value: 2471, color: 'var(--primary)' },
  { label: 'Served / delivered', value: 2455, color: 'var(--c2)' },
  { label: 'Paid & closed', value: 2412, color: 'var(--success)' },
]

// ---------- table occupancy grid (16 hall tables) ----------
export const tableGrid: TableCell[] = (() => {
  const statuses: TableStatus[] = [
    'seated', 'seated', 'free', 'seated', 'reserved', 'free', 'seated', 'cleaning',
    'seated', 'free', 'seated', 'seated', 'reserved', 'free', 'seated', 'seated',
  ]
  const out: TableCell[] = []
  for (let i = 0; i < 16; i++) {
    out.push({
      n: i + 1,
      status: statuses[i],
      guests: statuses[i] === 'seated' ? 2 + (i % 4) : 0,
      mins: statuses[i] === 'seated' ? 12 + ((i * 7) % 70) : 0,
    })
  }
  return out
})()

// ---------- live order feed seed ----------
export const liveFeed: LiveFeedItem[] = [
  { id: 2562, type: 'HALL', info: 'Table 4', total: 84_000, ts: Date.now() - 8_000, status: 'PREPARING' },
  { id: 2561, type: 'DELIVERY', info: 'Yunusobod', total: 132_000, ts: Date.now() - 42_000, status: 'PREPARING' },
  { id: 2560, type: 'PICKUP', info: '—', total: 56_000, ts: Date.now() - 95_000, status: 'READY' },
  { id: 2559, type: 'HALL', info: 'Table 9', total: 218_000, ts: Date.now() - 140_000, status: 'COMPLETED' },
  { id: 2558, type: 'HALL', info: 'Table 2', total: 47_000, ts: Date.now() - 190_000, status: 'COMPLETED' },
]

// ---------- prep by category ----------
export const prepByCategory: PrepByCategoryRow[] = [
  { label: 'Hot Dogs', mins: 5.2, target: 8, orders: 190 },
  { label: 'Drinks', mins: 1.4, target: 4, orders: 612 },
  { label: 'Lavash', mins: 7.8, target: 9, orders: 401 },
  { label: 'Kebab', mins: 9.1, target: 9, orders: 286 },
  { label: 'Sides', mins: 6.3, target: 7, orders: 224 },
  { label: 'Pizza', mins: 13.6, target: 12, orders: 312 },
  { label: 'Desserts', mins: 4.1, target: 6, orders: 98 },
]

// ---------- headline aggregates ----------
export const monthRevenue: number = revenue30.reduce((a, b) => a + b, 0)
export const monthTarget: number = Math.round(monthRevenue * 1.16)
export const monthOrders: number = orders30.reduce((a, b) => a + b, 0)
export const avgAov: number = Math.round(aov30.reduce((a, b) => a + b, 0) / aov30.length)
export const grossMargin = 61.5
export const repeatRate = 38.4

// ---------- default aggregator (parity with source `window.DASH`) ----------
export const DASH = {
  dayLabels,
  prepByCategory,
  revenue30,
  orders30,
  aov30,
  expense30,
  lastMonthRev,
  HM_HOURS,
  HM_DAYS,
  heatMatrix,
  channelDays,
  categories,
  productPareto,
  productTrends,
  staff,
  funnelData,
  tableGrid,
  liveFeed,
  monthRevenue,
  monthTarget,
  monthOrders,
  avgAov,
  grossMargin,
  repeatRate,
}

export default DASH

// ---------- composable for Vue ergonomics ----------
export function useDashMock() {
  return DASH
}
