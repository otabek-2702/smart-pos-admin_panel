import type { Ref } from 'vue'

/**
 * Observe an element's content-box width via ResizeObserver.
 * Returns [templateRef, widthRef]. Mirrors useWidth() in
 * .tmp-alpha-design/alpha-design-source/charts.svg.jsx (lines 9-20).
 *
 * Uses watch(elRef, …, { flush: 'post', immediate: true }) so the observer
 * (re)binds when the template ref target swaps — e.g. when v-if toggles the
 * loading skeleton off and the chart div remounts. onMounted-only would lock
 * the observer to the very first mounted element and width would never update.
 */
export function useWidth(): [Ref<HTMLElement | null>, Ref<number>] {
  const elRef = ref<HTMLElement | null>(null)
  const w = ref(0)

  watch(elRef, (el, _prev, onCleanup) => {
    if (!el)
      return
    const ro = new ResizeObserver(entries => {
      const e = entries[0]
      if (e)
        w.value = e.contentRect.width
    })
    ro.observe(el)
    w.value = el.clientWidth
    onCleanup(() => ro.disconnect())
  }, { flush: 'post', immediate: true })

  return [elRef, w]
}
