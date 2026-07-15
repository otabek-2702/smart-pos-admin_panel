import { computed, onScopeDispose, ref, watch } from 'vue'

export type AlphaTheme = 'light' | 'dark'

interface VuetifyThemeController {
  global: {
    name: { value: string }
    current: { value: { dark: boolean } }
  }
}

const sharedTheme = ref<AlphaTheme>('light')
let resolved = false

function storedTheme(): AlphaTheme | null {
  if (typeof window === 'undefined')
    return null

  try {
    const stored = localStorage.getItem('alphapos-theme')

    if (stored === 'light' || stored === 'dark')
      return stored
  }
  catch { /* storage may be blocked */ }
  const attr = document.documentElement.getAttribute('data-theme')

  return (attr === 'light' || attr === 'dark') ? attr : null
}

/** Keep raw CSS tokens, Vuetify, and persistence on one shared theme value. */
export function useAlphaTheme(controller: VuetifyThemeController) {
  if (!resolved) {
    sharedTheme.value = storedTheme() ?? (controller.global.current.value.dark ? 'dark' : 'light')
    resolved = true
  }

  const stop = watch(sharedTheme, value => {
    controller.global.name.value = value

    if (typeof window === 'undefined')
      return

    document.documentElement.setAttribute('data-theme', value)
    try { localStorage.setItem('alphapos-theme', value) }
    catch { /* storage may be blocked */ }
  }, { immediate: true })

  onScopeDispose(stop)

  function setTheme(value: AlphaTheme) {
    sharedTheme.value = value
  }

  function toggleTheme() {
    setTheme(sharedTheme.value === 'dark' ? 'light' : 'dark')
  }

  return {
    theme: computed(() => sharedTheme.value),
    setTheme,
    toggleTheme,
  }
}
