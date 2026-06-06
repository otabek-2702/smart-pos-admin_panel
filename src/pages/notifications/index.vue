<script setup lang="ts">
import { notificationsApi as axios } from '@/plugins/axios'
import DataTableFooter from '@core/components/DataTableFooter.vue'

const { t, te } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatDate } = useFormatters()

const tab = ref<'settings' | 'templates' | 'logs'>('settings')

// Settings
const settings = ref<any>(null)
const settingsLoading = ref(false)
const settingsSaving = ref(false)
const status = ref<any>(null)

// Templates
const templates = ref<any[]>([])
const templatesLoading = ref(false)

// Logs
const logs = ref<any[]>([])
const logsTotal = ref(0)
const logsLoading = ref(false)
const logsPage = ref(1)
const logsPerPage = ref(20)

const logHeaders = [
  { title: t('Date'), key: 'created_at', sortable: false },
  { title: t('Type'), key: 'notification_type', sortable: false },
  { title: t('Recipient'), key: 'recipient', sortable: false },
  { title: t('Status'), key: 'status', sortable: false },
  { title: t('Message'), key: 'message', sortable: false },
]

async function loadSettings() {
  settingsLoading.value = true
  try {
    const [s, st] = await Promise.allSettled([
      axios.get('/settings/'),
      axios.get('/settings/status/'),
    ])

    if (s.status === 'fulfilled')
      settings.value = s.value.data?.data ?? s.value.data
    if (st.status === 'fulfilled')
      status.value = st.value.data?.data ?? st.value.data
  }
  finally {
    settingsLoading.value = false
  }
}

async function saveSettings() {
  settingsSaving.value = true
  try {
    const payload: any = {
      brand_name: settings.value.brand_name,
      is_enabled: settings.value.is_enabled,
      timeout: settings.value.timeout,
      chat_ids: Array.isArray(settings.value.chat_ids) ? settings.value.chat_ids : [],
    }
    if (settings.value.bot_token)
      payload.bot_token = settings.value.bot_token
    await axios.put('/settings/', payload)
    notify(t('Settings saved'))
    loadSettings()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    settingsSaving.value = false
  }
}

