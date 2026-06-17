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

<style scoped>
.page-shell {
  /* Default padding for every routed page. Generous breathing room around
     the content so pages don't hug the topbar or the sidebar edge — same
     gap on every page makes the layout feel uniform. */
  flex: 1;
  padding: var(--sp-7) var(--sp-8);  /* 32px top/bottom · 40px left/right */
  min-width: 0;
  /* Allow pages whose root sets block-size: 100% (e.g. chat layouts) to fill
     the full content area. Children get a definite height via flex:1. */
  display: flex;
  flex-direction: column;
}
.page-shell > * {
  /* Pages that don't explicitly fill take only the height their content
     needs; pages that want to fill set block-size:100% themselves. */
  width: 100%;
}
.page-shell > :deep(.page) {
  /* Pages built with their own .page wrapper (dashboard, shifts-analytics)
     already provide padding + max-width; cancel the outer padding so they
     don't double up. */
  padding: 0;
  max-width: 1440px;
  margin: 0 auto;
}

.fade-enter-active, .fade-leave-active { transition: opacity .15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
