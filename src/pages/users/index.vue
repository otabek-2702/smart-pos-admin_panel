<script setup lang="ts">
/* ============================================================
   USERS — accounts, roles, access
   1:1 port of .tmp-alpha-design/alpha-design-source/Users.jsx
   Uses design primitives (DataTable, Modal, Field, Input, Select,
   Switch, Button, Badge, StatusBadge, IconAction, Kpi, Card,
   PageHeader). All axios calls, refs, computeds, validation
   (PIN-4-digit for cashier/waiter, email-required for ADMIN/MANAGER)
   and i18n keys preserved verbatim from the prior implementation.
   ============================================================ */
import type { DataTableColumn } from '@/components/design/DataTable.vue'
import axios from '@/plugins/axios'
import Badge from '@/components/design/Badge.vue'
import Button from '@/components/design/Button.vue'
import Card from '@/components/design/Card.vue'
import DataTable from '@/components/design/DataTable.vue'
import DesignIcon from '@/components/design/DesignIcon.vue'
import Field from '@/components/design/Field.vue'
import IconAction from '@/components/design/IconAction.vue'
import Input from '@/components/design/Input.vue'
import Kpi from '@/components/design/Kpi.vue'
import Modal from '@/components/design/Modal.vue'
import PageHeader from '@/components/design/PageHeader.vue'
import Select from '@/components/design/Select.vue'
import Switch from '@/components/design/Switch.vue'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatDate } = useFormatters()

// NOTE: BE _serialize_user also returns 'uuid', 'permissions', and 'is_deleted'.
// These are intentionally hidden from this surface:
//   - uuid: internal identifier, never shown to admins
//   - permissions: raw JSON list; edited via the dedicated Settings -> Roles screen
//   - is_deleted: soft-delete flag, never user-facing
// Any future "View details" panel / expanded row MUST also strip these fields.

// ============================================================
// State (preserved from previous implementation)
// ============================================================
const users = ref<any[]>([])
const totalUsers = ref(0)
const loading = ref(false)
const stats = ref<any>(null)

const page = ref(1)
const itemsPerPage = ref(10)
const search = ref('')
const roleFilter = ref<string>('')
const statusFilter = ref<string>('')

const dialogOpen = ref(false)
const editing = ref<any>(null)
const dialogLoading = ref(false)

const deleteDialog = ref(false)
const deleting = ref<any>(null)
const deleteBusy = ref(false)

