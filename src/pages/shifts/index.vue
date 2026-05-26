<script setup lang="ts">
import axios from '@axios'
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

const headers = [
  { title: '#', key: 'id', sortable: false, width: '60px' },
  { title: t('User'), key: 'user', sortable: false },
  { title: t('Started'), key: 'started_at', sortable: false },
  { title: t('Ended'), key: 'ended_at', sortable: false },
  { title: t('Status'), key: 'status', sortable: false },
  { title: t('Cash'), key: 'expected_cash', sortable: false },
  { title: t('Actions'), key: 'actions', sortable: false, align: 'end' as const },
]

const statusColor: Record<string, string> = {
  ACTIVE: 'success',
  ENDED: 'secondary',
  RECONCILED: 'info',
}

async function loadActiveShifts() {
  activeLoading.value = true
  try {
    const res = await axios.get('/shifts/active')
    const d = res.data?.data ?? res.data

    activeShifts.value = d?.shifts ?? d?.items ?? []
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

    templates.value = d?.templates ?? d?.shift_templates ?? d?.items ?? []
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
    loadActiveShifts()
    loadShifts()
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
    loadShifts()
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
    loadTemplates()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}

async function deleteTpl(tpl: any) {
  if (!confirm('Delete this template?'))
    return
  try {
    await axios.delete(`/shift-templates/${tpl.id}`)
    notify('Template deleted')
    loadTemplates()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? 'Error', 'error')
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
                          {{ (s as any).user?.first_name }} {{ (s as any).user?.last_name }}
                        </div>
                        <div class="text-caption text-disabled">
                          {{ t('Started') }}: {{ formatDate((s as any).started_at) }}
                        </div>
                      </div>
                    </div>
                    <div class="d-flex justify-space-between text-body-2 mb-2">
                      <span class="text-disabled">{{ t('Expected Cash') }}</span>
                      <span class="font-weight-medium">{{ formatCurrency((s as any).expected_cash ?? 0) }}</span>
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
              :items="['ACTIVE', 'ENDED', 'RECONCILED']"
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
              {{ item.raw.user?.first_name }} {{ item.raw.user?.last_name }}
            </template>
            <template #item.started_at="{ item }">
              {{ formatDate(item.raw.started_at) }}
            </template>
            <template #item.ended_at="{ item }">
              {{ item.raw.ended_at ? formatDate(item.raw.ended_at) : '—' }}
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
            <template #item.expected_cash="{ item }">
              {{ formatCurrency(item.raw.expected_cash ?? 0) }}
            </template>
            <template #item.actions="{ item }">
              <VBtn
                v-if="item.raw.status === 'ENDED'"
                size="small"
                variant="tonal"
                color="info"
                @click="openReconcile(item.raw)"
              >
                {{ t('Reconcile') }}
              </VBtn>
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
