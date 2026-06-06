<script setup lang="ts">
import { hrApi as axios } from '@/plugins/axios'
import DataTableFooter from '@core/components/DataTableFooter.vue'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()

const items = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const itemsPerPage = ref(10)
const search = ref('')

const dialog = ref(false)
const editing = ref<any>(null)
const saving = ref(false)
const form = ref({ name: '', description: '', is_active: true })

const headers = [
  { title: t('Name'), key: 'name', sortable: false },
  { title: t('Description'), key: 'description', sortable: false },
  { title: t('Employees'), key: 'employee_count', sortable: false },
  { title: t('Status'), key: 'is_active', sortable: false },
  { title: t('Actions'), key: 'actions', sortable: false, align: 'end' as const },
]

async function load() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (search.value)
      params.search = search.value
    const res = await axios.get('/departments/', { params })
    const d = res.data?.data ?? res.data

    items.value = d?.departments ?? d?.items ?? []
    total.value = d?.pagination?.total_items ?? d?.pagination?.total ?? items.value.length
  }
  catch {
    notify(t('Failed to load'), 'error')
  }
  finally {
    loading.value = false
  }
}

onMounted(load)
watch([page, itemsPerPage], load)

const debouncedSearch = useDebounceFn(() => { page.value = 1; load() }, 400)

watch(search, debouncedSearch)

function openCreate() {
  editing.value = null
  form.value = { name: '', description: '', is_active: true }
  dialog.value = true
}

function openEdit(d: any) {
  editing.value = d
  form.value = { name: d.name ?? '', description: d.description ?? '', is_active: d.is_active ?? true }
  dialog.value = true
}

async function save() {
  saving.value = true
  try {
    if (editing.value)
      await axios.put(`/departments/${editing.value.id}/`, form.value)
    else
      await axios.post('/departments/', form.value)
    notify(t('Saved'))
    dialog.value = false
    await load()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    saving.value = false
  }
}

async function remove(d: any) {
  if (!confirm(t('Delete this department?')))
    return
  try {
    await axios.delete(`/departments/${d.id}/`)
    notify(t('Deleted'))
    await load()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}
</script>

<template>
  <div>
    <VCard>
      <VCardText class="d-flex align-center gap-3 py-3 flex-wrap">
        <VTextField
          v-model="search"
          :placeholder="t('Search...')"
          prepend-inner-icon="bx-search"
          density="compact"
          style="min-inline-size:200px;max-inline-size:280px;"
          hide-details
          clearable
        />
        <VSpacer />
        <VBtn
          color="primary"
          prepend-icon="bx-plus"
          @click="openCreate"
        >
          {{ t('New Department') }}
        </VBtn>
      </VCardText>

      <VDataTableServer
        :headers="headers"
        :items="items"
        :items-length="total"
        :loading="loading"
        :items-per-page="itemsPerPage"
        :page="page"
      >
        <template #bottom>
          <DataTableFooter
            v-model:page="page"
            v-model:items-per-page="itemsPerPage"
            :total-items="total"
          />
        </template>
        <template
          v-if="loading && items.length === 0"
          #body
        >
          <tr
            v-for="n in itemsPerPage"
            :key="n"
            class="sk-row"
          >
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:140px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:200px;height:13px;border-radius:4px;"
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
                  style="width:32px;height:32px;border-radius:6px;"
                />
                <div
                  class="sk-box"
                  style="width:32px;height:32px;border-radius:6px;"
                />
              </div>
            </td>
          </tr>
        </template>
        <template #item.is_active="{ item }">
          <VChip
            size="small"
            :color="item.raw.is_active ? 'success' : 'default'"
            variant="tonal"
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
                icon="bx-edit-alt"
                size="18"
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
              @click="remove(item.raw)"
            >
              <VIcon
                icon="bx-trash"
                size="18"
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
      </VDataTableServer>
    </VCard>

    <VDialog
      v-model="dialog"
      max-width="480"
      persistent
    >
      <VCard :title="editing ? t('Edit Department') : t('New Department')">
        <VCardText>
          <VTextField
            v-model="form.name"
            :label="t('Name')"
            class="mb-3"
          />
          <VTextarea
            v-model="form.description"
            :label="t('Description')"
            rows="2"
            class="mb-3"
          />
          <VSwitch
            v-model="form.is_active"
            :label="t('Active')"
          />
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            @click="dialog = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            color="primary"
            :loading="saving"
            @click="save"
          >
            {{ t('Save') }}
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
