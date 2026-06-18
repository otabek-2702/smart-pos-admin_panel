<script setup lang="ts">
import { stockApi as axios } from '@/plugins/axios'
import DataTableFooter from '@core/components/DataTableFooter.vue'
import { useStateAction } from '@/composables/useStateAction'
import { COUNT_STATUS_COLOR as statusColor } from '@/constants/statusColors'

const { t } = useI18n({ useScope: 'global' })

const counts = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const itemsPerPage = ref(10)
const statusFilter = ref<string | undefined>(undefined)
const locationFilter = ref<number | undefined>(undefined)

const locationsList = ref<any[]>([])

const createDialog = ref(false)
const saving = ref(false)

const form = ref({
  location_id: null as number | null,
  count_type: 'FULL',
  notes: '',
})

const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatDateShort } = useFormatters()

const statuses = ['DRAFT', 'IN_PROGRESS', 'PENDING_APPROVAL', 'APPROVED', 'CANCELED']
const countTypes = ['FULL', 'PARTIAL', 'CYCLE', 'SPOT']

const headers = [
  { title: t('Count #'), key: 'count_number', sortable: false },
  { title: t('Location'), key: 'location_name', sortable: false },
  { title: t('Type'), key: 'count_type', sortable: false },
  { title: t('Status'), key: 'status', sortable: false },
  { title: t('Items Counted'), key: 'items_counted', sortable: false },
  { title: t('Date'), key: 'created_at', sortable: false },
  { title: t('Actions'), key: 'actions', sortable: false, align: 'end' as const },
]

