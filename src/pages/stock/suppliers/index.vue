<script setup lang="ts">
import axios from '@axios'
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
    if (search.value) params.search = search.value
    if (activeFilter.value !== undefined) params.is_active = activeFilter.value

    const res = await axios.get('/suppliers/', { params })
    const d = res.data
    suppliers.value = d.suppliers ?? []
    total.value = d.pagination?.total_items ?? suppliers.value.length
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
    const d = res.data?.supplier ?? res.data?.data ?? item
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
    loadSuppliers()
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
    loadSuppliers()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error deleting supplier'), 'error')
  }
  finally {
    deleting.value = false
  }
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
        <VBtn prepend-icon="bx-plus" @click="openCreate">{{ t('Add Supplier') }}</VBtn>
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

        <template v-if="loading && suppliers.length === 0" #body>
          <tr v-for="n in itemsPerPage" :key="n" class="sk-row">
            <td class="sk-cell"><div class="sk-box" style="width:140px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:90px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:60px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:60px;height:22px;border-radius:12px;" /></td>
            <td class="sk-cell" style="text-align:end;"><div class="d-flex justify-end gap-1"><div class="sk-box" style="width:28px;height:28px;border-radius:6px;" /><div class="sk-box" style="width:28px;height:28px;border-radius:6px;" /><div class="sk-box" style="width:28px;height:28px;border-radius:6px;" /></div></td>
          </tr>
        </template>

        <template #item.city="{ item }">
          {{ item.raw.city || '—' }}
        </template>
        <template #item.rating="{ item }">
          <div class="d-flex align-center gap-1">
            <VIcon icon="bx-star" size="14" color="warning" />
            <span>{{ item.raw.rating ?? '—' }}</span>
          </div>
        </template>
        <template #item.is_active="{ item }">
          <VChip :color="item.raw.is_active ? 'success' : 'default'" size="small" variant="tonal">
            {{ item.raw.is_active ? t('Active') : t('Inactive') }}
          </VChip>
        </template>
        <template #item.actions="{ item }">
          <div class="d-flex justify-end" style="gap:2px;">
            <VBtn icon variant="text" size="small" @click="openDetail(item.raw)">
              <VIcon size="18" icon="bx-show" />
              <VTooltip activator="parent" location="top">{{ t('View') }}</VTooltip>
            </VBtn>
            <VBtn icon variant="text" size="small" @click="openEdit(item.raw)">
              <VIcon size="18" icon="bx-edit" />
              <VTooltip activator="parent" location="top">{{ t('Edit') }}</VTooltip>
            </VBtn>
            <VBtn icon variant="text" size="small" color="error" @click="confirmDelete(item.raw)">
              <VIcon size="18" icon="bx-trash" />
              <VTooltip activator="parent" location="top">{{ t('Delete') }}</VTooltip>
            </VBtn>
          </div>
        </template>
      </VDataTableServer>
    </VCard>

    <!-- Detail Dialog -->
    <VDialog v-model="detailDialog" max-width="560">
      <VCard v-if="detailItem" :title="detailItem.name">
        <VCardText>
          <VProgressLinear v-if="detailLoading" indeterminate class="mb-3" />
          <VRow dense>
            <VCol cols="6">
              <div class="text-caption text-disabled">{{ t('Contact') }}</div>
              <div>{{ detailItem.contact_person || '—' }}</div>
            </VCol>
            <VCol cols="6">
              <div class="text-caption text-disabled">{{ t('Phone') }}</div>
              <div>{{ detailItem.phone || '—' }}</div>
            </VCol>
            <VCol cols="6">
              <div class="text-caption text-disabled">{{ t('Email') }}</div>
              <div>{{ detailItem.email || '—' }}</div>
            </VCol>
            <VCol cols="6">
              <div class="text-caption text-disabled">{{ t('City') }}</div>
              <div>{{ detailItem.city || '—' }}</div>
            </VCol>
            <VCol cols="6">
              <div class="text-caption text-disabled">{{ t('Payment Terms') }}</div>
              <div>{{ detailItem.payment_terms_days ? `${detailItem.payment_terms_days} ${t('days')}` : '—' }}</div>
            </VCol>
            <VCol cols="6">
              <div class="text-caption text-disabled">{{ t('Lead Time') }}</div>
              <div>{{ detailItem.lead_time_days ? `${detailItem.lead_time_days} ${t('days')}` : '—' }}</div>
            </VCol>
            <VCol cols="6">
              <div class="text-caption text-disabled">{{ t('Balance') }}</div>
              <div>{{ detailItem.current_balance ?? '—' }}</div>
            </VCol>
            <VCol cols="6">
              <div class="text-caption text-disabled">{{ t('Rating') }}</div>
              <div class="d-flex align-center gap-1">
                <VIcon icon="bx-star" size="14" color="warning" />
                {{ detailItem.rating ?? '—' }}
              </div>
            </VCol>
            <template v-if="detailItem.items?.length">
              <VCol cols="12" class="mt-2">
                <div class="text-caption text-disabled mb-1">{{ t('Supplied Items') }} ({{ detailItem.item_count }})</div>
                <VTable density="compact">
                  <thead><tr><th>{{ t('Item') }}</th><th>{{ t('Price') }}</th><th>{{ t('Unit') }}</th></tr></thead>
                  <tbody>
                    <tr v-for="si in (detailItem.items as any[])" :key="si.id">
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
          <VBtn variant="tonal" @click="detailDialog = false">{{ t('Close') }}</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Create / Edit Dialog -->
    <VDialog v-model="dialog" max-width="560" persistent>
      <VCard :title="dialogMode === 'create' ? t('Add Supplier') : t('Edit Supplier')">
        <VCardText>
          <VRow>
            <VCol cols="12">
              <VTextField v-model="form.name" :label="t('Name')" required />
            </VCol>
            <VCol cols="12" sm="6">
              <VTextField v-model="form.contact_person" :label="t('Contact Person')" />
            </VCol>
            <VCol cols="12" sm="6">
              <VTextField v-model="form.phone" :label="t('Phone')" />
            </VCol>
            <VCol cols="12" sm="6">
              <VTextField v-model="form.email" :label="t('Email')" type="email" />
            </VCol>
            <VCol cols="12" sm="6">
              <VTextField v-model="form.city" :label="t('City')" />
            </VCol>
            <VCol cols="12">
              <VTextField v-model="form.address" :label="t('Address')" />
            </VCol>
            <VCol cols="12" sm="4">
              <VTextField v-model.number="form.rating" :label="t('Rating (1-5)')" type="number" :min="1" :max="5" />
            </VCol>
            <VCol cols="12" sm="4">
              <VTextField v-model.number="form.payment_terms_days" :label="t('Payment Terms (days)')" type="number" :min="0" />
            </VCol>
            <VCol cols="12" sm="4">
              <VTextField v-model.number="form.lead_time_days" :label="t('Lead Time (days)')" type="number" :min="0" />
            </VCol>
          </VRow>
        </VCardText>
        <VCardActions class="justify-end gap-2 pa-4 pt-0">
          <VBtn variant="tonal" color="default" @click="dialog = false">{{ t('Cancel') }}</VBtn>
          <VBtn :loading="saving" @click="save">{{ t('Save') }}</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Delete Confirm -->
    <VDialog v-model="deleteDialog" max-width="400">
      <VCard :title="t('Delete Supplier')">
        <VCardText>{{ t('Are you sure you want to delete') }} <strong>{{ selectedItem?.name }}</strong>?</VCardText>
        <VCardActions class="justify-end gap-2 pa-4 pt-0">
          <VBtn variant="tonal" color="default" @click="deleteDialog = false">{{ t('Cancel') }}</VBtn>
          <VBtn color="error" :loading="deleting" @click="doDelete">{{ t('Delete') }}</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VSnackbar v-model="snackbar" :color="snackbarColor" :timeout="3000">{{ snackbarMsg }}</VSnackbar>
  </div>
</template>

<route lang="yaml">
name: stock-suppliers
meta:
  action: manage
  subject: all
</route>
