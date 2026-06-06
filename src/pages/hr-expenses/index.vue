<script setup lang="ts">
import { hrApi as axios } from '@/plugins/axios'
import DataTableFooter from '@core/components/DataTableFooter.vue'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatCurrency, formatDate } = useFormatters()

const items = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const itemsPerPage = ref(20)
const stats = ref<any>(null)

const dialog = ref(false)
const editing = ref<any>(null)
const saving = ref(false)

const form = ref({
  category_id: null as number | null,
  amount: 0,
  description: '',
  expense_date: new Date().toISOString().slice(0, 10),
  receipt_number: '',
})

const categories = ref<any[]>([])

const headers = [
  { title: t('Date'), key: 'expense_date', sortable: false },
  { title: t('Category'), key: 'category', sortable: false },
  { title: t('Description'), key: 'description', sortable: false },
  { title: t('Amount'), key: 'amount', sortable: false },
  { title: t('Status'), key: 'status', sortable: false },
  { title: t('Actions'), key: 'actions', sortable: false, align: 'end' as const },
]

const statusColor: Record<string, string> = {
  PENDING: 'warning',
  APPROVED: 'info',
  REJECTED: 'error',
  PAID: 'success',
}

async function load() {
  loading.value = true
  try {
    const res = await axios.get('/expenses/', { params: { page: page.value, per_page: itemsPerPage.value } })
    const d = res.data?.data ?? res.data

    items.value = d?.expenses ?? d?.items ?? []
    total.value = d?.pagination?.total_items ?? d?.pagination?.total ?? items.value.length
  }
  catch {
    notify(t('Failed to load'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    const res = await axios.get('/expenses/stats/')

    stats.value = res.data?.data ?? res.data
  }
  catch { /* ignore */ }
}

async function loadCategories() {
  try {
    const res = await axios.get('/expense-categories/', { params: { per_page: 100 } })
    const d = res.data?.data ?? res.data

    categories.value = d?.expense_categories ?? d?.categories ?? d?.items ?? []
  }
  catch { /* ignore */ }
}

onMounted(() => { load(); loadStats(); loadCategories() })
watch([page, itemsPerPage], load)

function openCreate() {
  editing.value = null
  form.value = {
    category_id: categories.value[0]?.id ?? null,
    amount: 0,
    description: '',
    expense_date: new Date().toISOString().slice(0, 10),
    receipt_number: '',
  }
  dialog.value = true
}

async function save() {
  saving.value = true
  try {
    await axios.post('/expenses/', form.value)
    notify(t('Expense created'))
    dialog.value = false
    await Promise.all([load(), loadStats()])
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    saving.value = false
  }
}

async function approve(e: any) {
  try {
    await axios.post(`/expenses/${e.id}/approve/`)
    notify(t('Approved'))
    await Promise.all([load(), loadStats()])
  }
  catch (err: any) {
    notify(err?.response?.data?.message ?? t('Error'), 'error')
  }
}

async function reject(e: any) {
  const reason = prompt(t('Rejection reason') as string)
  if (!reason)
    return
  try {
    await axios.post(`/expenses/${e.id}/reject/`, { notes: reason })
    notify(t('Rejected'))
    await Promise.all([load(), loadStats()])
  }
  catch (err: any) {
    notify(err?.response?.data?.message ?? t('Error'), 'error')
  }
}

async function pay(e: any) {
  try {
    await axios.post(`/expenses/${e.id}/pay/`)
    notify(t('Paid'))
    await Promise.all([load(), loadStats()])
  }
  catch (err: any) {
    notify(err?.response?.data?.message ?? t('Error'), 'error')
  }
}

// ---------- Category manager ----------
const catDialog = ref(false)
const catSaving = ref(false)
const catEditing = ref<any>(null)
const catForm = ref({ name: '', description: '' })

function openCatManager() {
  catEditing.value = null
  catForm.value = { name: '', description: '' }
  catDialog.value = true
}

function pickCat(c: any) {
  catEditing.value = c
  catForm.value = { name: c.name ?? '', description: c.description ?? '' }
}

async function saveCat() {
  if (!catForm.value.name.trim()) {
    notify(t('Name is required'), 'error')

    return
  }
  catSaving.value = true
  try {
    if (catEditing.value)
      await axios.put(`/expense-categories/${catEditing.value.id}/`, catForm.value)
    else
      await axios.post('/expense-categories/', catForm.value)
    notify(catEditing.value ? t('Category updated') : t('Category created'))
    catEditing.value = null
    catForm.value = { name: '', description: '' }
    await loadCategories()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    catSaving.value = false
  }
}

async function deleteCat(c: any) {
  if (!confirm(t('Delete this category?')))
    return
  try {
    await axios.delete(`/expense-categories/${c.id}/`)
    notify(t('Deleted'))
    if (catEditing.value?.id === c.id) {
      catEditing.value = null
      catForm.value = { name: '', description: '' }
    }
    await loadCategories()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
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
          <VCardText>
            <div class="text-subtitle-1 font-weight-bold">
              <template v-if="stats">
                {{ stats.pending_count ?? 0 }}
              </template>
              <span
                v-else
                class="sk-box d-inline-block"
                style="width:36px;height:1em;border-radius:4px;"
              />
            </div>
            <div class="text-caption text-disabled">
              {{ t('Pending') }}
            </div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol
        cols="6"
        sm="3"
      >
        <VCard>
          <VCardText>
            <div class="text-subtitle-1 font-weight-bold">
              <template v-if="stats">
                {{ formatCurrency(stats.total_amount ?? 0) }}
              </template>
              <span
                v-else
                class="sk-box d-inline-block"
                style="width:80px;height:1em;border-radius:4px;"
              />
            </div>
            <div class="text-caption text-disabled">
              {{ t('Total') }}
            </div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol
        cols="6"
        sm="3"
      >
        <VCard>
          <VCardText>
            <div class="text-subtitle-1 font-weight-bold">
              <template v-if="stats">
                {{ formatCurrency(stats.this_month ?? 0) }}
              </template>
              <span
                v-else
                class="sk-box d-inline-block"
                style="width:80px;height:1em;border-radius:4px;"
              />
            </div>
            <div class="text-caption text-disabled">
              {{ t('This Month') }}
            </div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol
        cols="6"
        sm="3"
      >
        <VCard>
          <VCardText>
            <div class="text-subtitle-1 font-weight-bold">
              <template v-if="stats">
                {{ formatCurrency(stats.paid_amount ?? 0) }}
              </template>
              <span
                v-else
                class="sk-box d-inline-block"
                style="width:80px;height:1em;border-radius:4px;"
              />
            </div>
            <div class="text-caption text-disabled">
              {{ t('Paid') }}
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <VCard>
      <VCardText class="d-flex align-center justify-space-between py-3 flex-wrap gap-2">
        <span class="text-h6">{{ t('Expenses') }}</span>
        <div class="d-flex gap-2">
          <VBtn
            variant="tonal"
            prepend-icon="bx-folder"
            @click="openCatManager"
          >
            {{ t('Categories') }}
          </VBtn>
          <VBtn
            color="primary"
            prepend-icon="bx-plus"
            @click="openCreate"
          >
            {{ t('New Expense') }}
          </VBtn>
        </div>
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
        <template #item.expense_date="{ item }">
          {{ formatDate(item.raw.expense_date) }}
        </template>
        <template #item.category="{ item }">
          {{ item.raw.category?.name ?? '—' }}
        </template>
        <template #item.amount="{ item }">
          <span class="font-weight-medium">{{ formatCurrency(item.raw.amount ?? 0) }}</span>
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
            <template v-if="item.raw.status === 'PENDING'">
              <VBtn
                icon
                variant="text"
                size="small"
                color="success"
                @click="approve(item.raw)"
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
                icon
                variant="text"
                size="small"
                color="error"
                @click="reject(item.raw)"
              >
                <VIcon
                  icon="bx-x"
                  size="18"
                />
                <VTooltip
                  activator="parent"
                  location="top"
                >
                  {{ t('Reject') }}
                </VTooltip>
              </VBtn>
            </template>
            <VBtn
              v-if="item.raw.status === 'APPROVED'"
              icon
              variant="text"
              size="small"
              color="success"
              @click="pay(item.raw)"
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
      v-model="dialog"
      max-width="520"
      persistent
    >
      <VCard :title="t('New Expense')">
        <VCardText>
          <VRow>
            <VCol cols="12">
              <VSelect
                v-model="form.category_id"
                :items="categories.map((c: any) => ({ title: c.name, value: c.id }))"
                :label="t('Category')"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model.number="form.amount"
                :label="t('Amount')"
                type="number"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model="form.expense_date"
                type="date"
                :label="t('Date')"
              />
            </VCol>
            <VCol cols="12">
              <VTextField
                v-model="form.receipt_number"
                :label="t('Reference Number')"
              />
            </VCol>
            <VCol cols="12">
              <VTextarea
                v-model="form.description"
                :label="t('Description')"
                rows="2"
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

    <VDialog
      v-model="catDialog"
      max-width="720"
      scrollable
    >
      <VCard :title="t('Expense Categories')">
        <VCardText style="max-height:70vh;overflow-y:auto;">
          <VRow>
            <VCol
              cols="12"
              md="5"
            >
              <div class="text-subtitle-2 mb-2">
                {{ catEditing ? t('Edit Category') : t('New Category') }}
              </div>
              <VTextField
                v-model="catForm.name"
                :label="t('Name')"
                class="mb-2"
                density="compact"
              />
              <VTextarea
                v-model="catForm.description"
                :label="t('Description')"
                rows="3"
                density="compact"
                class="mb-2"
              />
              <div class="d-flex gap-2">
                <VBtn
                  color="primary"
                  size="small"
                  :loading="catSaving"
                  @click="saveCat"
                >
                  {{ catEditing ? t('Save') : t('Add') }}
                </VBtn>
                <VBtn
                  v-if="catEditing"
                  variant="tonal"
                  size="small"
                  @click="catEditing = null; catForm = { name: '', description: '' }"
                >
                  {{ t('Cancel') }}
                </VBtn>
              </div>
            </VCol>
            <VCol
              cols="12"
              md="7"
            >
              <div class="text-subtitle-2 mb-2">
                {{ t('Existing') }} ({{ categories.length }})
              </div>
              <VList
                density="compact"
                class="pa-0"
                style="border:1px solid rgba(var(--v-theme-on-surface),0.08);border-radius:6px;max-height:340px;overflow-y:auto;"
              >
                <VListItem
                  v-for="c in categories"
                  :key="c.id"
                  :active="catEditing?.id === c.id"
                  @click="pickCat(c)"
                >
                  <VListItemTitle>{{ c.name }}</VListItemTitle>
                  <VListItemSubtitle v-if="c.description">
                    {{ c.description }}
                  </VListItemSubtitle>
                  <template #append>
                    <VBtn
                      icon
                      variant="text"
                      size="x-small"
                      color="error"
                      @click.stop="deleteCat(c)"
                    >
                      <VIcon
                        icon="bx-trash"
                        size="16"
                      />
                    </VBtn>
                  </template>
                </VListItem>
                <VListItem v-if="!categories.length">
                  <VListItemTitle class="text-disabled">
                    {{ t('No categories yet') }}
                  </VListItemTitle>
                </VListItem>
              </VList>
            </VCol>
          </VRow>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            @click="catDialog = false"
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
meta:
  action: manage
  subject: all
</route>