async function loadCounts() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (statusFilter.value)
      params.status = statusFilter.value
    if (locationFilter.value)
      params.location_id = locationFilter.value

    const res = await axios.get('/counts/', { params })
    const d = res.data?.data ?? res.data

    counts.value = d?.counts ?? []
    total.value = d.pagination?.total_items ?? d.pagination?.total ?? counts.value.length
  }
  catch {
    notify(t('Failed to load stock counts'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function loadLocations() {
  try {
    const res = await axios.get('/locations/', { params: { per_page: 200 } })
    const d = res.data?.data ?? res.data

    locationsList.value = d?.locations ?? []
  }
  catch { /* ignore */ }
}

onMounted(() => { loadCounts(); loadLocations() })
watch([page, itemsPerPage], loadCounts)
watch([statusFilter, locationFilter], () => { page.value = 1; loadCounts() })

const locationOptions = computed(() => locationsList.value.map(l => ({ title: l.name, value: l.id })))

async function createCount() {
  saving.value = true
  try {
    const payload: any = { ...form.value }
    if (!payload.notes)
      delete payload.notes
    await axios.post('/counts/', payload)
    notify(t('Stock count created'))
    createDialog.value = false
    await loadCounts()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error creating count'), 'error')
  }
  finally {
    saving.value = false
  }
}

const actionLabels: Record<string, string> = {
  start: 'Start Count',
  complete: 'Complete Count',
  approve: 'Approve Count',
  cancel: 'Cancel Count',
}

const { actionDialog, actionItem, actionType, actioning, openAction, doAction } = useStateAction('/counts/', loadCounts, notify, t, axios)

function canStart(item: any) { return item.status === 'DRAFT' }
function canComplete(item: any) { return item.status === 'IN_PROGRESS' }
function canApprove(item: any) { return item.status === 'PENDING_APPROVAL' }
function canCancel(item: any) { return !['APPROVED', 'CANCELED'].includes(item.status) }

// -------- Count detail + record_count UI --------
const detailDialog = ref(false)
const detailCount = ref<any>(null)
const detailLoading = ref(false)
const detailItems = ref<any[]>([])
const detailSummary = ref<any>(null)
const varianceCodes = ref<any[]>([])
const itemFilter = ref<'all' | 'pending' | 'counted' | 'variance'>('all')
const recordingItemId = ref<number | null>(null)

async function openDetail(count: any) {
  detailCount.value = count
  detailItems.value = []
  detailSummary.value = null
  itemFilter.value = 'all'
  detailDialog.value = true
  detailLoading.value = true
  try {
    const [dRes, vRes] = await Promise.all([
      axios.get(`/counts/${count.id}/`),
      axios.get('/variance-codes/'),
    ])
    const dd = dRes.data?.data ?? dRes.data
    const vd = vRes.data?.data ?? vRes.data

    detailCount.value = dd?.count ?? dd
    detailItems.value = (dd?.count?.items ?? dd?.items ?? []).map((i: any) => ({
      ...i,
      _input: i.counted_quantity ?? null,
      _reason_code_id: i.reason_code?.id ?? null,
      _notes: i.notes ?? '',
    }))
    detailSummary.value = dd?.count?.summary ?? dd?.summary ?? null
    varianceCodes.value = vd?.codes ?? vd?.items ?? []
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Failed to load count'), 'error')
  }
  finally {
    detailLoading.value = false
  }
}

const filteredItems = computed(() => {
  if (itemFilter.value === 'pending')
    return detailItems.value.filter((i: any) => i.counted_quantity == null)
  if (itemFilter.value === 'counted')
    return detailItems.value.filter((i: any) => i.counted_quantity != null)
  if (itemFilter.value === 'variance')
    return detailItems.value.filter((i: any) => i.counted_quantity != null && Number(i.variance ?? 0) !== 0)

  return detailItems.value
})

async function recordItem(item: any) {
  if (!detailCount.value)
    return
  if (item._input == null || item._input === '') {
    notify(t('Enter a counted quantity'), 'error')

    return
  }
  recordingItemId.value = item.id
  try {
    const payload: any = {
      item_id: item.id,
      counted_quantity: item._input,
    }
    if (item._reason_code_id)
      payload.reason_code_id = item._reason_code_id
    if (item._notes)
      payload.notes = item._notes
    const res = await axios.post(`/counts/${detailCount.value.id}/record/`, payload)
    const d = res.data?.data ?? res.data
    const updated = d?.item ?? d

    if (updated) {
      const idx = detailItems.value.findIndex((i: any) => i.id === item.id)
      if (idx !== -1) {
        detailItems.value[idx] = {
          ...updated,
          _input: updated.counted_quantity,
          _reason_code_id: updated.reason_code?.id ?? null,
          _notes: updated.notes ?? '',
        }
      }
    }
    notify(t('Count recorded'))
    // refresh top-level list to update items_counted
    await loadCounts()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    recordingItemId.value = null
  }
}
</script>

<template>
  <div>
    <VCard>
      <VCardText class="d-flex flex-wrap gap-3 align-center">
        <VSelect
          v-model="statusFilter"
          :items="statuses.map(s => ({ title: t(`count_status_${s}`), value: s }))"
          :placeholder="t('All Statuses')"
          density="compact"
          style="min-inline-size: 200px;"
          hide-details
          clearable
        />
        <VSelect
          v-model="locationFilter"
          :items="locationOptions"
          :placeholder="t('All Locations')"
          density="compact"
          style="min-inline-size: 200px;"
          hide-details
          clearable
        />
        <VSpacer />
        <VBtn
          prepend-icon="bx-plus"
          @click="createDialog = true"
        >
          {{ t('New Count') }}
        </VBtn>
      </VCardText>

      <VDataTableServer
        :headers="headers"
        :items="counts"
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

        <template
          v-if="loading && counts.length === 0"
          #body
        >
          <tr
            v-for="n in itemsPerPage"
            :key="n"
            class="sk-row"
          >
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:100px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:110px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:70px;height:22px;border-radius:12px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:90px;height:22px;border-radius:12px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:40px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:80px;height:13px;border-radius:4px;"
              />
            </td>
            <td
              class="sk-cell"
              style="text-align:end;"
            >
              <div class="d-flex justify-end gap-1">
                <div
                  class="sk-box"
                  style="width:28px;height:28px;border-radius:6px;"
                /><div
                  class="sk-box"
                  style="width:28px;height:28px;border-radius:6px;"
                />
              </div>
            </td>
          </tr>
        </template>

        <template #item.count_number="{ item }">
          <span class="font-weight-medium">{{ item.raw.count_number }}</span>
        </template>
        <template #item.location_name="{ item }">
          {{ item.raw.location_name ?? item.raw.location?.name ?? '—' }}
        </template>
        <template #item.count_type="{ item }">
          <VChip
            color="info"
            size="small"
            variant="tonal"
            class="status-pill"
          >
            {{ t(`count_type_${item.raw.count_type}`) }}
          </VChip>
        </template>
        <template #item.status="{ item }">
          <VChip
            :color="statusColor[item.raw.status] ?? 'default'"
            size="small"
            variant="tonal"
            class="status-pill"
          >
            {{ t(`count_status_${item.raw.status}`) }}
          </VChip>
        </template>
        <template #item.items_counted="{ item }">
          <span class="num-tabular">{{ item.raw.items_counted ?? item.raw.count_items?.length ?? '—' }}</span>
        </template>
        <template #item.created_at="{ item }">
          {{ formatDateShort(item.raw.created_at) }}
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
              @click="openDetail(item.raw)"
            >
              <VIcon
                size="18"
                icon="bx-list-ul"
              />
              <VTooltip
                activator="parent"
                location="top"
              >
                {{ t('Open / record') }}
              </VTooltip>
            </VBtn>
            <VBtn
              v-if="canStart(item.raw)"
              icon
              variant="text"
              size="small"
              color="warning"
              @click="openAction(item.raw, 'start')"
            >
              <VIcon
                size="18"
                icon="bx-play"
              />
              <VTooltip
                activator="parent"
                location="top"
              >
                {{ t('Start') }}
              </VTooltip>
            </VBtn>
            <VBtn
              v-if="canComplete(item.raw)"
              icon
              variant="text"
              size="small"
              color="info"
              @click="openAction(item.raw, 'complete')"
            >
              <VIcon
                size="18"
                icon="bx-check"
              />
              <VTooltip
                activator="parent"
                location="top"
              >
                {{ t('Complete') }}
              </VTooltip>
            </VBtn>
            <VBtn
              v-if="canApprove(item.raw)"
              icon
              variant="text"
              size="small"
              color="success"
              @click="openAction(item.raw, 'approve')"
            >
              <VIcon
                size="18"
                icon="bx-check-double"
              />
              <VTooltip
                activator="parent"
                location="top"
              >
                {{ t('Approve') }}
              </VTooltip>
            </VBtn>
            <VBtn
              v-if="canCancel(item.raw)"
              icon
              variant="text"
              size="small"
              color="error"
              @click="openAction(item.raw, 'cancel')"
            >
              <VIcon
                size="18"
                icon="bx-x"
              />
              <VTooltip
                activator="parent"
                location="top"
              >
                {{ t('Cancel') }}
              </VTooltip>
            </VBtn>
          </div>
        </template>
      </VDataTableServer>
    </VCard>

    <!-- Create Dialog -->
    <VDialog
      v-model="createDialog"
      max-width="400"
      persistent
    >
      <VCard :title="t('New Stock Count')">
        <VCardText>
          <VRow>
            <VCol cols="12">
              <VSelect
                v-model="form.location_id"
                :items="locationOptions"
                :label="t('Location')"
                required
              />
            </VCol>
            <VCol cols="12">
              <VSelect
                v-model="form.count_type"
                :items="countTypes.map(c => ({ title: t(`count_type_${c}`), value: c }))"
                :label="t('Count Type')"
              />
            </VCol>
            <VCol cols="12">
              <VTextField
                v-model="form.notes"
                :label="t('Notes')"
              />
            </VCol>
          </VRow>
        </VCardText>
        <VCardActions class="justify-end gap-2 pa-4 pt-0">
          <VBtn
            variant="tonal"
            color="default"
            @click="createDialog = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            :loading="saving"
            @click="createCount"
          >
            {{ t('Create') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Action Confirm -->
    <VDialog
      v-model="actionDialog"
      max-width="400"
    >
      <VCard :title="t(actionLabels[actionType] ?? actionType)">
        <VCardText>{{ t('Confirm action for count') }} <strong>{{ actionItem?.count_number }}</strong>?</VCardText>
        <VCardActions class="justify-end gap-2 pa-4 pt-0">
          <VBtn
            variant="tonal"
            color="default"
            @click="actionDialog = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            :color="actionType === 'cancel' ? 'error' : 'primary'"
            :loading="actioning"
            @click="doAction"
          >
            {{ t('Confirm') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Count detail + record_count -->
    <VDialog
      v-model="detailDialog"
      max-width="1100"
      scrollable
    >
      <VCard>
        <VCardText class="py-3 d-flex align-center justify-space-between">
          <div>
            <div class="text-h6">
              {{ detailCount?.count_number ?? t('Count') }}
            </div>
            <div class="text-caption text-disabled">
              {{ detailCount?.location?.name ?? detailCount?.location_name }} · {{ t(`count_type_${detailCount?.count_type}`) }}
            </div>
          </div>
          <VChip
            v-if="detailCount?.status"
            :color="statusColor[detailCount.status] ?? 'default'"
            variant="tonal"
            class="status-pill"
          >
            {{ t(`count_status_${detailCount.status}`) }}
          </VChip>
        </VCardText>
        <VDivider />
        <VCardText style="max-height:75vh;overflow-y:auto;">
          <!-- summary strip -->
          <VRow
            v-if="detailSummary"
            class="mb-3"
          >
            <VCol cols="6" sm="3">
              <div class="text-caption text-disabled">{{ t('Total items') }}</div>
              <div class="text-h6">{{ detailSummary.total_items }}</div>
            </VCol>
            <VCol cols="6" sm="3">
              <div class="text-caption text-success">{{ t('Counted') }}</div>
              <div class="text-h6">{{ detailSummary.counted_items }}</div>
            </VCol>
            <VCol cols="6" sm="3">
              <div class="text-caption text-warning">{{ t('Pending') }}</div>
              <div class="text-h6">{{ detailSummary.pending_items }}</div>
            </VCol>
            <VCol cols="6" sm="3">
              <div class="text-caption text-error">{{ t('With variance') }}</div>
              <div class="text-h6">{{ detailSummary.items_with_variance }}</div>
            </VCol>
          </VRow>

          <!-- filter chips -->
          <VBtnToggle
            v-model="itemFilter"
            variant="outlined"
            density="compact"
            color="primary"
            class="mb-3"
            mandatory
          >
            <VBtn size="small" value="all">{{ t('All') }}</VBtn>
            <VBtn size="small" value="pending">{{ t('Pending') }}</VBtn>
            <VBtn size="small" value="counted">{{ t('Counted') }}</VBtn>
            <VBtn size="small" value="variance">{{ t('Variance') }}</VBtn>
          </VBtnToggle>

          <VProgressLinear
            v-if="detailLoading"
            indeterminate
            class="mb-2"
          />

          <VTable density="compact">
            <thead>
              <tr>
                <th>{{ t('Item') }}</th>
                <th class="text-end">{{ t('System qty') }}</th>
                <th class="text-end" style="min-inline-size:160px;">{{ t('Counted qty') }}</th>
                <th class="text-end">{{ t('Variance') }}</th>
                <th style="min-inline-size:180px;">{{ t('Reason') }}</th>
                <th>{{ t('Notes') }}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="i in filteredItems"
                :key="i.id"
              >
                <td class="font-weight-medium">{{ i.stock_item?.name ?? i.item?.name ?? '—' }}</td>
                <td class="text-end num-tabular">{{ i.system_quantity }} {{ i.stock_item?.unit?.short_name ?? '' }}</td>
                <td class="text-end">
                  <VTextField
                    v-model.number="i._input"
                    type="number"
                    step="0.01"
                    density="compact"
                    hide-details
                    :disabled="detailCount?.status !== 'DRAFT' && detailCount?.status !== 'IN_PROGRESS'"
                  />
                </td>
                <td class="text-end">
                  <VChip
                    v-if="i.counted_quantity != null"
                    size="x-small"
                    :color="Number(i.variance ?? 0) === 0 ? 'success' : (Number(i.variance) < 0 ? 'error' : 'warning')"
                    variant="tonal"
                    class="status-pill num-tabular"
                  >
                    {{ i.variance ?? 0 }} ({{ i.variance_percentage ?? 0 }}%)
                  </VChip>
                  <span
                    v-else
                    class="text-disabled"
                  >—</span>
                </td>
                <td>
                  <VSelect
                    v-model="i._reason_code_id"
                    :items="varianceCodes.map((c: any) => ({ title: `${c.code} — ${c.name}`, value: c.id }))"
                    density="compact"
                    hide-details
                    clearable
                    :disabled="detailCount?.status !== 'DRAFT' && detailCount?.status !== 'IN_PROGRESS'"
                  />
                </td>
                <td>
                  <VTextField
                    v-model="i._notes"
                    density="compact"
                    hide-details
                    :disabled="detailCount?.status !== 'DRAFT' && detailCount?.status !== 'IN_PROGRESS'"
                  />
                </td>
                <td>
                  <VBtn
                    icon
                    variant="text"
                    size="small"
                    color="primary"
                    :loading="recordingItemId === i.id"
                    :disabled="detailCount?.status !== 'DRAFT' && detailCount?.status !== 'IN_PROGRESS'"
                    @click="recordItem(i)"
                  >
                    <VIcon icon="bx-save" size="18" />
                    <VTooltip activator="parent" location="top">{{ t('Record') }}</VTooltip>
                  </VBtn>
                </td>
              </tr>
              <tr v-if="!filteredItems.length && !detailLoading">
                <td colspan="7" class="text-center text-disabled py-4">
                  {{ t('No items') }}
                </td>
              </tr>
            </tbody>
          </VTable>
        </VCardText>
        <VDivider />
        <VCardActions>
          <VSpacer />
          <VBtn variant="text" @click="detailDialog = false">
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
name: stock-counts
meta:
  action: manage
  subject: all
</route>
