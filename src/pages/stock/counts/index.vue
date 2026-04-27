<script setup lang="ts">
import axios from '@axios'
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

const statuses = ['DRAFT', 'IN_PROGRESS', 'PENDING_APPROVAL', 'APPROVED', 'CANCELLED']
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
    if (statusFilter.value) params.status = statusFilter.value
    if (locationFilter.value) params.location_id = locationFilter.value

    const res = await axios.get('/counts/', { params })
    const d = res.data
    counts.value = d.counts ?? []
    total.value = d.pagination?.total_items ?? counts.value.length
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
    locationsList.value = res.data.locations ?? []
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
    if (!payload.notes) delete payload.notes
    await axios.post('/counts/', payload)
    notify(t('Stock count created'))
    createDialog.value = false
    loadCounts()
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

const { actionDialog, actionItem, actionType, actioning, openAction, doAction } = useStateAction('/counts/', loadCounts, notify, t)

function canStart(item: any) { return item.status === 'DRAFT' }
function canComplete(item: any) { return item.status === 'IN_PROGRESS' }
function canApprove(item: any) { return item.status === 'PENDING_APPROVAL' }
function canCancel(item: any) { return !['APPROVED', 'CANCELLED'].includes(item.status) }
</script>

<template>
  <div>
    <VCard>
      <VCardText class="d-flex flex-wrap gap-3 align-center">
        <VSelect
          v-model="statusFilter"
          :items="statuses"
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
        <VBtn prepend-icon="bx-plus" @click="createDialog = true">{{ t('New Count') }}</VBtn>
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

        <template v-if="loading && counts.length === 0" #body>
          <tr v-for="n in itemsPerPage" :key="n" class="sk-row">
            <td class="sk-cell"><div class="sk-box" style="width:100px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:110px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:70px;height:22px;border-radius:12px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:90px;height:22px;border-radius:12px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:40px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:80px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell" style="text-align:end;"><div class="d-flex justify-end gap-1"><div class="sk-box" style="width:28px;height:28px;border-radius:6px;" /><div class="sk-box" style="width:28px;height:28px;border-radius:6px;" /></div></td>
          </tr>
        </template>

        <template #item.count_number="{ item }">
          <span class="font-weight-medium">{{ item.raw.count_number }}</span>
        </template>
        <template #item.location_name="{ item }">
          {{ item.raw.location_name ?? item.raw.location?.name ?? '—' }}
        </template>
        <template #item.count_type="{ item }">
          <VChip color="secondary" size="small" variant="tonal">{{ item.raw.count_type }}</VChip>
        </template>
        <template #item.status="{ item }">
          <VChip :color="statusColor[item.raw.status] ?? 'default'" size="small" variant="tonal">{{ item.raw.status }}</VChip>
        </template>
        <template #item.items_counted="{ item }">
          {{ item.raw.items_counted ?? item.raw.count_items?.length ?? '—' }}
        </template>
        <template #item.created_at="{ item }">
          {{ formatDateShort(item.raw.created_at) }}
        </template>
        <template #item.actions="{ item }">
          <div class="d-flex justify-end" style="gap:2px;">
            <VBtn v-if="canStart(item.raw)" icon variant="text" size="small" color="warning" @click="openAction(item.raw, 'start')">
              <VIcon size="18" icon="bx-play" />
              <VTooltip activator="parent" location="top">{{ t('Start') }}</VTooltip>
            </VBtn>
            <VBtn v-if="canComplete(item.raw)" icon variant="text" size="small" color="info" @click="openAction(item.raw, 'complete')">
              <VIcon size="18" icon="bx-check" />
              <VTooltip activator="parent" location="top">{{ t('Complete') }}</VTooltip>
            </VBtn>
            <VBtn v-if="canApprove(item.raw)" icon variant="text" size="small" color="success" @click="openAction(item.raw, 'approve')">
              <VIcon size="18" icon="bx-check-double" />
              <VTooltip activator="parent" location="top">{{ t('Approve') }}</VTooltip>
            </VBtn>
            <VBtn v-if="canCancel(item.raw)" icon variant="text" size="small" color="error" @click="openAction(item.raw, 'cancel')">
              <VIcon size="18" icon="bx-x" />
              <VTooltip activator="parent" location="top">{{ t('Cancel') }}</VTooltip>
            </VBtn>
          </div>
        </template>
      </VDataTableServer>
    </VCard>

    <!-- Create Dialog -->
    <VDialog v-model="createDialog" max-width="400" persistent>
      <VCard :title="t('New Stock Count')">
        <VCardText>
          <VRow>
            <VCol cols="12">
              <VSelect v-model="form.location_id" :items="locationOptions" :label="t('Location')" required />
            </VCol>
            <VCol cols="12">
              <VSelect v-model="form.count_type" :items="countTypes" :label="t('Count Type')" />
            </VCol>
            <VCol cols="12">
              <VTextField v-model="form.notes" :label="t('Notes')" />
            </VCol>
          </VRow>
        </VCardText>
        <VCardActions class="justify-end gap-2 pa-4 pt-0">
          <VBtn variant="tonal" color="default" @click="createDialog = false">{{ t('Cancel') }}</VBtn>
          <VBtn :loading="saving" @click="createCount">{{ t('Create') }}</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Action Confirm -->
    <VDialog v-model="actionDialog" max-width="400">
      <VCard :title="t(actionLabels[actionType] ?? actionType)">
        <VCardText>{{ t('Confirm action for count') }} <strong>{{ actionItem?.count_number }}</strong>?</VCardText>
        <VCardActions class="justify-end gap-2 pa-4 pt-0">
          <VBtn variant="tonal" color="default" @click="actionDialog = false">{{ t('Cancel') }}</VBtn>
          <VBtn :color="actionType === 'cancel' ? 'error' : 'primary'" :loading="actioning" @click="doAction">{{ t('Confirm') }}</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VSnackbar v-model="snackbar" :color="snackbarColor" :timeout="3000">{{ snackbarMsg }}</VSnackbar>
  </div>
</template>

<route lang="yaml">
name: stock-counts
meta:
  action: manage
  subject: all
</route>
