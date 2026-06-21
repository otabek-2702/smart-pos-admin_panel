<script setup lang="ts">
import { stockApi as axios } from '@/plugins/axios'

const { t } = useI18n({ useScope: 'global' })

const loading = ref(false)
const saving = ref(false)

const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()

const form = ref({
  // General
  stock_enabled: true,
  multi_location_enabled: false,
  allow_negative_stock: true,

  // Tracking
  track_cost: true,
  track_batches: true,
  track_expiry: false,
  track_serial_numbers: false,
  costing_method: 'FIFO',

  // Auto Actions
  auto_deduct_on_sale: true,
  deduct_on_order_status: 'PREPARING',
  reserve_on_order_create: false,
  auto_create_production: false,

  // Modules
  production_enabled: false,
  purchasing_enabled: false,

  // Alerts
  low_stock_alert_enabled: true,
  expiry_alert_enabled: true,
  expiry_alert_days: 7,
  negative_stock_alert: true,

  // Approvals
  require_po_approval: false,
  require_transfer_approval: false,
  require_adjustment_approval: false,
  require_count_approval: true,

  // Extra
  include_waste_in_cost: true,
})

const costingMethods = [
  { title: t('costing_FIFO'), value: 'FIFO' },
  { title: t('costing_LIFO'), value: 'LIFO' },
  { title: t('costing_AVERAGE'), value: 'AVERAGE' },
  { title: t('costing_SPECIFIC'), value: 'SPECIFIC' },
]

const orderStatuses = [
  { title: t('deduct_on_CREATED'), value: 'CREATED' },
  { title: t('deduct_on_PREPARING'), value: 'PREPARING' },
  { title: t('deduct_on_READY'), value: 'READY' },
  { title: t('deduct_on_PAID'), value: 'PAID' },
]

