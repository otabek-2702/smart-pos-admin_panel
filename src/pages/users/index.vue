<script setup lang="ts">
import axios from '@axios'
import UserStatsRow from './UserStatsRow.vue'

const { t } = useI18n({ useScope: 'global' })

// ---- state ----
const users = ref<any[]>([])
const totalUsers = ref(0)
const loading = ref(false)
const stats = ref<any>(null)
const rolesList = ref<any[]>([])

const page = ref(1)
const itemsPerPage = ref(10)
const search = ref('')
const roleFilter = ref<string | undefined>(undefined)

// Dialog
const dialogOpen = ref(false)
const editingUser = ref<any>(null)
const dialogLoading = ref(false)

// Confirm delete
const deleteDialog = ref(false)
const deletingUser = ref<any>(null)

// Snackbar
const snackbar = ref(false)
const snackbarMsg = ref('')
const snackbarColor = ref('success')

// Form — no email/username
const form = ref({
  first_name: '',
  last_name: '',
  role: 'USER',
  password: '',
})

const roleColors: Record<string, string> = {
  ADMIN: 'error',
  CASHIER: 'warning',
  RESELLER: 'info',
  USER: 'secondary',
}

// code → display name  (reactive function so slot templates always get latest)
function getRoleName(code: string): string {
  return rolesList.value.find((r: any) => r.code === code)?.name ?? code
}

const headers = [
  { title: t('ID'), key: 'id', sortable: false, width: '60px' },
  { title: t('First Name'), key: 'first_name', sortable: false },
  { title: t('Last Name'), key: 'last_name', sortable: false },
  { title: t('Role'), key: 'role', sortable: false },
  { title: t('Actions'), key: 'actions', sortable: false, align: 'end' },
]

// ---- helpers ----
function notify(msg: string, color = 'success') {
  snackbarMsg.value = msg
  snackbarColor.value = color
  snackbar.value = true
}

// ---- load ----
async function loadRoles() {
  try {
    const res = await axios.get('/roles')
    rolesList.value = res.data?.data?.roles ?? []
  }
  catch { /* ignore */ }
}

