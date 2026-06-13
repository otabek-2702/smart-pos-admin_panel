<script setup lang="ts">
import UserStatsRow from './UserStatsRow.vue'
import { ROLE_COLOR as roleColors } from '@/constants/statusColors'
import axios from '@/plugins/axios'
import DataTableFooter from '@core/components/DataTableFooter.vue'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()

const users = ref<any[]>([])
const totalUsers = ref(0)
const loading = ref(false)
const stats = ref<any>(null)

const page = ref(1)
const itemsPerPage = ref(10)
const search = ref('')
const roleFilter = ref<string | undefined>(undefined)
const statusFilter = ref<string | undefined>(undefined)

const dialogOpen = ref(false)
const editing = ref<any>(null)
const dialogLoading = ref(false)

const deleteDialog = ref(false)
const deleting = ref<any>(null)

const roles = ['ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'USER']
const statuses = ['ACTIVE', 'SUSPENDED']

const form = ref({
  first_name: '',
  last_name: '',
  email: '',
  role: 'CASHIER',
  status: 'ACTIVE',
  password: '',
})

const isAdminRole = computed(() => form.value.role === 'ADMIN')
const requiresEmail = computed(() => ['ADMIN', 'MANAGER'].includes(form.value.role))
const isPinRole = computed(() => ['CASHIER', 'WAITER'].includes(form.value.role))

const headers = computed(() => [
  { title: t('ID'), key: 'id', sortable: false, width: '60px' },
  { title: t('Name'), key: 'name', sortable: false },
  { title: t('Email'), key: 'email', sortable: false },
  { title: t('Role'), key: 'role', sortable: false },
  { title: t('Status'), key: 'status', sortable: false },
  { title: t('Actions'), key: 'actions', sortable: false, align: 'end' as const },
])

async function loadUsers() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (search.value)
      params.search = search.value
    if (roleFilter.value)
      params.role = roleFilter.value
    if (statusFilter.value)
      params.status = statusFilter.value
    const res = await axios.get('/users', { params })
    const d = res.data?.data ?? res.data

    users.value = d?.users ?? []
    totalUsers.value = d?.pagination?.total_users ?? d?.pagination?.total ?? users.value.length

    // Derive light stats from list — backend doesn't expose /users/stats yet.
    stats.value = {
      total_users: totalUsers.value,
      active_users: users.value.filter((u: any) => u.status === 'ACTIVE').length,
      total_departments: 0,
      total_salary: 0,
    }
  }
  catch {
    notify(t('Failed to load users'), 'error')
  }
  finally {
    loading.value = false
  }
}

onMounted(loadUsers)
watch([page, itemsPerPage], loadUsers)

const debouncedSearch = useDebounceFn(() => { page.value = 1; loadUsers() }, 400)

watch(search, debouncedSearch)
watch([roleFilter, statusFilter], () => { page.value = 1; loadUsers() })

function openCreate() {
  editing.value = null
  form.value = {
    first_name: '',
    last_name: '',
    email: '',
    role: 'CASHIER',
    status: 'ACTIVE',
    password: '',
  }
  dialogOpen.value = true
}

function onRoleChange() {
  // ADMIN + MANAGER require an explicit email; everything else lets BE auto-
  // generate. Clear stale input when leaving an email-required role.
  if (!requiresEmail.value)
    form.value.email = ''
  // Roles that authenticate via PIN must enter a 4-digit numeric code only;
  // clear any leftover free-form password when switching INTO a PIN role.
  if (isPinRole.value && form.value.password && !/^\d{4}$/.test(form.value.password))
    form.value.password = ''
}

function openEdit(user: any) {
  editing.value = user
  form.value = {
    first_name: user.first_name ?? '',
    last_name: user.last_name ?? '',
    email: user.email ?? '',
    role: user.role ?? 'CASHIER',
    status: user.status ?? 'ACTIVE',
    password: '',
  }
  dialogOpen.value = true
}

async function save() {
  // ADMIN + MANAGER require explicit email; cashier/waiter get one auto-assigned.
  if (!editing.value && requiresEmail.value && !form.value.email.trim()) {
    notify(t('Email is required for this role'), 'error')

    return
  }

  // PIN-role passwords must be exactly 4 digits (BE rejects otherwise).
  if (!editing.value && isPinRole.value && !/^\d{4}$/.test(form.value.password)) {
    notify(t('PIN must be exactly 4 digits'), 'error')

    return
  }
  dialogLoading.value = true
  try {
    if (editing.value) {
      const payload: any = {
        first_name: form.value.first_name,
        last_name: form.value.last_name,
        role: form.value.role,
        status: form.value.status,
      }

      if (form.value.email)
        payload.email = form.value.email
      if (form.value.password)
        payload.password = form.value.password
      await axios.patch(`/users/${editing.value.id}`, payload)
      notify(t('User updated'))
    }
    else {
      const payload: any = {
        first_name: form.value.first_name,
        last_name: form.value.last_name,
        role: form.value.role,
        password: form.value.password,
      }

      // Email only sent for roles that need it; otherwise BE auto-generates.
      // Status is never sent on create — BE hardcodes ACTIVE.
      if (requiresEmail.value && form.value.email)
        payload.email = form.value.email
      await axios.post('/users', payload)
      notify(t('User created'))
    }
    dialogOpen.value = false
    await loadUsers()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    dialogLoading.value = false
  }
}