async function loadSettings() {
  loading.value = true
  try {
    const res = await axios.get('/settings/')
    const d = res.data?.data ?? res.data

    Object.keys(form.value).forEach(key => {
      if (d[key] !== undefined)
        (form.value as any)[key] = d[key]
    })
  }
  catch {
    notify(t('Failed to load settings'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function saveSettings() {
  saving.value = true
  try {
    await axios.put('/settings/', form.value)
    notify(t('Settings saved'))
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error saving settings'), 'error')
  }
  finally {
    saving.value = false
  }
}

onMounted(loadSettings)
</script>

<template>
  <div>
    <div class="page-head">
      <div style="min-width:0;">
        <h1 class="page-head__title">{{ t('Stock Settings') }}</h1>
        <div class="page-head__subtitle">{{ t('Configure stock tracking, alerts, modules, and approvals') }}</div>
      </div>
      <div class="page-head__actions" />
    </div>
    <VRow>
      <!-- General -->
      <VCol
        cols="12"
        md="6"
      >
        <VCard>
          <VCardTitle>{{ t('General') }}</VCardTitle>
          <VCardText>
            <VSwitch
              v-model="form.stock_enabled"
              :label="t('Stock Enabled')"
              color="primary"
              class="mb-2"
            />
            <VSwitch
              v-model="form.multi_location_enabled"
              :label="t('Multi Location')"
              color="primary"
              class="mb-2"
            />
            <VSwitch
              v-model="form.allow_negative_stock"
              :label="t('Allow Negative Stock')"
              color="primary"
            />
          </VCardText>
        </VCard>
      </VCol>

      <!-- Tracking -->
      <VCol
        cols="12"
        md="6"
      >
        <VCard>
          <VCardTitle>{{ t('Tracking') }}</VCardTitle>
          <VCardText>
            <VSwitch
              v-model="form.track_cost"
              :label="t('Track Cost')"
              color="primary"
              class="mb-2"
            />
            <VSwitch
              v-model="form.track_batches"
              :label="t('Track Batches')"
              color="primary"
              class="mb-2"
            />
            <VSwitch
              v-model="form.track_expiry"
              :label="t('Track Expiry')"
              color="primary"
              class="mb-2"
            />
            <VSwitch
              v-model="form.track_serial_numbers"
              :label="t('Track Serial Numbers')"
              color="primary"
              class="mb-2"
            />
            <VSelect
              v-model="form.costing_method"
              :items="costingMethods"
              :label="t('Costing Method')"
              density="compact"
              class="mt-2"
            />
            <VSwitch
              v-model="form.include_waste_in_cost"
              :label="t('Include Waste in Cost')"
              color="primary"
            />
          </VCardText>
        </VCard>
      </VCol>

      <!-- Auto Actions -->
      <VCol
        cols="12"
        md="6"
      >
        <VCard>
          <VCardTitle>{{ t('Auto Actions') }}</VCardTitle>
          <VCardText>
            <VSwitch
              v-model="form.auto_deduct_on_sale"
              :label="t('Auto Deduct on Sale')"
              color="primary"
              class="mb-2"
            />
            <VSelect
              v-model="form.deduct_on_order_status"
              :items="orderStatuses"
              :label="t('Deduct on Order Status')"
              density="compact"
              class="mb-2"
            />
            <VSwitch
              v-model="form.reserve_on_order_create"
              :label="t('Reserve on Order Create')"
              color="primary"
              class="mb-2"
            />
            <VSwitch
              v-model="form.auto_create_production"
              :label="t('Auto Create Production')"
              color="primary"
            />
          </VCardText>
        </VCard>
      </VCol>

      <!-- Modules -->
      <VCol
        cols="12"
        md="6"
      >
        <VCard>
          <VCardTitle>{{ t('Modules') }}</VCardTitle>
          <VCardText>
            <VSwitch
              v-model="form.production_enabled"
              :label="t('Production Enabled')"
              color="primary"
              class="mb-2"
            />
            <VSwitch
              v-model="form.purchasing_enabled"
              :label="t('Purchasing Enabled')"
              color="primary"
            />
          </VCardText>
        </VCard>
      </VCol>

      <!-- Alerts -->
      <VCol
        cols="12"
        md="6"
      >
        <VCard>
          <VCardTitle>{{ t('Alerts') }}</VCardTitle>
          <VCardText>
            <VSwitch
              v-model="form.low_stock_alert_enabled"
              :label="t('Low Stock Alert')"
              color="primary"
              class="mb-2"
            />
            <VSwitch
              v-model="form.expiry_alert_enabled"
              :label="t('Expiry Alert')"
              color="primary"
              class="mb-2"
            />
            <VTextField
              v-model.number="form.expiry_alert_days"
              :label="t('Expiry Alert Days')"
              type="number"
              :min="1"
              density="compact"
              class="mb-2"
            />
            <VSwitch
              v-model="form.negative_stock_alert"
              :label="t('Negative Stock Alert')"
              color="primary"
            />
          </VCardText>
        </VCard>
      </VCol>

      <!-- Approvals -->
      <VCol
        cols="12"
        md="6"
      >
        <VCard>
          <VCardTitle>{{ t('Approvals') }}</VCardTitle>
          <VCardText>
            <VSwitch
              v-model="form.require_po_approval"
              :label="t('Require PO Approval')"
              color="primary"
              class="mb-2"
            />
            <VSwitch
              v-model="form.require_transfer_approval"
              :label="t('Require Transfer Approval')"
              color="primary"
              class="mb-2"
            />
            <VSwitch
              v-model="form.require_adjustment_approval"
              :label="t('Require Adjustment Approval')"
              color="primary"
              class="mb-2"
            />
            <VSwitch
              v-model="form.require_count_approval"
              :label="t('Require Count Approval')"
              color="primary"
            />
          </VCardText>
        </VCard>
      </VCol>

      <!-- Save -->
      <VCol
        cols="12"
        class="d-flex justify-end"
      >
        <VBtn
          :loading="saving"
          size="large"
          @click="saveSettings"
        >
          {{ t('Save Settings') }}
        </VBtn>
      </VCol>
    </VRow>

    <VSnackbar
      v-model="snackbar"
      :color="snackbarColor"
      :timeout="3000"
    >
      {{ snackbarMsg }}
    </VSnackbar>
  </div>
</template>

<style scoped>
.page-head__title {
  overflow-wrap: anywhere;
  word-break: break-word;
}
.page-head__subtitle {
  overflow-wrap: anywhere;
}

@media (max-width: 768px) {
  .page-head {
    flex-wrap: wrap;
    gap: 8px;
  }
  .page-head__title {
    font-size: 18px;
    line-height: 1.3;
  }
  .page-head__subtitle {
    font-size: 12px;
  }
  /* Compact card padding on phone */
  :deep(.v-card-title) {
    padding-inline: 12px;
    padding-block: 12px 8px;
    font-size: 15px;
  }
  :deep(.v-card-text) {
    padding: 12px;
  }
  /* Ensure inputs and selects don't overflow */
  :deep(.v-field),
  :deep(.v-input) {
    max-width: 100%;
    min-width: 0;
  }
  /* Save button stretches full width on mobile for easier tap */
  :deep(.d-flex.justify-end) {
    justify-content: stretch !important;
  }
  :deep(.d-flex.justify-end .v-btn) {
    inline-size: 100%;
  }
}

@media (max-width: 420px) {
  :deep(.v-card-title) {
    padding-inline: 10px;
    font-size: 14px;
  }
  :deep(.v-card-text) {
    padding: 10px;
  }
}
</style>

<route lang="yaml">
name: stock-settings
meta:
  action: manage
  subject: all
</route>
