<script setup lang="ts">
/**
 * AppSkeleton — reusable page-level loading skeleton.
 *
 * Usage:
 *   <AppSkeleton v-if="loading" :stat-cards="4" :table-rows="8" />
 *   <div v-else>...real content...</div>
 *
 * Props:
 *   statCards  — how many stat-card skeletons to show in the top row (0 = none)
 *   tableRows  — how many skeleton rows to show in the table card (default 6)
 */
withDefaults(defineProps<{
  statCards?: number
  tableRows?: number
}>(), {
  statCards: 0,
  tableRows: 6,
})
</script>

<template>
  <div>
    <!-- ── Stat cards row ── -->
    <VRow
      v-if="statCards > 0"
      class="mb-4"
    >
      <VCol
        v-for="n in statCards"
        :key="n"
        cols="6"
        :sm="Math.floor(12 / statCards)"
      >
        <VCard>
          <VCardText class="d-flex align-center gap-3">
            <!-- icon placeholder -->
            <VSkeletonLoader
              type="avatar"
              width="40"
              height="40"
              class="flex-shrink-0"
            />
            <!-- number + label placeholders -->
            <div style="flex: 1; min-width: 0;">
              <VSkeletonLoader
                type="heading"
                width="56"
                height="22"
                class="mb-1"
              />
              <VSkeletonLoader
                type="text"
                width="80"
                height="14"
              />
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- ── Table card (only when tableRows > 0) ── -->
    <VCard v-if="tableRows > 0">
      <!-- toolbar skeleton -->
      <VCardText class="d-flex flex-wrap gap-3 align-center">
        <VSkeletonLoader
          type="chip"
          width="240"
          height="36"
        />
        <VSkeletonLoader
          type="chip"
          width="160"
          height="36"
        />
        <VSpacer />
        <VSkeletonLoader
          type="button"
          width="148"
          height="36"
        />
      </VCardText>

      <!-- table header skeleton -->
      <VSkeletonLoader type="table-thead" />

      <!-- table row skeletons -->
      <VSkeletonLoader
        v-for="n in tableRows"
        :key="n"
        type="table-row-divider"
      />
    </VCard>
  </div>
</template>
