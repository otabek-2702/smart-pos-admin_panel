<script setup lang="ts">
import { stockApi as axios } from '@/plugins/axios'
import DataTableFooter from '@core/components/DataTableFooter.vue'

const { t } = useI18n({ useScope: 'global' })

// List only returns: id, uuid, code(null), name, city, rating, is_active
const suppliers = ref<any[]>([])
const total = ref(0)
const loading = ref(false)

const page = ref(1)
const itemsPerPage = ref(10)
const search = ref('')
const activeFilter = ref<string | undefined>(undefined)

// detail dialog (view)
const detailDialog = ref(false)
const detailItem = ref<any>(null)
const detailLoading = ref(false)

// create/edit dialog
const dialog = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const saving = ref(false)
const deleteDialog = ref(false)
const deleting = ref(false)
const selectedItem = ref<any>(null)

const form = ref({
  name: '',
  contact_person: '',
  email: '',
  phone: '',
  city: '',
  address: '',
  rating: 3,
  payment_terms_days: 30,
  lead_time_days: 7,
})

const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()

// Only columns that the list API actually returns
const headers = [
  { title: t('Name'), key: 'name', sortable: false },
  { title: t('City'), key: 'city', sortable: false },
  { title: t('Rating'), key: 'rating', sortable: false },
  { title: t('Status'), key: 'is_active', sortable: false },
  { title: t('Actions'), key: 'actions', sortable: false, align: 'end' as const },
]

async function loadSuppliers() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (search.value)
      params.search = search.value
    if (activeFilter.value !== undefined)
      params.is_active = activeFilter.value

    const res = await axios.get('/suppliers/', { params })
    const d = res.data?.data ?? res.data

    suppliers.value = d?.suppliers ?? []
    total.value = d?.pagination?.total_items ?? d?.pagination?.total ?? d?.pagination?.total_suppliers ?? suppliers.value.length
  }
  catch {
    notify(t('Failed to load suppliers'), 'error')
  }
  finally {
    loading.value = false
  }
}

onMounted(loadSuppliers)
watch([page, itemsPerPage], loadSuppliers)
watch([search, activeFilter], () => { page.value = 1; loadSuppliers() })

async function openDetail(item: any) {
  detailItem.value = item
  detailDialog.value = true
  detailLoading.value = true
  try {
    const res = await axios.get(`/suppliers/${item.id}/`)

    detailItem.value = res.data?.supplier ?? res.data?.data ?? item
  }
  catch { /* keep basic data */ }
  finally {
    detailLoading.value = false
  }
}

function openCreate() {
  dialogMode.value = 'create'
  form.value = { name: '', contact_person: '', email: '', phone: '', city: '', address: '', rating: 3, payment_terms_days: 30, lead_time_days: 7 }
  dialog.value = true
}

function openEdit(item: any) {
  dialogMode.value = 'edit'
  selectedItem.value = item

  // Load detail first to get all fields
  axios.get(`/suppliers/${item.id}/`).then(res => {
    const d = res.data?.data ?? res.data?.supplier ?? res.data?.data ?? item

    form.value = {
      name: d.name ?? '',
      contact_person: d.contact_person ?? '',
      email: d.email ?? '',
      phone: d.phone ?? '',
      city: d.city ?? '',
      address: d.address ?? '',
      rating: d.rating ?? 3,
      payment_terms_days: d.payment_terms_days ?? 30,
      lead_time_days: d.lead_time_days ?? 7,
    }
  }).catch(() => {
    form.value = { name: item.name ?? '', contact_person: '', email: '', phone: '', city: item.city ?? '', address: '', rating: item.rating ?? 3, payment_terms_days: 30, lead_time_days: 7 }
  })
  dialog.value = true
}

async function save() {
  saving.value = true
  try {
    if (dialogMode.value === 'create')
      await axios.post('/suppliers/', form.value)
    else
      await axios.patch(`/suppliers/${selectedItem.value.id}/`, form.value)
    notify(dialogMode.value === 'create' ? t('Supplier created') : t('Supplier updated'))
    dialog.value = false
    await loadSuppliers()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error saving supplier'), 'error')
  }
  finally {
    saving.value = false
  }
}

