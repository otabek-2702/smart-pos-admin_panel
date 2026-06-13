import type { Ref } from 'vue'

/**
 * Observe an element's content-box width via ResizeObserver.
 * Returns [templateRef, widthRef]. Mirrors useWidth() in charts.jsx.
 */
export function useWidth(): [Ref<HTMLElement | null>, Ref<number>] {
  const elRef = ref<HTMLElement | null>(null)
  const w = ref(0)
  let ro: ResizeObserver | null = null

  onMounted(() => {
    if (!elRef.value)
      return
    ro = new ResizeObserver(entries => {
      const e = entries[0]
      if (e)
        w.value = e.contentRect.width
    })
    ro.observe(elRef.value)
    w.value = elRef.value.clientWidth
  })

  onBeforeUnmount(() => {
    ro?.disconnect()
    ro = null
  })

  return [elRef, w]
}
