<script setup lang="ts">
import axios from '@/plugins/axios'
import DataTableFooter from '@core/components/DataTableFooter.vue'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatCurrency, formatDate } = useFormatters()

const tab = ref<'active' | 'history' | 'templates'>('active')

// Active shifts
const activeShifts = ref<any[]>([])
const activeLoading = ref(false)

// History
const shifts = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const itemsPerPage = ref(10)
const dateFrom = ref('')
const dateTo = ref('')
const statusFilter = ref<string | undefined>(undefined)

// Templates
const templates = ref<any[]>([])
const templatesLoading = ref(false)
const tplDialog = ref(false)
const tplEdit = ref<any>(null)
const tplForm = ref({ name: '', start_time: '08:00', end_time: '20:00' })

// End / reconcile
const endDialog = ref(false)
const endShift = ref<any>(null)
const endNotes = ref('')

const reconcileDialog = ref(false)
const reconcileShift = ref<any>(null)
const reconcileCash = ref<number | null>(null)
const reconcileNotes = ref('')

// Shift performance scorecard dialog
const perfDialog = ref(false)
const perfLoading = ref(false)
const perfData = ref<any>(null)

async function showPerformance(shift: any) {
  perfDialog.value = true
  perfLoading.value = true
  perfData.value = null
  try {
    const res = await axios.get(`/analytics/shifts/${shift.id}`)

    perfData.value = res.data?.data ?? res.data
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Failed to load'), 'error')
    perfDialog.value = false
  }
  finally {
    perfLoading.value = false
  }
}

