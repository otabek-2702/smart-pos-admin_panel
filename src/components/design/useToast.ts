/**
 * Toast singleton — Pinia store + push() composable.
 * Port of ToastProvider / useToast in
 * .tmp-alpha-design/alpha-design-source/ui.primitives.jsx
 *
 * Mount <Toast /> once near the root (e.g. inside the default layout) and
 * call `useToast()(...)` from anywhere.
 */

export type ToastTone = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: string
  tone: ToastTone
  title: string
  msg?: string
  duration?: number
}

export interface ToastPayload {
  tone?: ToastTone
  title: string
  msg?: string
  duration?: number
}

export const useToastStore = defineStore('design-toast', () => {
  const items = ref<ToastItem[]>([])
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  function remove(id: string) {
    items.value = items.value.filter(x => x.id !== id)
    const tm = timers.get(id)
    if (tm) {
      clearTimeout(tm)
      timers.delete(id)
    }
  }

  function push(t: ToastPayload): string {
    const id = Math.random().toString(36).slice(2)
    const item: ToastItem = {
      id,
      tone: t.tone || 'info',
      title: t.title,
      msg: t.msg,
      duration: t.duration ?? 4200,
    }
    items.value = items.value.concat([item])
    const tm = setTimeout(() => remove(id), item.duration!)
    timers.set(id, tm)
    return id
  }

  return { items, push, remove }
})

/** Push a toast from anywhere. Returns the toast id. */
export function useToast() {
  const store = useToastStore()
  return (t: ToastPayload) => store.push(t)
}
