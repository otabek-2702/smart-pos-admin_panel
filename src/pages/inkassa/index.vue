<script setup lang="ts">
import axios from '@/plugins/axios'
import DataTableFooter from '@core/components/DataTableFooter.vue'

const { t } = useI18n({ useScope: 'global' })
const { formatCurrency, formatDate } = useFormatters()
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()

const balance = ref<any>(null)
const stats = ref<any>(null)
const loading = ref(true)

const historyItems = ref<any[]>([])
const historyTotal = ref(0)
const historyLoading = ref(false)
const historyPage = ref(1)
const historyPerPage = ref(10)

const performDialog = ref(false)
const performLoading = ref(false)
const performAmounts = ref({ cash: 0, uzcard: 0, humo: 0, payme: 0 })
const performNotes = ref('')

const totalRemoved = computed(() =>
  Object.values(performAmounts.value).reduce((acc, v) => acc + (Number(v) || 0), 0),
)

const historyHeaders = [
  { title: t('Date'), key: 'created_at', sortable: false },
  { title: t('Cashier'), key: 'cashier', sortable: false },
  { title: t('Amount'), key: 'amount', sortable: false },
  { title: t('Notes'), key: 'notes', sortable: false },
]

async function loadBalance() {
  loading.value = true
  try {
    const [bal, st] = await Promise.allSettled([
      axios.get('/inkassa/balance'),
      axios.get('/inkassa/stats'),
    ])

    if (bal.status === 'fulfilled')
      balance.value = bal.value.data?.data ?? bal.value.data
    if (st.status === 'fulfilled')
      stats.value = (st.value.data?.data ?? st.value.data)?.stats ?? null
  }
  finally {
    loading.value = false
  }
}

async function loadHistory() {
  historyLoading.value = true
  try {
    const res = await axios.get('/inkassa/history', { params: { page: historyPage.value, per_page: historyPerPage.value } })
    const d = res.data?.data ?? res.data

    historyItems.value = d?.inkassas ?? []
    historyTotal.value = d?.pagination?.total_inkassas ?? d?.pagination?.total ?? historyItems.value.length
  }
  catch {
    notify(t('Failed to load history'), 'error')
  }
  finally {
    historyLoading.value = false
  }
}

function openPerform() {
  performAmounts.value = { cash: 0, uzcard: 0, humo: 0, payme: 0 }
  performNotes.value = ''
  performDialog.value = true
}

async function performInkassa() {
  if (totalRemoved.value <= 0) {
    notify(t('Amount is required'), 'error')

    return
  }
  performLoading.value = true
  try {
    // BE reads body directly as amounts dict + a `notes` key — NOT nested.
    await axios.post('/inkassa/perform', {
      cash: performAmounts.value.cash,
      uzcard: performAmounts.value.uzcard,
      humo: performAmounts.value.humo,
      payme: performAmounts.value.payme,
      notes: performNotes.value,
    })
    notify(t('Inkassa performed successfully'))
    performDialog.value = false
    await Promise.all([loadBalance(), loadHistory()])
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    performLoading.value = false
  }
}

onMounted(() => { loadBalance(); loadHistory() })
watch([historyPage, historyPerPage], loadHistory)
</script>

