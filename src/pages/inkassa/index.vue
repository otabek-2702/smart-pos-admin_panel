<script setup lang="ts">
import axios from '@axios'
import DataTableFooter from '@core/components/DataTableFooter.vue'

const { t } = useI18n({ useScope: 'global' })
const { formatCurrency, formatDate } = useFormatters()
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()

const balance = ref<any>(null)
const stats = ref<any>(null)
const loading = ref(true)

// History
const historyItems = ref<any[]>([])
const historyTotal = ref(0)
const historyLoading = ref(false)
const historyPage = ref(1)
const historyPerPage = ref(10)
const historyDateFrom = ref('')
const historyDateTo = ref('')

// Perform dialog
const performDialog = ref(false)
const performLoading = ref(false)
const performAmount = ref<number | null>(null)
const performNotes = ref('')

const historyHeaders = [
  { title: t('Date'), key: 'created_at', sortable: false },
  { title: t('Amount'), key: 'amount', sortable: false },
  { title: t('Notes'), key: 'notes', sortable: false },
]

async function loadData() {
  loading.value = true
  try {
    const [balRes, statsRes] = await Promise.allSettled([
      axios.get('/inkassa/balance'),
      axios.get('/inkassa/stats'),
    ])
    if (balRes.status === 'fulfilled') balance.value = balRes.value.data?.data ?? balRes.value.data
    if (statsRes.status === 'fulfilled') stats.value = statsRes.value.data?.data ?? statsRes.value.data
  }
  finally {
    loading.value = false
  }
}

async function loadHistory() {
  historyLoading.value = true
  try {
    const params: any = { page: historyPage.value, per_page: historyPerPage.value }
    if (historyDateFrom.value) params.date_from = historyDateFrom.value
    if (historyDateTo.value) params.date_to = historyDateTo.value
    const res = await axios.get('/inkassa/history', { params })
    const d = res.data?.data ?? res.data
    historyItems.value = d.inkassas ?? []
    historyTotal.value = d.pagination?.total_inkassas ?? historyItems.value.length
  }
  catch {
    notify(t('Failed to load inkassa history'), 'error')
  }
  finally {
    historyLoading.value = false
  }
}

function openPerformDialog() {
  performAmount.value = null
  performNotes.value = ''
  performDialog.value = true
}

async function performInkassa() {
  if (!performAmount.value || performAmount.value <= 0) {
    notify(t('Amount is required'), 'error')
    return
  }
  performLoading.value = true
  try {
    await axios.post('/inkassa/perform', {
      amount: performAmount.value,
      notes: performNotes.value,
    })
    notify(t('Inkassa performed successfully'), 'success')
    performDialog.value = false
    loadData()
    loadHistory()
  }
  catch {
    notify(t('Error performing inkassa'), 'error')
  }
  finally {
    performLoading.value = false
  }
}

onMounted(() => { loadData(); loadHistory() })
watch([historyPage, historyPerPage], loadHistory)
watch([historyDateFrom, historyDateTo], () => {
  historyPage.value = 1
  loadHistory()
})
</script>

