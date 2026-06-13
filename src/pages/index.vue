<script setup lang="ts">
import axios from '@/plugins/axios'

const { t } = useI18n({ useScope: 'global' })
const { formatCurrency, formatDate } = useFormatters()
const router = useRouter()

const data = ref<any>(null)
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    const res = await axios.get('/dashboard/today')

    data.value = res.data?.data ?? res.data
  }
  finally {
    loading.value = false
  }
}

onMounted(load)

const today = computed(() => data.value?.today ?? null)
const topProducts = computed(() => data.value?.top_products_today ?? [])
const lowStock = computed(() => data.value?.low_stock_count ?? null)
const clockedIn = computed(() => data.value?.clocked_in ?? [])

const paidPercentage = computed(() => {
  if (!today.value)
    return 0
  const total = today.value.orders || 0
  if (!total)
    return 0
  return Math.round((today.value.paid_orders / total) * 100)
})

const avgOrderValue = computed(() => {
  if (!today.value)
    return 0
  const paid = today.value.paid_orders || 0
  const revenue = Number(today.value.revenue) || 0
  if (!paid)
    return 0
  return Math.round(revenue / paid)
})
</script>

<template>
  <div>
    <div class="page-head">
      <div style="min-width:0;">
        <h1 class="page-head__title">
          {{ t("Today's Snapshot") }}
        </h1>
        <div class="page-head__subtitle">
          {{ formatDate(new Date().toISOString()) }}
        </div>
      </div>
      <div class="page-head__actions">
        <VBtn
          variant="tonal"
          prepend-icon="bx-refresh"
          :loading="loading"
          @click="load"
        >
          {{ t('Refresh') }}
        </VBtn>
      </div>
    </div>

    <VRow class="mb-4">
      <VCol
        cols="12"
        sm="6"
        lg="3"
      >
        <div class="kpi-card">
          <div class="kpi-card__top">
            <div class="kpi-card__icon t-success">
              <VIcon icon="bx-money" size="20" />
            </div>
            <div class="kpi-card__label">
              {{ t("Today's Revenue") }}
            </div>
          </div>
          <div
            v-if="today"
            class="kpi-card__value"
          >
            {{ formatCurrency(today.revenue ?? 0) }}<span class="kpi-card__unit">UZS</span>
          </div>
          <div
            v-else
            class="sk-box"
            style="width:140px;height:32px;border-radius:4px;"
          />
        </div>
      </VCol>

      <VCol
        cols="12"
        sm="6"
        lg="3"
      >
        <div class="kpi-card">
          <div class="kpi-card__top">
            <div class="kpi-card__icon t-primary">
              <VIcon icon="bx-receipt" size="20" />
            </div>
            <div class="kpi-card__label">
              {{ t('Orders Today') }}
            </div>
          </div>
          <div
            v-if="today"
            class="kpi-card__value"
          >
            {{ today.orders ?? 0 }}
          </div>
          <div
            v-else
            class="sk-box"
            style="width:80px;height:32px;border-radius:4px;"
          />
        </div>
      </VCol>

      <VCol
        cols="12"
        sm="6"
        lg="3"
      >
        <div class="kpi-card">
          <div class="kpi-card__top">
            <div class="kpi-card__icon t-info">
              <VIcon icon="bx-trending-up" size="20" />
            </div>
            <div class="kpi-card__label">
              {{ t('Avg Order Value') }}
            </div>
          </div>
          <div
            v-if="today"
            class="kpi-card__value"
          >
            {{ formatCurrency(avgOrderValue) }}<span class="kpi-card__unit">UZS</span>
          </div>
          <div
            v-else
            class="sk-box"
            style="width:120px;height:32px;border-radius:4px;"
          />
        </div>
      </VCol>

      <VCol
        cols="12"
        sm="6"
        lg="3"
      >
        <div
          class="kpi-card"
          :class="{ 'cursor-pointer': lowStock && lowStock > 0 }"
          @click="lowStock && lowStock > 0 && router.push('/stock/items')"
        >
          <div class="kpi-card__top">
            <div
              class="kpi-card__icon"
              :class="lowStock && lowStock > 0 ? 't-warning' : 't-success'"
            >
              <VIcon icon="bx-package" size="20" />
            </div>
            <div class="kpi-card__label">
              {{ t('Low Stock Items') }}
            </div>
          </div>
          <div
            v-if="lowStock !== null"
            class="kpi-card__value"
          >
            {{ lowStock }}
          </div>
          <div
            v-else
            class="sk-box"
            style="width:60px;height:32px;border-radius:4px;"
          />
        </div>
      </VCol>
    </VRow>

    <VRow class="mb-4">
      <VCol
        cols="6"
        md="3"
      >
        <VCard>
          <VCardText class="text-center pa-3">
            <div
              v-if="today"
              class="text-h5 font-weight-bold text-primary"
            >
              {{ today.open ?? 0 }}
            </div>
            <div
              v-else
              class="sk-box mx-auto mb-1"
              style="width:30px;height:20px;border-radius:4px;"
            />
            <div class="text-caption text-disabled">
              {{ t('Open Orders') }}
            </div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol
        cols="6"
        md="3"
      >
        <VCard>
          <VCardText class="text-center pa-3">
            <div
              v-if="today"
              class="text-h5 font-weight-bold text-error"
            >
              {{ today.cancelled ?? 0 }}
            </div>
            <div
              v-else
              class="sk-box mx-auto mb-1"
              style="width:30px;height:20px;border-radius:4px;"
            />
            <div class="text-caption text-disabled">
              {{ t('Cancelled') }}
            </div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol
        cols="6"
        md="3"
      >
        <VCard>
          <VCardText class="text-center pa-3">
            <div
              v-if="today"
              class="text-h5 font-weight-bold text-success"
            >
              {{ paidPercentage }}%
            </div>
            <div
              v-else
              class="sk-box mx-auto mb-1"
              style="width:40px;height:20px;border-radius:4px;"
            />
            <div class="text-caption text-disabled">
              {{ t('Paid') }} ({{ today?.paid_orders ?? 0 }}/{{ today?.orders ?? 0 }})
            </div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol
        cols="6"
        md="3"
      >
        <VCard>
          <VCardText class="text-center pa-3">
            <div class="text-h5 font-weight-bold text-info">
              {{ clockedIn.length }}
            </div>
            <div class="text-caption text-disabled">
              {{ t('Clocked In') }}
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <VRow>
      <VCol
        cols="12"
        lg="7"
      >
        <VCard :title="t('Top Products Today')">
          <VCardText>
            <template v-if="topProducts.length">
              <div
                v-for="(p, idx) in topProducts"
                :key="p.product_id"
                class="d-flex align-center gap-3 py-2"
                style="border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);"
              >
                <VAvatar
                  size="32"
                  color="primary"
                  variant="tonal"
                >
                  <span class="text-caption font-weight-bold">{{ idx + 1 }}</span>
                </VAvatar>
                <div class="flex-grow-1">
                  <div class="text-body-2 font-weight-medium">
                    {{ p.product_name }}
                  </div>
                  <div class="text-caption text-disabled">
                    {{ p.quantity }} {{ t('sold') }}
                  </div>
                </div>
                <span class="text-body-2 font-weight-medium text-success">
                  {{ formatCurrency(p.revenue) }}
                </span>
              </div>
            </template>
            <template v-else-if="loading">
              <div
                v-for="n in 5"
                :key="n"
                class="d-flex gap-3 py-2"
              >
                <div
                  class="sk-box"
                  style="width:32px;height:32px;border-radius:50%;"
                />
                <div
                  class="sk-box flex-grow-1"
                  style="height:14px;border-radius:4px;"
                />
                <div
                  class="sk-box"
                  style="width:80px;height:14px;border-radius:4px;"
                />
              </div>
            </template>
            <div
              v-else
              class="text-center text-disabled py-4"
            >
              {{ t('No sales yet today') }}
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        lg="5"
      >
        <VCard :title="t('Clocked In')">
          <VCardText>
            <template v-if="clockedIn.length">
              <div
                v-for="s in clockedIn"
                :key="s.shift_id"
                class="d-flex align-center gap-3 py-2"
                style="border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);cursor:pointer;"
                @click="router.push('/shifts')"
              >
                <VAvatar
                  size="36"
                  color="success"
                  variant="tonal"
                >
                  <VIcon icon="bx-user" />
                </VAvatar>
                <div class="flex-grow-1">
                  <div class="text-body-2 font-weight-medium">
                    {{ s.name }}
                  </div>
                  <div class="text-caption text-disabled">
                    {{ t('Since') }} {{ formatDate(s.start_time) }}
                  </div>
                </div>
                <VIcon
                  icon="bx-chevron-right"
                  size="18"
                />
              </div>
            </template>
            <template v-else-if="loading">
              <div
                v-for="n in 3"
                :key="n"
                class="d-flex gap-3 py-2"
              >
                <div
                  class="sk-box"
                  style="width:36px;height:36px;border-radius:50%;"
                />
                <div class="flex-grow-1">
                  <div
                    class="sk-box mb-1"
                    style="width:120px;height:14px;border-radius:4px;"
                  />
                  <div
                    class="sk-box"
                    style="width:80px;height:11px;border-radius:4px;"
                  />
                </div>
              </div>
            </template>
            <div
              v-else
              class="text-center text-disabled py-4"
            >
              {{ t('No active shifts') }}
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </div>
</template>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>
