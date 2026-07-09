<script setup lang="ts">
import { notificationsApi as axios } from '@/plugins/axios'

const { t } = useI18n({ useScope: 'global' })
const { formatDate } = useFormatters()
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()

// Settings
const settings = ref<any>(null)
const settingsLoading = ref(false)
const settingsSaving = ref(false)

// Accounts (top 100 by balance)
const accounts = ref<any[]>([])
const accountsLoading = ref(false)
const accountsError = ref(false)

// Search + filters (client-side over the loaded top list)
const search = ref('')
const onlyRedeemable = ref(false)

// Direct phone lookup (server) — lets a cashier serve any customer,
// not just the top-100 by balance.
const lookupResult = ref<any>(null)
const lookupLoading = ref(false)
const lookupError = ref('')

// Redeem dialog
const redeemDialog = ref(false)
const redeemPhone = ref('')
const redeeming = ref(false)

async function loadSettings() {
  settingsLoading.value = true
  try {
    const res = await axios.get('/loyalty/settings/')

    settings.value = res.data?.data ?? res.data
  }
  catch {
    notify(t('Failed to load settings'), 'error')
  }
  finally {
    settingsLoading.value = false
  }
}

async function saveSettings() {
  // Backend rejects zero / negative thresholds (422) — guard client-side
  // so the operator gets an inline hint instead of a raw error.
  const perOrder = Number(settings.value?.stamps_per_completed_order)
  const perReward = Number(settings.value?.stamps_per_reward)
  if (!Number.isInteger(perOrder) || perOrder <= 0 || !Number.isInteger(perReward) || perReward <= 0) {
    notify(t('Stamps values must be positive whole numbers'), 'error')

    return
  }

  settingsSaving.value = true
  try {
    await axios.put('/loyalty/settings/', settings.value)
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

async function loadAccounts() {
  accountsLoading.value = true
  accountsError.value = false
  try {
    const res = await axios.get('/loyalty/accounts/')
    const d = res.data?.data ?? res.data

    accounts.value = Array.isArray(d) ? d : (d?.accounts ?? d?.items ?? [])
  }
  catch {
    accountsError.value = true
    notify(t('Failed to load accounts'), 'error')
  }
  finally {
    accountsLoading.value = false
  }
}

async function lookupPhone(phone: string) {
  const p = (phone ?? '').trim()
  if (!p)
    return
  lookupLoading.value = true
  lookupError.value = ''
  lookupResult.value = null
  try {
    const res = await axios.get(`/loyalty/accounts/${encodeURIComponent(p)}/`)

    lookupResult.value = res.data?.data ?? res.data
  }
  catch (e: any) {
    if (e?.response?.status === 404)
      lookupError.value = t('No loyalty account for that phone')
    else
      lookupError.value = e?.response?.data?.message ?? t('Lookup failed')
  }
  finally {
    lookupLoading.value = false
  }
}

function doLookup() {
  lookupPhone(search.value)
}

function clearLookup() {
  lookupResult.value = null
  lookupError.value = ''
}

// Reset any prior server lookup when the query changes.
watch(search, () => {
  if (lookupResult.value || lookupError.value)
    clearLookup()
})

function openRedeem(account: any) {
  redeemPhone.value = account.phone_number
  redeemDialog.value = true
}

async function doRedeem() {
  redeeming.value = true
  try {
    await axios.post(`/loyalty/accounts/${encodeURIComponent(redeemPhone.value)}/redeem/`)
    notify(t('Reward redeemed'))
    redeemDialog.value = false
    await loadAccounts()
    // Keep an open lookup card in sync with the new balance.
    if (lookupResult.value?.phone_number)
      await lookupPhone(lookupResult.value.phone_number)
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Redeem failed'), 'error')
  }
  finally {
    redeeming.value = false
  }
}

onMounted(() => { loadSettings(); loadAccounts() })

const headers = computed(() => [
  { title: t('Phone'), key: 'phone_number', sortable: false },
  { title: t('Balance'), key: 'stamps_balance', sortable: true },
  { title: t('Earned (total)'), key: 'stamps_earned_total', sortable: true },
  { title: t('Redeemed (total)'), key: 'stamps_redeemed_total', sortable: true },
  { title: t('Last activity'), key: 'updated_at', sortable: true },
  { title: t('Actions'), key: 'actions', sortable: false, align: 'end' as const },
])

const stampsForReward = computed(() => settings.value?.stamps_per_reward ?? 10)
function canRedeem(a: any) {
  return !!settings.value?.is_enabled && Number(a?.stamps_balance) >= stampsForReward.value
}
function progressPct(a: any) {
  const bal = Number(a?.stamps_balance) || 0
  const thr = stampsForReward.value || 1

  return Math.max(0, Math.min(100, Math.round((bal / thr) * 100)))
}
function stampsToGo(a: any) {
  return Math.max(0, stampsForReward.value - (Number(a?.stamps_balance) || 0))
}

// Client-side search + filter over the loaded top list.
const digitsQuery = computed(() => (search.value ?? '').replace(/\D/g, ''))
const filteredAccounts = computed(() => {
  let list = accounts.value
  if (onlyRedeemable.value)
    list = list.filter(canRedeem)
  const q = digitsQuery.value
  if (q)
    list = list.filter(a => String(a.phone_number ?? '').replace(/\D/g, '').includes(q))

  return list
})

// Offer a server lookup when the typed phone matches nothing in the top list.
const showLookupPrompt = computed(() =>
  digitsQuery.value.length >= 4 && filteredAccounts.value.length === 0 && !lookupResult.value && !lookupError.value)

// KPI summary over the loaded top customers.
const kpiMembers = computed(() => accounts.value.length)
const kpiRedeemable = computed(() => accounts.value.filter(canRedeem).length)
const kpiOutstanding = computed(() => accounts.value.reduce((s, a) => s + (Number(a?.stamps_balance) || 0), 0))
const kpiRedeemed = computed(() => accounts.value.reduce((s, a) => s + (Number(a?.stamps_redeemed_total) || 0), 0))
const kpisLoading = computed(() => accountsLoading.value && accounts.value.length === 0)

const rewardLabel = computed(() => (settings.value?.reward_description || '').trim() || t('a reward'))
</script>

<template>
  <div>
    <div class="page-head">
      <div style="min-width:0;">
        <h1 class="page-head__title">
          {{ t('Loyalty') }}
        </h1>
        <div class="page-head__subtitle">
          {{ t('Stamps program and top customers') }}
        </div>
      </div>
      <div class="page-head__actions" />
    </div>

    <!-- KPI summary -->
    <div class="lty-kpis mb-6">
      <VCard class="lty-kpi">
        <div class="lty-kpi__label">
          {{ t('Members') }}
        </div>
        <div class="lty-kpi__value num-tabular">
          <div
            v-if="kpisLoading"
            class="sk-box"
            style="width:56px;height:28px;border-radius:6px;"
          />
          <template v-else>
            {{ kpiMembers }}
          </template>
        </div>
      </VCard>
      <VCard class="lty-kpi">
        <div class="lty-kpi__label">
          {{ t('Redeemable now') }}
        </div>
        <div class="lty-kpi__value lty-kpi__value--accent num-tabular">
          <div
            v-if="kpisLoading"
            class="sk-box"
            style="width:56px;height:28px;border-radius:6px;"
          />
          <template v-else>
            {{ kpiRedeemable }}
          </template>
        </div>
      </VCard>
      <VCard class="lty-kpi">
        <div class="lty-kpi__label">
          {{ t('Stamps outstanding') }}
        </div>
        <div class="lty-kpi__value num-tabular">
          <div
            v-if="kpisLoading"
            class="sk-box"
            style="width:72px;height:28px;border-radius:6px;"
          />
          <template v-else>
            {{ kpiOutstanding }}
          </template>
        </div>
      </VCard>
      <VCard class="lty-kpi">
        <div class="lty-kpi__label">
          {{ t('Redeemed stamps') }}
        </div>
        <div class="lty-kpi__value num-tabular">
          <div
            v-if="kpisLoading"
            class="sk-box"
            style="width:72px;height:28px;border-radius:6px;"
          />
          <template v-else>
            {{ kpiRedeemed }}
          </template>
        </div>
      </VCard>
    </div>

    <VRow>
      <VCol
        cols="12"
        md="5"
      >
        <VCard :title="t('Loyalty Settings')">
          <VCardText>
            <template v-if="settingsLoading || !settings">
              <div
                v-for="n in 4"
                :key="n"
                class="mb-3"
              >
                <div
                  class="sk-box mb-1"
                  style="width:120px;height:14px;border-radius:4px;"
                />
                <div
                  class="sk-box"
                  style="width:100%;height:48px;border-radius:6px;"
                />
              </div>
            </template>
            <template v-else>
              <VAlert
                :type="settings.is_enabled ? 'success' : 'warning'"
                variant="tonal"
                class="mb-4"
              >
                {{ settings.is_enabled
                  ? t('Loyalty program is active. Customers earn stamps on every completed paid order.')
                  : t('Loyalty program is disabled. Stamps are not being awarded.') }}
              </VAlert>

              <VSwitch
                v-model="settings.is_enabled"
                color="primary"
                :label="t('Enabled')"
                hide-details
                inset
                class="mb-4"
              />

              <VTextField
                v-model.number="settings.stamps_per_completed_order"
                :label="t('Stamps per completed order')"
                type="number"
                min="1"
                :hint="t('Awarded automatically when an order moves to COMPLETED + paid')"
                persistent-hint
                class="mb-4"
              />

              <VTextField
                v-model.number="settings.stamps_per_reward"
                :label="t('Stamps needed for one reward')"
                type="number"
                min="1"
                :hint="t('Cashier can redeem a reward once this threshold is reached')"
                persistent-hint
                class="mb-4"
              />

              <VTextField
                v-model="settings.reward_description"
                :label="t('Reward description')"
                :hint="t('Shown to customers in the Telegram bot, e.g. \'Free coffee\'')"
                persistent-hint
              />
            </template>
          </VCardText>
          <VCardActions>
            <VSpacer />
            <VBtn
              color="primary"
              :loading="settingsSaving"
              :disabled="!settings"
              prepend-icon="bx-save"
              @click="saveSettings"
            >
              {{ t('Save') }}
            </VBtn>
          </VCardActions>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        md="7"
      >
        <VCard>
          <VCardText class="d-flex flex-wrap align-center gap-3">
            <div class="d-flex flex-column" style="min-width:0;">
              <span class="text-h6">{{ t('Top Customers') }}</span>
              <span class="text-caption text-disabled">{{ t('Top 100 by stamp balance') }}</span>
            </div>
            <VSpacer />
            <VTextField
              v-model="search"
              :placeholder="t('Search or look up by phone')"
              prepend-inner-icon="bx-search"
              density="compact"
              hide-details
              clearable
              style="max-width:260px;"
              @keyup.enter="doLookup"
            />
            <VBtn
              variant="tonal"
              prepend-icon="bx-refresh"
              :loading="accountsLoading"
              @click="loadAccounts"
            >
              {{ t('Refresh') }}
            </VBtn>
          </VCardText>

          <div class="d-flex align-center px-4 pb-2">
            <VSwitch
              v-model="onlyRedeemable"
              color="success"
              :label="t('Only redeemable')"
              density="compact"
              hide-details
              inset
            />
          </div>

          <!-- Direct phone lookup result / prompt -->
          <div
            v-if="showLookupPrompt || lookupLoading || lookupResult || lookupError"
            class="px-4 pb-3"
          >
            <VBtn
              v-if="showLookupPrompt"
              variant="tonal"
              color="primary"
              prepend-icon="bx-search-alt"
              :loading="lookupLoading"
              block
              @click="doLookup"
            >
              {{ t('Look up "{phone}" directly', { phone: search }) }}
            </VBtn>

            <VAlert
              v-else-if="lookupError"
              type="warning"
              variant="tonal"
              closable
              @click:close="clearLookup"
            >
              {{ lookupError }}
            </VAlert>

            <VCard
              v-else-if="lookupResult"
              variant="tonal"
              :color="canRedeem(lookupResult) ? 'success' : 'primary'"
            >
              <VCardText class="d-flex flex-wrap align-center gap-4">
                <div style="min-width:0;">
                  <div class="text-caption text-disabled">
                    {{ t('Found via lookup') }}
                  </div>
                  <div class="text-h6 num-tabular">
                    {{ lookupResult.phone_number }}
                  </div>
                  <div class="text-body-2 num-tabular">
                    {{ lookupResult.stamps_balance }} / {{ stampsForReward }} {{ t('stamps') }}
                    <span v-if="!canRedeem(lookupResult)" class="text-disabled">
                      · {{ t('{n} to go', { n: stampsToGo(lookupResult) }) }}
                    </span>
                  </div>
                </div>
                <VSpacer />
                <VBtn
                  color="success"
                  :disabled="!canRedeem(lookupResult)"
                  prepend-icon="bx-gift"
                  @click="openRedeem(lookupResult)"
                >
                  {{ t('Redeem') }}
                </VBtn>
                <VBtn
                  icon
                  variant="text"
                  size="small"
                  @click="clearLookup"
                >
                  <VIcon icon="bx-x" size="20" />
                  <VTooltip activator="parent" location="top">
                    {{ t('Close') }}
                  </VTooltip>
                </VBtn>
              </VCardText>
            </VCard>
          </div>

          <!-- Error + retry -->
          <div
            v-if="accountsError && accounts.length === 0"
            class="d-flex flex-column align-center justify-center text-center pa-10"
          >
            <VIcon
              icon="bx-error-circle"
              size="40"
              class="text-disabled mb-3"
            />
            <div class="text-body-1 mb-1">
              {{ t('Could not load customers') }}
            </div>
            <VBtn
              variant="tonal"
              prepend-icon="bx-refresh"
              class="mt-3"
              @click="loadAccounts"
            >
              {{ t('Retry') }}
            </VBtn>
          </div>

          <VDataTable
            v-else
            :headers="headers"
            :items="filteredAccounts"
            :loading="accountsLoading"
            hide-default-footer
            :items-per-page="100"
          >
            <template
              v-if="accountsLoading && accounts.length === 0"
              #body
            >
              <tr
                v-for="n in 8"
                :key="n"
                class="sk-row"
              >
                <td class="sk-cell">
                  <div
                    class="sk-box"
                    style="width:120px;height:13px;border-radius:4px;"
                  />
                </td>
                <td class="sk-cell">
                  <div
                    class="sk-box"
                    style="width:110px;height:13px;border-radius:4px;"
                  />
                </td>
                <td class="sk-cell">
                  <div
                    class="sk-box"
                    style="width:40px;height:13px;border-radius:4px;"
                  />
                </td>
                <td class="sk-cell">
                  <div
                    class="sk-box"
                    style="width:40px;height:13px;border-radius:4px;"
                  />
                </td>
                <td class="sk-cell">
                  <div
                    class="sk-box"
                    style="width:100px;height:13px;border-radius:4px;"
                  />
                </td>
                <td
                  class="sk-cell"
                  style="text-align:end;"
                >
                  <div
                    class="sk-box"
                    style="width:80px;height:28px;border-radius:6px;margin-inline-start:auto;"
                  />
                </td>
              </tr>
            </template>

            <template #no-data>
              <div class="d-flex flex-column align-center justify-center text-center pa-10">
                <VIcon
                  :icon="digitsQuery || onlyRedeemable ? 'bx-search' : 'bx-medal'"
                  size="40"
                  class="text-disabled mb-3"
                />
                <div class="text-body-1 mb-1">
                  {{ (digitsQuery || onlyRedeemable) ? t('No customers match your search') : t('No customers yet') }}
                </div>
                <div class="text-body-2 text-disabled">
                  {{ (digitsQuery || onlyRedeemable)
                    ? t('Try a different phone or clear the filters.')
                    : t('Customers appear here once they earn their first stamp.') }}
                </div>
              </div>
            </template>

            <template #item.phone_number="{ item }">
              <span class="font-weight-medium num-tabular">{{ item.raw.phone_number }}</span>
            </template>
            <template #item.stamps_balance="{ item }">
              <div style="min-width:140px;">
                <div class="d-flex align-center justify-space-between mb-1">
                  <span class="text-caption num-tabular">{{ item.raw.stamps_balance }} / {{ stampsForReward }}</span>
                  <VIcon
                    v-if="canRedeem(item.raw)"
                    icon="bx-check-circle"
                    size="14"
                    color="success"
                  />
                </div>
                <VProgressLinear
                  :model-value="progressPct(item.raw)"
                  :color="canRedeem(item.raw) ? 'success' : 'primary'"
                  height="6"
                  rounded
                  bg-opacity="0.12"
                />
              </div>
            </template>
            <template #item.stamps_earned_total="{ item }">
              <span class="num-tabular">{{ item.raw.stamps_earned_total }}</span>
            </template>
            <template #item.stamps_redeemed_total="{ item }">
              <span class="num-tabular">{{ item.raw.stamps_redeemed_total }}</span>
            </template>
            <template #item.updated_at="{ item }">
              <span class="text-body-2 text-disabled">{{ formatDate(item.raw.updated_at) }}</span>
            </template>
            <template #item.actions="{ item }">
              <VBtn
                size="small"
                variant="tonal"
                color="success"
                prepend-icon="bx-gift"
                :disabled="!canRedeem(item.raw)"
                @click="openRedeem(item.raw)"
              >
                {{ t('Redeem') }}
              </VBtn>
            </template>
          </VDataTable>
        </VCard>
      </VCol>
    </VRow>

    <VDialog
      v-model="redeemDialog"
      max-width="480"
      persistent
    >
      <VCard :title="t('Redeem Reward')">
        <VCardText>
          <p class="mb-2">
            {{ t('Redeem {reward} for {phone}?', { reward: rewardLabel, phone: redeemPhone }) }}
          </p>
          <p class="text-caption text-disabled">
            {{ t("This will subtract {n} stamps from the customer's balance.", { n: stampsForReward }) }}
          </p>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            @click="redeemDialog = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            color="success"
            :loading="redeeming"
            @click="doRedeem"
          >
            {{ t('Redeem') }}
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

<style scoped>
.lty-kpis {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.lty-kpi {
  padding: 18px 20px;
}

.lty-kpi__label {
  font-size: var(--fs-sm, 0.8125rem);
  color: rgb(var(--v-theme-text-secondary));
  font-weight: var(--fw-medium, 500);
  margin-block-end: 6px;
}

.lty-kpi__value {
  font-size: 1.75rem;
  line-height: 1.1;
  font-weight: var(--fw-bold, 700);
  color: rgb(var(--v-theme-on-surface));
  min-height: 30px;
  display: flex;
  align-items: center;
}

.lty-kpi__value--accent {
  color: rgb(var(--v-theme-success));
}

@media (max-width: 960px) {
  .lty-kpis {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .lty-kpis {
    grid-template-columns: 1fr;
  }
}
</style>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>
