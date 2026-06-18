<script setup lang="ts">
import axios from '@/plugins/axios'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()

const loading = ref(false)
const data = ref<any>(null)
const error = ref<string>('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await axios.get('/forecast/tomorrow')

    data.value = res.data?.data ?? res.data
  }
  catch (e: any) {
    const msg = e?.response?.data?.message ?? t('Forecast unavailable')

    error.value = msg
    notify(msg, 'error')
  }
  finally {
    loading.value = false
  }
}

onMounted(load)

const predictions = computed(() => data.value?.predictions ?? [])
const reason = computed(() => data.value?.reason)
const maxQty = computed(() => Math.max(...predictions.value.map((p: any) => p.predicted_quantity ?? 0), 1))
</script>

<template>
  <div>
    <div class="page-head">
      <div style="min-width:0;">
        <h1 class="page-head__title">{{ t('Demand Forecast') }}</h1>
        <div class="page-head__subtitle">{{ t('What to prep tomorrow morning, based on last 30 days') }}</div>
      </div>
      <div class="page-head__actions">
        <VBtn
          variant="tonal"
          prepend-icon="bx-refresh"
          :loading="loading"
          @click="load"
        >
          {{ t('Recalculate') }}
        </VBtn>
      </div>
    </div>

    <VAlert
      v-if="reason === 'no_history'"
      type="info"
      variant="tonal"
      class="mb-4"
    >
      {{ t('Not enough order history yet. Forecast will appear once you have ~30 days of orders.') }}
    </VAlert>

    <VAlert
      v-else-if="error"
      type="warning"
      variant="tonal"
      class="mb-4"
    >
      {{ error }}
    </VAlert>

    <VCard v-else>
      <VCardText>
        <template v-if="loading && predictions.length === 0">
          <div
            v-for="n in 8"
            :key="n"
            class="d-flex align-center gap-3 py-2"
          >
            <div
              class="sk-box"
              style="width:200px;height:14px;border-radius:4px;"
            />
            <div
              class="sk-box flex-grow-1"
              style="height:8px;border-radius:4px;"
            />
            <div
              class="sk-box"
              style="width:60px;height:14px;border-radius:4px;"
            />
          </div>
        </template>
        <template v-else-if="predictions.length">
          <div
            v-for="p in predictions"
            :key="p.product_id"
            class="d-flex align-center gap-3 py-2"
            style="border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);"
          >
            <div style="min-width: 200px;">
              <div class="text-body-2 font-weight-medium">
                {{ p.product_name }}
              </div>
              <div
                v-if="p.confidence"
                class="text-caption text-disabled"
              >
                {{ t('Confidence') }}: {{ p.confidence }}
              </div>
            </div>
            <div class="flex-grow-1">
              <VProgressLinear
                :model-value="((p.predicted_quantity ?? 0) / maxQty) * 100"
                :color="p.predicted_quantity > maxQty * 0.7 ? 'success' : p.predicted_quantity > maxQty * 0.3 ? 'info' : 'default'"
                height="8"
                rounded
              />
            </div>
            <div
              class="text-end"
              style="min-width: 80px;"
            >
              <span class="text-h6 font-weight-bold num-tabular">{{ p.predicted_quantity }}</span>
              <div class="text-caption text-disabled">
                {{ t('units') }}
              </div>
            </div>
          </div>
        </template>
        <div
          v-else
          class="text-center text-disabled py-8"
        >
          <VIcon
            icon="bx-bulb"
            size="48"
            class="mb-2"
          />
          <div>{{ t('No forecast available') }}</div>
        </div>
      </VCardText>
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