<template>
  <div>
    <div class="page-head">
      <div style="min-width:0;">
        <h1 class="page-head__title">{{ t('Inkassa') }}</h1>
        <div class="page-head__subtitle">{{ t('Cash Balance') }}</div>
      </div>
    </div>

    <VRow class="mb-4">
      <VCol cols="12" sm="6" lg="4">
        <div class="kpi-card">
          <div class="kpi-card__top">
            <div class="kpi-card__icon t-success"><VIcon icon="bx-wallet" size="20" /></div>
            <div class="kpi-card__label">{{ t('Cash Balance') }}</div>
          </div>
          <div v-if="balance" class="kpi-card__value num-tabular">
            {{ formatCurrency(balance.balance ?? 0) }}<span class="kpi-card__unit">UZS</span>
          </div>
          <div v-else class="sk-box mb-1" style="width:120px;height:24px;border-radius:4px;" />
        </div>
      </VCol>

      <VCol cols="12" sm="6" lg="4">
        <div class="kpi-card">
          <div class="kpi-card__top">
            <div class="kpi-card__icon t-primary"><VIcon icon="bx-trending-up" size="20" /></div>
            <div class="kpi-card__label">{{ t("Today's Revenue") }}</div>
          </div>
          <div v-if="stats" class="kpi-card__value num-tabular">
            {{ formatCurrency(stats.today?.total_revenue ?? 0) }}<span class="kpi-card__unit">UZS</span>
          </div>
          <div v-else class="sk-box mb-1" style="width:120px;height:24px;border-radius:4px;" />
        </div>
      </VCol>

      <VCol cols="12" sm="6" lg="4">
        <div class="kpi-card">
          <div class="kpi-card__top">
            <div class="kpi-card__icon t-info"><VIcon icon="bx-receipt" size="20" /></div>
            <div class="kpi-card__label">{{ t("Today's Orders") }}</div>
          </div>
          <div v-if="stats" class="kpi-card__value num-tabular">{{ stats.today?.order_count ?? 0 }}</div>
          <div v-else class="sk-box mb-1" style="width:60px;height:24px;border-radius:4px;" />
        </div>
      </VCol>
    </VRow>

    <VRow
      v-if="stats?.cashier_performance?.length"
      class="mb-4"
    >
      <VCol cols="12">
        <VCard :title="t('Cashier Performance (today)')">
          <VCardText>
            <div
              v-for="c in stats.cashier_performance"
              :key="c.cashier_id"
              class="d-flex align-center justify-space-between py-2"
              style="border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);"
            >
              <div class="d-flex align-center gap-2">
                <VAvatar
                  size="28"
                  color="primary"
                  variant="tonal"
                >
                  <span class="text-caption">{{ (c.cashier_name ?? '?')[0] }}</span>
                </VAvatar>
                <div>
                  <div class="text-body-2 font-weight-medium">
                    {{ c.cashier_name }}
                  </div>
                  <div class="text-caption text-disabled">
                    {{ c.order_count }} {{ t('Orders').toLowerCase() }}
                  </div>
                </div>
              </div>
              <span class="text-body-2 font-weight-medium text-success num-tabular">{{ formatCurrency(c.total_revenue) }}</span>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <VCard>
      <VCardText class="d-flex flex-wrap gap-3 align-center">
        <span class="text-h6">{{ t('Inkassa History') }}</span>
        <VSpacer />
        <VBtn
          color="primary"
          prepend-icon="bx-plus"
          @click="openPerform"
        >
          {{ t('Perform Inkassa') }}
        </VBtn>
        <VBtn
          variant="tonal"
          prepend-icon="bx-refresh"
          @click="loadHistory"
        >
          {{ t('Refresh') }}
        </VBtn>
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

        <template
          v-if="historyLoading && historyItems.length === 0"
          #body
        >
          <tr
            v-for="n in historyPerPage"
            :key="n"
            class="sk-row"
          >
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:130px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:120px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:100px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:180px;height:13px;border-radius:4px;"
              />
            </td>
          </tr>
        </template>

        <template #item.created_at="{ item }">
          {{ formatDate(item.raw.created_at) }}
        </template>
        <template #item.cashier="{ item }">
          {{ item.raw.cashier?.name ?? item.raw.cashier_name ?? '—' }}
        </template>
        <template #item.amount="{ item }">
          <span class="font-weight-medium num-tabular">{{ formatCurrency(item.raw.amount) }}</span>
        </template>
        <template #item.notes="{ item }">
          <span class="text-body-2 text-disabled">{{ item.raw.notes || '—' }}</span>
        </template>
      </VDataTableServer>
    </VCard>

    <VDialog
      v-model="performDialog"
      max-width="480"
      persistent
    >
      <VCard :title="t('Perform Inkassa')">
        <VCardText>
          <VRow>
            <VCol
              cols="6"
              sm="6"
            >
              <VTextField
                v-model.number="performAmounts.cash"
                :label="t('Cash')"
                type="number"
                min="0"
                autofocus
              />
            </VCol>
            <VCol
              cols="6"
              sm="6"
            >
              <VTextField
                v-model.number="performAmounts.uzcard"
                :label="t('Uzcard')"
                type="number"
                min="0"
              />
            </VCol>
            <VCol
              cols="6"
              sm="6"
            >
              <VTextField
                v-model.number="performAmounts.humo"
                :label="t('Humo')"
                type="number"
                min="0"
              />
            </VCol>
            <VCol
              cols="6"
              sm="6"
            >
              <VTextField
                v-model.number="performAmounts.payme"
                :label="t('Payme')"
                type="number"
                min="0"
              />
            </VCol>
          </VRow>
          <div class="d-flex justify-space-between mt-2 mb-3">
            <span class="text-body-2 text-disabled">{{ t('Total') }}</span>
            <span class="text-body-1 font-weight-bold num-tabular">{{ formatCurrency(totalRemoved) }}</span>
          </div>
          <VTextarea
            v-model="performNotes"
            :label="t('Notes')"
            rows="3"
          />
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            @click="performDialog = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            color="primary"
            :loading="performLoading"
            @click="performInkassa"
          >
            {{ t('Confirm') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

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
