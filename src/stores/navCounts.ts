import { defineStore } from 'pinia'
import axios from '@/plugins/axios'

export interface NavCounts {
  shifts: number | null
  orders: number | null
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const useNavCountsStore = defineStore('navCounts', () => {
  const counts = ref<NavCounts>({ shifts: null, orders: null })
  const refreshing = ref(false)
  let timer: number | null = null

  async function refresh() {
    if (refreshing.value) return
    refreshing.value = true
    try {
      const today = todayIso()
      const [shiftsRes, ordersRes] = await Promise.allSettled([
        axios.get('/shifts/active'),
        axios.get('/orders/stats', { params: { date_from: today, date_to: today } }),
      ])

      if (shiftsRes.status === 'fulfilled') {
        const d = shiftsRes.value.data?.data ?? shiftsRes.value.data
        counts.value.shifts = Array.isArray(d) ? d.length : (Array.isArray(d?.shifts) ? d.shifts.length : 0)
      }
      if (ordersRes.status === 'fulfilled') {
        const d = ordersRes.value.data?.data ?? ordersRes.value.data
        counts.value.orders = typeof d?.total_orders === 'number' ? d.total_orders : 0
      }
    }
    finally {
      refreshing.value = false
    }
  }

  function start() {
    refresh()
    if (timer !== null) return
    timer = window.setInterval(refresh, 90_000)
    document.addEventListener('visibilitychange', onVis)
  }

  function stop() {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
    document.removeEventListener('visibilitychange', onVis)
  }

  function onVis() {
    if (!document.hidden) refresh()
  }

  return { counts, refreshing, refresh, start, stop }
})
