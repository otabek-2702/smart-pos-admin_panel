<script setup lang="ts">
import DesignSidebar from '@/layouts/components/DesignSidebar.vue'
import DesignTopbar from '@/layouts/components/DesignTopbar.vue'
import MobileTabBar from '@/layouts/components/MobileTabBar.vue'

const collapsed = ref(false)
const drawerOpen = ref(false)
const dateRange = ref('14d')

function onToggleSidebar() {
  if (window.innerWidth <= 768)
    drawerOpen.value = !drawerOpen.value
  else
    collapsed.value = !collapsed.value
}

onMounted(() => {
  const saved = localStorage.getItem('alphapos-theme')
  if (saved === 'light' || saved === 'dark')
    document.documentElement.setAttribute('data-theme', saved)
})
</script>

<template>
  <div class="app" :class="{ 'drawer-open': drawerOpen }">
    <DesignSidebar
      :collapsed="collapsed"
      :open="drawerOpen"
      @close="drawerOpen = false"
      @nav-go="drawerOpen = false"
    />
    <div
      class="nav-scrim"
      @click="drawerOpen = false"
    />
    <div class="main">
      <DesignTopbar
        v-model:date-range="dateRange"
        @toggle-sidebar="onToggleSidebar"
      />
      <main class="page-shell">
        <RouterView v-slot="{ Component }">
          <Transition name="fade" mode="out-in">
            <Component :is="Component" :date-range="dateRange" />
          </Transition>
        </RouterView>
      </main>
    </div>
    <MobileTabBar
      :drawer-open="drawerOpen"
      @more="drawerOpen = !drawerOpen"
    />
  </div>
</template>

<style>
main.page-shell {
  flex: 1;
  padding: var(--sp-4, 16px) var(--sp-5, 20px);
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
