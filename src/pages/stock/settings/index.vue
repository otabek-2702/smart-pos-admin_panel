<script setup lang="ts">
import axios from '@axios'

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
  { title: 'FIFO', value: 'FIFO' },
  { title: 'LIFO', value: 'LIFO' },
  { title: 'AVG', value: 'AVG' },
]

const orderStatuses = [
  { title: t('Order Created'), value: 'CREATED' },
  { title: t('Preparing'), value: 'PREPARING' },
  { title: t('Ready'), value: 'READY' },
  { title: t('Paid'), value: 'PAID' },
]

async function loadSettings() {
  loading.value = true
  try {
    const res = await axios.get('/settings/')
    const d = res.data
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
    <VRow>
      <!-- General -->
      <VCol cols="12" md="6">
        <VCard>
          <VCardTitle>{{ t('General') }}</VCardTitle>
          <VCardText>
            <VSwitch v-model="form.stock_enabled" :label="t('Stock Enabled')" color="primary" class="mb-2" />
            <VSwitch v-model="form.multi_location_enabled" :label="t('Multi Location')" color="primary" class="mb-2" />
            <VSwitch v-model="form.allow_negative_stock" :label="t('Allow Negative Stock')" color="primary" />
          </VCardText>
        </VCard>
      </VCol>

      <!-- Tracking -->
      <VCol cols="12" md="6">
        <VCard>
          <VCardTitle>{{ t('Tracking') }}</VCardTitle>
          <VCardText>
            <VSwitch v-model="form.track_cost" :label="t('Track Cost')" color="primary" class="mb-2" />
            <VSwitch v-model="form.track_batches" :label="t('Track Batches')" color="primary" class="mb-2" />
            <VSwitch v-model="form.track_expiry" :label="t('Track Expiry')" color="primary" class="mb-2" />
            <VSwitch v-model="form.track_serial_numbers" :label="t('Track Serial Numbers')" color="primary" class="mb-2" />
            <VSelect
              v-model="form.costing_method"
              :items="costingMethods"
              :label="t('Costing Method')"
              density="compact"
              class="mt-2"
            />
            <VSwitch v-model="form.include_waste_in_cost" :label="t('Include Waste in Cost')" color="primary" />
          </VCardText>
        </VCard>
      </VCol>

      <!-- Auto Actions -->
      <VCol cols="12" md="6">
        <VCard>
          <VCardTitle>{{ t('Auto Actions') }}</VCardTitle>
          <VCardText>
            <VSwitch v-model="form.auto_deduct_on_sale" :label="t('Auto Deduct on Sale')" color="primary" class="mb-2" />
            <VSelect
              v-model="form.deduct_on_order_status"
              :items="orderStatuses"
              :label="t('Deduct on Order Status')"
              density="compact"
              class="mb-2"
            />
            <VSwitch v-model="form.reserve_on_order_create" :label="t('Reserve on Order Create')" color="primary" class="mb-2" />
            <VSwitch v-model="form.auto_create_production" :label="t('Auto Create Production')" color="primary" />
          </VCardText>
        </VCard>
      </VCol>

      <!-- Modules -->
      <VCol cols="12" md="6">
        <VCard>
          <VCardTitle>{{ t('Modules') }}</VCardTitle>
          <VCardText>
            <VSwitch v-model="form.production_enabled" :label="t('Production Enabled')" color="primary" class="mb-2" />
            <VSwitch v-model="form.purchasing_enabled" :label="t('Purchasing Enabled')" color="primary" />
          </VCardText>
        </VCard>
      </VCol>

      <!-- Alerts -->
      <VCol cols="12" md="6">
        <VCard>
          <VCardTitle>{{ t('Alerts') }}</VCardTitle>
          <VCardText>
            <VSwitch v-model="form.low_stock_alert_enabled" :label="t('Low Stock Alert')" color="primary" class="mb-2" />
            <VSwitch v-model="form.expiry_alert_enabled" :label="t('Expiry Alert')" color="primary" class="mb-2" />
            <VTextField
              v-model.number="form.expiry_alert_days"
              :label="t('Expiry Alert Days')"
              type="number"
              :min="1"
              density="compact"
              class="mb-2"
            />
            <VSwitch v-model="form.negative_stock_alert" :label="t('Negative Stock Alert')" color="primary" />
          </VCardText>
        </VCard>
      </VCol>

      <!-- Approvals -->
      <VCol cols="12" md="6">
        <VCard>
          <VCardTitle>{{ t('Approvals') }}</VCardTitle>
          <VCardText>
            <VSwitch v-model="form.require_po_approval" :label="t('Require PO Approval')" color="primary" class="mb-2" />
            <VSwitch v-model="form.require_transfer_approval" :label="t('Require Transfer Approval')" color="primary" class="mb-2" />
            <VSwitch v-model="form.require_adjustment_approval" :label="t('Require Adjustment Approval')" color="primary" class="mb-2" />
            <VSwitch v-model="form.require_count_approval" :label="t('Require Count Approval')" color="primary" />
          </VCardText>
        </VCard>
      </VCol>

      <!-- Save -->
      <VCol cols="12" class="d-flex justify-end">
        <VBtn :loading="saving" size="large" @click="saveSettings">{{ t('Save Settings') }}</VBtn>
      </VCol>
    </VRow>

    <VSnackbar v-model="snackbar" :color="snackbarColor" :timeout="3000">{{ snackbarMsg }}</VSnackbar>
  </div>
</template>

<route lang="yaml">
name: stock-settings
meta:
  action: manage
  subject: all
</route>
