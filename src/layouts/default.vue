<script setup lang="ts">
import DesignSidebar from '@/layouts/components/DesignSidebar.vue'
import DesignTopbar from '@/layouts/components/DesignTopbar.vue'

/* ============================================================
   Alpha POS — default layout
   Mirrors App() shell from
   .tmp-alpha-design/alpha-design-source/App.shell.jsx:
     <div class="app">
       <Sidebar collapsed ... />
       <div class="main">
         <Topbar showDate dateRange ... />
         <main>{Page}</main>
       </div>
     </div>
   ============================================================ */

const collapsed = ref(false)
const dateRange = ref('14d')

// Apply data-theme attr on mount so design-shell.css [data-theme="dark"]
// rules kick in immediately on first paint.
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
   regardless of which page is rendered. */
main.page-shell {
  flex: 1;
  padding: var(--sp-5, 20px) var(--sp-6, 24px);
  min-width: 0;
  display: flex;
  flex-direction: column;
}
main.page-shell > .page {
  padding: 0;
  width: 100%;
}

@media (max-width: 900px) {
  main.page-shell { padding: var(--sp-4) var(--sp-4); }
}
@media (max-width: 600px) {
  main.page-shell { padding: var(--sp-3) var(--sp-3); }
}
@media (max-width: 420px) {
  main.page-shell { padding: var(--sp-2) var(--sp-3); }
}

.fade-enter-active, .fade-leave-active { transition: opacity .15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
