<script setup lang="ts">
import { stockApi as axios } from '@/plugins/axios'

const { t } = useI18n({ useScope: 'global' })

const codes = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const itemsPerPage = ref(10)
const search = ref('')
const activeFilter = ref<string | undefined>(undefined)
const seeding = ref(false)

const dialog = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const saving = ref(false)
const deleteDialog = ref(false)
const deleting = ref(false)
const selectedItem = ref<any>(null)

const form = ref({
  code: '',
  name: '',
  description: '',
  requires_approval: false,
  is_active: true,
})

const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()

const headers = [
  { title: t('Code'), key: 'code', sortable: false },
  { title: t('Name'), key: 'name', sortable: false },
  { title: t('Description'), key: 'description', sortable: false },
  { title: t('Requires Approval'), key: 'requires_approval', sortable: false },
  { title: t('Status'), key: 'is_active', sortable: false },
  { title: t('Actions'), key: 'actions', sortable: false, align: 'end' as const },
]

async function loadCodes() {
  loading.value = true
  try {
    const params: any = {}
    if (activeFilter.value === 'true')
      params.active = true
    else if (activeFilter.value === 'false')
      params.active = false

    const res = await axios.get('/variance-codes/', { params })
    const d = res.data?.data ?? res.data

    codes.value = d?.codes ?? []
    total.value = d?.count ?? codes.value.length
  }
  catch {
    notify(t('Failed to load variance codes'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function seedDefaults() {
  seeding.value = true
  try {
    await axios.post('/variance-codes/seed/')
    notify(t('Defaults seeded'))
    await loadCodes()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error seeding defaults'), 'error')
  }
  finally {
    seeding.value = false
  }
}

onMounted(loadCodes)
watch(activeFilter, loadCodes)

function openCreate() {
  dialogMode.value = 'create'
  form.value = { code: '', name: '', description: '', requires_approval: false, is_active: true }
  dialog.value = true
}

function openEdit(item: any) {
  dialogMode.value = 'edit'
  selectedItem.value = item
  form.value = {
    code: item.code ?? '',
    name: item.name ?? '',
    description: item.description ?? '',
    requires_approval: item.requires_approval ?? false,
    is_active: item.is_active ?? true,
  }
  dialog.value = true
}

async function save() {
  saving.value = true
  try {
    const payload = { ...form.value }
    if (dialogMode.value === 'create')
      await axios.post('/variance-codes/', payload)
    else
      await axios.put(`/variance-codes/${selectedItem.value.id}/`, payload)
    notify(dialogMode.value === 'create' ? t('Variance code created') : t('Variance code updated'))
    dialog.value = false
    await loadCodes()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error saving variance code'), 'error')
  }
  finally {
    saving.value = false
  }
}

function confirmDelete(item: any) {
  selectedItem.value = item
  deleteDialog.value = true
}

async function doDelete() {
  deleting.value = true
  try {
    await axios.delete(`/variance-codes/${selectedItem.value.id}/`)
    notify(t('Variance code deleted'))
    deleteDialog.value = false
    await loadCodes()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error deleting variance code'), 'error')
  }
  finally {
    deleting.value = false
  }
}
</script>

<template>
  <div>
    <VCard>
      <VCardText class="d-flex flex-wrap gap-3 align-center">
        <VSelect
          v-model="activeFilter"
          :items="[
            { title: t('All'), value: undefined },
            { title: t('Active'), value: 'true' },
            { title: t('Inactive'), value: 'false' },
          ]"
          :label="t('Status')"
          density="compact"
          style="min-inline-size: 200px; max-inline-size: 240px;"
          hide-details
          clearable
        />
        <VSpacer />
        <VBtn
          variant="tonal"
          prepend-icon="bx-download"
          :loading="seeding"
          @click="seedDefaults"
        >
          {{ t('Seed defaults') }}
        </VBtn>
        <VBtn
          prepend-icon="bx-plus"
          @click="openCreate"
        >
          {{ t('Add Variance Code') }}
        </VBtn>
      </VCardText>

      <VDataTable
        :headers="headers"
        :items="codes"
        :loading="loading"
        :items-per-page="-1"
      >
        <template #bottom />

        <template
          v-if="loading && codes.length === 0"
          #body
        >
          <tr
            v-for="n in 6"
            :key="n"
            class="sk-row"
          >
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:80px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:120px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:160px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:60px;height:22px;border-radius:12px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:60px;height:22px;border-radius:12px;"
              />
            </td>
            <td
              class="sk-cell"
              style="text-align:end;"
            >
              <div class="d-flex justify-end gap-1">
                <div
                  class="sk-box"
                  style="width:28px;height:28px;border-radius:6px;"
                /><div
                  class="sk-box"
                  style="width:28px;height:28px;border-radius:6px;"
                />
              </div>
            </td>
          </tr>
        </template>

        <template #item.requires_approval="{ item }">
          <VChip
            :color="item.raw.requires_approval ? 'warning' : 'default'"
            size="small"
            variant="tonal"
            class="status-pill"
          >
            {{ item.raw.requires_approval ? t('Yes') : t('No') }}
          </VChip>
        </template>
        <template #item.is_active="{ item }">
          <VChip
            :color="item.raw.is_active ? 'success' : 'default'"
            size="small"
            variant="tonal"
            class="status-pill"
          >
            {{ item.raw.is_active ? t('Active') : t('Inactive') }}
          </VChip>
        </template>
        <template #item.actions="{ item }">
          <div
            class="d-flex justify-end"
            style="gap:2px;"
          >
            <VBtn
              icon
              variant="text"
              size="small"
              @click="openEdit(item.raw)"
            >
              <VIcon
                size="18"
                icon="bx-edit"
              />
              <VTooltip
                activator="parent"
                location="top"
              >
                {{ t('Edit') }}
              </VTooltip>
            </VBtn>
            <VBtn
              icon
              variant="text"
              size="small"
              color="error"
              @click="confirmDelete(item.raw)"
            >
              <VIcon
                size="18"
                icon="bx-trash"
              />
              <VTooltip
                activator="parent"
                location="top"
              >
                {{ t('Delete') }}
              </VTooltip>
            </VBtn>
          </div>
        </template>
      </VDataTable>
    </VCard>

    <VDialog
      v-model="dialog"
      max-width="480"
      persistent
    >
      <VCard :title="dialogMode === 'create' ? t('Add Variance Code') : t('Edit Variance Code')">
        <VCardText>
          <VRow>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model="form.code"
                :label="t('Code')"
                required
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model="form.name"
                :label="t('Name')"
                required
              />
            </VCol>
            <VCol cols="12">
              <VTextField
                v-model="form.description"
                :label="t('Description')"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VSwitch
                v-model="form.requires_approval"
                :label="t('Requires Approval')"
                color="warning"
              />
            </VCol>
            <VCol
              v-if="dialogMode === 'edit'"
              cols="12"
              sm="6"
            >
              <VSwitch
                v-model="form.is_active"
                :label="t('Active')"
                color="success"
              />
            </VCol>
          </VRow>
        </VCardText>
        <VCardActions class="justify-end gap-2 pa-4 pt-0">
          <VBtn
            variant="tonal"
            color="default"
            @click="dialog = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            :loading="saving"
            @click="save"
          >
            {{ t('Save') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog
      v-model="deleteDialog"
      max-width="400"
    >
      <VCard :title="t('Delete Variance Code')">
        <VCardText>{{ t('Are you sure you want to delete') }} <strong>{{ selectedItem?.name }}</strong>?</VCardText>
        <VCardActions class="justify-end gap-2 pa-4 pt-0">
          <VBtn
            variant="tonal"
            color="default"
            @click="deleteDialog = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            color="error"
            :loading="deleting"
            @click="doDelete"
          >
            {{ t('Delete') }}
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
name: stock-variance-codes
meta:
  action: manage
  subject: all
</route>
