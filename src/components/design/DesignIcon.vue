<script lang="ts">
// ============================================================
// ALPHA POS - icon set (stroke, 24px grid, currentColor)
// Ported verbatim from .tmp-alpha-design/alpha-design-source/icons.jsx
// ============================================================

export const ICON_PATHS: Record<string, string> = {
  dashboard: '<path d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm9 0h7v-9h-7v9Zm0-16v5h7V4h-7Z"/>',
  ai: '<rect x="4.5" y="7" width="15" height="12" rx="3"/><path d="M12 7V4M9 12h.01M15 12h.01M9.5 16h5"/><path d="M2.5 12.5v2M21.5 12.5v2"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 6.2a3 3 0 0 1 0 5.6M21 19a5 5 0 0 0-3.5-4.8"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.6"/><rect x="13" y="4" width="7" height="7" rx="1.6"/><rect x="4" y="13" width="7" height="7" rx="1.6"/><rect x="13" y="13" width="7" height="7" rx="1.6"/>',
  box: '<path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z"/><path d="m4 7 8 4 8-4M12 11v10"/>',
  receipt: '<path d="M6 3.5h12v17l-2.2-1.5-2.3 1.5-2.2-1.5L9 20.5l-2.3-1.5L4.5 20.5V3.5H6Z"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>',
  table: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M9 9.5v10M15 9.5v10"/>',
  tag: '<path d="M4 4h7l9 9-7 7-9-9V4Z"/><circle cx="8" cy="8" r="1.4"/>',
  register: '<rect x="3.5" y="9" width="17" height="11" rx="2"/><path d="M7 9V5.5A1.5 1.5 0 0 1 8.5 4h7A1.5 1.5 0 0 1 17 5.5V9M8 13h3M14 13h2M8 16.5h8"/>',
  gift: '<rect x="4" y="9" width="16" height="11" rx="1.6"/><path d="M3 9h18M12 9v11M12 9c-1-3-3.5-4-4.5-3s0 3 4.5 3Zm0 0c1-3 3.5-4 4.5-3s0 3-4.5 3Z"/>',
  employee: '<circle cx="12" cy="8" r="3.4"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/>',
  building: '<rect x="5" y="3.5" width="14" height="17" rx="1.5"/><path d="M9 7.5h2M13 7.5h2M9 11h2M13 11h2M9 14.5h2M13 14.5h2M10 20.5v-3h4v3"/>',
  coins: '<ellipse cx="9" cy="7" rx="5.5" ry="2.8"/><path d="M3.5 7v5c0 1.5 2.5 2.8 5.5 2.8M14.5 11.5c2.8.3 5 1.4 5 2.8 0 1.6-2.7 2.9-6 2.9s-6-1.3-6-2.9M3.5 12c0 1.5 2.5 2.8 5.5 2.8"/>',
  chart: '<path d="M4 4v16h16"/><path d="M8 15l3-4 3 2 4-6"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.5-3.5"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z"/><path d="M10 19a2 2 0 0 0 4 0"/>',
  chevdown: '<path d="m6 9 6 6 6-6"/>',
  chevleft: '<path d="m15 6-6 6 6 6"/>',
  chevright: '<path d="m9 6 6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4L18.5 9.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M5 7h14M10 7V5h4v2M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  pause: '<rect x="7" y="5" width="3.5" height="14" rx="1"/><rect x="13.5" y="5" width="3.5" height="14" rx="1"/>',
  play: '<path d="M7 5l12 7-12 7V5Z"/>',
  dollar: '<path d="M12 3v18M16 7c0-1.7-1.8-3-4-3s-4 1.3-4 3 1.8 3 4 3 4 1.3 4 3-1.8 3-4 3-4-1.3-4-3"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12 5 5 9-11"/>',
  checkcircle: '<circle cx="12" cy="12" r="8.5"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  sortup: '<path d="m6 14 6-6 6 6"/>',
  sortdown: '<path d="m6 10 6 6 6-6"/>',
  sort: '<path d="M8 9l-3-3-3 3M5 6v12M16 15l3 3 3-3M19 18V6"/>',
  arrowup: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  arrowdown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3.5v4M16 3.5v4"/>',
  filter: '<path d="M4 5h16l-6 7v6l-4 2v-8L4 5Z"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14-5l-2 2M4 13a8 8 0 0 0 14 5l2-2"/><path d="M4 5v3.5h3.5M20 19v-3.5h-3.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5 3.5 3.5M20.5 20.5 19 19M19 5l1.5-1.5M3.5 20.5 5 19"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z"/>',
  layout: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9h17M9 9v10.5"/>',
  translate: '<path d="M4 6h9M8.5 4v2c0 4-2 7-5 8M6 9c0 2.5 3 5 7 6"/><path d="m12.5 20 3.5-8 3.5 8M14 17h4"/>',
  alert: '<path d="M12 4 3 19h18L12 4Z"/><path d="M12 10v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
  wallet: '<rect x="3.5" y="6" width="17" height="13" rx="2.5"/><path d="M3.5 10h17M16 13.5h1.5"/><path d="M17 6V4.5a1.5 1.5 0 0 0-2-1.4L5 6"/>',
  trend: '<path d="M3 16l6-6 4 4 8-9"/><path d="M21 9.5V5h-4.5"/>',
  package: '<path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z"/><path d="m4 7 8 4 8-4M12 11v10M8 5l8 4"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4 7 8 6 8-6"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/>',
  userok: '<circle cx="10" cy="8" r="3.4"/><path d="M4 20a6 6 0 0 1 12 0M16 12l2 2 3.5-3.5"/>',
  sliders: '<path d="M4 8h10M18 8h2M4 16h2M10 16h10"/><circle cx="16" cy="8" r="2.2"/><circle cx="8" cy="16" r="2.2"/>',
  inbox: '<path d="M4 13h4l1.5 2.5h5L16 13h4"/><path d="M4 13 6 5h12l2 8v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5Z"/>',
  dept: '<rect x="3.5" y="8" width="7" height="12" rx="1.4"/><rect x="13.5" y="4" width="7" height="16" rx="1.4"/><path d="M5.5 12h3M5.5 15.5h3M15.5 8h3M15.5 11.5h3M15.5 15h3"/>',
  store: '<path d="M4 9.5 5.5 5h13L20 9.5M4 9.5h16M4 9.5v9.5h16V9.5M4 9.5a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0M9 19v-5h4v5"/>',
  flag: '<path d="M6 21V4M6 4h11l-2 3 2 3H6"/>',
  star: '<path d="m12 4 2.4 5 5.6.7-4 3.8 1 5.5L12 16l-5 3 1-5.5-4-3.8 5.6-.7L12 4Z"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".6" fill="currentColor"/>',
  send: '<path d="M4.5 12 20 4l-4.5 16-3.5-6.5L4.5 12Z"/><path d="M12 13.5 20 4"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2.5"/>',
  sparkle: '<path d="M12 3l1.8 5L19 9.8 14 12l-2 5-2-5-5-2.2L10 8l2-5Z"/><path d="M19 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  belloff: '<path d="M6 9a6 6 0 0 1 8.5-5.4M18 13c0 2 1 3 1 3M6 9c0 5-2 6-2 6h12"/><path d="M10 19a2 2 0 0 0 4 0M3 3l18 18"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  pencil: '<path d="M4 20h4L18.5 9.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  retry: '<path d="M20 11a8 8 0 0 0-14-5l-2 2M4 13a8 8 0 0 0 14 5l2-2"/><path d="M4 5v3.5h3.5M20 19v-3.5h-3.5"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v2.4M12 19.1v2.4M21.5 12h-2.4M4.9 12H2.5M18.7 5.3l-1.7 1.7M7 17l-1.7 1.7M18.7 18.7 17 17M7 7 5.3 5.3"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  bars: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
  hourglass: '<path d="M7 4h10M7 20h10M8 4c0 4 8 4 8 8s-8 4-8 8M16 4c0 4-8 4-8 8s8 4 8 8"/>',
  share: '<circle cx="6" cy="12" r="2.4"/><circle cx="17" cy="6" r="2.4"/><circle cx="17" cy="18" r="2.4"/><path d="m8.2 10.8 6.6-3.6M8.2 13.2l6.6 3.6"/>',
}

export const ICON_NAMES: string[] = Object.keys(ICON_PATHS)
</script>

<script setup lang="ts">
interface Props {
  name: string
  size?: number
  weight?: number
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 18,
  weight: 1.8,
  class: '',
})

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()

function cx(...parts: Array<string | undefined | null | false>): string {
  return parts.filter(Boolean).join(' ')
}

const klass = computed(() => cx('ic', props.class, attrs.class as string | undefined))
const inner = computed(() => ICON_PATHS[props.name] || '')
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="weight"
    stroke-linecap="round"
    stroke-linejoin="round"
    :class="klass"
    v-html="inner"
  />
</template>
