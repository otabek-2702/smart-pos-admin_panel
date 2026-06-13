<script setup lang="ts">
import { licensingApi } from '@/plugins/axios'

const { t } = useI18n({ useScope: 'global' })
const { formatDate } = useFormatters()
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()

const state = ref<any>(null)
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    const res = await licensingApi.get('/status')

    state.value = res.data?.data ?? res.data
  }
  finally {
    loading.value = false
  }
}

onMounted(load)

const statusColor: Record<string, string> = {
  ACTIVE: 'success',
  UNREGISTERED: 'warning',
  SUSPENDED: 'error',
  EXPIRED: 'error',
  GRACE: 'warning',
}

const statusDescription: Record<string, string> = {
  ACTIVE: 'License is active. The heartbeat daemon is keeping it alive.',
  UNREGISTERED: 'This install has not been registered. No business endpoints will respond.',
  SUSPENDED: 'License has been suspended by the vendor. Contact your POS vendor to restore service.',
  EXPIRED: 'Subscription has expired. Contact your POS vendor to renew.',
  GRACE: 'License is in a grace period after a failed heartbeat. Will reactivate on next successful check-in.',
}
</script>

<template>
  <div>
    <div class="page-head">
      <div style="min-width:0;">
        <h1 class="page-head__title">{{ t('License Status') }}</h1>
        <div class="page-head__subtitle">{{ t('Snapshot from /api/licensing/status') }}</div>
      </div>
      <div class="page-head__actions">
        <VBtn
          variant="tonal"
          prepend-icon="bx-refresh"
          :loading="loading"
          @click="load"
        >
          {{ t('Refresh') }}
        </VBtn>
      </div>
    </div>

    <VCard
      v-if="loading"
      class="mb-4"
    >
      <VCardText>
        <div
          class="sk-box mb-2"
          style="width:120px;height:14px;border-radius:4px;"
        />
        <div
          class="sk-box mb-2"
          style="width:240px;height:24px;border-radius:4px;"
        />
        <div
          class="sk-box"
          style="width:80%;height:14px;border-radius:4px;"
        />
      </VCardText>
    </VCard>

    <VCard
      v-else-if="state"
      class="mb-4"
    >
      <VCardText>
        <div class="d-flex align-center gap-3 mb-3">
          <VChip
            class="status-pill"
            :color="statusColor[state.status] ?? 'default'"
            size="large"
            variant="tonal"
          >
            <VIcon
              start
              :icon="state.is_blocked ? 'bx-x-circle' : 'bx-check-circle'"
            />
            {{ state.status }}
          </VChip>
          <VChip
            v-if="state.is_blocked"
            class="status-pill"
            color="error"
            size="small"
            variant="tonal"
          >
            {{ t('Kill switch active') }}
          </VChip>
        </div>

        <div class="text-body-2 text-disabled mb-4">
          {{ t(statusDescription[state.status] ?? 'Unknown license state.') }}
        </div>

        <VRow>
          <VCol
            cols="12"
            sm="6"
          >
            <div class="text-caption text-disabled">
              {{ t('Organization') }}
            </div>
            <div class="text-body-1 font-weight-medium">
              {{ state.tenant?.org_name ?? '—' }}
            </div>
          </VCol>
          <VCol
            cols="12"
            sm="6"
          >
            <div class="text-caption text-disabled">
              {{ t('Contact email') }}
            </div>
            <div class="text-body-1 font-weight-medium">
              {{ state.tenant?.email ?? '—' }}
            </div>
          </VCol>
          <VCol
            cols="12"
            sm="6"
          >
            <div class="text-caption text-disabled">
              {{ t('Expires at') }}
            </div>
            <div class="text-body-1 font-weight-medium">
              {{ state.expires_at ? formatDate(state.expires_at) : '—' }}
            </div>
          </VCol>
          <VCol
            cols="12"
            sm="6"
          >
            <div class="text-caption text-disabled">
              {{ t('Last heartbeat') }}
            </div>
            <div class="text-body-1 font-weight-medium">
              {{ state.last_heartbeat_at ? formatDate(state.last_heartbeat_at) : '—' }}
            </div>
          </VCol>
          <VCol
            v-if="state.grace_until"
            cols="12"
            sm="6"
          >
            <div class="text-caption text-disabled">
              {{ t('Grace until') }}
            </div>
            <div class="text-body-1 font-weight-medium text-warning">
              {{ formatDate(state.grace_until) }}
            </div>
          </VCol>
          <VCol
            v-if="state.reason"
            cols="12"
            sm="6"
          >
            <div class="text-caption text-disabled">
              {{ t('Reason') }}
            </div>
            <div class="text-body-1 font-weight-medium text-error">
              {{ state.reason }}
            </div>
          </VCol>
        </VRow>

        <VAlert
          v-if="state.message"
          type="info"
          variant="tonal"
          class="mt-4"
        >
          {{ state.message }}
        </VAlert>
      </VCardText>

      <VCardActions class="pa-4">
        <VBtn
          v-if="state.status === 'UNREGISTERED'"
          color="primary"
          prepend-icon="bx-key"
          to="/licensing/setup"
        >
          {{ t('Run setup') }}
        </VBtn>
        <VSpacer />
      </VCardActions>
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
