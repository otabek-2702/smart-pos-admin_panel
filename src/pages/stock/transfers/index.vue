<script setup lang="ts">
import axios from '@axios'
import DataTableFooter from '@core/components/DataTableFooter.vue'
import { useStateAction } from '@/composables/useStateAction'
import { TRANSFER_STATUS_COLOR as statusColor } from '@/constants/statusColors'

const { t } = useI18n({ useScope: 'global' })

const transfers = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const itemsPerPage = ref(10)
const search = ref('')
const statusFilter = ref<string | undefined>(undefined)

const locationsList = ref<any[]>([])
const itemsList = ref<any[]>([])
const unitsList = ref<any[]>([])

const createDialog = ref(false)
const saving = ref(false)
const form = ref({
  from_location_id: null as number | null,
  to_location_id: null as number | null,
  transfer_type: 'INTERNAL',
  notes: '',
  items: [] as Array<{ stock_item_id: number | null; quantity: number; unit_id: number | null }>,
})

const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatDateShort } = useFormatters()

const statuses = ['DRAFT', 'REQUESTED', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED']
const transferTypes = ['INTERNAL', 'BRANCH_TO_BRANCH']

const headers = [
  { title: '', key: 'data-table-expand', sortable: false, width: '40px' },
  { title: t('Transfer #'), key: 'transfer_number', sortable: false },
  { title: t('From'), key: 'from_location', sortable: false },
  { title: t('To'), key: 'to_location', sortable: false },
  { title: t('Type'), key: 'transfer_type', sortable: false },
  { title: t('Status'), key: 'status', sortable: false },
  { title: t('Date'), key: 'created_at', sortable: false },
  { title: t('Actions'), key: 'actions', sortable: false, align: 'end' as const },
]

async function loadTransfers() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (search.value) params.search = search.value
    if (statusFilter.value) params.status = statusFilter.value

    const res = await axios.get('/transfers/', { params })
    const d = res.data
    transfers.value = d.transfers ?? []
    total.value = d.pagination?.total_items ?? transfers.value.length
  }
  catch {
    notify(t('Failed to load transfers'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function loadMeta() {
  try {
    const [locRes, itemsRes, unitsRes] = await Promise.all([
      axios.get('/locations/', { params: { per_page: 200 } }),
      axios.get('/items/', { params: { per_page: 300 } }),
      axios.get('/units/', { params: { per_page: 200 } }),
    ])
    locationsList.value = locRes.data.locations ?? []
    itemsList.value = itemsRes.data.items ?? []
    unitsList.value = unitsRes.data.units ?? []
  }
  catch { /* ignore */ }
}

onMounted(() => { loadTransfers(); loadMeta() })
watch([page, itemsPerPage], loadTransfers)
watch([statusFilter], () => { page.value = 1; loadTransfers() })

const debouncedSearch = useDebounceFn(() => {
  page.value = 1
  loadTransfers()
}, 400)
watch(search, debouncedSearch)

const locationOptions = computed(() => locationsList.value.map(l => ({ title: l.name, value: l.id })))
const itemOptions = computed(() => itemsList.value.map(i => ({ title: `${i.name} (${i.sku ?? '—'})`, value: i.id })))
const unitOptions = computed(() => unitsList.value.map(u => ({ title: `${u.name} (${u.short_name})`, value: u.id })))

function addLineItem() {
  form.value.items.push({ stock_item_id: null, quantity: 1, unit_id: null })
}

function removeLineItem(idx: number) {
  form.value.items.splice(idx, 1)
}

function openCreate() {
  form.value = { from_location_id: null, to_location_id: null, transfer_type: 'INTERNAL', notes: '', items: [{ stock_item_id: null, quantity: 1, unit_id: null }] }
  createDialog.value = true
}

async function createTransfer() {
  saving.value = true
  try {
    const payload: any = {
      from_location_id: form.value.from_location_id,
      to_location_id: form.value.to_location_id,
      transfer_type: form.value.transfer_type,
      notes: form.value.notes || undefined,
      items: form.value.items.filter(i => i.stock_item_id).map(i => ({
        stock_item_id: i.stock_item_id,
        quantity: i.quantity,
        unit_id: i.unit_id || undefined,
      })),
    }
    await axios.post('/transfers/', payload)
    notify(t('Transfer created'))
    createDialog.value = false
    loadTransfers()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error creating transfer'), 'error')
  }
  finally {
    saving.value = false
  }
}

const actionLabels: Record<string, string> = {
  request: 'Request Transfer',
  approve: 'Approve Transfer',
  ship: 'Mark as Shipped',
  receive: 'Mark as Received',
  cancel: 'Cancel Transfer',
}

const { actionDialog, actionItem, actionType, actioning, openAction, doAction } = useStateAction('/transfers/', loadTransfers, notify, t)

function canRequest(item: any) { return item.status === 'DRAFT' }
function canApprove(item: any) { return item.status === 'REQUESTED' }
function canShip(item: any) { return item.status === 'APPROVED' }
function canReceive(item: any) { return item.status === 'IN_TRANSIT' }
function canCancel(item: any) { return !['RECEIVED', 'CANCELLED'].includes(item.status) }
</script>

<template>
  <div>
    <VCard>
      <VCardText class="d-flex flex-wrap gap-3 align-center">
        <VTextField
          v-model="search"
          :placeholder="t('Search transfers...')"
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
        <VSpacer />
        <VBtn prepend-icon="bx-plus" @click="openCreate">{{ t('New Transfer') }}</VBtn>
      </VCardText>

      <VDataTableServer
        :headers="headers"
        :items="transfers"
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

        <template v-if="loading && transfers.length === 0" #body>
          <tr v-for="n in itemsPerPage" :key="n" class="sk-row">
            <td class="sk-cell"><div class="sk-box" style="width:20px;height:20px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:100px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:100px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:100px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:80px;height:22px;border-radius:12px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:80px;height:22px;border-radius:12px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:80px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell" style="text-align:end;"><div class="d-flex justify-end gap-1"><div class="sk-box" style="width:28px;height:28px;border-radius:6px;" /><div class="sk-box" style="width:28px;height:28px;border-radius:6px;" /></div></td>
          </tr>
        </template>

        <template #item.transfer_number="{ item }">
          <span class="font-weight-medium">{{ item.raw.transfer_number }}</span>
        </template>
        <template #item.from_location="{ item }">
          {{ typeof item.raw.from_location === 'string' ? item.raw.from_location : item.raw.from_location?.name ?? '—' }}
        </template>
        <template #item.to_location="{ item }">
          {{ typeof item.raw.to_location === 'string' ? item.raw.to_location : item.raw.to_location?.name ?? '—' }}
        </template>
        <template #item.transfer_type="{ item }">
          <VChip color="secondary" size="small" variant="tonal">{{ item.raw.transfer_type }}</VChip>
        </template>
        <template #item.status="{ item }">
          <VChip :color="statusColor[item.raw.status] ?? 'default'" size="small" variant="tonal">{{ item.raw.status }}</VChip>
        </template>
        <template #item.created_at="{ item }">
          {{ formatDateShort(item.raw.created_at) }}
        </template>
        <template #item.actions="{ item }">
          <div class="d-flex justify-end" style="gap:2px;">
            <VBtn v-if="canRequest(item.raw)" icon variant="text" size="small" color="info" @click.stop="openAction(item.raw, 'request')">
              <VIcon size="18" icon="bx-send" />
              <VTooltip activator="parent" location="top">{{ t('Request') }}</VTooltip>
            </VBtn>
            <VBtn v-if="canApprove(item.raw)" icon variant="text" size="small" color="success" @click.stop="openAction(item.raw, 'approve')">
              <VIcon size="18" icon="bx-check" />
              <VTooltip activator="parent" location="top">{{ t('Approve') }}</VTooltip>
            </VBtn>
            <VBtn v-if="canShip(item.raw)" icon variant="text" size="small" color="primary" @click.stop="openAction(item.raw, 'ship')">
              <VIcon size="18" icon="bx-car" />
              <VTooltip activator="parent" location="top">{{ t('Ship') }}</VTooltip>
            </VBtn>
            <VBtn v-if="canReceive(item.raw)" icon variant="text" size="small" color="success" @click.stop="openAction(item.raw, 'receive')">
              <VIcon size="18" icon="bx-package" />
              <VTooltip activator="parent" location="top">{{ t('Receive') }}</VTooltip>
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
                <VTable density="compact">
                  <thead>
                    <tr>
                      <th>{{ t('Item') }}</th>
                      <th>{{ t('Quantity') }}</th>
                      <th>{{ t('Unit') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(li, idx) in ((item.raw.items ?? item.raw.line_items ?? []) as any[])" :key="idx">
                      <td>{{ li.item?.name ?? li.stock_item?.name ?? '—' }}</td>
                      <td>{{ li.requested_qty ?? li.quantity }}</td>
                      <td>{{ li.unit_short ?? li.unit?.short_name ?? '—' }}</td>
                    </tr>
                    <tr v-if="!(item.raw.items?.length ?? item.raw.line_items?.length)">
                      <td colspan="3" class="text-center text-disabled">{{ t('No items') }}</td>
                    </tr>
                  </tbody>
                </VTable>
              </div>
            </td>
          </tr>
        </template>
      </VDataTableServer>
    </VCard>

    <!-- Create Transfer Dialog -->
    <VDialog v-model="createDialog" max-width="600" persistent scrollable>
      <VCard :title="t('New Transfer')">
        <VCardText style="max-height:65vh;overflow-y:auto;">
          <VRow>
            <VCol cols="12" sm="6">
              <VSelect v-model="form.from_location_id" :items="locationOptions" :label="t('From Location')" required />
            </VCol>
            <VCol cols="12" sm="6">
              <VSelect v-model="form.to_location_id" :items="locationOptions" :label="t('To Location')" required />
            </VCol>
            <VCol cols="12" sm="6">
              <VSelect v-model="form.transfer_type" :items="transferTypes" :label="t('Type')" />
            </VCol>
            <VCol cols="12">
              <VTextField v-model="form.notes" :label="t('Notes')" />
            </VCol>

            <!-- Line items -->
            <VCol cols="12">
              <div class="d-flex align-center justify-space-between mb-2">
                <p class="text-overline text-disabled mb-0">{{ t('Items') }}</p>
                <VBtn size="small" variant="tonal" prepend-icon="bx-plus" @click="addLineItem">{{ t('Add Item') }}</VBtn>
              </div>
              <VRow v-for="(li, idx) in form.items" :key="idx" class="mb-1 align-center">
                <VCol cols="12" sm="5">
                  <VSelect v-model="li.stock_item_id" :items="itemOptions" :label="t('Item')" density="compact" />
                </VCol>
                <VCol cols="12" sm="3">
                  <VTextField v-model.number="li.quantity" :label="t('Qty')" type="number" step="0.01" density="compact" />
                </VCol>
                <VCol cols="12" sm="3">
                  <VSelect v-model="li.unit_id" :items="unitOptions" :label="t('Unit')" density="compact" clearable />
                </VCol>
                <VCol cols="12" sm="1" class="d-flex align-center">
                  <VBtn icon variant="text" size="small" color="error" @click="removeLineItem(idx)">
                    <VIcon size="16" icon="bx-trash" />
                  </VBtn>
                </VCol>
              </VRow>
            </VCol>
          </VRow>
        </VCardText>
        <VCardActions class="justify-end gap-2 pa-4 pt-0">
          <VBtn variant="tonal" color="default" @click="createDialog = false">{{ t('Cancel') }}</VBtn>
          <VBtn :loading="saving" @click="createTransfer">{{ t('Create') }}</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Action Confirm -->
    <VDialog v-model="actionDialog" max-width="400">
      <VCard :title="t(actionLabels[actionType] ?? actionType)">
        <VCardText>{{ t('Confirm action for transfer') }} <strong>{{ actionItem?.transfer_number }}</strong>?</VCardText>
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
name: stock-transfers
meta:
  action: manage
  subject: all
</route>