function confirmDelete(item: any) {
  selectedItem.value = item
  deleteDialog.value = true
}

async function doDelete() {
  deleting.value = true
  try {
    await axios.delete(`/suppliers/${selectedItem.value.id}/`)
    notify(t('Supplier deleted'))
    deleteDialog.value = false
    await loadSuppliers()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error deleting supplier'), 'error')
  }
  finally {
    deleting.value = false
  }
}

// -------- pay supplier --------
const payDialog = ref(false)
const paying = ref<any>(null)
const paySaving = ref(false)
const payForm = ref({ amount: 0, source_account: 'BANK', commission: 0, note: '' })
const { formatCurrency, formatDate } = useFormatters()

function openPay(s: any) {
  paying.value = s
  payForm.value = { amount: 0, source_account: 'BANK', commission: 0, note: '' }
  payDialog.value = true
}

async function doPay() {
  if (!paying.value || payForm.value.amount <= 0) {
    notify(t('Amount must be greater than 0'), 'error')

    return
  }
  paySaving.value = true
  try {
    await axios.post(`/suppliers/${paying.value.id}/pay/`, payForm.value)
    notify(t('Payment recorded'))
    payDialog.value = false
    await loadSuppliers()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    paySaving.value = false
  }
}

// -------- ledger drawer --------
const ledgerDialog = ref(false)
const ledgerSupplier = ref<any>(null)
const ledgerLoading = ref(false)
const ledgerRows = ref<any[]>([])
const ledgerPage = ref(1)
const ledgerPerPage = ref(20)
const ledgerTotal = ref(0)
const ledgerBalance = ref<string | null>(null)

async function openLedger(s: any) {
  ledgerSupplier.value = s
  ledgerPage.value = 1
  ledgerRows.value = []
  ledgerBalance.value = null
  ledgerDialog.value = true
  await loadLedger()
}

async function loadLedger() {
  if (!ledgerSupplier.value)
    return
  ledgerLoading.value = true
  try {
    const res = await axios.get(`/suppliers/${ledgerSupplier.value.id}/ledger/`, {
      params: { page: ledgerPage.value, per_page: ledgerPerPage.value },
    })
    const d = res.data?.data ?? res.data

    ledgerRows.value = d?.transactions ?? d?.entries ?? d?.items ?? []
    ledgerTotal.value = d?.pagination?.total ?? ledgerRows.value.length
    ledgerBalance.value = d?.current_balance ?? d?.balance ?? null
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Failed to load'), 'error')
  }
  finally {
    ledgerLoading.value = false
  }
}

watch(ledgerPage, loadLedger)

const ledgerTypeColor: Record<string, string> = {
  PURCHASE: 'warning',
  PAYMENT: 'success',
  RETURN: 'info',
  ADJUSTMENT: 'secondary',
}
</script>