async function loadUsers() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (search.value) params.search = search.value
    if (roleFilter.value) params.role = roleFilter.value

    const res = await axios.get('/users', { params })
    const d = res.data?.data
    users.value = d?.users ?? []
    totalUsers.value = d?.pagination?.total_users ?? users.value.length
  }
  catch {
    notify(t('Failed to load users'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    const res = await axios.get('/users/stats')
    stats.value = res.data?.data ?? res.data
  }
  catch { /* ignore */ }
}

onMounted(() => {
  loadRoles()
  loadUsers()
  loadStats()
})

// pagination
watch([page, itemsPerPage], loadUsers)

// debounced search — waits 400ms after last keystroke
const debouncedSearch = useDebounceFn(() => {
  page.value = 1
  loadUsers()
}, 400)
watch(search, debouncedSearch)

// role filter is instant
watch(roleFilter, () => {
  page.value = 1
  loadUsers()
})

// ---- dirty tracking ----
const initialForm = ref({ first_name: '', last_name: '', role: 'USER', password: '' })
const isDirty = computed(() => JSON.stringify(form.value) !== JSON.stringify(initialForm.value))

function tryCloseDialog(val: boolean) {
  if (val) return
  if (isDirty.value) {
    notify(t('Unsaved changes! Use the close button to discard.'), 'warning')
    return
  }
  dialogOpen.value = false
}

// ---- CRUD ----
function openCreate() {
  editingUser.value = null
  form.value = { first_name: '', last_name: '', role: rolesList.value[0]?.code ?? 'USER', password: '' }
  initialForm.value = { ...form.value }
  dialogOpen.value = true
}

function openEdit(user: any) {
  editingUser.value = user
  form.value = {
    first_name: user.first_name ?? '',
    last_name: user.last_name ?? '',
    role: user.role ?? 'USER',
    password: '',
  }
  initialForm.value = { ...form.value }
  dialogOpen.value = true
}

async function saveUser() {
  dialogLoading.value = true
  try {
    if (editingUser.value) {
      await axios.put(`/users/${editingUser.value.id}/update`, {
        first_name: form.value.first_name,
        last_name: form.value.last_name,
        role: form.value.role,
      })
      notify(t('User updated'))
    }
    else {
      await axios.post('/users/create', {
        first_name: form.value.first_name,
        last_name: form.value.last_name,
        role: form.value.role,
        password: form.value.password,
      })
      notify(t('User created'))
    }
    dialogOpen.value = false
    loadUsers()
    loadStats()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error saving user'), 'error')
  }
  finally {
    dialogLoading.value = false
  }
}

function confirmDelete(user: any) {
  deletingUser.value = user
  deleteDialog.value = true
}

async function deleteUser() {
  if (!deletingUser.value) return
  try {
    await axios.delete(`/users/${deletingUser.value.id}/delete`)
    notify(t('User deleted'))
    deleteDialog.value = false
    loadUsers()
    loadStats()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error deleting user'), 'error')
  }
}

async function toggleStatus(user: any) {
  try {
    await axios.post(`/users/${user.id}/status`)
    notify(t('Status updated'))
    loadUsers()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error updating status'), 'error')
  }
}
</script>

<template>
  <div>
    <UserStatsRow :stats="stats" />

    <!-- Table card -->
      <VCard>
        <VCardText class="d-flex align-center gap-3 py-3">
          <VTextField
            v-model="search"
            :placeholder="t('Search')"
            prepend-inner-icon="bx-search"
            density="compact"
            style="max-inline-size: 260px;"
            hide-details
            clearable
          />
          <VSelect
            v-model="roleFilter"
            :items="rolesList"
            :placeholder="t('All Roles')"
            item-title="name"
            item-value="code"
            density="compact"
            style="min-inline-size: 200px;"
            hide-details
            clearable
          />
          <VSpacer />
          <VBtn
            prepend-icon="bx-plus"
            @click="openCreate"
          >
            {{ t('Add User') }}
          </VBtn>
        </VCardText>

        <VDataTableServer
          :headers="headers"
          :items="users"
          :items-length="totalUsers"
          :loading="loading"
          :items-per-page="itemsPerPage"
          :page="page"
        >
        <!-- Custom footer with numbered pagination -->
        <template #bottom>
          <div class="v-data-table-footer" style="align-items:center;">
            <div class="v-data-table-footer__items-per-page">
              <span>{{ t('Items per page:') }}</span>
              <VSelect
                v-model="itemsPerPage"
                :items="[5, 10, 25, 50]"
                density="compact"
                variant="plain"
                hide-details
                style="width:75px;"
                @update:model-value="page = 1"
              />
            </div>
            <div class="v-data-table-footer__info">
              {{ Math.min((page - 1) * itemsPerPage + 1, totalUsers) }}-{{ Math.min(page * itemsPerPage, totalUsers) }} {{ t('of') }} {{ totalUsers }}
            </div>
            <div class="v-data-table-footer__pagination" style="display:flex;align-items:center;">
              <VPagination
                v-model="page"
                :length="Math.ceil(totalUsers / itemsPerPage) || 1"
                :total-visible="5"
                density="compact"
                variant="text"
                rounded="lg"
              />
            </div>
          </div>
        </template>

        <!-- Skeleton rows on initial load -->
        <template v-if="loading && users.length === 0" #body>
          <tr v-for="n in itemsPerPage" :key="n" class="sk-row">
            <td class="sk-cell"><div class="sk-box" style="width:30px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell">
              <div class="d-flex align-center gap-2">
                <div class="sk-box" style="width:32px;height:32px;border-radius:50%;flex-shrink:0;" />
                <div class="sk-box" style="width:96px;height:13px;border-radius:4px;" />
              </div>
            </td>
            <td class="sk-cell"><div class="sk-box" style="width:110px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:70px;height:22px;border-radius:12px;" /></td>
            <td class="sk-cell" style="text-align:end;">
              <div class="d-flex justify-end gap-1">
                <div class="sk-box" style="width:28px;height:28px;border-radius:50%;" />
                <div class="sk-box" style="width:28px;height:28px;border-radius:50%;" />
                <div class="sk-box" style="width:28px;height:28px;border-radius:50%;" />
              </div>
            </td>
          </tr>
        </template>

        <template #item.id="{ item }">
          <span class="text-sm text-disabled font-weight-medium">#{{ item.raw.id }}</span>
        </template>

        <template #item.first_name="{ item }">
          <div class="d-flex align-center gap-2">
            <VAvatar
              size="32"
              color="primary"
              variant="tonal"
            >
              <span class="text-xs">{{ (item.raw.first_name?.[0] ?? '?').toUpperCase() }}</span>
            </VAvatar>
            <span class="font-weight-medium">{{ item.raw.first_name }}</span>
          </div>
        </template>

        <template #item.last_name="{ item }">
          <span>{{ item.raw.last_name }}</span>
        </template>

        <template #item.role="{ item }">
          <VChip
            size="small"
            :color="roleColors[item.raw.role] ?? 'default'"
            variant="tonal"
            label
          >
            {{ getRoleName(item.raw.role) }}
          </VChip>
        </template>

        <template #item.actions="{ item }">
          <div class="d-flex justify-end" style="gap:2px;">
            <VBtn icon variant="text" size="small" @click="openEdit(item.raw)">
              <VIcon icon="bx-edit" size="18" />
              <VTooltip activator="parent" location="top">{{ t('Edit') }}</VTooltip>
            </VBtn>
            <VBtn
              icon variant="text" size="small"
              :color="item.raw.status === 'ACTIVE' ? 'warning' : 'success'"
              @click="toggleStatus(item.raw)"
            >
              <VIcon :icon="item.raw.status === 'ACTIVE' ? 'bx-user-x' : 'bx-user-check'" size="18" />
              <VTooltip activator="parent" location="top">
                {{ item.raw.status === 'ACTIVE' ? t('Suspend') : t('Activate') }}
              </VTooltip>
            </VBtn>
            <VBtn icon variant="text" size="small" color="error" @click="confirmDelete(item.raw)">
              <VIcon icon="bx-trash" size="18" />
              <VTooltip activator="parent" location="top">{{ t('Delete') }}</VTooltip>
            </VBtn>
          </div>
        </template>
      </VDataTableServer>
    </VCard>

    <!-- Create/Edit Dialog -->
    <VDialog
      :model-value="dialogOpen"
      max-width="500"
      :persistent="isDirty"
      @update:model-value="tryCloseDialog"
    >
      <VCard :title="editingUser ? t('Edit User') : t('Add User')">
        <DialogCloseBtn @click="dialogOpen = false" />
        <VCardText class="pb-2">
          <VRow>
            <VCol cols="6">
              <VTextField
                v-model="form.first_name"
                :label="t('First Name')"
                density="compact"
              />
            </VCol>
            <VCol cols="6">
              <VTextField
                v-model="form.last_name"
                :label="t('Last Name')"
                density="compact"
              />
            </VCol>
            <VCol cols="12">
              <VSelect
                v-model="form.role"
                :label="t('Role')"
                :items="rolesList"
                item-title="name"
                item-value="code"
                density="compact"
              />
            </VCol>
            <VCol
              v-if="!editingUser"
              cols="12"
            >
              <VTextField
                v-model="form.password"
                :label="t('Password')"
                type="password"
                density="compact"
              />
            </VCol>
          </VRow>
        </VCardText>
        <VCardActions class="justify-end pt-0 pb-4 px-4">
          <VBtn
            :loading="dialogLoading"
            @click="saveUser"
          >
            {{ t('Save') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Delete Confirm Dialog -->
    <VDialog
      v-model="deleteDialog"
      max-width="400"
    >
      <VCard :title="t('Delete User')">
        <VCardText>{{ t('Are you sure you want to delete this user?') }}</VCardText>
        <VCardActions class="justify-end">
          <VBtn
            variant="tonal"
            color="secondary"
            @click="deleteDialog = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            color="error"
            @click="deleteUser"
          >
            {{ t('Delete') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Snackbar -->
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
.sk-row { height: 52px; }
.sk-cell { padding: 0 16px; }
.sk-box {
  background: rgba(var(--v-theme-on-surface), 0.08);
  animation: sk-pulse 1.5s ease-in-out infinite;
}
@keyframes sk-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>