async function testSettings() {
  try {
    await axios.post('/settings/test/')
    notify(t('Test notification sent'))
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}

async function loadTemplates() {
  templatesLoading.value = true
  try {
    const res = await axios.get('/templates/')
    const d = res.data?.data ?? res.data

    templates.value = Array.isArray(d) ? d : (d?.templates ?? d?.items ?? [])
  }
  catch {
    notify(t('Failed to load templates'), 'error')
  }
  finally {
    templatesLoading.value = false
  }
}

async function toggleTemplate(tpl: any) {
  try {
    await axios.put(`/types/${tpl.notification_type}/`, { is_enabled: !tpl.is_enabled })
    notify(t('Updated'))
    await loadTemplates()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}

async function loadLogs() {
  logsLoading.value = true
  try {
    const res = await axios.get('/logs/', { params: { page: logsPage.value, per_page: logsPerPage.value } })
    const d = res.data?.data

    logs.value = Array.isArray(d) ? d : (d?.logs ?? d?.items ?? [])
    const pag = res.data?.pagination
    logsTotal.value = pag?.total_items ?? pag?.total ?? logs.value.length
  }
  catch {
    notify(t('Failed to load logs'), 'error')
  }
  finally {
    logsLoading.value = false
  }
}

async function processQueue() {
  try {
    await axios.post('/queue/process/')
    notify(t('Queue processed'))
    await loadLogs()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}

onMounted(loadSettings)
watch(tab, val => {
  if (val === 'templates' && templates.value.length === 0)
    loadTemplates()
  if (val === 'logs' && logs.value.length === 0)
    loadLogs()
})
watch([logsPage, logsPerPage], loadLogs)

const statusColor: Record<string, string> = {
  SENT: 'success',
  FAILED: 'error',
  PENDING: 'warning',
  QUEUED: 'info',
}
</script>

<template>
  <div>
    <VCard>
      <VTabs
        v-model="tab"
        color="primary"
      >
        <VTab value="settings">
          <VIcon
            start
            icon="bx-cog"
          />{{ t('Settings') }}
        </VTab>
        <VTab value="templates">
          <VIcon
            start
            icon="bx-message-square-detail"
          />{{ t('Templates') }}
        </VTab>
        <VTab value="logs">
          <VIcon
            start
            icon="bx-history"
          />{{ t('Logs') }}
        </VTab>
      </VTabs>
      <VDivider />

      <VCardText>
        <!-- Settings tab -->
        <VWindow v-model="tab">
          <VWindowItem value="settings">
            <template v-if="!settings && settingsLoading">
              <div
                v-for="n in 6"
                :key="n"
                class="mb-3"
              >
                <div
                  class="sk-box mb-1"
                  style="width:140px;height:14px;border-radius:4px;"
                />
                <div
                  class="sk-box"
                  style="width:100%;height:48px;border-radius:6px;"
                />
              </div>
            </template>
            <template v-else-if="settings">
              <VAlert
                v-if="status"
                :type="status.is_configured ? 'success' : 'warning'"
                variant="tonal"
                class="mb-4"
              >
                {{ status.is_configured ? t('Notifications are configured') : t('Notifications need configuration') }}
              </VAlert>
              <VRow>
                <VCol
                  cols="12"
                  sm="6"
                >
                  <VTextField
                    v-model="settings.brand_name"
                    :label="t('Brand Name')"
                  />
                </VCol>
                <VCol
                  cols="12"
                  sm="6"
                >
                  <VTextField
                    v-model="settings.bot_token"
                    :label="t('Bot Token')"
                    type="password"
                    :placeholder="settings.bot_configured ? t('(configured — enter to replace)') : ''"
                  />
                </VCol>
                <VCol
                  cols="12"
                  sm="6"
                >
                  <VTextField
                    v-model.number="settings.timeout"
                    :label="t('Timeout (sec)')"
                    type="number"
                    min="1"
                  />
                </VCol>
                <VCol cols="12">
                  <VCombobox
                    v-model="settings.chat_ids"
                    :label="t('Chat IDs')"
                    :placeholder="t('Type a chat ID and press Enter')"
                    multiple
                    chips
                    closable-chips
                  />
                </VCol>
                <VCol cols="12">
                  <VSwitch
                    v-model="settings.is_enabled"
                    :label="t('Enabled')"
                  />
                </VCol>
              </VRow>
              <div class="d-flex gap-2">
                <VBtn
                  color="primary"
                  :loading="settingsSaving"
                  @click="saveSettings"
                >
                  {{ t('Save') }}
                </VBtn>
                <VBtn
                  variant="tonal"
                  prepend-icon="bx-test-tube"
                  @click="testSettings"
                >
                  {{ t('Send Test') }}
                </VBtn>
              </div>
            </template>
          </VWindowItem>

          <!-- Templates tab -->
          <VWindowItem value="templates">
            <VList>
              <template v-if="templatesLoading && templates.length === 0">
                <VListItem
                  v-for="n in 5"
                  :key="n"
                >
                  <div
                    class="sk-box"
                    style="width:100%;height:50px;border-radius:6px;"
                  />
                </VListItem>
              </template>
              <VListItem
                v-for="tpl in templates"
                :key="tpl.id"
                class="border-b"
              >
                <VListItemTitle>{{ tpl.name }}</VListItemTitle>
                <VListItemSubtitle class="text-caption">
                  {{ te(`notif_type_${tpl.notification_type}`) ? t(`notif_type_${tpl.notification_type}`) : tpl.notification_type }} · {{ tpl.language }}
                </VListItemSubtitle>
                <template #append>
                  <VSwitch
                    :model-value="tpl.is_enabled"
                    color="primary"
                    hide-details
                    inset
                    @update:model-value="toggleTemplate(tpl)"
                  />
                </template>
              </VListItem>
            </VList>
          </VWindowItem>

          <!-- Logs tab -->
          <VWindowItem value="logs">
            <div class="d-flex justify-end mb-2 gap-2">
              <VBtn
                variant="tonal"
                prepend-icon="bx-refresh"
                @click="loadLogs"
              >
                {{ t('Refresh') }}
              </VBtn>
              <VBtn
                color="primary"
                prepend-icon="bx-play"
                @click="processQueue"
              >
                {{ t('Process Queue') }}
              </VBtn>
            </div>
            <VDataTableServer
              :headers="logHeaders"
              :items="logs"
              :items-length="logsTotal"
              :loading="logsLoading"
              :items-per-page="logsPerPage"
              :page="logsPage"
            >
              <template #bottom>
                <DataTableFooter
                  v-model:page="logsPage"
                  v-model:items-per-page="logsPerPage"
                  :total-items="logsTotal"
                />
              </template>
              <template #item.created_at="{ item }">
                {{ formatDate(item.raw.created_at) }}
              </template>
              <template #item.status="{ item }">
                <VChip
                  size="small"
                  :color="statusColor[item.raw.status] ?? 'default'"
                  variant="tonal"
                >
                  {{ te(`notif_log_status_${item.raw.status}`) ? t(`notif_log_status_${item.raw.status}`) : item.raw.status }}
                </VChip>
              </template>
              <template #item.message="{ item }">
                <span class="text-body-2 text-disabled">{{ item.raw.message ?? item.raw.error ?? '—' }}</span>
              </template>
            </VDataTableServer>
          </VWindowItem>
        </VWindow>
      </VCardText>
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
