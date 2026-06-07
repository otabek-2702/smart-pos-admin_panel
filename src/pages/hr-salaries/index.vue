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

// ---------- itemization dialog ----------
const itemDialog = ref(false)
const itemSalary = ref<any>(null)
const itemLoading = ref(false)
const baseInput = ref<number>(0)
const bonuses = ref<any[]>([])
const deductions = ref<any[]>([])
const newBonus = ref({ amount: 0, reason: '' })
const newDeduction = ref({ amount: 0, reason: '' })

const isPaid = computed(() => itemSalary.value?.status === 'PAID')

const calcBonusTotal = computed(() => bonuses.value.reduce((a, b: any) => a + Number(b.amount || 0), 0))
const calcDeductionTotal = computed(() => deductions.value.reduce((a, d: any) => a + Number(d.amount || 0), 0))
const calcNet = computed(() => Number(baseInput.value || 0) + calcBonusTotal.value - calcDeductionTotal.value)

async function openItems(s: any) {
  itemSalary.value = s
  baseInput.value = Number(s.base_amount ?? 0)
  bonuses.value = []
  deductions.value = []
  itemDialog.value = true
  itemLoading.value = true
  try {
    const res = await axios.get(`/salaries/${s.id}/bonuses/`)
    const d = res.data?.data ?? res.data

    bonuses.value = d?.bonuses ?? []
    deductions.value = d?.deductions ?? []
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Failed to load'), 'error')
  }
  finally {
    itemLoading.value = false
  }
}

