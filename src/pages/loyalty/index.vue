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
  try {
    const res = await axios.get('/loyalty/accounts/')

    accounts.value = res.data?.data ?? []
  }
  catch {
    notify(t('Failed to load accounts'), 'error')
  }
  finally {
    accountsLoading.value = false
  }
}

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
    loadAccounts()
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
  { title: t('Balance'), key: 'stamps_balance', sortable: false },
  { title: t('Earned (total)'), key: 'stamps_earned_total', sortable: false },
  { title: t('Redeemed (total)'), key: 'stamps_redeemed_total', sortable: false },
  { title: t('Last activity'), key: 'updated_at', sortable: false },
  { title: t('Actions'), key: 'actions', sortable: false, align: 'end' as const },
])

const stampsForReward = computed(() => settings.value?.stamps_per_reward ?? 10)
function canRedeem(a: any) {
  return settings.value?.is_enabled && a.stamps_balance >= stampsForReward.value
}
</script>

<template>
  <div>
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
          <VCardText class="d-flex align-center justify-space-between">
            <span class="text-h6">{{ t('Top Customers') }}</span>
            <VBtn
              variant="tonal"
              prepend-icon="bx-refresh"
              :loading="accountsLoading"
              @click="loadAccounts"
            >
              {{ t('Refresh') }}
            </VBtn>
          </VCardText>

          <VDataTable
            :headers="headers"
            :items="accounts"
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

            <template #item.phone_number="{ item }">
              <span class="font-weight-medium">{{ item.raw.phone_number }}</span>
            </template>
            <template #item.stamps_balance="{ item }">
              <VChip
                size="small"
                :color="canRedeem(item.raw) ? 'success' : 'default'"
                variant="tonal"
              >
                {{ item.raw.stamps_balance }} / {{ stampsForReward }}
              </VChip>
            </template>
            <template #item.updated_at="{ item }">
              <span class="text-body-2 text-disabled">{{ formatDate(item.raw.updated_at) }}</span>
            </template>
            <template #item.actions="{ item }">
              <VBtn
                size="small"
                variant="tonal"
                color="success"
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
            {{ t('Redeem {reward} for {phone}?', { reward: settings?.reward_description, phone: redeemPhone }) }}
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

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>
