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

const headers = [
  { title: t('Employee'), key: 'employee', sortable: false },
  { title: t('Contract Type'), key: 'contract_type', sortable: false },
  { title: t('Start'), key: 'start_date', sortable: false },
  { title: t('End'), key: 'end_date', sortable: false },
  { title: t('Salary'), key: 'salary', sortable: false },
  { title: t('Status'), key: 'status', sortable: false },
  { title: t('Actions'), key: 'actions', sortable: false, align: 'end' as const },
]

const statusColor: Record<string, string> = {
  DRAFT: 'default',
  ACTIVE: 'success',
  EXPIRED: 'warning',
  TERMINATED: 'error',
}

async function load() {
  loading.value = true
  try {
    const res = await axios.get('/contracts/', { params: { page: page.value, per_page: itemsPerPage.value } })
    const d = res.data?.data ?? res.data

    items.value = d?.contracts ?? d?.items ?? []
    total.value = d?.pagination?.total_items ?? d?.pagination?.total ?? items.value.length
  }
  catch {
    notify(t('Failed to load'), 'error')
  }
  finally {
    loading.value = false
  }
}

onMounted(load)
watch([page, itemsPerPage], load)

async function activate(c: any) {
  try {
    await axios.post(`/contracts/${c.id}/activate/`)
    notify(t('Activated'))
    load()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}

async function terminate(c: any) {
  if (!confirm(t('Terminate this contract?')))
    return
  try {
    await axios.post(`/contracts/${c.id}/terminate/`)
    notify(t('Terminated'))
    load()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}
</script>

<template>
  <div>
    <VCard>
      <VCardText class="d-flex align-center justify-space-between py-3">
        <span class="text-h6">{{ t('Contracts') }}</span>
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
        <template #item.employee="{ item }">
          {{ item.raw.employee?.user?.first_name }} {{ item.raw.employee?.user?.last_name }}
        </template>
        <template #item.contract_type="{ item }">
          <VChip
            size="small"
            color="info"
            variant="tonal"
          >
            {{ item.raw.contract_type }}
          </VChip>
        </template>
        <template #item.start_date="{ item }">
          {{ formatDate(item.raw.start_date) }}
        </template>
        <template #item.end_date="{ item }">
          {{ item.raw.end_date ? formatDate(item.raw.end_date) : '—' }}
        </template>
        <template #item.salary="{ item }">
          {{ formatCurrency(item.raw.salary ?? item.raw.base_salary ?? 0) }}
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
            <VBtn
              v-if="item.raw.status === 'DRAFT'"
              icon
              variant="text"
              size="small"
              color="success"
              @click="activate(item.raw)"
            >
              <VIcon
                icon="bx-play"
                size="18"
              />
              <VTooltip
                activator="parent"
                location="top"
              >
                {{ t('Activate') }}
              </VTooltip>
            </VBtn>
            <VBtn
              v-if="item.raw.status === 'ACTIVE'"
              icon
              variant="text"
              size="small"
              color="error"
              @click="terminate(item.raw)"
            >
              <VIcon
                icon="bx-stop"
                size="18"
              />
              <VTooltip
                activator="parent"
                location="top"
              >
                {{ t('Terminate') }}
              </VTooltip>
            </VBtn>
          </div>
        </template>
      </VDataTableServer>
    </VCard>

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
