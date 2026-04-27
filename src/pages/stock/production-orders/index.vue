<script setup lang="ts">
import axios from '@axios'
import DataTableFooter from '@core/components/DataTableFooter.vue'
import { useStateAction } from '@/composables/useStateAction'
import { PRODUCTION_ORDER_STATUS_COLOR as statusColor, PRODUCTION_PRIORITY_COLOR as priorityColor } from '@/constants/statusColors'

const { t } = useI18n({ useScope: 'global' })

const orders = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const itemsPerPage = ref(10)
const search = ref('')
const statusFilter = ref<string | undefined>(undefined)
const priorityFilter = ref<string | undefined>(undefined)

const recipesList = ref<any[]>([])
const locationsList = ref<any[]>([])

const createDialog = ref(false)
const saving = ref(false)
const form = ref({
  recipe_id: null as number | null,
  batch_multiplier: 1,
  source_location_id: null as number | null,
  output_location_id: null as number | null,
  priority: 'NORMAL',
  planned_start_date: '',
  notes: '',
})

const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatDateShort } = useFormatters()

const statuses = ['DRAFT', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ON_HOLD']
const priorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT']

const headers = [
  { title: '', key: 'data-table-expand', sortable: false, width: '40px' },
  { title: t('Order #'), key: 'order_number', sortable: false },
  { title: t('Recipe'), key: 'recipe_name', sortable: false },
  { title: t('Status'), key: 'status', sortable: false },
  { title: t('Priority'), key: 'priority', sortable: false },
  { title: t('Output'), key: 'output', sortable: false },
  { title: t('Planned Start'), key: 'planned_start', sortable: false },
  { title: t('Actions'), key: 'actions', sortable: false, align: 'end' as const },
]

async function loadOrders() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (search.value) params.search = search.value
    if (statusFilter.value) params.status = statusFilter.value
    if (priorityFilter.value) params.priority = priorityFilter.value

    const res = await axios.get('/production-orders/', { params })
    const d = res.data
    orders.value = d.orders ?? []
    total.value = d.pagination?.total_items ?? orders.value.length
  }
  catch {
    notify(t('Failed to load production orders'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function loadMeta() {
  try {
    const [recRes, locRes] = await Promise.all([
      axios.get('/recipes/', { params: { per_page: 300, is_active: true } }),
      axios.get('/locations/', { params: { per_page: 200 } }),
    ])
    recipesList.value = recRes.data.recipes ?? []
    locationsList.value = locRes.data.locations ?? []
  }
  catch { /* ignore */ }
}

onMounted(() => { loadOrders(); loadMeta() })
watch([page, itemsPerPage], loadOrders)
watch([statusFilter, priorityFilter], () => { page.value = 1; loadOrders() })

const debouncedSearch = useDebounceFn(() => {
  page.value = 1
  loadOrders()
}, 400)
watch(search, debouncedSearch)

const recipeOptions = computed(() => recipesList.value.map(r => ({ title: r.name, value: r.id })))
const locationOptions = computed(() => locationsList.value.map(l => ({ title: l.name, value: l.id })))

async function createOrder() {
  if (!form.value.source_location_id || !form.value.output_location_id) {
    notify(t('Source and output locations are required'), 'error')
    return
  }
  saving.value = true
  try {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}')
    const payload: any = { ...form.value, created_by_id: userData.id }
    if (!payload.planned_start_date) delete payload.planned_start_date
    if (!payload.notes) delete payload.notes
    await axios.post('/production-orders/', payload)
    notify(t('Production order created'))
    createDialog.value = false
    loadOrders()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error creating order'), 'error')
  }
  finally {
    saving.value = false
  }
}

const actionLabels: Record<string, string> = {
  plan: 'Plan Order',
  start: 'Start Production',
  complete: 'Complete Production',
  cancel: 'Cancel Order',
  hold: 'Put on Hold',
  resume: 'Resume Order',
}

const { actionDialog, actionItem, actionType, actioning, openAction, doAction } = useStateAction('/production-orders/', loadOrders, notify, t)

function canPlan(item: any) { return item.status === 'DRAFT' }
function canStart(item: any) { return item.status === 'PLANNED' }
function canComplete(item: any) { return item.status === 'IN_PROGRESS' }
function canHold(item: any) { return item.status === 'IN_PROGRESS' }
function canResume(item: any) { return item.status === 'ON_HOLD' }
function canCancel(item: any) { return !['COMPLETED', 'CANCELLED'].includes(item.status) }
</script>

<template>
  <div>
    <VCard>
      <VCardText class="d-flex flex-wrap gap-3 align-center">
        <VTextField
          v-model="search"
          :placeholder="t('Search orders...')"
          prepend-inner-icon="bx-search"
          density="compact"
          style="min-inline-size: 240px;"
          hide-details
          clearable
        />
        <VSelect
          v-model="statusFilter"
          :items="statuses"
          :placeholder="t('All Statuses')"
          density="compact"
          style="min-inline-size: 180px;"
          hide-details
          clearable
        />
        <VSelect
          v-model="priorityFilter"
          :items="priorities"
          :placeholder="t('All Priorities')"
          density="compact"
          style="min-inline-size: 160px;"
          hide-details
          clearable
        />
        <VSpacer />
        <VBtn prepend-icon="bx-plus" @click="createDialog = true">{{ t('New Order') }}</VBtn>
      </VCardText>

      <VDataTableServer
        :headers="headers"
        :items="orders"
        :items-length="total"
        :loading="loading"
        :items-per-page="itemsPerPage"
        :page="page"
        expand-on-click
      >
        <template #bottom>
          <DataTableFooter
            v-model:page="page"
            v-model:items-per-page="itemsPerPage"
            :total-items="total"
          />
        </template>

        <template v-if="loading && orders.length === 0" #body>
          <tr v-for="n in itemsPerPage" :key="n" class="sk-row">
            <td class="sk-cell"><div class="sk-box" style="width:20px;height:20px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:90px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:120px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:90px;height:22px;border-radius:12px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:70px;height:22px;border-radius:12px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:80px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:80px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell" style="text-align:end;"><div class="d-flex justify-end gap-1"><div class="sk-box" style="width:28px;height:28px;border-radius:6px;" /><div class="sk-box" style="width:28px;height:28px;border-radius:6px;" /></div></td>
          </tr>
        </template>

        <template #item.order_number="{ item }">
          <span class="font-weight-medium">{{ item.raw.order_number }}</span>
        </template>
        <template #item.recipe_name="{ item }">
          {{ item.raw.recipe_name ?? item.raw.recipe?.name ?? '—' }}
        </template>
        <template #item.status="{ item }">
          <VChip :color="statusColor[item.raw.status] ?? 'default'" size="small" variant="tonal">{{ item.raw.status }}</VChip>
        </template>
        <template #item.priority="{ item }">
          <VChip :color="priorityColor[item.raw.priority] ?? 'default'" size="small" variant="tonal">{{ item.raw.priority }}</VChip>
        </template>
        <template #item.output="{ item }">
          {{ item.raw.expected_output_qty ?? '—' }} {{ typeof item.raw.output_unit === 'string' ? item.raw.output_unit : item.raw.output_unit?.short_name ?? '' }}
        </template>
        <template #item.planned_start="{ item }">
          {{ formatDateShort(item.raw.planned_start ?? item.raw.planned_start_date) }}
        </template>
        <template #item.actions="{ item }">
          <div class="d-flex justify-end" style="gap:2px;">
            <VBtn v-if="canPlan(item.raw)" icon variant="text" size="small" color="info" @click.stop="openAction(item.raw, 'plan')">
              <VIcon size="18" icon="bx-calendar-check" />
              <VTooltip activator="parent" location="top">{{ t('Plan') }}</VTooltip>
            </VBtn>
            <VBtn v-if="canStart(item.raw)" icon variant="text" size="small" color="success" @click.stop="openAction(item.raw, 'start')">
              <VIcon size="18" icon="bx-play" />
              <VTooltip activator="parent" location="top">{{ t('Start') }}</VTooltip>
            </VBtn>
            <VBtn v-if="canComplete(item.raw)" icon variant="text" size="small" color="primary" @click.stop="openAction(item.raw, 'complete')">
              <VIcon size="18" icon="bx-check-double" />
              <VTooltip activator="parent" location="top">{{ t('Complete') }}</VTooltip>
            </VBtn>
            <VBtn v-if="canHold(item.raw)" icon variant="text" size="small" color="warning" @click.stop="openAction(item.raw, 'hold')">
              <VIcon size="18" icon="bx-pause" />
              <VTooltip activator="parent" location="top">{{ t('Hold') }}</VTooltip>
            </VBtn>
            <VBtn v-if="canResume(item.raw)" icon variant="text" size="small" color="success" @click.stop="openAction(item.raw, 'resume')">
              <VIcon size="18" icon="bx-play-circle" />
              <VTooltip activator="parent" location="top">{{ t('Resume') }}</VTooltip>
            </VBtn>
            <VBtn v-if="canCancel(item.raw)" icon variant="text" size="small" color="error" @click.stop="openAction(item.raw, 'cancel')">
              <VIcon size="18" icon="bx-x" />
              <VTooltip activator="parent" location="top">{{ t('Cancel') }}</VTooltip>
            </VBtn>
          </div>
        </template>

        <!-- Expanded row -->
        <template #expanded-row="{ item, columns }">
          <tr>
            <td :colspan="columns.length">
              <div class="pa-3">
                <div class="d-flex gap-4 mb-2 text-body-2 flex-wrap">
                  <span><span class="text-disabled">{{ t('Recipe') }}: </span>{{ item.raw.recipe_name ?? item.raw.recipe?.name ?? '—' }}</span>
                  <span><span class="text-disabled">{{ t('Multiplier') }}: </span>×{{ item.raw.batch_multiplier ?? 1 }}</span>
                  <span v-if="item.raw.source_location"><span class="text-disabled">{{ t('Source') }}: </span>{{ typeof item.raw.source_location === 'string' ? item.raw.source_location : item.raw.source_location?.name ?? '—' }}</span>
                  <span v-if="item.raw.output_location"><span class="text-disabled">{{ t('Output') }}: </span>{{ typeof item.raw.output_location === 'string' ? item.raw.output_location : item.raw.output_location?.name ?? '—' }}</span>
                </div>
                <span v-if="item.raw.notes" class="text-body-2 text-disabled">{{ item.raw.notes }}</span>
              </div>
            </td>
          </tr>
        </template>
      </VDataTableServer>
    </VCard>

    <!-- Create Dialog -->
    <VDialog v-model="createDialog" max-width="480" persistent>
      <VCard :title="t('New Production Order')">
        <VCardText>
          <VRow>
            <VCol cols="12">
              <VSelect v-model="form.recipe_id" :items="recipeOptions" :label="t('Recipe')" required />
            </VCol>
            <VCol cols="12" sm="6">
              <VTextField v-model.number="form.batch_multiplier" :label="t('Batch Multiplier')" type="number" step="0.1" :min="0.1" />
            </VCol>
            <VCol cols="12" sm="6">
              <VSelect v-model="form.priority" :items="priorities" :label="t('Priority')" />
            </VCol>
            <VCol cols="12" sm="6">
              <VSelect v-model="form.source_location_id" :items="locationOptions" :label="t('Source Location *')" />
            </VCol>
            <VCol cols="12" sm="6">
              <VSelect v-model="form.output_location_id" :items="locationOptions" :label="t('Output Location *')" />
            </VCol>
            <VCol cols="12" sm="6">
              <VTextField v-model="form.planned_start_date" :label="t('Planned Start')" type="date" />
            </VCol>
            <VCol cols="12">
              <VTextField v-model="form.notes" :label="t('Notes')" />
            </VCol>
          </VRow>
        </VCardText>
        <VCardActions class="justify-end gap-2 pa-4 pt-0">
          <VBtn variant="tonal" color="default" @click="createDialog = false">{{ t('Cancel') }}</VBtn>
          <VBtn :loading="saving" @click="createOrder">{{ t('Create') }}</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Action Confirm Dialog -->
    <VDialog v-model="actionDialog" max-width="400">
      <VCard :title="t(actionLabels[actionType] ?? actionType)">
        <VCardText>{{ t('Confirm action for order') }} <strong>{{ actionItem?.order_number }}</strong>?</VCardText>
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
name: stock-production-orders
meta:
  action: manage
  subject: all
</route>
