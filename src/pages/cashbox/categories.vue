<script setup lang="ts">
import { cashboxApi as axios } from '@/plugins/axios'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()

const categories = ref<any[]>([])
const loading = ref(false)
const saving = ref(false)
const newCat = ref({ name: '', sort_order: 0 })

async function load() {
  loading.value = true
  try {
    const res = await axios.get('/categories/')
    const d = res.data?.data ?? res.data

    categories.value = d?.categories ?? d?.items ?? []
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Failed to load'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function add() {
  if (!newCat.value.name.trim()) {
    notify(t('Name is required'), 'error')

    return
  }
  saving.value = true
  try {
    await axios.post('/categories/', newCat.value)
    notify(t('Category created'))
    newCat.value = { name: '', sort_order: 0 }
    await load()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div>
    <VCard>
      <VCardText class="py-3">
        <span class="text-h6">{{ t('Cashbox Expense Categories') }}</span>
        <div class="text-caption text-disabled">
          {{ t('Categories used when a cashier records a cash-drawer expense during a shift.') }}
        </div>
      </VCardText>
      <VDivider />
      <VCardText>
        <div class="d-flex gap-2 mb-4">
          <VTextField
            v-model="newCat.name"
            :label="t('Name')"
            density="compact"
            hide-details
            @keyup.enter="add"
          />
          <VTextField
            v-model.number="newCat.sort_order"
            :label="t('Sort')"
            type="number"
            density="compact"
            hide-details
            style="max-inline-size:120px;"
          />
          <VBtn
            color="primary"
            :loading="saving"
            prepend-icon="bx-plus"
            @click="add"
          >
            {{ t('Add') }}
          </VBtn>
        </div>

        <VTable density="compact">
          <thead>
            <tr>
              <th class="text-end" style="inline-size:60px;">#</th>
              <th>{{ t('Name') }}</th>
              <th class="text-end">{{ t('Sort order') }}</th>
              <th>{{ t('Created') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="c in categories"
              :key="c.id"
            >
              <td class="text-end">{{ c.id }}</td>
              <td class="font-weight-medium">{{ c.name }}</td>
              <td class="text-end">{{ c.sort_order ?? 0 }}</td>
              <td class="text-caption text-disabled">{{ c.created_at ?? '—' }}</td>
            </tr>
            <tr v-if="!categories.length && !loading">
              <td colspan="4" class="text-center text-disabled py-4">
                {{ t('No categories yet') }}
              </td>
            </tr>
          </tbody>
        </VTable>
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
