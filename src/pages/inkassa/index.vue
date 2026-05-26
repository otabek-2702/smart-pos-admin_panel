<script setup lang="ts">
import { hrApi as axios } from '@/plugins/axios'
import DataTableFooter from '@core/components/DataTableFooter.vue'

const { t } = useI18n({ useScope: 'global' })
const { formatCurrency, formatDate } = useFormatters()
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()

const balance = ref<any>(null)
const loading = ref(true)

const historyItems = ref<any[]>([])
const historyTotal = ref(0)
const historyLoading = ref(false)
const historyPage = ref(1)
const historyPerPage = ref(10)

// Action dialog (deposit / withdraw)
const actionDialog = ref(false)
const actionLoading = ref(false)
const actionMode = ref<'deposit' | 'withdraw'>('deposit')
const actionAmount = ref<number | null>(null)
const actionNotes = ref('')

const historyHeaders = [
  { title: t('Date'), key: 'created_at', sortable: false },
  { title: t('Type'), key: 'transaction_type', sortable: false },
  { title: t('Amount'), key: 'amount', sortable: false },
  { title: t('Notes'), key: 'description', sortable: false },
]

async function loadBalance() {
  loading.value = true
  try {
    const res = await axios.get('/cash/balance/')

    balance.value = res.data?.data ?? res.data
  }
  catch {
    /* tolerate missing endpoint */
  }
  finally {
    loading.value = false
  }
}

async function loadHistory() {
  historyLoading.value = true
  try {
    const params: any = { page: historyPage.value, per_page: historyPerPage.value }
    const res = await axios.get('/cash/', { params })
    const d = res.data?.data ?? res.data

    historyItems.value = d.transactions ?? d.items ?? []
    historyTotal.value = d.pagination?.total_items ?? d.pagination?.total ?? historyItems.value.length
  }
  catch {
    notify(t('Failed to load history'), 'error')
  }
  finally {
    historyLoading.value = false
  }
}

function openDialog(mode: 'deposit' | 'withdraw') {
  actionMode.value = mode
  actionAmount.value = null
  actionNotes.value = ''
  actionDialog.value = true
}

async function submitAction() {
  if (!actionAmount.value || actionAmount.value <= 0) {
    notify(t('Amount is required'), 'error')

    return
  }
  actionLoading.value = true
  try {
    await axios.post(`/cash/${actionMode.value}/`, {
      amount: actionAmount.value,
      description: actionNotes.value,
    })
    notify(t(actionMode.value === 'deposit' ? 'Deposit successful' : 'Withdraw successful'))
    actionDialog.value = false
    loadBalance()
    loadHistory()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    actionLoading.value = false
  }
}

onMounted(() => { loadBalance(); loadHistory() })
watch([historyPage, historyPerPage], loadHistory)
</script>

<template>
  <div>
    <VRow class="mb-4">
      <VCol
        cols="12"
        sm="4"
      >
        <VCard>
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
              <div
                v-if="balance"
                class="text-h5 font-weight-bold"
              >
                {{ formatCurrency(balance.current_balance ?? balance.balance ?? 0) }}
              </div>
              <div
                v-else
                class="sk-box mb-1"
                style="width:120px;height:24px;border-radius:4px;"
              />
              <div class="text-body-2 text-disabled">
                {{ t('Cash Balance') }}
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        sm="4"
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
                icon="bx-down-arrow-circle"
                size="32"
              />
            </VAvatar>
            <div>
              <div
                v-if="balance"
                class="text-h5 font-weight-bold"
              >
                {{ formatCurrency(balance.totals_by_type?.DEPOSIT ?? balance.total_deposits ?? 0) }}
              </div>
              <div
                v-else
                class="sk-box mb-1"
                style="width:120px;height:24px;border-radius:4px;"
              />
              <div class="text-body-2 text-disabled">
                {{ t('Total Deposits') }}
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        sm="4"
      >
        <VCard>
          <VCardText class="d-flex align-center gap-4">
            <VAvatar
              color="warning"
              variant="tonal"
              size="56"
              rounded
            >
              <VIcon
                icon="bx-up-arrow-circle"
                size="32"
              />
            </VAvatar>
            <div>
              <div
                v-if="balance"
                class="text-h5 font-weight-bold"
              >
                {{ formatCurrency(balance.totals_by_type?.WITHDRAW ?? balance.total_withdrawals ?? 0) }}
              </div>
              <div
                v-else
                class="sk-box mb-1"
                style="width:120px;height:24px;border-radius:4px;"
              />
              <div class="text-body-2 text-disabled">
                {{ t('Total Withdrawals') }}
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <VCard>
      <VCardText class="d-flex flex-wrap gap-3 align-center">
        <span class="text-h6">{{ t('Cash History') }}</span>
        <VSpacer />
        <VBtn
          color="success"
          prepend-icon="bx-plus"
          @click="openDialog('deposit')"
        >
          {{ t('Deposit') }}
        </VBtn>
        <VBtn
          color="warning"
          prepend-icon="bx-minus"
          @click="openDialog('withdraw')"
        >
          {{ t('Withdraw') }}
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
                style="width:80px;height:22px;border-radius:12px;"
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
          <span class="text-body-2">{{ formatDate(item.raw.created_at) }}</span>
        </template>
        <template #item.transaction_type="{ item }">
          <VChip
            size="small"
            :color="item.raw.transaction_type === 'DEPOSIT' || item.raw.amount > 0 ? 'success' : 'warning'"
            variant="tonal"
          >
            {{ item.raw.transaction_type ?? (item.raw.amount > 0 ? 'DEPOSIT' : 'WITHDRAW') }}
          </VChip>
        </template>
        <template #item.amount="{ item }">
          <span class="font-weight-medium">{{ formatCurrency(Math.abs(item.raw.amount)) }}</span>
        </template>
        <template #item.description="{ item }">
          <span class="text-body-2 text-disabled">{{ item.raw.description || item.raw.notes || '—' }}</span>
        </template>
      </VDataTableServer>
    </VCard>

    <VDialog
      v-model="actionDialog"
      max-width="480"
      persistent
    >
      <VCard :title="actionMode === 'deposit' ? t('Deposit') : t('Withdraw')">
        <VCardText>
          <VTextField
            v-model.number="actionAmount"
            :label="t('Amount')"
            type="number"
            class="mb-4"
            autofocus
          />
          <VTextarea
            v-model="actionNotes"
            :label="t('Notes')"
            rows="3"
          />
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            @click="actionDialog = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            :color="actionMode === 'deposit' ? 'success' : 'warning'"
            :loading="actionLoading"
            @click="submitAction"
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