// CHEF is a valid backend role (kitchen staff, used for KDS attribution). It is
// created without any login credential — the BE stores an unusable password and
// it never appears in the cashier PIN picker. Exposed here so operators can add
// kitchen staff without dropping to the Django admin.
const roles = ['ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'CHEF', 'USER']
const statuses = ['ACTIVE', 'SUSPENDED']

const form = ref({
  first_name: '',
  last_name: '',
  email: '',
  role: 'CASHIER',
  status: 'ACTIVE',
  password: '',
})

const touched = ref<Record<string, boolean>>({})
const errors = ref<Record<string, string>>({})
const togglingId = ref<number | null>(null)
const editingId = ref<number | null>(null)
const deletingId = ref<number | null>(null)
const statusConfirm = ref<{ user: any; newStatus: string } | null>(null)

const isAdminRole = computed(() => form.value.role === 'ADMIN')
const requiresEmail = computed(() => ['ADMIN', 'MANAGER'].includes(form.value.role))
const isPinRole = computed(() => ['CASHIER', 'WAITER'].includes(form.value.role))
// CHEF is a non-login kitchen label — no email, no PIN. The credential field is
// hidden and replaced with an explanatory note; on create the BE forces an empty
// (unusable) password regardless of what we send.
const isChef = computed(() => form.value.role === 'CHEF')

function validateField(field: string) {
  // Surfaces inline errors without blocking submission flow.
  const err: Record<string, string> = { ...errors.value }
  delete err[field]
  if (field === 'email' && !editing.value && requiresEmail.value && !form.value.email.trim())
    err.email = t('Email is required for this role')
  if (field === 'password' && !editing.value && isPinRole.value && !/^\d{4}$/.test(form.value.password))
    err.password = t('PIN must be exactly 4 digits')
  errors.value = err
}

function onBlur(field: string) {
  touched.value[field] = true
  validateField(field)
}

// ============================================================
// Tone maps (mirror bundle's STATUS_TONE)
// ============================================================
const ROLE_TONE: Record<string, 'primary' | 'info' | 'neutral' | 'success' | 'warning' | 'error'> = {
  ADMIN: 'primary',
  MANAGER: 'primary',
  CASHIER: 'info',
  WAITER: 'info',
  CHEF: 'warning',
  USER: 'neutral',
}

// ============================================================
// Formatters
// ============================================================
const NB = ' ' // narrow no-break space
function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—'
  const neg = Number(n) < 0
  const s = Math.round(Math.abs(Number(n))).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NB)
  return (neg ? '−' : '') + s
}
function fmtAbbr(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—'
  const v = Number(n)
  const a = Math.abs(v)
  const trim2 = (x: number) => x.toFixed(2).replace(/\.?0+$/, '')
  const trim1 = (x: number) => x.toFixed(1).replace(/\.0$/, '')
  let out: string
  if (a >= 1e9) out = `${trim2(a / 1e9)}B`
  else if (a >= 1e6) out = `${trim2(a / 1e6)}M`
  else if (a >= 1e3) out = `${trim1(a / 1e3)}K`
  else out = String(Math.round(a))
  return (v < 0 ? '−' : '') + out
}

// ============================================================
// API — preserved from previous implementation
// ============================================================
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
    // NOTE: total_salary was removed because BE _serialize_user() doesn't return
    // a 'salary' field; payroll lives at /api/admins/hr/salaries instead.
    const distinctRoles = new Set(users.value.map((u: any) => u.role).filter(Boolean))
    stats.value = {
      total_users: totalUsers.value,
      active_users: users.value.filter((u: any) => u.status === 'ACTIVE').length,
      total_roles: distinctRoles.size,
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

// ============================================================
// Dialog
// ============================================================
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
  touched.value = {}
  errors.value = {}
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
  // CHEF has no credential at all — drop any typed value and its inline error.
  if (isChef.value) {
    form.value.password = ''
    const err = { ...errors.value }
    delete err.password
    errors.value = err
  }
}

function openEdit(user: any) {
  if (editingId.value !== null) return
  editingId.value = user.id
  editing.value = user
  form.value = {
    first_name: user.first_name ?? '',
    last_name: user.last_name ?? '',
    email: user.email ?? '',
    role: user.role ?? 'CASHIER',
    status: user.status ?? 'ACTIVE',
    password: '',
  }
  touched.value = {}
  errors.value = {}
  dialogOpen.value = true
}

function closeDialog() {
  if (dialogLoading.value) return
  dialogOpen.value = false
  editingId.value = null
}

