<script setup lang="ts">
import axios from '@axios'

const { t } = useI18n({ useScope: 'global' })

const balance = ref<any>(null)
const stats = ref<any>(null)
const loading = ref(true)

function formatCurrency(val: number | string) {
  return new Intl.NumberFormat('uz-UZ').format(Number(val) || 0)
}

async function loadData() {
  loading.value = true
  try {
    const [balRes, statsRes] = await Promise.allSettled([
      axios.get('/inkassa/balance'),
      axios.get('/inkassa/stats'),
    ])
    if (balRes.status === 'fulfilled') balance.value = balRes.value.data?.data ?? balRes.value.data
    if (statsRes.status === 'fulfilled') stats.value = statsRes.value.data?.data ?? statsRes.value.data
  }
  finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div>
    <VRow class="mb-4">
      <VCol
        cols="12"
        sm="6"
        lg="4"
      >
        <VCard :loading="loading">
          <VCardText class="d-flex align-center gap-4">
            <VAvatar
              color="success"
              variant="tonal"
              size="56"
              rounded
            >
              <VIcon
                icon="bx-wallet"
                size="32"
              />
            </VAvatar>
            <div>
              <div class="text-h5 font-weight-bold">
                {{ balance ? formatCurrency(balance.balance ?? balance.total ?? 0) : '…' }}
              </div>
              <div class="text-body-2 text-disabled">
                {{ t('Cash Balance') }}
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol
        v-if="stats"
        cols="12"
        sm="6"
        lg="4"
      >
        <VCard>
          <VCardText class="d-flex align-center gap-4">
            <VAvatar
              color="primary"
              variant="tonal"
              size="56"
              rounded
            >
              <VIcon
                icon="bx-receipt"
                size="32"
              />
            </VAvatar>
            <div>
              <div class="text-h5 font-weight-bold">
                {{ stats.summary?.total_orders ?? '—' }}
              </div>
              <div class="text-body-2 text-disabled">
                {{ t('Total Orders') }}
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol
        v-if="stats"
        cols="12"
        sm="6"
        lg="4"
      >
        <VCard>
          <VCardText class="d-flex align-center gap-4">
            <VAvatar
              color="info"
              variant="tonal"
              size="56"
              rounded
            >
              <VIcon
                icon="bx-trending-up"
                size="32"
              />
            </VAvatar>
            <div>
              <div class="text-h5 font-weight-bold">
                {{ stats.summary?.total_revenue ? formatCurrency(stats.summary.total_revenue) : '—' }}
              </div>
              <div class="text-body-2 text-disabled">
                {{ t('Total Revenue') }}
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Extra stats if available -->
    <VCard
      v-if="stats"
      :title="t('Inkassa Statistics')"
    >
      <VCardText>
        <VRow>
          <VCol
            v-for="(val, key) in stats.summary"
            :key="key"
            cols="6"
            sm="4"
            md="3"
          >
            <div class="text-body-2 text-disabled">
              {{ String(key).replace(/_/g, ' ') }}
            </div>
            <div class="text-body-1 font-weight-medium">
              {{ typeof val === 'number' ? formatCurrency(val) : val }}
            </div>
          </VCol>
        </VRow>
      </VCardText>
    </VCard>
  </div>
</template>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>