function formatPrep(seconds: number | null) {
  if (!seconds)
    return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

const headers = [
  { title: '#', key: 'id', sortable: false, width: '60px' },
  { title: t('User'), key: 'user', sortable: false },
  { title: t('Started'), key: 'start_time', sortable: false },
  { title: t('Ended'), key: 'end_time', sortable: false },
  { title: t('Status'), key: 'status', sortable: false },
  { title: t('Cash'), key: 'cash_collected', sortable: false },
  { title: t('Actions'), key: 'actions', sortable: false, align: 'end' as const },
]

const statusColor: Record<string, string> = {
  ACTIVE: 'success',
  ENDED: 'warning',
  COMPLETED: 'secondary',
  ABANDONED: 'error',
  RECONCILED: 'info',
}

async function loadActiveShifts() {
  activeLoading.value = true
  try {
    const res = await axios.get('/shifts/active')
    const d = res.data?.data ?? res.data

    activeShifts.value = Array.isArray(d) ? d : (d?.shifts ?? d?.items ?? [])
  }
  catch {
    notify(t('Failed to load shifts'), 'error')
  }
  finally {
    activeLoading.value = false
  }
}

async function loadShifts() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (dateFrom.value)
      params.date_from = dateFrom.value
    if (dateTo.value)
      params.date_to = dateTo.value
    if (statusFilter.value)
      params.status = statusFilter.value
    const res = await axios.get('/shifts', { params })
    const d = res.data?.data ?? res.data

    shifts.value = d?.shifts ?? d?.items ?? []
    total.value = d?.pagination?.total_items ?? d?.pagination?.total ?? shifts.value.length
  }
  catch {
    notify(t('Failed to load shifts'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function loadTemplates() {
  templatesLoading.value = true
  try {
    const res = await axios.get('/shift-templates')
    const d = res.data?.data ?? res.data

    templates.value = Array.isArray(d) ? d : (d?.templates ?? d?.shift_templates ?? d?.items ?? [])
  }
  catch {
    notify(t('Failed to load templates'), 'error')
  }
  finally {
    templatesLoading.value = false
  }
}

onMounted(loadActiveShifts)
watch(tab, val => {
  if (val === 'history' && shifts.value.length === 0)
    loadShifts()
  if (val === 'templates' && templates.value.length === 0)
    loadTemplates()
})
watch([page, itemsPerPage, dateFrom, dateTo, statusFilter], () => {
  if (tab.value === 'history')
    loadShifts()
})

function openEndDialog(s: any) {
  endShift.value = s
  endNotes.value = ''
  endDialog.value = true
}

async function endShiftConfirm() {
  try {
    await axios.post(`/shifts/${endShift.value.id}/end`, { notes: endNotes.value })
    notify(t('Shift ended'))
    endDialog.value = false
    await Promise.all([loadActiveShifts(), loadShifts()])
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}

function openReconcile(s: any) {
  reconcileShift.value = s
  reconcileCash.value = null
  reconcileNotes.value = ''
  reconcileDialog.value = true
}

async function reconcileConfirm() {
  if (reconcileCash.value === null) {
    notify(t('Cash amount required'), 'error')

    return
  }
  try {
    await axios.post(`/shifts/${reconcileShift.value.id}/reconcile`, {
      actual_cash: reconcileCash.value,
      notes: reconcileNotes.value,
    })
    notify(t('Shift reconciled'))
    reconcileDialog.value = false
    await loadShifts()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}

function openTplDialog(tpl: any = null) {
  tplEdit.value = tpl
  tplForm.value = tpl
    ? { name: tpl.name, start_time: (tpl.start_time ?? '').slice(0, 5), end_time: (tpl.end_time ?? '').slice(0, 5) }
    : { name: '', start_time: '08:00', end_time: '20:00' }
  tplDialog.value = true
}

async function saveTpl() {
  try {
    if (tplEdit.value)
      await axios.put(`/shift-templates/${tplEdit.value.id}`, tplForm.value)
    else
      await axios.post('/shift-templates', tplForm.value)
    notify(t('Template saved'))
    tplDialog.value = false
    await loadTemplates()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}

async function deleteTpl(tpl: any) {
  if (!confirm(t('Delete this template?')))
    return
  try {
    await axios.delete(`/shift-templates/${tpl.id}`)
    notify(t('Template deleted'))
    await loadTemplates()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}
</script>

<template>
  <div>
    <VCard>
      <VTabs
        v-model="tab"
        color="primary"
      >
        <VTab value="active">
          <VIcon
            start
            icon="bx-time-five"
          />{{ t('Active') }}
        </VTab>
        <VTab value="history">
          <VIcon
            start
            icon="bx-history"
          />{{ t('History') }}
        </VTab>
        <VTab value="templates">
          <VIcon
            start
            icon="bx-list-ul"
          />{{ t('Templates') }}
        </VTab>
      </VTabs>
      <VDivider />

      <VWindow v-model="tab">
        <VWindowItem value="active">
          <VCardText>
            <VRow v-if="activeShifts.length || activeLoading">
              <VCol
                v-for="(s, idx) in (activeLoading && activeShifts.length === 0 ? Array.from({ length: 4 }) : activeShifts)"
                :key="(s as any)?.id ?? idx"
                cols="12"
                sm="6"
                md="4"
              >
                <VCard
                  v-if="s"
                  border
                >
                  <VCardText>
                    <div class="d-flex align-center gap-3 mb-2">
                      <VAvatar
                        color="success"
                        variant="tonal"
                        size="40"
                      >
                        <VIcon icon="bx-user" />
                      </VAvatar>
                      <div>
                        <div class="text-body-1 font-weight-medium">
                          {{ (s as any).user?.name ?? '—' }}
                        </div>
                        <div class="text-caption text-disabled">
                          {{ t('Started') }}: {{ formatDate((s as any).start_time) }}
                        </div>
                      </div>
                    </div>
                    <div class="d-flex justify-space-between text-body-2 mb-1">
                      <span class="text-disabled">{{ t('Orders') }}</span>
                      <span class="font-weight-medium">{{ (s as any).total_orders ?? 0 }}</span>
                    </div>
                    <div class="d-flex justify-space-between text-body-2 mb-2">
                      <span class="text-disabled">{{ t('Cash Collected') }}</span>
                      <span class="font-weight-medium">{{ formatCurrency((s as any).cash_collected ?? 0) }}</span>
                    </div>
                    <VBtn
                      block
                      color="warning"
                      prepend-icon="bx-stop-circle"
                      @click="openEndDialog(s)"
                    >
                      {{ t('End Shift') }}
                    </VBtn>
                  </VCardText>
                </VCard>
                <div
                  v-else
                  class="sk-box"
                  style="width:100%;height:140px;border-radius:8px;"
                />
              </VCol>
            </VRow>
            <div
              v-else
              class="text-center text-disabled py-8"
            >
              <VIcon
                icon="bx-time-five"
                size="48"
                class="mb-2"
              />
              <div>{{ t('No active shifts') }}</div>
            </div>
          </VCardText>
        </VWindowItem>

        <VWindowItem value="history">
          <VCardText class="d-flex flex-wrap gap-3">
            <VTextField
              v-model="dateFrom"
              type="date"
              :label="t('From')"
              density="compact"
              hide-details
              style="max-inline-size:170px;"
              clearable
            />
            <VTextField
              v-model="dateTo"
              type="date"
              :label="t('To')"
              density="compact"
              hide-details
              style="max-inline-size:170px;"
              clearable
            />
            <VSelect
              v-model="statusFilter"
              :items="['ACTIVE', 'ENDED', 'COMPLETED', 'ABANDONED'].map(s => ({ title: t(`shift_status_${s}`), value: s }))"
              :placeholder="t('Status')"
              density="compact"
              style="min-inline-size:160px;"
              hide-details
              clearable
            />
          </VCardText>

          <VDataTableServer
            :headers="headers"
            :items="shifts"
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
            <template #item.user="{ item }">
              {{ item.raw.user?.name ?? '—' }}
            </template>
            <template #item.start_time="{ item }">
              {{ formatDate(item.raw.start_time) }}
            </template>
            <template #item.end_time="{ item }">
              {{ item.raw.end_time ? formatDate(item.raw.end_time) : '—' }}
            </template>
            <template #item.status="{ item }">
              <VChip
                size="small"
                :color="statusColor[item.raw.status] ?? 'default'"
                variant="tonal"
              >
                {{ t(`shift_status_${item.raw.status}`) }}
              </VChip>
            </template>
            <template #item.cash_collected="{ item }">
              {{ formatCurrency(item.raw.cash_collected ?? 0) }}
            </template>
            <template #item.actions="{ item }">
              <div class="d-flex justify-end gap-1">
                <VBtn
                  icon
                  variant="text"
                  size="small"
                  color="primary"
                  @click="showPerformance(item.raw)"
                >
                  <VIcon
                    icon="bx-line-chart"
                    size="18"
                  />
                  <VTooltip
                    activator="parent"
                    location="top"
                  >
                    {{ t('Performance') }}
                  </VTooltip>
                </VBtn>
                <VBtn
                  v-if="item.raw.status === 'ENDED'"
                  size="small"
                  variant="tonal"
                  color="info"
                  @click="openReconcile(item.raw)"
                >
                  {{ t('Reconcile') }}
                </VBtn>
              </div>
            </template>
          </VDataTableServer>
        </VWindowItem>

        <VWindowItem value="templates">
          <VCardText class="d-flex justify-end mb-2">
            <VBtn
              color="primary"
              prepend-icon="bx-plus"
              @click="openTplDialog"
            >
              {{ t('New Template') }}
            </VBtn>
          </VCardText>
          <VList>
            <VListItem v-if="templatesLoading && templates.length === 0">
              <div
                class="sk-box"
                style="width:100%;height:50px;border-radius:6px;"
              />
            </VListItem>
            <VListItem
              v-for="tpl in templates"
              :key="tpl.id"
              class="border-b"
            >
              <VListItemTitle>{{ tpl.name }}</VListItemTitle>
              <VListItemSubtitle>{{ tpl.start_time }} → {{ tpl.end_time }}</VListItemSubtitle>
              <template #append>
                <div
                  class="d-flex"
                  style="gap:2px;"
                >
                  <VBtn
                    icon
                    variant="text"
                    size="small"
                    @click="openTplDialog(tpl)"
                  >
                    <VIcon
                      icon="bx-edit-alt"
                      size="18"
                    />
                  </VBtn>
                  <VBtn
                    icon
                    variant="text"
                    size="small"
                    color="error"
                    @click="deleteTpl(tpl)"
                  >
                    <VIcon
                      icon="bx-trash"
                      size="18"
                    />
                  </VBtn>
                </div>
              </template>
            </VListItem>
          </VList>
        </VWindowItem>
      </VWindow>
    </VCard>

    <!-- End shift dialog -->
    <VDialog
      v-model="endDialog"
      max-width="480"
      persistent
    >
      <VCard :title="t('End Shift')">
        <VCardText>
          <VTextarea
            v-model="endNotes"
            :label="t('Notes')"
            rows="3"
          />
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            @click="endDialog = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            color="warning"
            @click="endShiftConfirm"
          >
            {{ t('End Shift') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Reconcile dialog -->
    <VDialog
      v-model="reconcileDialog"
      max-width="480"
      persistent
    >
      <VCard :title="t('Reconcile Shift')">
        <VCardText>
          <VTextField
            v-model.number="reconcileCash"
            :label="t('Actual Cash')"
            type="number"
            class="mb-3"
            autofocus
          />
          <VTextarea
            v-model="reconcileNotes"
            :label="t('Notes')"
            rows="2"
          />
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            @click="reconcileDialog = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            color="info"
            @click="reconcileConfirm"
          >
            {{ t('Confirm') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Template dialog -->
    <VDialog
      v-model="tplDialog"
      max-width="480"
      persistent
    >
      <VCard :title="tplEdit ? t('Edit Template') : t('New Template')">
        <VCardText>
          <VTextField
            v-model="tplForm.name"
            :label="t('Name')"
            class="mb-3"
          />
          <VTextField
            v-model="tplForm.start_time"
            type="time"
            :label="t('Start Time')"
            class="mb-3"
          />
          <VTextField
            v-model="tplForm.end_time"
            type="time"
            :label="t('End Time')"
          />
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            @click="tplDialog = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            color="primary"
            @click="saveTpl"
          >
            {{ t('Save') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Shift performance scorecard -->
    <VDialog
      v-model="perfDialog"
      max-width="720"
      scrollable
    >
      <VCard :title="t('Shift Performance')">
        <VCardText>
          <div v-if="perfLoading">
            <div
              v-for="n in 4"
              :key="n"
              class="sk-box mb-3"
              style="width:100%;height:60px;border-radius:8px;"
            />
          </div>
          <template v-else-if="perfData">
            <div class="d-flex align-center gap-3 mb-4">
              <VAvatar
                size="48"
                color="primary"
                variant="tonal"
              >
                <VIcon icon="bx-user" />
              </VAvatar>
              <div>
                <div class="text-h6 font-weight-bold">
                  {{ perfData.user_name }}
                </div>
                <div class="text-caption text-disabled">
                  {{ t(`shift_status_${perfData.status}`) }} · {{ perfData.duration_minutes }} {{ t('min') }}
                </div>
              </div>
            </div>

            <VRow>
              <VCol
                cols="6"
                sm="3"
              >
                <VCard
                  variant="tonal"
                  color="success"
                >
                  <VCardText class="text-center pa-2">
                    <div class="text-h6 font-weight-bold">
                      {{ formatCurrency(perfData.revenue) }}
                    </div>
                    <div class="text-caption">
                      {{ t('Revenue') }}
                    </div>
                  </VCardText>
                </VCard>
              </VCol>
              <VCol
                cols="6"
                sm="3"
              >
                <VCard
                  variant="tonal"
                  color="primary"
                >
                  <VCardText class="text-center pa-2">
                    <div class="text-h6 font-weight-bold">
                      {{ perfData.orders_total }}
                    </div>
                    <div class="text-caption">
                      {{ t('Orders') }}
                    </div>
                  </VCardText>
                </VCard>
              </VCol>
              <VCol
                cols="6"
                sm="3"
              >
                <VCard
                  variant="tonal"
                  color="info"
                >
                  <VCardText class="text-center pa-2">
                    <div class="text-h6 font-weight-bold">
                      {{ perfData.orders_per_hour }}
                    </div>
                    <div class="text-caption">
                      {{ t('Orders/hour') }}
                    </div>
                  </VCardText>
                </VCard>
              </VCol>
              <VCol
                cols="6"
                sm="3"
              >
                <VCard
                  variant="tonal"
                  :color="perfData.cancel_rate_pct > 10 ? 'error' : 'default'"
                >
                  <VCardText class="text-center pa-2">
                    <div class="text-h6 font-weight-bold">
                      {{ perfData.cancel_rate_pct }}%
                    </div>
                    <div class="text-caption">
                      {{ t('Cancel rate') }}
                    </div>
                  </VCardText>
                </VCard>
              </VCol>
            </VRow>

            <VDivider class="my-4" />

            <div class="d-flex justify-space-between py-1">
              <span class="text-body-2 text-disabled">{{ t('Completed') }}</span>
              <span class="font-weight-medium">{{ perfData.orders_completed }}</span>
            </div>
            <div class="d-flex justify-space-between py-1">
              <span class="text-body-2 text-disabled">{{ t('Cancelled') }}</span>
              <span class="font-weight-medium">{{ perfData.orders_cancelled }}</span>
            </div>
            <div class="d-flex justify-space-between py-1">
              <span class="text-body-2 text-disabled">{{ t('Paid') }}</span>
              <span class="font-weight-medium">{{ perfData.orders_paid }}</span>
            </div>
            <div class="d-flex justify-space-between py-1">
              <span class="text-body-2 text-disabled">{{ t('Avg Prep Time') }}</span>
              <span class="font-weight-medium">{{ formatPrep(perfData.avg_prep_seconds) }}</span>
            </div>
            <div class="d-flex justify-space-between py-1">
              <span class="text-body-2 text-disabled">{{ t('Revenue/hour') }}</span>
              <span class="font-weight-medium">{{ formatCurrency(perfData.revenue_per_hour) }}</span>
            </div>
          </template>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn @click="perfDialog = false">
            {{ t('Close') }}
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