async function saveBase() {
  if (!itemSalary.value)
    return
  try {
    await axios.post(`/salaries/${itemSalary.value.id}/base/`, { amount: baseInput.value })
    notify(t('Base updated'))
    await load()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}

async function addBonus() {
  if (!itemSalary.value || newBonus.value.amount <= 0)
    return
  try {
    await axios.post(`/salaries/${itemSalary.value.id}/bonuses/`, newBonus.value)
    notify(t('Bonus added'))
    newBonus.value = { amount: 0, reason: '' }
    await openItems(itemSalary.value) // reload list
    await load()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}

async function addDeduction() {
  if (!itemSalary.value || newDeduction.value.amount <= 0)
    return
  try {
    await axios.post(`/salaries/${itemSalary.value.id}/deductions/`, newDeduction.value)
    notify(t('Deduction added'))
    newDeduction.value = { amount: 0, reason: '' }
    await openItems(itemSalary.value)
    await load()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}

async function deleteBonus(b: any) {
  if (!itemSalary.value)
    return
  try {
    await axios.delete(`/salaries/${itemSalary.value.id}/bonuses/${b.id}/`)
    notify(t('Removed'))
    await openItems(itemSalary.value)
    await load()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}

async function deleteDeduction(d: any) {
  if (!itemSalary.value)
    return
  try {
    await axios.delete(`/salaries/${itemSalary.value.id}/deductions/${d.id}/`)
    notify(t('Removed'))
    await openItems(itemSalary.value)
    await load()
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
              icon
              variant="text"
              size="small"
              @click="openItems(item.raw)"
            >
              <VIcon
                icon="bx-list-ul"
                size="18"
              />
              <VTooltip
                activator="parent"
                location="top"
              >
                {{ t('Edit items (base / bonus / deduction)') }}
              </VTooltip>
            </VBtn>
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
      v-model="itemDialog"
      max-width="780"
      scrollable
    >
      <VCard :title="t('Salary itemization')">
        <VCardText style="max-height:75vh;overflow-y:auto;">
          <div
            v-if="itemSalary"
            class="d-flex align-center gap-2 mb-4"
          >
            <VAvatar size="36" color="primary" variant="tonal">
              <span class="text-caption">{{ (itemSalary.employee?.user?.first_name ?? '?')[0] }}</span>
            </VAvatar>
            <div>
              <div class="text-body-1 font-weight-medium">
                {{ itemSalary.employee?.user?.first_name }} {{ itemSalary.employee?.user?.last_name }}
              </div>
              <div class="text-caption text-disabled">
                {{ itemSalary.period_year }}-{{ String(itemSalary.period_month).padStart(2, '0') }}
              </div>
            </div>
            <VSpacer />
            <VChip
              size="small"
              :color="statusColor[itemSalary.status] ?? 'default'"
              variant="tonal"
            >
              {{ itemSalary.status }}
            </VChip>
          </div>

          <VAlert
            v-if="isPaid"
            type="warning"
            variant="tonal"
            class="mb-3"
          >
            {{ t('This salary is PAID — items are locked. Backend rejects edits.') }}
          </VAlert>

          <!-- Base -->
          <VCard
            variant="outlined"
            class="mb-4"
          >
            <VCardText>
              <div class="text-subtitle-2 mb-2">
                {{ t('Base salary (this month)') }}
              </div>
              <div class="d-flex align-center gap-2">
                <VTextField
                  v-model.number="baseInput"
                  type="number"
                  min="0"
                  density="compact"
                  hide-details
                  :disabled="isPaid"
                />
                <VBtn
                  color="primary"
                  :disabled="isPaid"
                  @click="saveBase"
                >
                  {{ t('Save base') }}
                </VBtn>
              </div>
            </VCardText>
          </VCard>

          <!-- Bonuses -->
          <VCard
            variant="outlined"
            class="mb-4"
          >
            <VCardText>
              <div class="text-subtitle-2 mb-2 d-flex align-center justify-space-between">
                <span>
                  <VIcon icon="bx-plus-circle" size="16" color="success" class="me-1" />
                  {{ t('Bonuses') }}
                </span>
                <span class="text-success font-weight-bold">+{{ formatCurrency(calcBonusTotal) }}</span>
              </div>
              <VList density="compact" class="pa-0 mb-2">
                <VListItem
                  v-for="b in bonuses"
                  :key="b.id"
                >
                  <VListItemTitle class="text-success">
                    +{{ formatCurrency(b.amount) }}
                  </VListItemTitle>
                  <VListItemSubtitle v-if="b.reason">
                    {{ b.reason }}
                  </VListItemSubtitle>
                  <template #append>
                    <VBtn
                      icon
                      variant="text"
                      size="x-small"
                      color="error"
                      :disabled="isPaid"
                      @click="deleteBonus(b)"
                    >
                      <VIcon icon="bx-trash" size="16" />
                    </VBtn>
                  </template>
                </VListItem>
                <VListItem v-if="!bonuses.length && !itemLoading">
                  <VListItemTitle class="text-disabled text-caption">
                    {{ t('No bonuses') }}
                  </VListItemTitle>
                </VListItem>
              </VList>
              <div class="d-flex gap-2">
                <VTextField
                  v-model.number="newBonus.amount"
                  :label="t('Amount')"
                  type="number"
                  min="0"
                  density="compact"
                  hide-details
                  style="max-inline-size:140px;"
                  :disabled="isPaid"
                />
                <VTextField
                  v-model="newBonus.reason"
                  :label="t('Reason')"
                  density="compact"
                  hide-details
                  :disabled="isPaid"
                />
                <VBtn
                  color="success"
                  variant="tonal"
                  prepend-icon="bx-plus"
                  :disabled="isPaid || !newBonus.amount"
                  @click="addBonus"
                >
                  {{ t('Add') }}
                </VBtn>
              </div>
            </VCardText>
          </VCard>

          <!-- Deductions -->
          <VCard
            variant="outlined"
            class="mb-4"
          >
            <VCardText>
              <div class="text-subtitle-2 mb-2 d-flex align-center justify-space-between">
                <span>
                  <VIcon icon="bx-minus-circle" size="16" color="error" class="me-1" />
                  {{ t('Deductions') }}
                </span>
                <span class="text-error font-weight-bold">−{{ formatCurrency(calcDeductionTotal) }}</span>
              </div>
              <VList density="compact" class="pa-0 mb-2">
                <VListItem
                  v-for="d in deductions"
                  :key="d.id"
                >
                  <VListItemTitle class="text-error">
                    −{{ formatCurrency(d.amount) }}
                  </VListItemTitle>
                  <VListItemSubtitle v-if="d.reason">
                    {{ d.reason }}
                  </VListItemSubtitle>
                  <template #append>
                    <VBtn
                      icon
                      variant="text"
                      size="x-small"
                      color="error"
                      :disabled="isPaid"
                      @click="deleteDeduction(d)"
                    >
                      <VIcon icon="bx-trash" size="16" />
                    </VBtn>
                  </template>
                </VListItem>
                <VListItem v-if="!deductions.length && !itemLoading">
                  <VListItemTitle class="text-disabled text-caption">
                    {{ t('No deductions') }}
                  </VListItemTitle>
                </VListItem>
              </VList>
              <div class="d-flex gap-2">
                <VTextField
                  v-model.number="newDeduction.amount"
                  :label="t('Amount')"
                  type="number"
                  min="0"
                  density="compact"
                  hide-details
                  style="max-inline-size:140px;"
                  :disabled="isPaid"
                />
                <VTextField
                  v-model="newDeduction.reason"
                  :label="t('Reason')"
                  density="compact"
                  hide-details
                  :disabled="isPaid"
                />
                <VBtn
                  color="error"
                  variant="tonal"
                  prepend-icon="bx-minus"
                  :disabled="isPaid || !newDeduction.amount"
                  @click="addDeduction"
                >
                  {{ t('Add') }}
                </VBtn>
              </div>
            </VCardText>
          </VCard>

          <!-- Net preview -->
          <VCard color="primary" variant="tonal">
            <VCardText class="d-flex align-center justify-space-between">
              <span class="text-subtitle-1 font-weight-medium">{{ t('Net (preview)') }}</span>
              <span class="text-h5 font-weight-bold">{{ formatCurrency(calcNet) }}</span>
            </VCardText>
          </VCard>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            @click="itemDialog = false"
          >
            {{ t('Close') }}
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
