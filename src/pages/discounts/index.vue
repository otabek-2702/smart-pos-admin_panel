<script setup lang="ts">
import { discountsApi as axios } from '@/plugins/axios'
import DataTableFooter from '@core/components/DataTableFooter.vue'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatCurrency } = useFormatters()

const discounts = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const itemsPerPage = ref(10)
const search = ref('')
const isActiveFilter = ref<boolean | undefined>(undefined)

const types = ref<any[]>([])

const dialog = ref(false)
const editing = ref<any>(null)
const saving = ref(false)

const form = ref({
  name: '',
  code: '',
  discount_type_id: null as number | null,
  discount_method: 'PERCENTAGE',
  value: 0,
  min_order_amount: 0,
  is_active: true,
  starts_at: '',
  ends_at: '',
  secret_word: '',
})

const methodColor: Record<string, string> = {
  PERCENTAGE: 'success',
  FIXED: 'info',
}

const headers = [
  { title: t('Name'), key: 'name', sortable: false },
  { title: t('Code'), key: 'code', sortable: false },
  { title: t('Type'), key: 'discount_type', sortable: false },
  { title: t('Method'), key: 'discount_method', sortable: false },
  { title: t('Value'), key: 'value', sortable: false },
  { title: t('Status'), key: 'is_active', sortable: false },
  { title: t('Actions'), key: 'actions', sortable: false, align: 'end' as const },
]

