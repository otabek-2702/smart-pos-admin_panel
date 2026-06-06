<script setup lang="ts">
import { hrApi as axios } from '@/plugins/axios'
import DataTableFooter from '@core/components/DataTableFooter.vue'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatCurrency } = useFormatters()

const items = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const itemsPerPage = ref(20)
const summary = ref<any>(null)

const generateDialog = ref(false)
const generatePeriod = ref('')
const generating = ref(false)

const headers = [
  { title: t('Employee'), key: 'employee', sortable: false },
  { title: t('Period'), key: 'period', sortable: false },
  { title: t('Base'), key: 'base_salary', sortable: false },
  { title: t('Net'), key: 'net_salary', sortable: false },
  { title: t('Status'), key: 'status', sortable: false },
  { title: t('Actions'), key: 'actions', sortable: false, align: 'end' as const },
]

const statusColor: Record<string, string> = {
  PENDING: 'warning',
  APPROVED: 'info',
  PAID: 'success',
}

async function load() {
  loading.value = true
  try {
    const res = await axios.get('/salaries/', { params: { page: page.value, per_page: itemsPerPage.value } })
    const d = res.data?.data ?? res.data

    items.value = d?.salaries ?? d?.items ?? []
    total.value = d?.pagination?.total_items ?? d?.pagination?.total ?? items.value.length
  }
  catch {
    notify(t('Failed to load'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function loadSummary() {
  try {
    const res = await axios.get('/salaries/summary/')

    summary.value = res.data?.data ?? res.data
  }
  catch { /* ignore */ }
}

onMounted(() => { load(); loadSummary() })
watch([page, itemsPerPage], load)

const approveAllDialog = ref(false)
const approveAllPeriod = ref('')

function openApproveAll() {
  const now = new Date()

  approveAllPeriod.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  approveAllDialog.value = true
}

async function approveAll() {
  if (!approveAllPeriod.value)
    return
  try {
    const [y, m] = approveAllPeriod.value.split('-')

    await axios.post('/salaries/approve-all/', { year: Number(y), month: Number(m) })
    notify(t('All pending salaries approved'))
    approveAllDialog.value = false
    await Promise.all([load(), loadSummary()])
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}

async function approveOne(s: any) {
  try {
    await axios.post(`/salaries/${s.id}/approve/`)
    notify(t('Approved'))
    await load()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}

async function payOne(s: any) {
  try {
    await axios.post(`/salaries/${s.id}/pay/`)
    notify(t('Paid'))
    await Promise.all([load(), loadSummary()])
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}

function openGenerate() {
  const now = new Date()

  generatePeriod.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  generateDialog.value = true
}

async function generate() {
  if (!generatePeriod.value)
    return
  generating.value = true
  try {
    const [y, m] = generatePeriod.value.split('-')
    await axios.post('/salaries/generate/', { year: Number(y), month: Number(m) })
    notify(t('Salaries generated'))
    generateDialog.value = false
    await Promise.all([load(), loadSummary()])
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    generating.value = false
  }
}
</script>

<template>
  <div>
    <VRow class="mb-4">
      <VCol
        cols="6"
        sm="3"
      >
        <VCard>
          <VCardText class="d-flex align-center gap-2 py-3">
            <VAvatar
              color="warning"
              variant="tonal"
              size="32"
              rounded
            >
              <VIcon
                icon="bx-time"
                size="16"
              />
            </VAvatar>
            <div>
              <div class="text-subtitle-1 font-weight-bold lh-1">
                <template v-if="summary">
                  {{ summary.pending_count ?? 0 }}
                </template>
                <span
                  v-else
                  class="sk-box d-inline-block"
                  style="width:36px;height:1em;border-radius:4px;vertical-align:middle;"
                />
              </div>
              <div class="text-caption text-disabled">
                {{ t('Pending') }}
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol
        cols="6"
        sm="3"
      >
        <VCard>
          <VCardText class="d-flex align-center gap-2 py-3">
            <VAvatar
              color="info"
              variant="tonal"
              size="32"
              rounded
            >
              <VIcon
                icon="bx-check"
                size="16"
              />
            </VAvatar>
            <div>
              <div class="text-subtitle-1 font-weight-bold lh-1">
                <template v-if="summary">
                  {{ summary.approved_count ?? 0 }}
                </template>
                <span
                  v-else
                  class="sk-box d-inline-block"
                  style="width:36px;height:1em;border-radius:4px;vertical-align:middle;"
                />
              </div>
              <div class="text-caption text-disabled">
                {{ t('Approved') }}
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol
        cols="6"
        sm="3"
      >
        <VCard>
          <VCardText class="d-flex align-center gap-2 py-3">
            <VAvatar
              color="success"
              variant="tonal"
              size="32"
              rounded
            >
              <VIcon
                icon="bx-money"
                size="16"
              />
            </VAvatar>
            <div>
              <div class="text-subtitle-1 font-weight-bold lh-1">
                <template v-if="summary">
                  {{ summary.paid_count ?? 0 }}
                </template>
                <span
                  v-else
                  class="sk-box d-inline-block"
                  style="width:36px;height:1em;border-radius:4px;vertical-align:middle;"
                />
              </div>
              <div class="text-caption text-disabled">
                {{ t('Paid') }}
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol
        cols="6"
        sm="3"
      >
        <VCard>
          <VCardText class="d-flex align-center gap-2 py-3">
            <VAvatar
              color="primary"
              variant="tonal"
              size="32"
              rounded
            >
              <VIcon
                icon="bx-trending-up"
                size="16"
              />
            </VAvatar>
            <div>
              <div class="text-subtitle-1 font-weight-bold lh-1">
                <template v-if="summary">
                  {{ formatCurrency(summary.total_amount ?? 0) }}
                </template>
                <span
                  v-else
                  class="sk-box d-inline-block"
                  style="width:80px;height:1em;border-radius:4px;vertical-align:middle;"
                />
              </div>
              <div class="text-caption text-disabled">
                {{ t('Total') }}
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <VCard>
      <VCardText class="d-flex align-center gap-3 py-3 flex-wrap">
        <span class="text-h6">{{ t('Salaries') }}</span>
        <VSpacer />
        <VBtn
          variant="tonal"
          prepend-icon="bx-cog"
          @click="openGenerate"
        >
          {{ t('Generate') }}
        </VBtn>
        <VBtn
          color="success"
          prepend-icon="bx-check-double"
          @click="openApproveAll"
        >
          {{ t('Approve All') }}
        </VBtn>
      </VCardText>

      <VDataTableServer
        :headers="headers"
        :items="items"
        :items-length="total"
        :loading="loading"
        :items-per-page="itemsPerPage"
        :page="page"
      >
        <template #bottom>
          <DataTableFooter
            v-model:page="page"
            v-model:items-per-page="itemsPerPage"
            :total-items="total"
          />
        </template>
        <template #item.employee="{ item }">
          {{ item.raw.employee?.user?.first_name }} {{ item.raw.employee?.user?.last_name }}
        </template>
        <template #item.period="{ item }">
          {{ item.raw.period_year }}-{{ String(item.raw.period_month).padStart(2, '0') }}
        </template>
        <template #item.base_salary="{ item }">
          {{ formatCurrency(item.raw.base_amount ?? 0) }}
        </template>
        <template #item.net_salary="{ item }">
          <span class="font-weight-medium">{{ formatCurrency(item.raw.net_amount ?? 0) }}</span>
        </template>
        <template #item.status="{ item }">
          <VChip
            size="small"
            :color="statusColor[item.raw.status] ?? 'default'"
            variant="tonal"
          >
            {{ item.raw.status }}
          </VChip>
        </template>
        <template #item.actions="{ item }">
          <div
            class="d-flex justify-end"
            style="gap:2px;"
          >
            <VBtn
              v-if="item.raw.status === 'PENDING'"
              icon
              variant="text"
              size="small"
              color="info"
              @click="approveOne(item.raw)"
            >
              <VIcon
                icon="bx-check"
                size="18"
              />
              <VTooltip
                activator="parent"
                location="top"
              >
                {{ t('Approve') }}
              </VTooltip>
            </VBtn>
            <VBtn
              v-if="item.raw.status === 'APPROVED'"
              icon
              variant="text"
              size="small"
              color="success"
              @click="payOne(item.raw)"
            >
              <VIcon
                icon="bx-dollar"
                size="18"
              />
              <VTooltip
                activator="parent"
                location="top"
              >
                {{ t('Pay') }}
              </VTooltip>
            </VBtn>
          </div>
        </template>
      </VDataTableServer>
    </VCard>

    <VDialog
      v-model="generateDialog"
      max-width="480"
      persistent
    >
      <VCard :title="t('Generate Salaries')">
        <VCardText>
          <VTextField
            v-model="generatePeriod"
            type="month"
            :label="t('Period')"
            autofocus
          />
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            @click="generateDialog = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            color="primary"
            :loading="generating"
            @click="generate"
          >
            {{ t('Generate') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog
      v-model="approveAllDialog"
      max-width="480"
      persistent
    >
      <VCard :title="t('Approve All Pending Salaries')">
        <VCardText>
          <VTextField
            v-model="approveAllPeriod"
            type="month"
            :label="t('Period')"
            autofocus
          />
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            @click="approveAllDialog = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            color="success"
            @click="approveAll"
          >
            {{ t('Approve All') }}
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
