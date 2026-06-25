<script setup lang="ts">
// ============================================================
// ALPHA POS - KpiSkel primitive
// Ported verbatim from .tmp-handoff-v3/pos-admin-panel/project/app/ui.jsx (lines 230-239)
// Shared loading placeholder for KPI cards (full & mini variants).
// ============================================================
import Skeleton from './Skeleton.vue'

interface Props {
  mini?: boolean
}

withDefaults(defineProps<Props>(), {
  mini: false,
})
</script>

<template>
  <div class="kpi">
    <div
      v-if="!mini"
      class="kpi__top"
    >
      <Skeleton
        :w="38"
        :h="38"
        :r="8"
      />
      <Skeleton
        :w="90"
        :h="13"
      />
    </div>
    <Skeleton
      v-if="mini"
      :w="70"
      :h="13"
      :style="{ marginBottom: '10px' }"
    />
    <Skeleton
      :w="mini ? 90 : 140"
      :h="mini ? 24 : 30"
    />
    <Skeleton
      v-if="!mini"
      :w="80"
      :h="18"
      :style="{ marginTop: '12px', borderRadius: '99px' }"
    />
  </div>
</template>
