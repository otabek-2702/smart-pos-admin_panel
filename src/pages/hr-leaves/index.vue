<script setup lang="ts">
import { hrApi as axios } from '@/plugins/axios'
import DataTableFooter from '@core/components/DataTableFooter.vue'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatDate } = useFormatters()

const items = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const itemsPerPage = ref(20)
const statusFilter = ref<string | undefined>(undefined)

const headers = [
  { title: t('Employee'), key: 'employee', sortable: false },
  { title: t('Leave Type'), key: 'leave_type', sortable: false },
  { title: t('From'), key: 'start_date', sortable: false },
  { title: t('To'), key: 'end_date', sortable: false },
  { title: t('Days'), key: 'days', sortable: false },
  { title: t('Status'), key: 'status', sortable: false },
  { title: t('Actions'), key: 'actions', sortable: false, align: 'end' as const },
]

const statusColor: Record<string, string> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
  CANCELLED: 'default',
}

async function load() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (statusFilter.value)
      params.status = statusFilter.value
    const res = await axios.get('/leaves/', { params })
    const d = res.data?.data ?? res.data

    items.value = d?.leave_requests ?? d?.leaves ?? d?.items ?? []
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
watch([page, itemsPerPage, statusFilter], load)

async function approve(l: any) {
  try {
    await axios.post(`/leaves/${l.id}/approve/`)
    notify(t('Approved'))
    load()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}

async function reject(l: any) {
  const reason = prompt(t('Rejection reason') as string)
  if (!reason)
    return
  try {
    await axios.post(`/leaves/${l.id}/reject/`, { reason })
    notify(t('Rejected'))
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
      <VCardText class="d-flex align-center gap-3 py-3 flex-wrap">
        <span class="text-h6">{{ t('Leave Requests') }}</span>
        <VSpacer />
        <VSelect
          v-model="statusFilter"
          :items="['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']"
          :placeholder="t('Status')"
          density="compact"
          style="min-inline-size:160px;"
          hide-details
          clearable
        />
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
        <template #item.leave_type="{ item }">
          {{ item.raw.leave_type?.name ?? '—' }}
        </template>
        <template #item.start_date="{ item }">
          {{ formatDate(item.raw.start_date) }}
        </template>
        <template #item.end_date="{ item }">
          {{ formatDate(item.raw.end_date) }}
        </template>
        <template #item.days="{ item }">
          {{ item.raw.days ?? item.raw.duration ?? '—' }}
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
            v-if="item.raw.status === 'PENDING'"
            class="d-flex justify-end"
            style="gap:2px;"
          >
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
