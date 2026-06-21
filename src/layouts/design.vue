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

.fade-enter-active, .fade-leave-active { transition: opacity .15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