<template>
  <div>
    <VRow class="mb-4">
      <VCol
        cols="12"
        sm="6"
        lg="4"
      >
        <VCard :loading="loading">
          <VCardText class="d-flex align-center gap-4">
            <VAvatar
              color="success"
              variant="tonal"
              size="56"
              rounded
            >
              <VIcon
                icon="bx-wallet"
                size="32"
              />
            </VAvatar>
            <div>
              <div class="text-h5 font-weight-bold">
                {{ balance ? formatCurrency(balance.balance ?? balance.total ?? 0) : '…' }}
              </div>
              <div class="text-body-2 text-disabled">
                {{ t('Cash Balance') }}
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol
        v-if="stats"
        cols="12"
        sm="6"
        lg="4"
      >
        <VCard>
          <VCardText class="d-flex align-center gap-4">
            <VAvatar
              color="primary"
              variant="tonal"
              size="56"
              rounded
            >
              <VIcon
                icon="bx-receipt"
                size="32"
              />
            </VAvatar>
            <div>
              <div class="text-h5 font-weight-bold">
                {{ stats.summary?.total_orders ?? '—' }}
              </div>
              <div class="text-body-2 text-disabled">
                {{ t('Total Orders') }}
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol
        v-if="stats"
        cols="12"
        sm="6"
        lg="4"
      >
        <VCard>
          <VCardText class="d-flex align-center gap-4">
            <VAvatar
              color="info"
              variant="tonal"
              size="56"
              rounded
            >
              <VIcon
                icon="bx-trending-up"
                size="32"
              />
            </VAvatar>
            <div>
              <div class="text-h5 font-weight-bold">
                {{ stats.summary?.total_revenue ? formatCurrency(stats.summary.total_revenue) : '—' }}
              </div>
              <div class="text-body-2 text-disabled">
                {{ t('Total Revenue') }}
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Extra stats if available -->
    <VCard
      v-if="stats"
      :title="t('Inkassa Statistics')"
    >
      <VCardText>
        <VRow>
          <VCol
            v-for="(val, key) in stats.summary"
            :key="key"
            cols="6"
            sm="4"
            md="3"
          >
            <div class="text-body-2 text-disabled">
              {{ String(key).replace(/_/g, ' ') }}
            </div>
            <div class="text-body-1 font-weight-medium">
              {{ typeof val === 'number' ? formatCurrency(val) : val }}
            </div>
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <!-- Inkassa History -->
    <VCard class="mt-4">
      <VCardText class="d-flex flex-wrap gap-3 align-center">
        <span class="text-h6">{{ t('Inkassa History') }}</span>
        <VSpacer />
        <VTextField
          v-model="historyDateFrom"
          type="date"
          :label="t('From')"
          density="compact"
          hide-details
          style="max-inline-size: 170px;"
          clearable
        />
        <VTextField
          v-model="historyDateTo"
          type="date"
          :label="t('To')"
          density="compact"
          hide-details
          style="max-inline-size: 170px;"
          clearable
        />
        <VBtn prepend-icon="bx-plus" @click="openPerformDialog">{{ t('Perform Inkassa') }}</VBtn>
        <VBtn variant="tonal" prepend-icon="bx-refresh" @click="loadHistory">{{ t('Refresh') }}</VBtn>
      </VCardText>

      <VDataTableServer
        :headers="historyHeaders"
        :items="historyItems"
        :items-length="historyTotal"
        :loading="historyLoading"
        :items-per-page="historyPerPage"
        :page="historyPage"
      >
        <template #bottom>
          <DataTableFooter
            v-model:page="historyPage"
            v-model:items-per-page="historyPerPage"
            :total-items="historyTotal"
          />
        </template>

        <template v-if="historyLoading && historyItems.length === 0" #body>
          <tr v-for="n in historyPerPage" :key="n" class="sk-row">
            <td class="sk-cell"><div class="sk-box" style="width:130px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:100px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:180px;height:13px;border-radius:4px;" /></td>
          </tr>
        </template>

        <template #item.created_at="{ item }">
          <span class="text-body-2">{{ formatDate(item.raw.created_at) }}</span>
        </template>
        <template #item.amount="{ item }">
          <span class="font-weight-medium">{{ formatCurrency(item.raw.amount) }}</span>
        </template>
        <template #item.notes="{ item }">
          <span class="text-body-2 text-disabled">{{ item.raw.notes || '—' }}</span>
        </template>
      </VDataTableServer>
    </VCard>

    <!-- Perform Inkassa Dialog -->
    <VDialog v-model="performDialog" max-width="480" persistent>
      <VCard :title="t('Perform Inkassa')">
        <VCardText>
          <VTextField
            v-model.number="performAmount"
            :label="t('Amount')"
            type="number"
            class="mb-4"
          />
          <VTextarea
            v-model="performNotes"
            :label="t('Notes')"
            rows="3"
          />
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn variant="text" @click="performDialog = false">{{ t('Cancel') }}</VBtn>
          <VBtn color="primary" :loading="performLoading" @click="performInkassa">{{ t('Confirm') }}</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VSnackbar v-model="snackbar" :color="snackbarColor" :timeout="3000">{{ snackbarMsg }}</VSnackbar>
  </div>
</template>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>
