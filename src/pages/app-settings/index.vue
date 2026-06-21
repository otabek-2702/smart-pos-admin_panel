<script setup lang="ts">
import axios from '@/plugins/axios'

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
  { key: 'hr_enabled', icon: 'bx-group', label: 'app_module_hr', description: 'app_module_hr_hint' },
  { key: 'stock_enabled', icon: 'bx-package', label: 'app_module_stock', description: 'app_module_stock_hint' },
  { key: 'waiter_enabled', icon: 'bx-restaurant', label: 'app_module_waiter', description: 'app_module_waiter_hint' },
])
</script>

<template>
  <div class="app-settings-page">
    <!-- Page head -->
    <div class="page-head">
      <div>
        <h1 class="page-head__title">
          {{ t('App Settings') }}
        </h1>
        <div class="page-head__subtitle">
          {{ t('Toggle modules on or off across the entire system') }}
        </div>
      </div>
    </div>

    <VRow>
      <VCol
        cols="12"
        md="8"
      >
        <!-- Modules panel -->
        <VCard class="settings-panel">
          <div class="card__head">
            <div class="card__head-title">
              {{ t('App Modules') }}
            </div>
            <div class="card__head-sub">
              {{ t('Toggle modules on or off across the entire system') }}
            </div>
          </div>

          <div class="settings-list">
            <template v-if="loading">
              <div
                v-for="n in 3"
                :key="n"
                class="setting-row"
              >
                <div
                  class="kpi-card__icon t-neutral"
                  style="visibility:hidden;"
                />
                <div class="setting-row__body">
                  <div
                    class="sk-box"
                    style="width:160px;height:16px;border-radius:4px;margin-bottom:8px;"
                  />
                  <div
                    class="sk-box"
                    style="width:80%;height:12px;border-radius:4px;"
                  />
                </div>
                <div
                  class="sk-box"
                  style="width:46px;height:24px;border-radius:12px;"
                />
              </div>
            </template>
            <template v-else>
              <div
                v-for="m in modules"
                :key="m.key"
                class="setting-row"
              >
                <div
                  class="kpi-card__icon"
                  :class="settings[m.key] ? 't-success' : 't-neutral'"
                >
                  <VIcon
                    :icon="m.icon"
                    size="20"
                  />
                </div>
                <div class="setting-row__body">
                  <div class="setting-row__label">
                    {{ t(m.label) }}
                  </div>
                  <div class="setting-row__hint">
                    {{ t(m.description) }}
                  </div>
                </div>
                <VSwitch
                  v-model="settings[m.key]"
                  color="primary"
                  hide-details
                  inset
                  density="compact"
                />
              </div>
            </template>
          </div>

          <!-- Save bar -->
          <div class="save-bar">
            <VBtn
              variant="outlined"
              color="default"
              :disabled="loading || saving"
              prepend-icon="bx-reset"
              @click="load"
            >
              {{ t('Reset') }}
            </VBtn>
            <VBtn
              color="primary"
              :loading="saving"
              :disabled="loading"
              prepend-icon="bx-save"
              @click="save"
            >
              {{ t('Save') }}
            </VBtn>
          </div>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        md="4"
      >
        <!-- Tip panel -->
        <VCard class="settings-panel">
          <div class="card__head">
            <div class="card__head-title">
              {{ t('Tip') }}
            </div>
            <div class="card__head-sub">
              {{ t('How module toggles affect the app') }}
            </div>
          </div>
          <div class="tip-body text-muted">
            {{ t('Disabling a module hides its endpoints and navigation. Settings persist across logins.') }}
          </div>
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

<style lang="scss" scoped>
.app-settings-page {
  /* container */
}

.settings-panel {
  overflow: hidden;
}

.card__head {
  padding: var(--sp-5);
  border-block-end: 1px solid rgb(var(--v-theme-border));

  &-title {
    font-size: var(--fs-h3);
    font-weight: var(--fw-semibold);
    color: rgb(var(--v-theme-on-surface));
    letter-spacing: -0.01em;
  }

  &-sub {
    margin-block-start: 4px;
    font-size: var(--fs-sm);
    color: rgb(var(--v-theme-text-secondary));
  }
}

.settings-list {
  display: flex;
  flex-direction: column;
}

.setting-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: var(--sp-4) var(--sp-5);
  border-block-end: 1px solid rgb(var(--v-theme-border));

  &:last-child {
    border-block-end: none;
  }

  &__body {
    flex: 1 1 auto;
    min-inline-size: 0;
  }

  &__label {
    font-size: var(--fs-body);
    font-weight: var(--fw-semibold);
    color: rgb(var(--v-theme-on-surface));
    line-height: 1.3;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  &__hint {
    margin-block-start: 2px;
    font-size: var(--fs-sm);
    color: rgb(var(--v-theme-text-secondary));
    line-height: 1.4;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
}

.save-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: var(--sp-4) var(--sp-5);
  border-block-start: 1px solid rgb(var(--v-theme-border));
  background: rgb(var(--v-theme-surface-2));
}

.tip-body {
  padding: var(--sp-5);
  font-size: var(--fs-sm);
  line-height: 1.55;
}

@media (max-width: 768px) {
  .card__head,
  .save-bar,
  .tip-body {
    padding: var(--sp-4);
  }

  .setting-row {
    gap: 10px;
    padding: var(--sp-3) var(--sp-4);
  }
}

@media (max-width: 420px) {
  .setting-row {
    flex-wrap: wrap;
  }

  .setting-row__body {
    flex: 1 1 0;
  }

  .save-bar {
    justify-content: stretch;
  }

  .save-bar > .v-btn {
    flex: 1 1 100%;
  }
}
</style>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>
