import { useI18n } from 'vue-i18n'
import { createVuetify } from 'vuetify'
import { en, ru, uz } from 'vuetify/locale'
import { createVueI18nAdapter } from 'vuetify/locale/adapters/vue-i18n'
import { VBtn } from 'vuetify/components/VBtn'
import { VDataTable, VDataTableServer } from 'vuetify/labs/VDataTable'
import { VSkeletonLoader } from 'vuetify/labs/VSkeletonLoader'
import i18n from '@/plugins/i18n'
import defaults from './defaults'
import { icons } from './icons'
import theme from './theme'

// Styles
import '@core/scss/template/libs/vuetify/index.scss'
import 'vuetify/styles'

// Inject Vuetify's built-in locale messages under a `$vuetify` namespace
// so its components ("No data available", "Items per page:", etc.) translate
// alongside our app strings.
const vuetifyLocales: Record<string, any> = { en, ru, uz }
for (const [code, pack] of Object.entries(vuetifyLocales)) {
  const existing = (i18n.global.getLocaleMessage(code) as any) || {}
  i18n.global.setLocaleMessage(code, { ...existing, $vuetify: pack })
}

export default createVuetify({
  aliases: {
    IconBtn: VBtn,
  },
  components: {
    VDataTable,
    VDataTableServer,
    VSkeletonLoader,
  },
  defaults,
  icons,
  theme,
  locale: {
    adapter: createVueI18nAdapter({ i18n, useI18n }),
  },
})
