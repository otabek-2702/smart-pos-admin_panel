<script setup lang="ts">
import { fiscalApi as axios } from '@/plugins/axios'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatDate, formatCurrency } = useFormatters()

const status = ref<any>(null)
const receipts = ref<any[]>([])
const loading = ref(false)
const receiptsLoading = ref(false)
const statusFilter = ref<string | undefined>(undefined)
const testing = ref(false)
const retrying = ref(false)
const savingMode = ref(false)

async function loadStatus() {
  loading.value = true
  try {
    const res = await axios.get('/status')

    status.value = res.data?.data ?? res.data
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Failed to load status'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function loadReceipts() {
  receiptsLoading.value = true
  try {
    const params: any = {}
    if (statusFilter.value)
      params.status = statusFilter.value
    const res = await axios.get('/receipts', { params })
    const d = res.data?.data ?? res.data

    receipts.value = d?.receipts ?? d?.items ?? []
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Failed to load receipts'), 'error')
  }
  finally {
    receiptsLoading.value = false
  }
}

async function setMode(mode: string) {
  if (mode === status.value?.mode)
    return
  savingMode.value = true
  try {
    const res = await axios.post('/mode', { mode })

    status.value = res.data?.data ?? res.data
    notify(t('Mode updated'))
    await loadStatus()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    savingMode.value = false
  }
}

async function runTest() {
  testing.value = true
  try {
    const res = await axios.post('/test')
    const ok = res.data?.success
    const msg = res.data?.message ?? (ok ? t('Test OK') : t('Test failed'))

    notify(msg, ok ? 'success' : 'error')
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Test failed'), 'error')
  }
  finally {
    testing.value = false
  }
}

async function retryFailed() {
  retrying.value = true
  try {
    const res = await axios.post('/retry')
    const d = res.data?.data ?? res.data
    const retried = d?.retried ?? d?.count ?? 0

    notify(`${t('Retried')}: ${retried}`)
    await Promise.all([loadStatus(), loadReceipts()])
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    retrying.value = false
  }
}

async function fiscalizeOrder(receipt: any) {
  if (!receipt.order_id) {
    notify(t('No order linked to this receipt'), 'error')

    return
  }
  try {
    await axios.post(`/orders/${receipt.order_id}/fiscalize`)
    notify(t('Sent for fiscalization'))
    await Promise.all([loadStatus(), loadReceipts()])
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}

onMounted(() => { loadStatus(); loadReceipts() })
watch(statusFilter, loadReceipts)

const receiptStatusColor: Record<string, string> = {
  PENDING: 'warning',
  SENT: 'info',
  CONFIRMED: 'success',
  FAILED: 'error',
}

const modeColor: Record<string, string> = {
  off: 'default',
  mock: 'info',
  live: 'success',
}

const statusFilterItems = computed(() => [
  { title: t('fiscal_receipt_status_PENDING'), value: 'PENDING' },
  { title: t('fiscal_receipt_status_SENT'), value: 'SENT' },
  { title: t('fiscal_receipt_status_CONFIRMED'), value: 'CONFIRMED' },
  { title: t('fiscal_receipt_status_FAILED'), value: 'FAILED' },
  { title: t('fiscal_receipt_status_SKIPPED'), value: 'SKIPPED' },
])
</script>

<template>
  <div>
    <div class="page-head">
      <div style="min-width:0;">
        <h1 class="page-head__title">{{ t('Fiscalization') }}</h1>
        <div class="page-head__subtitle">{{ t('Provider') }}: {{ status?.provider ?? '—' }} · {{ t('TIN') }}: {{ status?.tin ?? '—' }}</div>
      </div>
      <div class="page-head__actions" />
    </div>

    <!-- Status strip -->
    <VRow class="mb-4">
      <VCol cols="12" md="4">
        <VCard>
          <VCardText>
            <div class="text-caption text-disabled">{{ t('Mode') }}</div>
            <div class="d-flex align-center gap-2">
              <VChip
                v-if="status?.mode"
                class="status-pill"
                :color="modeColor[status.mode] ?? 'default'"
                variant="tonal"
                size="large"
              >
                {{ t(`fiscal_mode_${String(status.mode).toUpperCase()}`) }}
              </VChip>
              <span v-else class="sk-box d-inline-block" style="width:80px;height:24px;border-radius:4px;" />
            </div>
            <div class="text-caption text-disabled mt-2">{{ t('Provider') }}: {{ status?.provider ?? '—' }}</div>
            <div class="text-caption text-disabled">{{ t('TIN') }}: {{ status?.tin ?? '—' }}</div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol cols="6" md="2">
        <div class="kpi-card">
          <div class="kpi-card__top">
            <div class="kpi-card__icon t-success"><VIcon icon="bx-check-circle" size="20" /></div>
            <div class="kpi-card__label">{{ t('Confirmed') }}</div>
          </div>
          <div class="kpi-card__value num-tabular">{{ status?.confirmed ?? status?.stats?.CONFIRMED ?? 0 }}</div>
        </div>
      </VCol>
      <VCol cols="6" md="2">
        <div class="kpi-card">
          <div class="kpi-card__top">
            <div class="kpi-card__icon t-warning"><VIcon icon="bx-time" size="20" /></div>
            <div class="kpi-card__label">{{ t('Pending') }}</div>
          </div>
          <div class="kpi-card__value num-tabular">{{ status?.pending ?? status?.stats?.PENDING ?? 0 }}</div>
        </div>
      </VCol>
      <VCol cols="6" md="2">
        <div class="kpi-card">
          <div class="kpi-card__top">
            <div class="kpi-card__icon t-info"><VIcon icon="bx-send" size="20" /></div>
            <div class="kpi-card__label">{{ t('Sent') }}</div>
          </div>
          <div class="kpi-card__value num-tabular">{{ status?.sent ?? status?.stats?.SENT ?? 0 }}</div>
        </div>
      </VCol>
      <VCol cols="6" md="2">
        <div class="kpi-card">
          <div class="kpi-card__top">
            <div class="kpi-card__icon t-error"><VIcon icon="bx-x-circle" size="20" /></div>
            <div class="kpi-card__label">{{ t('Failed') }}</div>
          </div>
          <div class="kpi-card__value num-tabular">{{ status?.failed ?? status?.stats?.FAILED ?? 0 }}</div>
        </div>
      </VCol>
    </VRow>

    <!-- Controls -->
    <VCard class="mb-4">
      <VCardText class="d-flex flex-wrap align-center gap-3">
        <span class="text-h6">{{ t('Fiscalization') }}</span>
        <VSpacer />
        <VBtnToggle
          :model-value="status?.mode ?? 'off'"
          variant="outlined"
          density="compact"
          color="primary"
          mandatory
          :disabled="savingMode"
        >
          <VBtn size="small" value="off" @click="setMode('off')">{{ t('Off') }}</VBtn>
          <VBtn size="small" value="mock" @click="setMode('mock')">{{ t('Mock') }}</VBtn>
          <VBtn size="small" value="live" @click="setMode('live')">{{ t('Live') }}</VBtn>
        </VBtnToggle>
        <VBtn
          variant="tonal"
          prepend-icon="bx-test-tube"
          :loading="testing"
          @click="runTest"
        >
          {{ t('Run test') }}
        </VBtn>
        <VBtn
          variant="tonal"
          color="warning"
          prepend-icon="bx-refresh"
          :loading="retrying"
          @click="retryFailed"
        >
          {{ t('Retry failed') }}
        </VBtn>
      </VCardText>
    </VCard>

    <!-- Receipts -->
    <VCard>
      <VCardText class="d-flex align-center gap-3 py-3 flex-wrap">
        <span class="text-h6">{{ t('Receipts') }}</span>
        <VSpacer />
        <VSelect
          v-model="statusFilter"
          :items="statusFilterItems"
          item-title="title"
          item-value="value"
          :placeholder="t('Status')"
          density="compact"
          hide-details
          clearable
          style="min-inline-size:160px;"
        />
        <VBtn
          icon
          variant="text"
          @click="loadReceipts"
        >
          <VIcon icon="bx-refresh" />
        </VBtn>
      </VCardText>
      <VProgressLinear
        v-if="receiptsLoading"
        indeterminate
      />
      <VTable density="compact">
        <thead>
          <tr>
            <th>#</th>
            <th>{{ t('Order') }}</th>
            <th>{{ t('Type') }}</th>
            <th>{{ t('Status') }}</th>
            <th class="text-end">{{ t('Total') }}</th>
            <th>{{ t('Fiscal sign') }}</th>
            <th>{{ t('QR') }}</th>
            <th>{{ t('Created') }}</th>
            <th>{{ t('Error') }}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in receipts"
            :key="r.id"
          >
            <td>{{ r.id }}</td>
            <td>
              <span v-if="r.order_id">#{{ r.order_id }}</span>
              <span v-else class="text-disabled">—</span>
            </td>
            <td>{{ r.receipt_type ?? '—' }}</td>
            <td>
              <VChip class="status-pill" size="x-small" :color="receiptStatusColor[r.status] ?? 'default'" variant="tonal">
                {{ r.status }}
              </VChip>
            </td>
            <td class="text-end num-tabular">{{ formatCurrency(r.total ?? 0) }}</td>
            <td class="text-caption">{{ r.fiscal_sign ?? '—' }}</td>
            <td>
              <a
                v-if="r.qr_url"
                :href="r.qr_url"
                target="_blank"
                rel="noopener"
              >
                <VIcon icon="bx-qr" size="18" />
              </a>
              <span v-else class="text-disabled">—</span>
            </td>
            <td class="text-caption">{{ formatDate(r.created_at) }}</td>
            <td class="text-caption text-error">{{ r.error ?? r.last_error ?? '—' }}</td>
            <td>
              <VBtn
                v-if="r.order_id && (r.status === 'FAILED' || r.status === 'PENDING')"
                icon
                variant="text"
                size="x-small"
                color="primary"
                @click="fiscalizeOrder(r)"
              >
                <VIcon icon="bx-refresh" size="16" />
                <VTooltip activator="parent" location="top">{{ t('Re-send') }}</VTooltip>
              </VBtn>
            </td>
          </tr>
          <tr v-if="!receipts.length && !receiptsLoading">
            <td colspan="10" class="text-center text-disabled py-4">
              {{ t('No receipts yet') }}
            </td>
          </tr>
        </tbody>
      </VTable>
    </VCard>

    <VSnackbar v-model="snackbar" :color="snackbarColor" :timeout="3000">
      {{ snackbarMsg }}
    </VSnackbar>
  </div>
</template>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>