<template>
  <div>
    <VCard>
      <VCardText class="d-flex flex-wrap gap-3 align-center">
        <VTextField
          v-model="search"
          :placeholder="t('Search suppliers...')"
          prepend-inner-icon="bx-search"
          density="compact"
          style="min-inline-size: 240px;"
          hide-details
          clearable
        />
        <VSelect
          v-model="activeFilter"
          :items="[{ title: t('Active'), value: 'true' }, { title: t('Inactive'), value: 'false' }]"
          :placeholder="t('All')"
          density="compact"
          style="min-inline-size: 160px;"
          hide-details
          clearable
        />
        <VSpacer />
        <VBtn
          prepend-icon="bx-plus"
          @click="openCreate"
        >
          {{ t('Add Supplier') }}
        </VBtn>
      </VCardText>

      <VDataTableServer
        :headers="headers"
        :items="suppliers"
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
          v-if="loading && suppliers.length === 0"
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
                style="width:140px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:90px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:60px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:60px;height:22px;border-radius:12px;"
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
                /><div
                  class="sk-box"
                  style="width:28px;height:28px;border-radius:6px;"
                />
              </div>
            </td>
          </tr>
        </template>

        <template #item.city="{ item }">
          {{ item.raw.city || '—' }}
        </template>
        <template #item.rating="{ item }">
          <div class="d-flex align-center gap-1">
            <VIcon
              icon="bx-star"
              size="14"
              color="warning"
            />
            <span>{{ item.raw.rating ?? '—' }}</span>
          </div>
        </template>
        <template #item.is_active="{ item }">
          <VChip
            :color="item.raw.is_active ? 'success' : 'default'"
            size="small"
            variant="tonal"
          >
            {{ item.raw.is_active ? t('Active') : t('Inactive') }}
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
              color="success"
              @click="openPay(item.raw)"
            >
              <VIcon
                size="18"
                icon="bx-dollar-circle"
              />
              <VTooltip
                activator="parent"
                location="top"
              >
                {{ t('Pay supplier') }}
              </VTooltip>
            </VBtn>
            <VBtn
              icon
              variant="text"
              size="small"
              @click="openLedger(item.raw)"
            >
              <VIcon
                size="18"
                icon="bx-receipt"
              />
              <VTooltip
                activator="parent"
                location="top"
              >
                {{ t('Ledger') }}
              </VTooltip>
            </VBtn>
            <VBtn
              icon
              variant="text"
              size="small"
              @click="openDetail(item.raw)"
            >
              <VIcon
                size="18"
                icon="bx-show"
              />
              <VTooltip
                activator="parent"
                location="top"
              >
                {{ t('View') }}
              </VTooltip>
            </VBtn>
            <VBtn
              icon
              variant="text"
              size="small"
              @click="openEdit(item.raw)"
            >
              <VIcon
                size="18"
                icon="bx-edit"
              />
              <VTooltip
                activator="parent"
                location="top"
              >
                {{ t('Edit') }}
              </VTooltip>
            </VBtn>
            <VBtn
              icon
              variant="text"
              size="small"
              color="error"
              @click="confirmDelete(item.raw)"
            >
              <VIcon
                size="18"
                icon="bx-trash"
              />
              <VTooltip
                activator="parent"
                location="top"
              >
                {{ t('Delete') }}
              </VTooltip>
            </VBtn>
          </div>
        </template>
      </VDataTableServer>
    </VCard>

    <!-- Detail Dialog -->
    <VDialog
      v-model="detailDialog"
      max-width="560"
    >
      <VCard
        v-if="detailItem"
        :title="detailItem.name"
      >
        <VCardText>
          <VProgressLinear
            v-if="detailLoading"
            indeterminate
            class="mb-3"
          />
          <VRow dense>
            <VCol cols="6">
              <div class="text-caption text-disabled">
                {{ t('Contact') }}
              </div>
              <div>{{ detailItem.contact_person || '—' }}</div>
            </VCol>
            <VCol cols="6">
              <div class="text-caption text-disabled">
                {{ t('Phone') }}
              </div>
              <div>{{ detailItem.phone || '—' }}</div>
            </VCol>
            <VCol cols="6">
              <div class="text-caption text-disabled">
                {{ t('Email') }}
              </div>
              <div>{{ detailItem.email || '—' }}</div>
            </VCol>
            <VCol cols="6">
              <div class="text-caption text-disabled">
                {{ t('City') }}
              </div>
              <div>{{ detailItem.city || '—' }}</div>
            </VCol>
            <VCol cols="6">
              <div class="text-caption text-disabled">
                {{ t('Payment Terms') }}
              </div>
              <div>{{ detailItem.payment_terms_days ? `${detailItem.payment_terms_days} ${t('days')}` : '—' }}</div>
            </VCol>
            <VCol cols="6">
              <div class="text-caption text-disabled">
                {{ t('Lead Time') }}
              </div>
              <div>{{ detailItem.lead_time_days ? `${detailItem.lead_time_days} ${t('days')}` : '—' }}</div>
            </VCol>
            <VCol cols="6">
              <div class="text-caption text-disabled">
                {{ t('Balance') }}
              </div>
              <div>{{ detailItem.current_balance ?? '—' }}</div>
            </VCol>
            <VCol cols="6">
              <div class="text-caption text-disabled">
                {{ t('Rating') }}
              </div>
              <div class="d-flex align-center gap-1">
                <VIcon
                  icon="bx-star"
                  size="14"
                  color="warning"
                />
                {{ detailItem.rating ?? '—' }}
              </div>
            </VCol>
            <template v-if="detailItem.items?.length">
              <VCol
                cols="12"
                class="mt-2"
              >
                <div class="text-caption text-disabled mb-1">
                  {{ t('Supplied Items') }} ({{ detailItem.item_count }})
                </div>
                <VTable density="compact">
                  <thead><tr><th>{{ t('Item') }}</th><th>{{ t('Price') }}</th><th>{{ t('Unit') }}</th></tr></thead>
                  <tbody>
                    <tr
                      v-for="si in (detailItem.items as any[])"
                      :key="si.id"
                    >
                      <td>{{ si.stock_item_name }}</td>
                      <td>{{ si.price }}</td>
                      <td>{{ si.unit_short }}</td>
                    </tr>
                  </tbody>
                </VTable>
              </VCol>
            </template>
          </VRow>
        </VCardText>
        <VCardActions class="justify-end pa-4 pt-0">
          <VBtn
            variant="tonal"
            @click="detailDialog = false"
          >
            {{ t('Close') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Create / Edit Dialog -->
    <VDialog
      v-model="dialog"
      max-width="560"
      persistent
    >
      <VCard :title="dialogMode === 'create' ? t('Add Supplier') : t('Edit Supplier')">
        <VCardText>
          <VRow>
            <VCol cols="12">
              <VTextField
                v-model="form.name"
                :label="t('Name')"
                required
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model="form.contact_person"
                :label="t('Contact Person')"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model="form.phone"
                :label="t('Phone')"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model="form.email"
                :label="t('Email')"
                type="email"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model="form.city"
                :label="t('City')"
              />
            </VCol>
            <VCol cols="12">
              <VTextField
                v-model="form.address"
                :label="t('Address')"
              />
            </VCol>
            <VCol
              cols="12"
              sm="4"
            >
              <VTextField
                v-model.number="form.rating"
                :label="t('Rating (1-5)')"
                type="number"
                :min="1"
                :max="5"
              />
            </VCol>
            <VCol
              cols="12"
              sm="4"
            >
              <VTextField
                v-model.number="form.payment_terms_days"
                :label="t('Payment Terms (days)')"
                type="number"
                :min="0"
              />
            </VCol>
            <VCol
              cols="12"
              sm="4"
            >
              <VTextField
                v-model.number="form.lead_time_days"
                :label="t('Lead Time (days)')"
                type="number"
                :min="0"
              />
            </VCol>
          </VRow>
        </VCardText>
        <VCardActions class="justify-end gap-2 pa-4 pt-0">
          <VBtn
            variant="tonal"
            color="default"
            @click="dialog = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            :loading="saving"
            @click="save"
          >
            {{ t('Save') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Delete Confirm -->
    <VDialog
      v-model="deleteDialog"
      max-width="400"
    >
      <VCard :title="t('Delete Supplier')">
        <VCardText>{{ t('Are you sure you want to delete') }} <strong>{{ selectedItem?.name }}</strong>?</VCardText>
        <VCardActions class="justify-end gap-2 pa-4 pt-0">
          <VBtn
            variant="tonal"
            color="default"
            @click="deleteDialog = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            color="error"
            :loading="deleting"
            @click="doDelete"
          >
            {{ t('Delete') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Pay dialog -->
    <VDialog
      v-model="payDialog"
      max-width="520"
      persistent
    >
      <VCard :title="t('Pay supplier')">
        <VCardText>
          <div
            v-if="paying"
            class="text-body-2 mb-3"
          >
            {{ paying.name }}<span v-if="paying.current_balance"> · {{ t('Owed') }}: <strong class="text-warning">{{ formatCurrency(paying.current_balance) }}</strong></span>
          </div>
          <VRow>
            <VCol cols="12" sm="6">
              <VTextField
                v-model.number="payForm.amount"
                :label="t('Amount')"
                type="number"
                min="0"
                autofocus
              />
            </VCol>
            <VCol cols="12" sm="6">
              <VSelect
                v-model="payForm.source_account"
                :items="[
                  { title: t('Bank (cards)'), value: 'BANK' },
                  { title: t('Safe (cash)'), value: 'SAFE' },
                ]"
                :label="t('Source account')"
              />
            </VCol>
            <VCol cols="12">
              <VTextField
                v-model.number="payForm.commission"
                :label="t('Commission / fee (optional)')"
                type="number"
                min="0"
                :hint="t('Bank charge — debits same account')"
                persistent-hint
              />
            </VCol>
            <VCol cols="12">
              <VTextField
                v-model="payForm.note"
                :label="t('Note')"
              />
            </VCol>
          </VRow>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            @click="payDialog = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            color="success"
            :loading="paySaving"
            @click="doPay"
          >
            {{ t('Pay') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Ledger drawer -->
    <VDialog
      v-model="ledgerDialog"
      max-width="900"
      scrollable
    >
      <VCard>
        <VCardText class="d-flex align-center justify-space-between py-3">
          <div>
            <div class="text-h6">
              {{ ledgerSupplier?.name }} · {{ t('Ledger') }}
            </div>
            <div
              v-if="ledgerBalance !== null"
              class="text-caption"
            >
              {{ t('Current balance') }}: <strong :class="Number(ledgerBalance) > 0 ? 'text-warning' : 'text-success'">{{ formatCurrency(ledgerBalance) }}</strong>
            </div>
          </div>
          <VBtn
            icon
            variant="text"
            @click="loadLedger"
          >
            <VIcon icon="bx-refresh" />
          </VBtn>
        </VCardText>
        <VDivider />
        <VCardText style="max-height:70vh;overflow-y:auto;">
          <VProgressLinear
            v-if="ledgerLoading"
            indeterminate
            class="mb-3"
          />
          <VTable density="compact">
            <thead>
              <tr>
                <th>{{ t('Date') }}</th>
                <th>{{ t('Type') }}</th>
                <th class="text-end">{{ t('Amount') }}</th>
                <th class="text-end">{{ t('Balance after') }}</th>
                <th>{{ t('Reference') }}</th>
                <th>{{ t('Note') }}</th>
                <th>{{ t('By') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="r in ledgerRows"
                :key="r.id"
              >
                <td>{{ formatDate(r.created_at) }}</td>
                <td>
                  <VChip
                    size="x-small"
                    :color="ledgerTypeColor[r.type] ?? 'default'"
                    variant="tonal"
                  >
                    {{ r.type }}
                  </VChip>
                </td>
                <td
                  class="text-end font-weight-medium"
                  :class="Number(r.amount ?? r.delta) > 0 ? 'text-warning' : 'text-success'"
                >
                  {{ formatCurrency(r.amount ?? r.delta ?? 0) }}
                </td>
                <td class="text-end">{{ formatCurrency(r.balance_after ?? 0) }}</td>
                <td>
                  <span
                    v-if="r.reference_type"
                    class="text-caption text-disabled"
                  >{{ r.reference_type }} #{{ r.reference_id }}</span>
                  <span
                    v-else
                    class="text-disabled"
                  >—</span>
                </td>
                <td class="text-body-2">{{ r.note || r.description || '—' }}</td>
                <td class="text-body-2">{{ r.performed_by || '—' }}</td>
              </tr>
              <tr v-if="!ledgerRows.length && !ledgerLoading">
                <td colspan="7" class="text-center text-disabled py-4">
                  {{ t('No ledger entries') }}
                </td>
              </tr>
            </tbody>
          </VTable>
        </VCardText>
        <VDivider />
        <VCardActions>
          <DataTableFooter
            v-model:page="ledgerPage"
            v-model:items-per-page="ledgerPerPage"
            :total-items="ledgerTotal"
          />
          <VSpacer />
          <VBtn
            variant="text"
            @click="ledgerDialog = false"
          >
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
name: stock-suppliers
meta:
  action: manage
  subject: all
</route>