async function loadDiscounts() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (search.value)
      params.search = search.value
    if (isActiveFilter.value !== undefined)
      params.is_active = isActiveFilter.value
    const res = await axios.get('/discounts/', { params })
    const d = res.data?.data ?? res.data

    discounts.value = d?.discounts ?? d?.items ?? []
    total.value = d?.pagination?.total_items ?? d?.pagination?.total ?? discounts.value.length
  }
  catch {
    notify(t('Failed to load discounts'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function loadTypes() {
  try {
    const res = await axios.get('/types/', { params: { per_page: 100 } })
    const d = res.data?.data ?? res.data

    types.value = d?.discount_types ?? d?.types ?? d?.items ?? []
  }
  catch { /* ignore */ }
}

onMounted(() => { loadDiscounts(); loadTypes() })
watch([page, itemsPerPage], loadDiscounts)

const debouncedSearch = useDebounceFn(() => { page.value = 1; loadDiscounts() }, 400)

watch(search, debouncedSearch)
watch(isActiveFilter, () => { page.value = 1; loadDiscounts() })

function openCreate() {
  editing.value = null
  form.value = {
    name: '',
    code: '',
    discount_type_id: types.value[0]?.id ?? null,
    discount_method: 'PERCENTAGE',
    value: 0,
    min_order_amount: 0,
    is_active: true,
    starts_at: '',
    ends_at: '',
    secret_word: '',
  }
  dialog.value = true
}

function openEdit(d: any) {
  editing.value = d
  form.value = {
    name: d.name ?? '',
    code: d.code ?? '',
    discount_type_id: d.discount_type?.id ?? d.discount_type_id ?? null,
    discount_method: d.discount_method ?? 'PERCENTAGE',
    value: Number(d.value ?? 0),
    min_order_amount: Number(d.min_order_amount ?? 0),
    is_active: d.is_active ?? true,
    starts_at: d.starts_at ?? '',
    ends_at: d.ends_at ?? '',
    secret_word: d.secret_word ?? '',
  }
  dialog.value = true
}

async function save() {
  saving.value = true
  try {
    if (editing.value)
      await axios.put(`/discounts/${editing.value.id}/`, form.value)
    else
      await axios.post('/discounts/', form.value)
    notify(t(editing.value ? 'Discount updated' : 'Discount created'))
    dialog.value = false
    loadDiscounts()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    saving.value = false
  }
}

async function toggleActive(d: any) {
  try {
    await axios.post(`/discounts/${d.id}/toggle/`)
    notify(t('Status updated'))
    loadDiscounts()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}

async function remove(d: any) {
  if (!confirm(t('Delete this discount?')))
    return
  try {
    await axios.delete(`/discounts/${d.id}/`)
    notify(t('Discount deleted'))
    loadDiscounts()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}
</script>

<template>
  <div>
    <VCard>
      <VCardText class="d-flex align-center gap-3 py-3 flex-wrap">
        <VTextField
          v-model="search"
          :placeholder="t('Search discounts...')"
          prepend-inner-icon="bx-search"
          density="compact"
          style="min-inline-size:200px;max-inline-size:280px;"
          hide-details
          clearable
        />
        <VSelect
          v-model="isActiveFilter"
          :items="[{ title: t('Active'), value: true }, { title: t('Inactive'), value: false }]"
          :placeholder="t('Status')"
          density="compact"
          style="min-inline-size:160px;"
          hide-details
          clearable
        />
        <VSpacer />
        <VBtn
          color="primary"
          prepend-icon="bx-plus"
          @click="openCreate"
        >
          {{ t('New Discount') }}
        </VBtn>
      </VCardText>

      <VDataTableServer
        :headers="headers"
        :items="discounts"
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
          v-if="loading && discounts.length === 0"
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
                style="width:80px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:100px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:80px;height:22px;border-radius:12px;"
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
                  style="width:32px;height:32px;border-radius:6px;"
                />
                <div
                  class="sk-box"
                  style="width:32px;height:32px;border-radius:6px;"
                />
              </div>
            </td>
          </tr>
        </template>

        <template #item.discount_type="{ item }">
          {{ item.raw.discount_type?.name ?? '—' }}
        </template>
        <template #item.discount_method="{ item }">
          <VChip
            size="small"
            :color="methodColor[item.raw.discount_method] ?? 'default'"
            variant="tonal"
          >
            {{ item.raw.discount_method }}
          </VChip>
        </template>
        <template #item.value="{ item }">
          {{ item.raw.discount_method === 'PERCENTAGE' ? `${item.raw.value}%` : formatCurrency(item.raw.value ?? 0) }}
        </template>
        <template #item.is_active="{ item }">
          <VChip
            size="small"
            :color="item.raw.is_active ? 'success' : 'default'"
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
              :color="item.raw.is_active ? 'warning' : 'success'"
              @click="toggleActive(item.raw)"
            >
              <VIcon
                :icon="item.raw.is_active ? 'bx-pause' : 'bx-play'"
                size="18"
              />
              <VTooltip
                activator="parent"
                location="top"
              >
                {{ item.raw.is_active ? t('Deactivate') : t('Activate') }}
              </VTooltip>
            </VBtn>
            <VBtn
              icon
              variant="text"
              size="small"
              @click="openEdit(item.raw)"
            >
              <VIcon
                icon="bx-edit-alt"
                size="18"
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
              @click="remove(item.raw)"
            >
              <VIcon
                icon="bx-trash"
                size="18"
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

    <VDialog
      v-model="dialog"
      max-width="640"
      persistent
    >
      <VCard :title="editing ? t('Edit Discount') : t('New Discount')">
        <VCardText>
          <VRow>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model="form.name"
                :label="t('Name')"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model="form.code"
                :label="t('Code')"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VSelect
                v-model="form.discount_type_id"
                :items="types.map((t: any) => ({ title: t.name, value: t.id }))"
                :label="t('Type')"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VSelect
                v-model="form.discount_method"
                :items="['PERCENTAGE', 'FIXED']"
                :label="t('Method')"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model.number="form.value"
                :label="t('Value')"
                type="number"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model.number="form.min_order_amount"
                :label="t('Min Order Amount')"
                type="number"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model="form.starts_at"
                type="datetime-local"
                :label="t('Starts At')"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model="form.ends_at"
                type="datetime-local"
                :label="t('Ends At')"
              />
            </VCol>
            <VCol cols="12">
              <VTextField
                v-model="form.secret_word"
                :label="t('Secret Word (optional)')"
              />
            </VCol>
            <VCol cols="12">
              <VSwitch
                v-model="form.is_active"
                :label="t('Active')"
              />
            </VCol>
          </VRow>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            @click="dialog = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            color="primary"
            :loading="saving"
            @click="save"
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
