<script setup lang="ts">
import axios from '@/plugins/axios'
import DataTableFooter from '@core/components/DataTableFooter.vue'

const { t } = useI18n({ useScope: 'global' })
const { formatCurrency } = useFormatters()
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()

function isoDay(offset = 0) {
  const d = new Date()

  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

const dateFrom = ref(isoDay(-30))
const dateTo = ref(isoDay(0))
const cogsFraction = ref(0.35)
const loading = ref(false)
const data = ref<any>(null)

const page = ref(1)
const itemsPerPage = ref(20)
const classFilter = ref<string | undefined>(undefined)

const classColor: Record<string, string> = {
  Star: 'success',
  Plowhorse: 'info',
  Puzzle: 'warning',
  Dog: 'error',
}

const classIcon: Record<string, string> = {
  Star: 'bx-star',
  Plowhorse: 'bx-trending-up',
  Puzzle: 'bx-question-mark',
  Dog: 'bx-trending-down',
}

async function load() {
  loading.value = true
  try {
    const res = await axios.get('/analytics/menu-engineering', {
      params: { from: dateFrom.value, to: dateTo.value, cogs_fraction: cogsFraction.value },
    })

    data.value = res.data?.data ?? res.data
    page.value = 1
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Failed to load'), 'error')
  }
  finally {
    loading.value = false
  }
}

onMounted(load)

const summary = computed(() => data.value?.summary ?? null)

const items = computed(() => {
  const all = data.value?.items ?? []
  if (!classFilter.value)
    return all
  return all.filter((i: any) => i.class === classFilter.value)
})

const paginated = computed(() => {
  const start = (page.value - 1) * itemsPerPage.value
  return items.value.slice(start, start + itemsPerPage.value)
})

const headers = computed(() => [
  { title: t('Class'), key: 'class', sortable: false, width: '120px' },
  { title: t('Product'), key: 'product_name', sortable: false },
  { title: t('Price'), key: 'price', sortable: false },
  { title: t('Sold'), key: 'qty_sold', sortable: false },
  { title: t('Revenue'), key: 'revenue', sortable: false },
  { title: t('Margin/unit'), key: 'margin_per_unit', sortable: false },
  { title: t('Profit'), key: 'profit', sortable: false },
])
</script>

<template>
  <div>
    <div class="page-head">
      <div style="min-width:0;">
        <h1 class="page-head__title">{{ t('Menu Engineering') }}</h1>
        <div class="page-head__subtitle">{{ dateFrom }} — {{ dateTo }}</div>
      </div>
    </div>

    <VCard class="mb-4">
      <VCardText class="d-flex flex-wrap gap-3 align-center">
        <VTextField
          v-model="dateFrom"
          type="date"
          :label="t('From')"
          density="compact"
          hide-details
          style="max-inline-size:170px;"
        />
        <VTextField
          v-model="dateTo"
          type="date"
          :label="t('To')"
          density="compact"
          hide-details
          style="max-inline-size:170px;"
        />
        <VTextField
          v-model.number="cogsFraction"
          :label="t('COGS fraction')"
          type="number"
          step="0.05"
          density="compact"
          hide-details
          style="max-inline-size:160px;"
        />
        <VBtn
          color="primary"
          prepend-icon="bx-search-alt"
          :loading="loading"
          @click="load"
        >
          {{ t('Analyze') }}
        </VBtn>
      </VCardText>
    </VCard>

    <VRow
      v-if="summary"
      class="mb-4"
    >
      <VCol
        v-for="(klass, key) in { Star: summary.stars, Plowhorse: summary.plowhorses, Puzzle: summary.puzzles, Dog: summary.dogs }"
        :key="key"
        cols="6"
        sm="3"
      >
        <div
          class="kpi-card cursor-pointer"
          :style="classFilter === key ? `border-color: rgb(var(--v-theme-${classColor[key]})); border-width: 2px;` : ''"
          @click="classFilter = classFilter === key ? undefined : (key as string)"
        >
          <div class="kpi-card__top">
            <div
              class="kpi-card__icon"
              :class="{
                't-success': classColor[key] === 'success',
                't-info': classColor[key] === 'info',
                't-warning': classColor[key] === 'warning',
                't-error': classColor[key] === 'error',
              }"
            >
              <VIcon :icon="classIcon[key]" size="20" />
            </div>
            <div class="kpi-card__label">{{ t(key as string) }}</div>
          </div>
          <div class="kpi-card__value num-tabular">{{ klass }}</div>
        </div>
      </VCol>
    </VRow>

    <VCard>
      <VCardText class="d-flex align-center gap-3 py-3">
        <VSpacer />
        <VChip
          v-if="classFilter"
          class="status-pill"
          closable
          @click:close="classFilter = undefined"
        >
          {{ t('Class') }}: {{ t(classFilter as string) }}
        </VChip>
        <span
          v-if="summary"
          class="text-caption text-disabled"
        >
          {{ summary.window_days }} {{ t('days') }} · {{ t('avg qty') }}: {{ summary.avg_qty }}
        </span>
      </VCardText>

      <VDataTable
        :headers="headers"
        :items="paginated"
        :loading="loading"
        :items-per-page="itemsPerPage"
        hide-default-footer
      >
        <template #bottom>
          <DataTableFooter
            v-model:page="page"
            v-model:items-per-page="itemsPerPage"
            :total-items="items.length"
          />
        </template>

        <template #item.class="{ item }">
          <VChip
            class="status-pill"
            size="small"
            :color="classColor[item.raw.class] ?? 'default'"
            variant="tonal"
            :prepend-icon="classIcon[item.raw.class]"
          >
            {{ t(item.raw.class) }}
          </VChip>
        </template>
        <template #item.price="{ item }">
          <span class="num-tabular">{{ formatCurrency(item.raw.price) }}</span>
        </template>
        <template #item.revenue="{ item }">
          <span class="num-tabular">{{ formatCurrency(item.raw.revenue) }}</span>
        </template>
        <template #item.margin_per_unit="{ item }">
          <span class="num-tabular">{{ formatCurrency(item.raw.margin_per_unit) }}</span>
          <span class="text-caption text-disabled">({{ item.raw.margin_pct }}%)</span>
        </template>
        <template #item.profit="{ item }">
          <span class="font-weight-medium num-tabular">{{ formatCurrency(item.raw.profit) }}</span>
        </template>
      </VDataTable>
    </VCard>

    <VSnackbar
      v-model="snackbar"
      :color="snackbarColor"
      :timeout="3000"
    >
      {{ snackbarMsg }}
    </VSnackbar>
  </div>
</template>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>
