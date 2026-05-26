<script setup lang="ts">
import axios from '@axios'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()

const settings = ref<any>({ hr_enabled: false, waiter_enabled: false, stock_enabled: false })
const loading = ref(false)
const saving = ref(false)

async function load() {
  loading.value = true
  try {
    const res = await axios.get('/app-settings')
    const d = res.data?.data ?? res.data
    if (d?.settings)
      settings.value = { ...settings.value, ...d.settings }
  }
  catch {
    notify(t('Failed to load settings'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    await axios.put('/app-settings', settings.value)
    notify(t('Settings saved'))
    load()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    saving.value = false
  }
}

onMounted(load)

const modules = computed(() => [
  { key: 'hr_enabled', icon: 'bx-group', label: 'HR Module', description: 'Employees, salaries, expenses, attendance, leaves, contracts.' },
  { key: 'stock_enabled', icon: 'bx-package', label: 'Stock Module', description: 'Inventory, recipes, suppliers, batches, purchase orders.' },
  { key: 'waiter_enabled', icon: 'bx-restaurant', label: 'Waiter Mode', description: 'Enable waiter-specific role and order flow.' },
])
</script>

<template>
  <div>
    <VRow>
      <VCol
        cols="12"
        md="8"
      >
        <VCard>
          <VCardItem>
            <VCardTitle>{{ t('App Modules') }}</VCardTitle>
            <VCardSubtitle>{{ t('Toggle modules on or off across the entire system') }}</VCardSubtitle>
          </VCardItem>
          <VDivider />
          <VCardText>
            <template v-if="loading">
              <div
                v-for="n in 3"
                :key="n"
                class="mb-3"
              >
                <div
                  class="sk-box"
                  style="width:100%;height:80px;border-radius:8px;"
                />
              </div>
            </template>
            <template v-else>
              <div
                v-for="m in modules"
                :key="m.key"
                class="d-flex align-center gap-3 pa-3 mb-2"
                style="border:1px solid rgba(var(--v-theme-on-surface),0.12);border-radius:8px;"
              >
                <VAvatar
                  :color="settings[m.key] ? 'success' : 'default'"
                  variant="tonal"
                  size="48"
                >
                  <VIcon
                    :icon="m.icon"
                    size="24"
                  />
                </VAvatar>
                <div class="flex-grow-1">
                  <div class="text-body-1 font-weight-medium">
                    {{ t(m.label) }}
                  </div>
                  <div class="text-caption text-disabled">
                    {{ t(m.description) }}
                  </div>
                </div>
                <VSwitch
                  v-model="settings[m.key]"
                  color="primary"
                  hide-details
                  inset
                />
              </div>
            </template>

            <div class="d-flex justify-end mt-4">
              <VBtn
                color="primary"
                :loading="saving"
                prepend-icon="bx-save"
                @click="save"
              >
                {{ t('Save Changes') }}
              </VBtn>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        md="4"
      >
        <VCard>
          <VCardItem>
            <VCardTitle>{{ t('Tip') }}</VCardTitle>
          </VCardItem>
          <VDivider />
          <VCardText class="text-body-2 text-disabled">
            {{ t('Disabling a module hides its endpoints and navigation. Settings persist across logins.') }}
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

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
