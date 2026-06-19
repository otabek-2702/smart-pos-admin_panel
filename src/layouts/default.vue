<script setup lang="ts">
import DesignSidebar from '@/layouts/components/DesignSidebar.vue'
import DesignTopbar from '@/layouts/components/DesignTopbar.vue'

const collapsed = ref(false)
const dateRange = ref('14d')

// Apply data-theme attr on mount so the design's [data-theme="dark"] CSS rules kick in.
onMounted(() => {
  const saved = localStorage.getItem('alphapos-theme')
  if (saved === 'light' || saved === 'dark')
    document.documentElement.setAttribute('data-theme', saved)
})
</script>

<template>
  <div class="app">
    <DesignSidebar :collapsed="collapsed" />
    <div class="main">
      <DesignTopbar
        v-model:date-range="dateRange"
        @toggle-sidebar="collapsed = !collapsed"
      />
      <main class="page-shell">
        <RouterView v-slot="{ Component }">
          <Transition name="fade" mode="out-in">
            <Component :is="Component" :date-range="dateRange" />
          </Transition>
        </RouterView>
      </main>
    </div>
  </div>
</template>

<style>
/* NOT scoped — page-shell wraps the routed page, so its rule must apply
   regardless of which page is rendered. Same selector lives globally. */
main.page-shell {
  flex: 1;
  /* Generous breathing room: 32px top/bottom · 40px left/right. */
  padding: var(--sp-7, 32px) var(--sp-8, 40px);
  min-width: 0;
  display: flex;
  flex-direction: column;
}
/* Pages built with their own .page wrapper (dashboard, shifts-analytics)
   already provide padding + max-width; cancel the outer padding so they
   don't double up. */
main.page-shell > .page {
  padding: 0;
  max-width: 1440px;
  margin: 0 auto;
}

@media (max-width: 900px) {
  main.page-shell { padding: var(--sp-5) var(--sp-5); }
}
@media (max-width: 600px) {
  main.page-shell { padding: var(--sp-4) var(--sp-4); }
}
@media (max-width: 420px) {
  main.page-shell { padding: var(--sp-3) var(--sp-3); }
}

.fade-enter-active, .fade-leave-active { transition: opacity .15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
