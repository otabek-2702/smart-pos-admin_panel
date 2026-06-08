<script setup lang="ts">
import { getCurrentApiHost, setApiHost } from '@/plugins/axios'

const { t } = useI18n({ useScope: 'global' })

const dialog = ref(false)
const input = ref('')
const probing = ref(false)
const probeResult = ref<'ok' | 'fail' | null>(null)
const probeMessage = ref('')

const current = computed(() => getCurrentApiHost() || t('(relative — vite proxy / nginx)'))

function open() {
  input.value = getCurrentApiHost()
  probeResult.value = null
  probeMessage.value = ''
  dialog.value = true
}

function clear() {
  input.value = ''
}

async function probe() {
  probing.value = true
  probeResult.value = null
  probeMessage.value = ''
  try {
    const host = input.value.trim().replace(/\/+$/, '')
    const url = `${host || ''}/healthz`
    const res = await fetch(url, { method: 'GET' })
    if (res.ok) {
      probeResult.value = 'ok'
      probeMessage.value = `${res.status} ${res.statusText}`
    }
    else {
      probeResult.value = 'fail'
      probeMessage.value = `${res.status} ${res.statusText}`
    }
  }
  catch (e: any) {
    probeResult.value = 'fail'
    probeMessage.value = e?.message ?? 'Network error'
  }
  finally {
    probing.value = false
  }
}

function save() {
  setApiHost(input.value)
  // Full reload so every module re-reads localStorage and axios picks up
  // the new baseURL on first request, not after lazy interceptor fire.
  window.location.reload()
}

function quickPreset(host: string) {
  input.value = host
}
</script>

<template>
  <div>
    <IconBtn @click="open">
      <VIcon icon="bx-server" />
      <VTooltip
        activator="parent"
        location="bottom"
      >
        {{ t('Backend URL') }}
      </VTooltip>
    </IconBtn>

    <VDialog
      v-model="dialog"
      max-width="560"
    >
      <VCard :title="t('Backend URL')">
        <VCardText>
          <div class="text-caption text-disabled mb-3">
            {{ t('Currently') }}: <code>{{ current }}</code>
          </div>

          <VTextField
            v-model="input"
            :label="t('Base URL')"
            placeholder="http://127.0.0.1:8000"
            density="compact"
            :hint="t('No trailing slash. Leave empty to fall back to the build default / vite proxy.')"
            persistent-hint
            autofocus
          />

          <div class="d-flex flex-wrap gap-2 mt-3">
            <VChip
              size="small"
              variant="tonal"
              @click="quickPreset('http://127.0.0.1:8000')"
            >
              {{ t('Local') }}: 127.0.0.1:8000
            </VChip>
            <VChip
              size="small"
              variant="tonal"
              @click="quickPreset('http://localhost:8000')"
            >
              localhost:8000
            </VChip>
            <VChip
              size="small"
              variant="tonal"
              @click="clear"
            >
              {{ t('Clear / default') }}
            </VChip>
          </div>

          <VAlert
            v-if="probeResult === 'ok'"
            type="success"
            variant="tonal"
            class="mt-3"
            density="compact"
          >
            {{ t('Reached') }} <code>/healthz</code> · {{ probeMessage }}
          </VAlert>
          <VAlert
            v-else-if="probeResult === 'fail'"
            type="error"
            variant="tonal"
            class="mt-3"
            density="compact"
          >
            {{ t('Could not reach') }} <code>/healthz</code> · {{ probeMessage }}
          </VAlert>

          <div class="text-caption text-disabled mt-3">
            {{ t('Saving reloads the page so every axios instance picks up the new URL.') }}
          </div>
        </VCardText>
        <VCardActions>
          <VBtn
            variant="tonal"
            prepend-icon="bx-link"
            :loading="probing"
            @click="probe"
          >
            {{ t('Test') }}
          </VBtn>
          <VSpacer />
          <VBtn
            variant="text"
            @click="dialog = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            color="primary"
            @click="save"
          >
            {{ t('Save & reload') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>
