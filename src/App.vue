<script setup lang="ts">
import { useTheme } from 'vuetify'
import { Toaster } from 'vue-sonner'
import 'vue-sonner/style.css'
import CommandPalette from '@/components/design/CommandPalette.vue'
import ShortcutHelp from '@/components/design/ShortcutHelp.vue'
import ScrollToTop from '@core/components/ScrollToTop.vue'
import { useThemeConfig } from '@core/composable/useThemeConfig'
import { hexToRgb } from '@layouts/utils'
import { useUserAccess } from '@/composables/useUserAccess'

const { isOperator, refresh: refreshAccess } = useUserAccess()
const route = useRoute()

watch(() => route.fullPath, refreshAccess, { flush: 'sync' })

const { syncInitialLoaderTheme, syncVuetifyThemeWithTheme: syncConfigThemeWithVuetifyTheme, isAppRtl, handleSkinChanges } = useThemeConfig()

const { global } = useTheme()

// ℹ️ Sync current theme with initial loader theme
syncInitialLoaderTheme()
syncConfigThemeWithVuetifyTheme()
handleSkinChanges()

// Tell vue-sonner whether we're in dark/light so its CSS vars flip with the rest of the app.
const sonnerTheme = computed<'dark' | 'light'>(() => global.current.value.dark ? 'dark' : 'light')
</script>

<template>
  <VLocaleProvider :rtl="isAppRtl">
    <!-- ℹ️ This is required to set the background color of active nav link based on currently active global theme's primary -->
    <VApp :style="`--v-global-theme-primary: ${hexToRgb(global.current.value.colors.primary)}`">
      <RouterView />
      <ScrollToTop v-if="!isOperator && route.path !== '/login'" />
      <!-- Global Cmd/Ctrl+K command palette (mount-once; listens at the window level). -->
      <CommandPalette v-if="!isOperator && route.path !== '/login'" />
      <!-- Global "?" key opens keyboard-shortcut reference. -->
      <ShortcutHelp v-if="!isOperator && route.path !== '/login'" />
      <!-- vue-sonner: replaces the per-page VSnackbar plumbing. useNotify() now dispatches to toast(). -->
      <Toaster
        :theme="sonnerTheme"
        rich-colors
        close-button
        position="bottom-right"
        :duration="3500"
        :toast-options="{ style: { zIndex: 3000 } }"
      />
    </VApp>
  </VLocaleProvider>
</template>
