/* eslint-disable import/order */
import '@/@iconify/icons-bundle'
import App from '@/App.vue'
import ability from '@/plugins/casl/ability'
import i18n from '@/plugins/i18n'
import layoutsPlugin from '@/plugins/layouts'
import vuetify from '@/plugins/vuetify'
import { loadFonts } from '@/plugins/webfontloader'
import router from '@/router'
import { abilitiesPlugin } from '@casl/vue'
import '@core/scss/template/index.scss'
import '@styles/styles.scss'
// vue-virtual-scroller — purely-structural CSS (no colors). Imported once
// globally so DynamicScroller / RecycleScroller in the AI thread render right.
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import * as Sentry from '@sentry/vue'

loadFonts()

// Create vue app
const app = createApp(App)

const sentryDsn = import.meta.env.VITE_SENTRY_DSN
if (sentryDsn) {
  Sentry.init({
    app,
    dsn: sentryDsn,
    // PII / replay / trace rates are opt-in via env so prod doesn't ship IPs
    // and 100% trace sampling by default. Defaults below match a sane prod.
    sendDefaultPii: import.meta.env.VITE_SENTRY_PII === 'true',
    integrations: [
      Sentry.browserTracingIntegration({ router }),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_RATE ?? 0.1),
    tracePropagationTargets: [/^\//, /\/api\/admins/],
    replaysSessionSampleRate: Number(import.meta.env.VITE_SENTRY_REPLAY_RATE ?? 0),
    replaysOnErrorSampleRate: 1.0,
  })
}

// Use plugins
app.use(vuetify)
app.use(createPinia())
app.use(router)
app.use(layoutsPlugin)
app.use(i18n)
app.use(abilitiesPlugin, ability, {
  useGlobalProperties: true,
})

// Mount vue app
app.mount('#app')
