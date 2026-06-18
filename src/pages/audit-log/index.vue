<script setup lang="ts">
import axios from '@/plugins/axios'
import DataTableFooter from '@core/components/DataTableFooter.vue'

const { t } = useI18n({ useScope: 'global' })
const { formatDate } = useFormatters()
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()

const items = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const itemsPerPage = ref(50)

const actionFilter = ref<string | undefined>(undefined)
const dateFrom = ref('')
const dateTo = ref('')

const headers = [
  { title: t('When'), key: 'created_at', sortable: false, width: '180px' },
  { title: t('Actor'), key: 'actor', sortable: false },
  { title: t('Action'), key: 'action', sortable: false },
  { title: t('Target'), key: 'target', sortable: false },
  { title: t('Metadata'), key: 'metadata', sortable: false },
]

async function load() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (actionFilter.value)
      params.action = actionFilter.value
    if (dateFrom.value)
      params.date_from = dateFrom.value
    if (dateTo.value)
      params.date_to = dateTo.value
    const res = await axios.get('/audit-log', { params })
    const d = res.data?.data ?? res.data

    items.value = d?.logs ?? d?.items ?? []
    total.value = d?.pagination?.total_items ?? d?.pagination?.total ?? d?.pagination?.total_logs ?? items.value.length
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Failed to load'), 'error')
  }
  finally {
    loading.value = false
  }
}

onMounted(load)
watch([page, itemsPerPage, actionFilter, dateFrom, dateTo], load)

const actionColor: Record<string, string> = {
  USER_CREATE: 'success',
  USER_DELETE: 'error',
  USER_UPDATE: 'info',
  PRODUCT_PRICE_CHANGE: 'warning',
  DISCOUNT_APPLY: 'primary',
  INKASSA_PERFORM: 'success',
  ORDER_CANCEL: 'error',
}

function shortMetadata(meta: any): string {
  if (!meta)
    return ''
  if (typeof meta === 'string')
    return meta
  const parts: string[] = []
  for (const [k, v] of Object.entries(meta)) {
    const val = Array.isArray(v) ? v.join(', ') : String(v)

    parts.push(`${k}=${val.length > 40 ? `${val.slice(0, 40)}…` : val}`)
  }
  return parts.join(' · ')
}
</script>

<template>
  <div>
    <div class="page-head">
      <div style="min-width:0;">
        <h1 class="page-head__title">
          {{ t('Audit Log') }}
        </h1>
        <div class="page-head__subtitle">
          {{ t('Trail of admin actions across the system') }}
        </div>
      </div>
      <div class="page-head__actions" />
    </div>

    <VCard>
      <VCardText class="d-flex align-center gap-3 py-3 flex-wrap">
        <VTextField
          v-model="actionFilter"
          :placeholder="t('Action filter (e.g. USER_CREATE)')"
          density="compact"
          style="min-inline-size:240px;"
          hide-details
          clearable
        />
        <VTextField
          v-model="dateFrom"
          type="date"
          :label="t('From')"
          density="compact"
          hide-details
          style="max-inline-size:170px;"
          clearable
        />
        <VTextField
          v-model="dateTo"
          type="date"
          :label="t('To')"
          density="compact"
          hide-details
          style="max-inline-size:170px;"
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
            :per-page-options="[20, 50, 100, 200]"
          />
        </template>

        <template
          v-if="loading && items.length === 0"
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
                style="width:150px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:120px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:140px;height:22px;border-radius:12px;"
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
                style="width:240px;height:13px;border-radius:4px;"
              />
            </td>
          </tr>
        </template>

        <template #item.created_at="{ item }">
          <span class="text-body-2">{{ formatDate(item.raw.created_at) }}</span>
        </template>
        <template #item.actor="{ item }">
          <div
            v-if="item.raw.actor"
            class="d-flex align-center gap-2"
          >
            <VAvatar
              size="28"
              color="primary"
              variant="tonal"
            >
              <span class="text-caption">{{ (item.raw.actor.first_name ?? item.raw.actor.email ?? '?')[0] }}</span>
            </VAvatar>
            <span class="text-body-2">{{ item.raw.actor.first_name }} {{ item.raw.actor.last_name }}</span>
          </div>
          <span
            v-else
            class="text-disabled"
          >{{ t('system') }}</span>
        </template>
        <template #item.action="{ item }">
          <VChip
            class="status-pill"
            size="small"
            :color="actionColor[item.raw.action] ?? 'default'"
            variant="tonal"
          >
            {{ item.raw.action }}
          </VChip>
        </template>
        <template #item.target="{ item }">
          <div
            v-if="item.raw.target_type"
            class="text-body-2"
          >
            <span class="font-weight-medium">{{ item.raw.target_type }}</span>
            <span
              v-if="item.raw.target_id"
              class="text-disabled"
            > #{{ item.raw.target_id }}</span>
          </div>
          <span
            v-else
            class="text-disabled"
          >—</span>
        </template>
        <template #item.metadata="{ item }">
          <span class="text-caption text-disabled">{{ shortMetadata(item.raw.metadata) }}</span>
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