async function save() {
  // Compute inline errors first; surface a toast only when something is wrong
  // so screen-reader users hear something instead of a silent failure.
  const newErrors: Record<string, string> = {}
  if (!editing.value && requiresEmail.value && !form.value.email.trim())
    newErrors.email = t('Email is required for this role')
  if (!editing.value && isPinRole.value && !/^\d{4}$/.test(form.value.password))
    newErrors.password = t('PIN must be exactly 4 digits')

  errors.value = newErrors
  if (Object.keys(newErrors).length > 0) {
    touched.value = { ...touched.value, email: true, password: true }
    notify(Object.values(newErrors)[0], 'error')

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
    editingId.value = null
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
  if (deletingId.value !== null) return
  deletingId.value = user.id
  deleting.value = user
  deleteDialog.value = true
}

function closeDeleteDialog() {
  if (deleteBusy.value) return
  deleteDialog.value = false
  deletingId.value = null
}

async function doDelete() {
  if (!deleting.value)
    return
  deleteBusy.value = true
  try {
    await axios.delete(`/users/${deleting.value.id}`)
    notify(t('User deleted'))
    deleteDialog.value = false
    deletingId.value = null
    await loadUsers()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    deleteBusy.value = false
  }
}

async function performStatusChange(user: any, newStatus: string) {
  if (togglingId.value !== null) return
  togglingId.value = user.id
  try {
    await axios.patch(`/users/${user.id}`, { status: newStatus })
    notify(t('Status updated'))
    await loadUsers()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    togglingId.value = null
  }
}

function toggleStatus(user: any) {
  // Suspending privileged roles is sensitive — gate behind a confirm dialog.
  // Cashier/Waiter/User toggles fire immediately, matching prior UX.
  const newStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
  const sensitive = ['ADMIN', 'MANAGER'].includes(user.role) && newStatus === 'SUSPENDED'
  if (sensitive) {
    statusConfirm.value = { user, newStatus }

    return
  }
  performStatusChange(user, newStatus)
}

function confirmStatusChange() {
  if (!statusConfirm.value) return
  const { user, newStatus } = statusConfirm.value
  statusConfirm.value = null
  performStatusChange(user, newStatus)
}

function cancelStatusChange() {
  statusConfirm.value = null
}

// ============================================================
// Filter chips
// ============================================================
const activeFilters = computed(() => {
  const out: { k: string; label: string; val: string; clear: () => void }[] = []
  if (search.value)
    out.push({ k: 'q', label: t('Search'), val: search.value, clear: () => { search.value = '' } })
  if (roleFilter.value)
    out.push({ k: 'r', label: t('Role'), val: t(`role_${roleFilter.value}`), clear: () => { roleFilter.value = '' } })
  if (statusFilter.value)
    out.push({ k: 's', label: t('Status'), val: t(`user_status_${statusFilter.value}`), clear: () => { statusFilter.value = '' } })
  return out
})

function clearAllFilters() {
  search.value = ''
  roleFilter.value = ''
  statusFilter.value = ''
}

function initialOf(u: any): string {
  return (u?.first_name?.[0] || u?.email?.[0] || '?').toUpperCase()
}

// ============================================================
// KPI data feeding the four-card strip
// ============================================================
const kpiTotal = computed(() => ({
  label: t('Total'),
  value: stats.value ? stats.value.total_users : null,
  icon: 'users',
  tone: 'primary' as const,
  sub: t('Users'),
}))
const kpiActive = computed(() => ({
  label: t('Active (this page)'),
  value: stats.value ? stats.value.active_users : null,
  icon: 'userok',
  tone: 'success' as const,
  sub: t('on current page'),
}))
const kpiRoles = computed(() => ({
  label: t('Roles'),
  value: stats.value ? stats.value.total_roles : null,
  icon: 'building',
  tone: 'info' as const,
  sub: t('distinct'),
}))
// kpiSalary removed: /users response has no salary field. Payroll lives on
// the dedicated HR salaries page (/api/admins/hr/salaries).

// ============================================================
// DataTable column definitions — matches Users.jsx columns 1:1
// (id, name, email, role, status). Cells use scoped slots so we
// can render avatars + design Badge / StatusBadge components.
// ============================================================
const columns: DataTableColumn<any>[] = [
  { key: 'id', label: t('ID'), sortable: true, width: 80 },
  { key: 'name', label: t('Name'), sortable: true, width: 220, sortValue: (u: any) => u.first_name ?? '' },
  { key: 'email', label: t('Email'), sortable: true },
  { key: 'role', label: t('Role'), sortable: true },
  { key: 'status', label: t('Status'), sortable: true },
  { key: 'last_login_at', label: t('Last login'), sortable: true },
  { key: 'created_at', label: t('Created'), sortable: true },
]

// Controlled pagination — backend pages the list. We hand pre-paged
// rows + total to DataTable so its internal slicing is bypassed.
const tablePagination = computed(() => ({
  page: page.value,
  perPage: itemsPerPage.value,
  total: totalUsers.value,
  onPage: (n: number) => { page.value = n },
  onPerPage: (n: number) => { itemsPerPage.value = n; page.value = 1 },
}))

// Role select options for the filter dropdown (placeholder = "All roles")
const roleOptions = computed(() => roles.map(r => ({ value: r, label: t(`role_${r}`) })))
const statusOptions = computed(() => statuses.map(s => ({ value: s, label: t(`user_status_${s}`) })))
const formRoleOptions = computed(() => roles.map(r => ({ value: r, label: t(`role_${r}`) })))

// ESC handler — close whichever modal is open, top-most first.
function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (statusConfirm.value) {
    cancelStatusChange()
    e.preventDefault()

    return
  }
  if (deleteDialog.value) {
    if (!deleteBusy.value) {
      deleteDialog.value = false
      deletingId.value = null
      e.preventDefault()
    }

    return
  }
  if (dialogOpen.value) {
    closeDialog()
    e.preventDefault()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="page">
    <!-- Page header -->
    <PageHeader
      :title="t('Users')"
      :subtitle="t('Manage accounts, roles and access')"
    >
      <template #actions>
        <Button
          variant="primary"
          icon="plus"
          @click="openCreate"
        >
          {{ t('New User') }}
        </Button>
      </template>
    </PageHeader>

    <!-- KPI strip -->
    <div
      class="grid cols-3 users-kpi-grid"
      style="margin-bottom: var(--sp-5);"
    >
      <Kpi :data="kpiTotal" />
      <Kpi :data="kpiActive" />
      <Kpi :data="kpiRoles" />
    </div>

    <!-- Toolbar + table -->
    <Card>
      <div
        class="toolbar users-toolbar"
        style="flex-wrap:wrap;"
      >
        <!-- Search -->
        <div class="users-toolbar__search">
          <Input
            v-model="search"
            icon="search"
            :placeholder="t('Search users...')"
          />
        </div>

        <!-- Role -->
        <div class="users-toolbar__filter">
          <Select
            v-model="roleFilter"
            icon="filter"
            :placeholder="t('All Roles')"
            :options="roleOptions"
          />
        </div>

        <!-- Status -->
        <div class="users-toolbar__filter">
          <Select
            v-model="statusFilter"
            :placeholder="t('All Statuses')"
            :options="statusOptions"
          />
        </div>
      </div>

      <!-- Filter chips -->
      <div
        v-if="activeFilters.length > 0"
        class="toolbar"
        style="padding-top:0;"
      >
        <div class="chips">
          <span
            class="tertiary"
            style="font-size:13px;margin-right:2px;"
          >{{ t('Filters') }}:</span>
          <span
            v-for="f in activeFilters"
            :key="f.k"
            class="chip"
          >
            <span>{{ f.label }}: <b>{{ f.val }}</b></span>
            <span
              class="chip__x"
              @click="f.clear()"
            >
              <DesignIcon
                name="close"
                :size="13"
              />
            </span>
          </span>
          <button
            class="chip--clear"
            @click="clearAllFilters"
          >
            {{ t('Clear all') }}
          </button>
        </div>
      </div>

      <div class="card__divider" />

      <!-- Table -->
      <DataTable
        :columns="columns"
        :rows="users"
        row-key="id"
        :loading="loading"
        :pagination="tablePagination"
        :initial-sort="{ key: 'id', dir: 'desc' }"
      >
        <!-- Cell renderers -->
        <template #cell.id="{ row }">
          <span class="mono cell-muted">#{{ row.id }}</span>
        </template>

        <template #cell.name="{ row }">
          <div
            class="row"
            style="gap:11px;align-items:center;"
          >
            <div class="avatar avatar--sm">
              {{ initialOf(row) }}
            </div>
            <span class="cell-strong nowrap">{{ row.first_name }} {{ row.last_name }}</span>
          </div>
        </template>

        <template #cell.email="{ row }">
          <span class="cell-muted">{{ row.email }}</span>
        </template>

        <template #cell.role="{ row }">
          <Badge :tone="ROLE_TONE[row.role] || 'neutral'">
            {{ row.role ? t(`role_${row.role}`) : '' }}
          </Badge>
        </template>

        <template #cell.status="{ row }">
          <Badge
            :tone="row.status === 'ACTIVE' ? 'success' : (row.status === 'SUSPENDED' ? 'error' : 'neutral')"
            dot
          >
            {{ row.status ? t(`user_status_${row.status}`) : '' }}
          </Badge>
        </template>

        <template #cell.last_login_at="{ row }">
          <span
            v-if="row.last_login_at"
            class="cell-muted"
          >{{ formatDate(row.last_login_at) }}</span>
          <!-- Dormant accounts (never signed in) are a housekeeping/security
               signal — flag them so operators can spot unused logins. -->
          <span
            v-else
            :title="t('This account has never signed in')"
          >
            <Badge
              tone="warning"
              dot
            >{{ t('Never') }}</Badge>
          </span>
        </template>

        <template #cell.created_at="{ row }">
          <span class="cell-muted">{{ formatDate(row.created_at) }}</span>
        </template>

        <!-- Row actions -->
        <template #row-actions="{ row }">
          <IconAction
            :icon="togglingId === row.id ? 'refresh' : (row.status === 'ACTIVE' ? 'pause' : 'play')"
            tone="warning"
            :title="row.status === 'ACTIVE' ? t('Suspend') : t('Activate')"
            :disabled="togglingId === row.id"
            :class="{ 'is-busy': togglingId === row.id, 'iconspin-wrap': togglingId === row.id }"
            @click="toggleStatus(row)"
          />
          <IconAction
            icon="edit"
            tone="primary"
            :title="t('Edit')"
            :disabled="editingId === row.id"
            @click="openEdit(row)"
          />
          <IconAction
            icon="trash"
            tone="danger"
            :title="t('Delete')"
            :disabled="deletingId === row.id"
            @click="confirmDelete(row)"
          />
        </template>

        <!-- Empty state -->
        <template #empty>
          <div class="statefill">
            <div class="statefill__icon">
              <DesignIcon
                name="users"
                :size="24"
              />
            </div>
            <div class="statefill__title">
              {{ t('No users match your filters') }}
            </div>
            <div style="margin-top:12px;">
              <Button
                variant="secondary"
                @click="clearAllFilters"
              >
                {{ t('Clear filters') }}
              </Button>
            </div>
          </div>
        </template>
      </DataTable>
    </Card>

    <!-- Edit / New User modal -->
    <Modal
      :open="dialogOpen"
      :title="editing ? t('Edit User') : t('New User')"
      :subtitle="editing
        ? t('Update details for') + ' ' + (editing.first_name || '') + ' ' + (editing.last_name || '')
        : t('Create a new account and assign a role')"
      :width="640"
      @close="closeDialog"
    >
      <form @submit.prevent="save">
        <div class="form-grid">
          <!-- User ID (edit only) -->
          <Field
            v-if="editing"
            :label="t('User ID')"
            class="span-2"
            :hint="t(`Identifier is assigned automatically and can't be changed.`)"
          >
            <div class="control is-disabled">
              <DesignIcon
                name="lock"
                :size="16"
              />
              <input
                :value="`#${editing.id}`"
                disabled
              >
            </div>
          </Field>

          <!-- First name -->
          <Field :label="t('First Name')">
            <Input
              v-model="form.first_name"
              :placeholder="t('First Name')"
            />
          </Field>

          <!-- Last name -->
          <Field :label="t('Last Name')">
            <Input
              v-model="form.last_name"
              :placeholder="t('Last Name')"
            />
          </Field>

          <!-- Role -->
          <Field :label="t('Role')">
            <Select
              v-model="form.role"
              :options="formRoleOptions"
              @change="onRoleChange"
            />
          </Field>

          <!-- Status (edit only — uses switch on edit; create defaults to ACTIVE) -->
          <Field
            v-if="editing"
            :label="t('Status')"
          >
            <div
              class="row"
              style="gap:10px;align-items:center;height:42px;"
            >
              <Switch
                :model-value="form.status === 'ACTIVE'"
                @update:model-value="(v: boolean) => form.status = v ? 'ACTIVE' : 'SUSPENDED'"
              />
              <span style="font-size:14px;font-weight:500;color:var(--text-secondary);">
                {{ t(`user_status_${form.status}`) }}
              </span>
            </div>
          </Field>

          <!-- Email -->
          <Field
            v-if="editing || isAdminRole || requiresEmail"
            :label="t('Email')"
            class="span-2"
            :error="errors.email"
            :hint="!editing && requiresEmail && !errors.email ? t('Required for ADMIN / MANAGER') : undefined"
          >
            <Input
              v-model="form.email"
              type="email"
              icon="mail"
              :error="!!errors.email"
              :placeholder="t('Email placeholder example')"
              @blur="onBlur('email')"
            />
          </Field>

          <!-- Chef: non-login kitchen label — no credential field -->
          <div
            v-if="isChef"
            class="span-2 chef-note"
          >
            <DesignIcon
              name="info"
              :size="16"
            />
            <span>{{ t('Chef accounts are kitchen labels only — they have no login access or PIN.') }}</span>
          </div>

          <!-- Password -->
          <Field
            v-if="!isChef"
            :label="editing ? t('New Password (leave blank to keep)') : (isPinRole ? t('4-digit PIN') : t('Password'))"
            class="span-2"
            :error="errors.password"
            :hint="!editing && isPinRole && !errors.password ? t('Exactly 4 digits') : undefined"
          >
            <Input
              v-model="form.password"
              icon="lock"
              :error="!!errors.password"
              :type="isPinRole ? 'tel' : 'password'"
              :placeholder="editing ? t('Leave blank to keep') : t('Password placeholder dots')"
              :maxlength="isPinRole ? 4 : undefined"
              :pattern="isPinRole ? '[0-9]{4}' : undefined"
              inputmode="numeric"
              @blur="onBlur('password')"
            />
          </Field>
        </div>
      </form>

      <template #footer>
        <Button
          variant="ghost"
          :disabled="dialogLoading"
          @click="closeDialog"
        >
          {{ t('Cancel') }}
        </Button>
        <Button
          variant="primary"
          icon="check"
          :loading="dialogLoading"
          :disabled="dialogLoading"
          @click="save"
        >
          {{ t('Save') }}
        </Button>
      </template>
    </Modal>

    <!-- Delete confirm modal -->
    <Modal
      :open="deleteDialog"
      :title="t('Delete User')"
      :subtitle="t('This action cannot be undone')"
      :width="440"
      @close="closeDeleteDialog"
    >
      <div
        class="row"
        style="gap:14px;align-items:flex-start;"
      >
        <div
          class="kpi__icon t-error"
          style="width:44px;height:44px;flex:0 0 44px;"
        >
          <DesignIcon
            name="alert"
            :size="22"
          />
        </div>
        <div>
          <p style="margin:0;font-weight:600;">
            {{ deleting ? `${deleting.first_name || ''} ${deleting.last_name || ''}`.trim() : '' }}
            {{ t('will be removed.') }}
          </p>
          <p
            class="muted"
            style="margin:6px 0 0;font-size:14px;"
          >
            {{ t('This permanently revokes account access.') }}
          </p>
        </div>
      </div>

      <template #footer>
        <Button
          variant="ghost"
          :disabled="deleteBusy"
          @click="closeDeleteDialog"
        >
          {{ t('Cancel') }}
        </Button>
        <Button
          variant="danger"
          icon="trash"
          :loading="deleteBusy"
          :disabled="deleteBusy"
          @click="doDelete"
        >
          {{ t('Delete') }}
        </Button>
      </template>
    </Modal>

    <!-- Status change confirm (ADMIN/MANAGER suspension) -->
    <Modal
      :open="!!statusConfirm"
      :title="statusConfirm?.newStatus === 'SUSPENDED' ? t('Suspend account') : t('Activate account')"
      :subtitle="t('Confirm sensitive role status change')"
      :width="440"
      @close="cancelStatusChange"
    >
      <div
        v-if="statusConfirm"
        class="row"
        style="gap:14px;align-items:flex-start;"
      >
        <div
          class="kpi__icon t-warning"
          style="width:44px;height:44px;flex:0 0 44px;"
        >
          <DesignIcon
            name="alert"
            :size="22"
          />
        </div>
        <div>
          <p style="margin:0;font-weight:600;">
            {{ `${statusConfirm.user.first_name || ''} ${statusConfirm.user.last_name || ''}`.trim() }}
            ({{ t(`role_${statusConfirm.user.role}`) }})
          </p>
          <p
            class="muted"
            style="margin:6px 0 0;font-size:14px;"
          >
            {{ statusConfirm.newStatus === 'SUSPENDED'
              ? t('Suspending a privileged account revokes their dashboard access immediately.')
              : t('Activating restores full dashboard access for this account.') }}
          </p>
        </div>
      </div>

      <template #footer>
        <Button
          variant="ghost"
          @click="cancelStatusChange"
        >
          {{ t('Cancel') }}
        </Button>
        <Button
          variant="primary"
          @click="confirmStatusChange"
        >
          {{ statusConfirm?.newStatus === 'SUSPENDED' ? t('Suspend') : t('Activate') }}
        </Button>
      </template>
    </Modal>

    <!-- Toast -->
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
/* Spin animation for the toggle-status icon while a PATCH is in flight. */
.iconspin-wrap :deep(svg) {
  animation: users-spin 0.85s linear infinite;
}
@keyframes users-spin {
  to { transform: rotate(360deg); }
}
.iconaction.is-busy {
  cursor: progress;
  opacity: 0.7;
}

/* CHEF role note — replaces the credential field for passwordless kitchen staff */
.chef-note {
  display: flex;
  gap: 9px;
  align-items: flex-start;
  padding: 12px 14px;
  border-radius: var(--r-sm, 8px);
  background: rgb(var(--v-theme-warning-weak));
  border: 1px solid rgb(var(--v-theme-warning-border));
  color: rgb(var(--v-theme-warning-strong));
  font-size: 13px;
  line-height: 1.45;
}
.chef-note :deep(svg) {
  flex: 0 0 auto;
  margin-top: 1px;
}

/* Toolbar: search expands, filters are fixed at 180px on desktop */
.users-toolbar__search {
  flex: 1;
  min-width: 220px;
  max-width: 300px;
}
.users-toolbar__filter {
  width: 180px;
}

/* Tablet (canonical 1024px) — KPI strip drops to 2 columns; filters shrink to fit */
@media (max-width: 1024px) {
  .users-kpi-grid {
    grid-template-columns: repeat(2, 1fr) !important;
  }
  .users-toolbar__search {
    min-width: 180px;
    max-width: none;
  }
  .users-toolbar__filter {
    width: 160px;
  }
}

/* Phone (canonical 768px) — toolbar inputs take full width; KPI stays 2-up */
@media (max-width: 768px) {
  .users-toolbar__search,
  .users-toolbar__filter {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    flex: 1 1 100%;
  }
}

/* Small phone (canonical 420px) — KPI collapses to single column */
@media (max-width: 420px) {
  .users-kpi-grid {
    grid-template-columns: 1fr !important;
  }
}
</style>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>