function confirmDelete(user: any) {
  deleting.value = user
  deleteDialog.value = true
}

async function doDelete() {
  if (!deleting.value)
    return
  try {
    await axios.delete(`/users/${deleting.value.id}`)
    notify(t('User deleted'))
    deleteDialog.value = false
    await loadUsers()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}

async function toggleStatus(user: any) {
  try {
    const newStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'

    await axios.patch(`/users/${user.id}`, { status: newStatus })
    notify(t('Status updated'))
    await loadUsers()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1 class="page-head__title">
          {{ t('Users') }}
        </h1>
        <div class="page-head__subtitle">
          {{ t('Manage accounts, roles and access') }}
        </div>
      </div>
      <div class="page-head__actions">
        <VBtn
          color="primary"
          prepend-icon="bx-plus"
          @click="openCreate"
        >
          {{ t('New User') }}
        </VBtn>
      </div>
    </div>

    <UserStatsRow :stats="stats" />

    <VCard>
      <VCardText class="d-flex align-center gap-3 py-3 flex-wrap">
        <VTextField
          v-model="search"
          :placeholder="t('Search users...')"
          prepend-inner-icon="bx-search"
          density="compact"
          style="min-inline-size:200px;max-inline-size:280px;"
          hide-details
          clearable
        />
        <VSelect
          v-model="roleFilter"
          :items="roles"
          :placeholder="t('Role')"
          density="compact"
          style="min-inline-size:160px;"
          hide-details
          clearable
        />
        <VSelect
          v-model="statusFilter"
          :items="statuses"
          :placeholder="t('Status')"
          density="compact"
          style="min-inline-size:160px;"
          hide-details
          clearable
        />
      </VCardText>

      <VDataTableServer
        :headers="headers"
        :items="users"
        :items-length="totalUsers"
        :loading="loading"
        :items-per-page="itemsPerPage"
        :page="page"
      >
        <template #bottom>
          <DataTableFooter
            v-model:page="page"
            v-model:items-per-page="itemsPerPage"
            :total-items="totalUsers"
          />
        </template>

        <template
          v-if="loading && users.length === 0"
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
                style="width:30px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:140px;height:13px;border-radius:4px;"
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
                style="width:80px;height:22px;border-radius:12px;"
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
                <div
                  class="sk-box"
                  style="width:32px;height:32px;border-radius:6px;"
                />
              </div>
            </td>
          </tr>
        </template>

        <template #item.id="{ item }">
          <span class="text-mono text-tertiary num-tabular">#{{ item.raw.id }}</span>
        </template>
        <template #item.name="{ item }">
          <div class="d-flex align-center gap-2">
            <VAvatar
              size="32"
              :color="roleColors[item.raw.role] ?? 'primary'"
              variant="tonal"
            >
              <span class="text-caption">{{ (item.raw.first_name ?? '?')[0] }}</span>
            </VAvatar>
            <div class="text-body-2 font-weight-medium">
              {{ item.raw.first_name }} {{ item.raw.last_name }}
            </div>
          </div>
        </template>
        <template #item.email="{ item }">
          <span class="text-muted">{{ item.raw.email }}</span>
        </template>
        <template #item.role="{ item }">
          <VChip
            class="status-pill"
            size="small"
            :color="roleColors[item.raw.role] ?? 'default'"
            variant="tonal"
          >
            {{ item.raw.role }}
          </VChip>
        </template>
        <template #item.status="{ item }">
          <VChip
            class="status-pill"
            size="small"
            :color="item.raw.status === 'ACTIVE' ? 'success' : 'default'"
            variant="tonal"
          >
            {{ item.raw.status }}
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
              :color="item.raw.status === 'ACTIVE' ? 'warning' : 'success'"
              @click="toggleStatus(item.raw)"
            >
              <VIcon
                :icon="item.raw.status === 'ACTIVE' ? 'bx-pause' : 'bx-play'"
                size="18"
              />
              <VTooltip
                activator="parent"
                location="top"
              >
                {{ item.raw.status === 'ACTIVE' ? t('Suspend') : t('Activate') }}
              </VTooltip>
            </VBtn>
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
              @click="confirmDelete(item.raw)"
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
      v-model="dialogOpen"
      max-width="640"
      persistent
    >
      <VCard class="dlg">
        <div class="dlg__head">
          <div class="dlg__head-text">
            <div class="dlg__title">
              {{ editing ? t('Edit User') : t('New User') }}
            </div>
            <div class="dlg__subtitle">
              {{ editing
                ? t('Update details for') + ' ' + (editing.first_name || '') + ' ' + (editing.last_name || '')
                : t('Create a new account and assign a role') }}
            </div>
          </div>
          <VBtn
            icon
            variant="text"
            size="small"
            class="dlg__close"
            @click="dialogOpen = false"
          >
            <VIcon
              icon="bx-x"
              size="20"
            />
          </VBtn>
        </div>

        <div class="dlg__body">
          <VRow>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model="form.first_name"
                :label="t('First Name')"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model="form.last_name"
                :label="t('Last Name')"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VSelect
                v-model="form.role"
                :items="roles"
                :label="t('Role')"
                @update:model-value="onRoleChange"
              />
            </VCol>
            <VCol
              v-if="editing"
              cols="12"
              sm="6"
            >
              <VSelect
                v-model="form.status"
                :items="statuses"
                :label="t('Status')"
              />
            </VCol>
            <VCol
              v-if="isAdminRole || editing"
              cols="12"
            >
              <VTextField
                v-if="editing || requiresEmail"
                v-model="form.email"
                :label="t('Email')"
                type="email"
                :hint="!editing && requiresEmail ? t('Required for ADMIN / MANAGER') : ''"
                :persistent-hint="!editing && requiresEmail"
                :required="!editing && requiresEmail"
              />
            </VCol>
            <VCol cols="12">
              <VTextField
                v-model="form.password"
                :label="editing ? t('New Password (leave blank to keep)') : (isPinRole ? t('4-digit PIN') : t('Password'))"
                :type="isPinRole ? 'tel' : 'password'"
                :hint="!editing && isPinRole ? t('Exactly 4 digits') : ''"
                :persistent-hint="!editing && isPinRole"
                :maxlength="isPinRole ? 4 : undefined"
                :pattern="isPinRole ? '[0-9]{4}' : undefined"
                inputmode="numeric"
              />
            </VCol>
          </VRow>
        </div>

        <div class="dlg__foot">
          <VBtn
            variant="text"
            @click="dialogOpen = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            color="primary"
            :loading="dialogLoading"
            @click="save"
          >
            {{ t('Save') }}
          </VBtn>
        </div>
      </VCard>
    </VDialog>

    <VDialog
      v-model="deleteDialog"
      max-width="440"
    >
      <VCard class="dlg">
        <div class="dlg__head">
          <div class="dlg__head-text">
            <div class="dlg__title">
              {{ t('Delete User') }}
            </div>
            <div class="dlg__subtitle">
              {{ t('This action cannot be undone') }}
            </div>
          </div>
          <VBtn
            icon
            variant="text"
            size="small"
            class="dlg__close"
            @click="deleteDialog = false"
          >
            <VIcon
              icon="bx-x"
              size="20"
            />
          </VBtn>
        </div>
        <div class="dlg__body">
          <div class="d-flex align-start gap-3">
            <div class="kpi-card__icon t-error" style="flex:0 0 44px;inline-size:44px;block-size:44px;">
              <VIcon
                icon="bx-error"
                size="22"
              />
            </div>
            <div>
              <div class="font-weight-semibold">
                {{ t('Are you sure you want to delete this user?') }}
              </div>
              <div class="text-tertiary text-body-2 mt-1">
                {{ t('This permanently revokes account access.') }}
              </div>
            </div>
          </div>
        </div>
        <div class="dlg__foot">
          <VBtn
            variant="text"
            @click="deleteDialog = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            color="error"
            @click="doDelete"
          >
            {{ t('Delete') }}
          </VBtn>
        </div>
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

<style lang="scss" scoped>
.dlg {
  border-radius: var(--r-lg);
  overflow: hidden;

  &__head {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 20px 24px 14px;
    border-block-end: 1px solid rgb(var(--v-theme-border));
  }

  &__head-text {
    flex: 1 1 auto;
    min-width: 0;
  }

  &__title {
    font-size: var(--fs-h3);
    line-height: var(--lh-h3);
    font-weight: var(--fw-bold);
    letter-spacing: -0.01em;
    color: rgb(var(--v-theme-on-surface));
  }

  &__subtitle {
    color: rgb(var(--v-theme-text-secondary));
    font-size: var(--fs-sm);
    margin-block-start: 4px;
  }

  &__close {
    margin-inline-start: auto;
    flex: 0 0 auto;
    color: rgb(var(--v-theme-text-tertiary));
  }

  &__body {
    padding: 20px 24px;
  }

  &__foot {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 10px;
    padding: 14px 24px;
    background: rgb(var(--v-theme-surface-2));
    border-block-start: 1px solid rgb(var(--v-theme-border));
    position: sticky;
    inset-block-end: 0;
  }
}
</style>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>
