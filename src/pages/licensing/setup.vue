<script setup lang="ts">
import { licensingApi } from '@/plugins/axios'

const { t } = useI18n({ useScope: 'global' })
const router = useRouter()
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()

const state = ref<any>(null)
const loadingState = ref(true)

const form = ref({
  email: '',
  org_name: '',
  invite_code: '',
})

const submitting = ref(false)
const error = ref('')

async function loadState() {
  loadingState.value = true
  try {
    const res = await licensingApi.get('/status')

    state.value = res.data?.data ?? res.data

    // If the install is already registered, send the user to the status page
    // instead of letting them re-run setup.
    if (state.value?.status && state.value.status !== 'UNREGISTERED')
      router.replace('/licensing/status')
  }
  catch (e: any) {
    error.value = e?.response?.data?.message ?? t('Could not reach licensing server')
  }
  finally {
    loadingState.value = false
  }
}

async function submit() {
  error.value = ''
  if (!form.value.email || !form.value.org_name || !form.value.invite_code) {
    error.value = t('All fields are required')
    return
  }
  submitting.value = true
  try {
    await licensingApi.post('/setup', form.value)
    notify(t('Setup complete — redirecting to login'))

    // Give the kill-switch state a moment to flip to ACTIVE before we
    // bounce; the heartbeat daemon writes it after a successful register.
    setTimeout(() => { window.location.href = '/login' }, 800)
  }
  catch (e: any) {
    error.value = e?.response?.data?.message ?? t('Setup failed')
  }
  finally {
    submitting.value = false
  }
}

onMounted(loadState)
</script>

<template>
  <div
    class="d-flex align-center justify-center"
    style="min-block-size:100vh;padding:24px;"
  >
    <VCard
      max-width="540"
      width="100%"
    >
      <VCardItem>
        <template #prepend>
          <VAvatar
            color="warning"
            variant="tonal"
            size="44"
            rounded
          >
            <VIcon icon="bx-key" />
          </VAvatar>
        </template>
        <VCardTitle>{{ t('Activate this POS install') }}</VCardTitle>
        <VCardSubtitle>{{ t('Enter your invite code to activate the license.') }}</VCardSubtitle>
      </VCardItem>

      <VCardText>
        <VAlert
          v-if="loadingState"
          type="info"
          variant="tonal"
          class="mb-4"
        >
          {{ t('Checking license status...') }}
        </VAlert>

        <VAlert
          v-else-if="state && state.status === 'UNREGISTERED'"
          type="warning"
          variant="tonal"
          class="mb-4"
        >
          {{ t('This install is not registered. The panel cannot reach any business endpoint until setup completes.') }}
        </VAlert>

        <VAlert
          v-if="error"
          type="error"
          variant="tonal"
          closable
          class="mb-4"
          @click:close="error = ''"
        >
          {{ error }}
        </VAlert>

        <VForm @submit.prevent="submit">
          <VTextField
            v-model="form.email"
            :label="t('Email')"
            type="email"
            autofocus
            class="mb-3"
            :disabled="submitting"
          />
          <VTextField
            v-model="form.org_name"
            :label="t('Organization name')"
            class="mb-3"
            :disabled="submitting"
          />
          <VTextField
            v-model="form.invite_code"
            :label="t('Invite code')"
            :hint="t('Provided by your POS vendor')"
            persistent-hint
            :disabled="submitting"
            class="mb-4"
          />
          <VBtn
            type="submit"
            color="primary"
            :loading="submitting"
            block
          >
            {{ t('Activate') }}
          </VBtn>
        </VForm>
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
  layout: blank
  action: read
  subject: Auth
</route>
