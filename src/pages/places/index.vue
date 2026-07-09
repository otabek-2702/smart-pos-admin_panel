<script setup lang="ts">
import axios from '@/plugins/axios'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()

const places = ref<any[]>([])
const tables = ref<any[]>([])
const loading = ref(false)
const tablesLoading = ref(false)

const placeTypes = ['HALL', 'TERRACE', 'PRIVATE_ROOM', 'BAR', 'OUTDOOR']
const tableStatuses = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'OUT_OF_SERVICE']

const statusColors: Record<string, string> = {
  AVAILABLE: 'success',
  OCCUPIED: 'error',
  RESERVED: 'warning',
  OUT_OF_SERVICE: 'info',
}

// Place dialog
const placeDialog = ref(false)
const placeEdit = ref<any>(null)
const placeForm = ref({ name: '', place_type: 'HALL', capacity: 0 })

// Table dialog
const tableDialog = ref(false)
const tableEdit = ref<any>(null)
const tableForm = ref({ place_id: null as number | null, number: '', capacity: 4 })

// Selected place filter
const selectedPlaceId = ref<number | null>(null)

async function loadPlaces() {
  loading.value = true
  try {
    const res = await axios.get('/places', { params: { per_page: 100 } })
    const d = res.data?.data ?? res.data

    places.value = d?.places ?? d?.items ?? []
  }
  catch {
    notify(t('Failed to load places'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function loadTables() {
  tablesLoading.value = true
  try {
    const params: any = { per_page: 200 }
    if (selectedPlaceId.value)
      params.place_id = selectedPlaceId.value
    const res = await axios.get('/tables', { params })
    const d = res.data?.data ?? res.data

    tables.value = d?.tables ?? d?.items ?? []
  }
  catch {
    notify(t('Failed to load tables'), 'error')
  }
  finally {
    tablesLoading.value = false
  }
}

onMounted(() => { loadPlaces(); loadTables() })
watch(selectedPlaceId, loadTables)

function openPlaceDialog(p: any = null) {
  placeEdit.value = p
  placeForm.value = p ? { name: p.name, place_type: p.place_type, capacity: p.capacity ?? 0 } : { name: '', place_type: 'HALL', capacity: 0 }
  placeDialog.value = true
}

async function savePlace() {
  try {
    if (placeEdit.value)
      await axios.put(`/places/${placeEdit.value.id}`, placeForm.value)
    else
      await axios.post('/places', placeForm.value)
    notify(placeEdit.value ? t('Place updated') : t('Place created'))
    placeDialog.value = false
    await Promise.all([loadPlaces(), loadTables()])
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}

async function deletePlace(p: any) {
  if (!confirm(t('Delete this place?')))
    return
  try {
    await axios.delete(`/places/${p.id}`)
    notify(t('Place deleted'))
    await Promise.all([loadPlaces(), loadTables()])
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}

function openTableDialog(tbl: any = null) {
  tableEdit.value = tbl
  tableForm.value = tbl
    ? { place_id: tbl.place?.id ?? tbl.place_id, number: tbl.number, capacity: tbl.capacity ?? 4 }
    : { place_id: selectedPlaceId.value ?? places.value[0]?.id ?? null, number: '', capacity: 4 }
  tableDialog.value = true
}

async function saveTable() {
  try {
    if (tableEdit.value)
      await axios.put(`/tables/${tableEdit.value.id}`, tableForm.value)
    else
      await axios.post('/tables', tableForm.value)
    notify(tableEdit.value ? t('Table updated') : t('Table created'))
    tableDialog.value = false
    await loadTables()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}

async function deleteTable(tbl: any) {
  if (!confirm(t('Delete this table?')))
    return
  try {
    await axios.delete(`/tables/${tbl.id}`)
    notify(t('Table deleted'))
    await loadTables()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}

async function changeTableStatus(tbl: any, status: string) {
  try {
    await axios.patch(`/tables/${tbl.id}/status`, { status })
    notify(t('Status updated'))
    await loadTables()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}
</script>

<template>
  <div>
    <div class="page-head">
      <div style="min-width:0;">
        <h1 class="page-head__title">
          {{ t('Places & Tables') }}
        </h1>
        <div class="page-head__subtitle">
          {{ t('Manage hall layout, tables and seat capacity') }}
        </div>
      </div>
      <div class="page-head__actions" />
    </div>

    <VRow>
      <VCol
        cols="12"
        md="4"
      >
        <VCard>
          <VCardText class="d-flex align-center justify-space-between">
            <span class="text-h6">{{ t('Places') }}</span>
            <VBtn
              size="small"
              prepend-icon="bx-plus"
              @click="openPlaceDialog"
            >
              {{ t('Add') }}
            </VBtn>
          </VCardText>
          <VDivider />
          <VList>
            <VListItem
              :active="!selectedPlaceId"
              @click="selectedPlaceId = null"
            >
              <VListItemTitle>{{ t('All Tables') }}</VListItemTitle>
              <template #append>
                <VChip size="x-small">
                  {{ tables.length }}
                </VChip>
              </template>
            </VListItem>
            <VDivider />
            <template v-if="loading && places.length === 0">
              <VListItem
                v-for="n in 3"
                :key="n"
              >
                <div
                  class="sk-box"
                  style="width:100%;height:18px;border-radius:4px;"
                />
              </VListItem>
            </template>
            <VListItem
              v-for="p in places"
              :key="p.id"
              :active="selectedPlaceId === p.id"
              @click="selectedPlaceId = p.id"
            >
              <VListItemTitle>{{ p.name }}</VListItemTitle>
              <VListItemSubtitle>{{ t(`place_type_${p.place_type}`) }} · {{ t('Capacity') }}: {{ p.capacity }}</VListItemSubtitle>
              <template #append>
                <div
                  class="d-flex"
                  style="gap:2px;"
                >
                  <VBtn
                    icon
                    variant="text"
                    size="x-small"
                    @click.stop="openPlaceDialog(p)"
                  >
                    <VIcon
                      icon="bx-edit-alt"
                      size="16"
                    />
                  </VBtn>
                  <VBtn
                    icon
                    variant="text"
                    size="x-small"
                    color="error"
                    @click.stop="deletePlace(p)"
                  >
                    <VIcon
                      icon="bx-trash"
                      size="16"
                    />
                  </VBtn>
                </div>
              </template>
            </VListItem>
          </VList>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        md="8"
      >
        <VCard>
          <VCardText class="d-flex align-center justify-space-between">
            <span class="text-h6">{{ t('Tables') }}</span>
            <VBtn
              size="small"
              prepend-icon="bx-plus"
              :disabled="!places.length"
              @click="openTableDialog"
            >
              {{ t('Add Table') }}
            </VBtn>
          </VCardText>
          <VDivider />
          <VCardText>
            <VRow v-if="tables.length || tablesLoading">
              <VCol
                v-for="(tbl, idx) in (tablesLoading && tables.length === 0 ? Array.from({ length: 8 }) : tables)"
                :key="(tbl as any)?.id ?? idx"
                cols="6"
                sm="4"
                md="3"
              >
                <VCard
                  v-if="tbl"
                  border
                  hover
                  class="text-center pa-3"
                >
                  <VAvatar
                    :color="statusColors[(tbl as any).status] ?? 'default'"
                    variant="tonal"
                    size="48"
                    rounded
                  >
                    <VIcon icon="bx-grid-alt" />
                  </VAvatar>
                  <div class="text-h6 mt-2">
                    #{{ (tbl as any).number }}
                  </div>
                  <div class="text-caption text-disabled">
                    {{ t('Capacity') }}: {{ (tbl as any).capacity }}
                  </div>
                  <VChip
                    size="x-small"
                    :color="statusColors[(tbl as any).status] ?? 'default'"
                    variant="tonal"
                    class="mt-1 status-pill"
                  >
                    {{ t(`status_${(tbl as any).status}`) }}
                  </VChip>
                  <VMenu>
                    <template #activator="{ props: menuProps }">
                      <VBtn
                        v-bind="menuProps"
                        variant="text"
                        size="x-small"
                        class="mt-2"
                        block
                      >
                        {{ t('Change Status') }}
                      </VBtn>
                    </template>
                    <VList density="compact">
                      <VListItem
                        v-for="s in tableStatuses"
                        :key="s"
                        @click="changeTableStatus(tbl, s)"
                      >
                        <VListItemTitle>{{ t(`status_${s}`) }}</VListItemTitle>
                      </VListItem>
                    </VList>
                  </VMenu>
                  <div
                    class="d-flex justify-center mt-1"
                    style="gap:2px;"
                  >
                    <VBtn
                      icon
                      variant="text"
                      size="x-small"
                      @click="openTableDialog(tbl)"
                    >
                      <VIcon
                        icon="bx-edit-alt"
                        size="14"
                      />
                    </VBtn>
                    <VBtn
                      icon
                      variant="text"
                      size="x-small"
                      color="error"
                      @click="deleteTable(tbl)"
                    >
                      <VIcon
                        icon="bx-trash"
                        size="14"
                      />
                    </VBtn>
                  </div>
                </VCard>
                <div
                  v-else
                  class="sk-box"
                  style="width:100%;height:170px;border-radius:8px;"
                />
              </VCol>
            </VRow>
            <div
              v-else
              class="text-center text-disabled py-8"
            >
              <VIcon
                icon="bx-grid-alt"
                size="48"
                class="mb-2"
              />
              <div>{{ t('No tables yet') }}</div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Place dialog -->
    <VDialog
      v-model="placeDialog"
      max-width="480"
      persistent
    >
      <VCard :title="placeEdit ? t('Edit Place') : t('New Place')">
        <VCardText>
          <VTextField
            v-model="placeForm.name"
            :label="t('Name')"
            class="mb-3"
          />
          <VSelect
            v-model="placeForm.place_type"
            :items="placeTypes.map(p => ({ title: t(`place_type_${p}`), value: p }))"
            :label="t('Type')"
            class="mb-3"
          />
          <VTextField
            v-model.number="placeForm.capacity"
            :label="t('Capacity')"
            type="number"
          />
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            @click="placeDialog = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            color="primary"
            @click="savePlace"
          >
            {{ t('Save') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Table dialog -->
    <VDialog
      v-model="tableDialog"
      max-width="480"
      persistent
    >
      <VCard :title="tableEdit ? t('Edit Table') : t('New Table')">
        <VCardText>
          <VSelect
            v-model="tableForm.place_id"
            :items="places.map((p: any) => ({ title: p.name, value: p.id }))"
            :label="t('Place')"
            class="mb-3"
          />
          <VTextField
            v-model="tableForm.number"
            :label="t('Number')"
            class="mb-3"
          />
          <VTextField
            v-model.number="tableForm.capacity"
            :label="t('Capacity')"
            type="number"
          />
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            @click="tableDialog = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            color="primary"
            @click="saveTable"
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
