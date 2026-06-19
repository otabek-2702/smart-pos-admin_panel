<script setup lang="ts">
/* ============================================================
   USERS — accounts, roles, access
   Ported 1:1 from .tmp-design-bundle/project/pages/Users.jsx
   ============================================================ */
import axios from '@/plugins/axios'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()

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

const touched = ref<Record<string, boolean>>({})
const errors = ref<Record<string, string>>({})
const togglingId = ref<number | null>(null)
const editingId = ref<number | null>(null)
const deletingId = ref<number | null>(null)
const statusConfirm = ref<{ user: any; newStatus: string } | null>(null)

const isAdminRole = computed(() => form.value.role === 'ADMIN')
const requiresEmail = computed(() => ['ADMIN', 'MANAGER'].includes(form.value.role))
const isPinRole = computed(() => ['CASHIER', 'WAITER'].includes(form.value.role))

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
const ROLE_TONE: Record<string, string> = {
  ADMIN: 'primary',
  MANAGER: 'primary',
  CASHIER: 'info',
  WAITER: 'info',
  USER: 'neutral',
}
const STATUS_TONE: Record<string, string> = {
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  INACTIVE: 'neutral',
}

// ============================================================
// Formatters
// ============================================================
const NB = ' ' // narrow no-break space
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
    const distinctRoles = new Set(users.value.map((u: any) => u.role).filter(Boolean))
    stats.value = {
      total_users: totalUsers.value,
      active_users: users.value.filter((u: any) => u.status === 'ACTIVE').length,
      total_roles: distinctRoles.size,
      total_salary: users.value.reduce((s: number, u: any) => s + (Number(u.salary) || 0), 0),
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
    out.push({ k: 'r', label: t('Role'), val: t(roleFilter.value), clear: () => { roleFilter.value = '' } })
  if (statusFilter.value)
    out.push({ k: 's', label: t('Status'), val: t(statusFilter.value), clear: () => { statusFilter.value = '' } })
  return out
})

function clearAllFilters() {
  search.value = ''
  roleFilter.value = ''
  statusFilter.value = ''
}

// ============================================================
// Pagination helpers
// ============================================================
const totalPages = computed(() => Math.max(1, Math.ceil(totalUsers.value / itemsPerPage.value)))
const pageStart = computed(() => totalUsers.value === 0 ? 0 : (page.value - 1) * itemsPerPage.value + 1)
const pageEnd = computed(() => Math.min(page.value * itemsPerPage.value, totalUsers.value))
const pageNums = computed<(number | string)[]>(() => {
  const pages = totalPages.value
  const p = page.value
  if (pages <= 7) {
    const arr: (number | string)[] = []
    for (let i = 1; i <= pages; i++) arr.push(i)
    return arr
  }
  if (p <= 4) return [1, 2, 3, 4, 5, '…', pages]
  if (p >= pages - 3) return [1, '…', pages - 4, pages - 3, pages - 2, pages - 1, pages]
  return [1, '…', p - 1, p, p + 1, '…', pages]
})

function gotoPage(n: number | string) {
  if (typeof n !== 'number') return
  if (n < 1 || n > totalPages.value) return
  page.value = n
}

function initialOf(u: any): string {
  return (u?.first_name?.[0] || u?.email?.[0] || '?').toUpperCase()
}

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
    <div class="page__head">
      <div>
        <h1 class="page__title">
          {{ t('Users') }}
        </h1>
        <div class="page__subtitle">
          {{ t('Manage accounts, roles and access') }}
        </div>
      </div>
      <div class="page__head-actions">
        <button class="btn btn--primary" @click="openCreate">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {{ t('New User') }}
        </button>
      </div>
    </div>

    <!-- KPI strip -->
    <div class="grid cols-4" style="margin-bottom: var(--sp-5);">
      <!-- Total -->
      <div class="kpi">
        <div class="kpi__top">
          <div class="kpi__icon t-primary">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
          </div>
          <div class="kpi__label">
            {{ t('Total') }}
          </div>
        </div>
        <div v-if="!stats" class="skel" style="width:80px;height:30px;" />
        <div v-else class="kpi__value">
          {{ fmtNum(stats.total_users) }}
        </div>
        <div class="kpi__foot">
          <span class="kpi__subtext">{{ t('Users') }}</span>
        </div>
      </div>

      <!-- Active -->
      <div class="kpi">
        <div class="kpi__top">
          <div class="kpi__icon t-success">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <polyline points="16 11 18 13 22 9" />
            </svg>
          </div>
          <div class="kpi__label">
            {{ t('Active (this page)') }}
          </div>
        </div>
        <div v-if="!stats" class="skel" style="width:60px;height:30px;" />
        <div v-else class="kpi__value">
          {{ fmtNum(stats.active_users) }}
        </div>
        <div class="kpi__foot">
          <span class="kpi__subtext">{{ t('on current page') }}</span>
        </div>
      </div>

      <!-- Roles count -->
      <div class="kpi">
        <div class="kpi__top">
          <div class="kpi__icon t-info">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 21h18" />
              <path d="M5 21V7l8-4v18" />
              <path d="M19 21V11l-6-4" />
            </svg>
          </div>
          <div class="kpi__label">
            {{ t('Roles') }}
          </div>
        </div>
        <div v-if="!stats" class="skel" style="width:40px;height:30px;" />
        <div v-else class="kpi__value">
          {{ fmtNum(stats.total_roles) }}
        </div>
        <div class="kpi__foot">
          <span class="kpi__subtext">{{ t('distinct') }}</span>
        </div>
      </div>

      <!-- Total Salary -->
      <div class="kpi">
        <div class="kpi__top">
          <div class="kpi__icon t-neutral">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <circle cx="12" cy="12" r="3" />
              <path d="M6 12h.01M18 12h.01" />
            </svg>
          </div>
          <div class="kpi__label">
            {{ t('Total Salary') }}
          </div>
        </div>
        <div v-if="!stats" class="skel" style="width:120px;height:30px;" />
        <div v-else class="kpi__value">
          {{ fmtAbbr(stats.total_salary) }}<span class="kpi__unit">UZS</span>
        </div>
        <div class="kpi__foot">
          <span class="kpi__subtext">{{ t('payroll') }}</span>
        </div>
      </div>
    </div>

    <!-- Toolbar + table -->
    <div class="card">
      <div class="toolbar">
        <!-- Search -->
        <div style="flex:1;max-width:300px;">
          <div class="control">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-tertiary);flex:0 0 18px;">
              <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input v-model="search" :placeholder="t('Search users...')">
          </div>
        </div>

        <!-- Role -->
        <div style="width:180px;">
          <div class="control control--select">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-tertiary);flex:0 0 18px;">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            <select v-model="roleFilter" :style="{ color: roleFilter ? 'var(--text)' : 'var(--text-tertiary)' }">
              <option value="">
                {{ t('All Roles') }}
              </option>
              <option v-for="r in roles" :key="r" :value="r" style="color:var(--text);">
                {{ t(r) }}
              </option>
            </select>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="chev"><polyline points="6 9 12 15 18 9" /></svg>
          </div>
        </div>

        <!-- Status -->
        <div style="width:180px;">
          <div class="control control--select">
            <select v-model="statusFilter" :style="{ color: statusFilter ? 'var(--text)' : 'var(--text-tertiary)' }">
              <option value="">
                {{ t('All Statuses') }}
              </option>
              <option v-for="s in statuses" :key="s" :value="s" style="color:var(--text);">
                {{ t(s) }}
              </option>
            </select>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="chev"><polyline points="6 9 12 15 18 9" /></svg>
          </div>
        </div>
      </div>

      <!-- Filter chips -->
      <div v-if="activeFilters.length > 0" class="toolbar" style="padding-top:0;">
        <div class="chips">
          <span class="tertiary" style="font-size:13px;margin-right:2px;">{{ t('Filters') }}:</span>
          <span v-for="f in activeFilters" :key="f.k" class="chip">
            <span>{{ f.label }}: <b>{{ f.val }}</b></span>
            <span class="chip__x" @click="f.clear()">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </span>
          </span>
          <button class="chip--clear" @click="clearAllFilters">
            {{ t('Clear all') }}
          </button>
        </div>
      </div>

      <div class="card__divider" />

      <!-- Table -->
      <table class="dtable">
        <thead>
          <tr>
            <th style="width:80px;">
              {{ t('ID') }}
            </th>
            <th>{{ t('Name') }}</th>
            <th>{{ t('Email') }}</th>
            <th>{{ t('Role') }}</th>
            <th>{{ t('Status') }}</th>
            <th style="text-align:right;width:140px;">
              {{ t('Actions') }}
            </th>
          </tr>
        </thead>

        <tbody v-if="loading && users.length === 0">
          <tr v-for="n in itemsPerPage" :key="`sk-${n}`">
            <td><div class="skel" style="width:32px;height:14px;" /></td>
            <td>
              <div class="row" style="gap:11px;align-items:center;">
                <div class="skel" style="width:28px;height:28px;border-radius:99px;" />
                <div class="skel" style="width:140px;height:14px;" />
              </div>
            </td>
            <td><div class="skel" style="width:180px;height:14px;" /></td>
            <td><div class="skel" style="width:80px;height:22px;border-radius:6px;" /></td>
            <td><div class="skel" style="width:70px;height:22px;border-radius:6px;" /></td>
            <td>
              <div class="row" style="gap:4px;justify-content:flex-end;">
                <div class="skel" style="width:32px;height:32px;border-radius:8px;" />
                <div class="skel" style="width:32px;height:32px;border-radius:8px;" />
                <div class="skel" style="width:32px;height:32px;border-radius:8px;" />
              </div>
            </td>
          </tr>
        </tbody>

        <tbody v-else-if="users.length === 0">
          <tr>
            <td colspan="6" style="padding:0;">
              <div class="statefill">
                <div class="statefill__icon">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
                  </svg>
                </div>
                <div class="statefill__title">
                  {{ t('No users match your filters') }}
                </div>
                <div style="margin-top:12px;">
                  <button class="btn btn--secondary" @click="clearAllFilters">
                    {{ t('Clear filters') }}
                  </button>
                </div>
              </div>
            </td>
          </tr>
        </tbody>

        <tbody v-else>
          <tr v-for="u in users" :key="u.id">
            <td><span class="mono cell-muted">#{{ u.id }}</span></td>
            <td>
              <div class="row" style="gap:11px;align-items:center;">
                <div class="avatar avatar--sm">
                  {{ initialOf(u) }}
                </div>
                <span class="cell-strong nowrap">{{ u.first_name }} {{ u.last_name }}</span>
              </div>
            </td>
            <td><span class="cell-muted">{{ u.email }}</span></td>
            <td>
              <span class="badge" :class="`t-${ROLE_TONE[u.role] || 'neutral'}`">{{ u.role ? t(u.role) : '' }}</span>
            </td>
            <td>
              <span class="badge badge--dot" :class="`t-${STATUS_TONE[u.status] || 'neutral'}`">{{ u.status ? t(u.status) : '' }}</span>
            </td>
            <td>
              <div class="row" style="gap:4px;justify-content:flex-end;">
                <button
                  class="iconaction is-warning"
                  :class="{ 'is-busy': togglingId === u.id }"
                  :title="u.status === 'ACTIVE' ? t('Suspend') : t('Activate')"
                  :disabled="togglingId === u.id"
                  @click="toggleStatus(u)"
                >
                  <svg v-if="togglingId === u.id" class="iconspin" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                  </svg>
                  <svg v-else-if="u.status === 'ACTIVE'" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
                  </svg>
                  <svg v-else viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="6 4 20 12 6 20 6 4" />
                  </svg>
                </button>
                <button class="iconaction is-primary" :title="t('Edit')" :disabled="editingId === u.id" @click="openEdit(u)">
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 113 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </button>
                <button class="iconaction is-danger" :title="t('Delete')" :disabled="deletingId === u.id" @click="confirmDelete(u)">
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-2 14a2 2 0 01-2 2H9a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2" />
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div class="pagination">
        <div class="row" style="gap:8px;">
          <span>{{ t('Rows per page') }}:</span>
          <div style="width:76px;">
            <div class="control control--select control--sm">
              <select v-model.number="itemsPerPage">
                <option :value="10">
                  10
                </option>
                <option :value="20">
                  20
                </option>
                <option :value="50">
                  50
                </option>
              </select>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="chev"><polyline points="6 9 12 15 18 9" /></svg>
            </div>
          </div>
        </div>
        <div class="pagination__spacer" />
        <span class="num">{{ pageStart }}–{{ pageEnd }} {{ t('of') }} {{ fmtNum(totalUsers) }}</span>
        <div class="pglist">
          <button class="pgbtn" :disabled="page <= 1" @click="gotoPage(page - 1)">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <template v-for="(n, i) in pageNums" :key="`pg-${i}`">
            <span v-if="n === '…'" class="pgbtn" style="pointer-events:none;">…</span>
            <button v-else class="pgbtn" :class="{ 'is-active': n === page }" @click="gotoPage(n)">
              {{ n }}
            </button>
          </template>
          <button class="pgbtn" :disabled="page >= totalPages" @click="gotoPage(page + 1)">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Edit / New User modal -->
    <div v-if="dialogOpen" class="overlay" @mousedown.self="closeDialog">
      <div class="modal" style="max-width:640px;" role="dialog" aria-modal="true">
        <div class="modal__head">
          <div style="flex:1;min-width:0;">
            <h3 class="modal__title">
              {{ editing ? t('Edit User') : t('New User') }}
            </h3>
            <div class="modal__sub">
              {{ editing
                ? t('Update details for') + ' ' + (editing.first_name || '') + ' ' + (editing.last_name || '')
                : t('Create a new account and assign a role') }}
            </div>
          </div>
          <button class="iconaction" :title="t('Close')" @click="closeDialog">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form class="modal__body" @submit.prevent="save">
          <div class="form-grid">
            <!-- User ID (edit only) -->
            <label v-if="editing" class="field span-2">
              <span class="field__label">{{ t('User ID') }}</span>
              <div class="control is-disabled">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:0 0 16px;color:var(--text-tertiary);">
                  <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                <input :value="`#${editing.id}`" disabled>
              </div>
              <span class="field__hint">{{ t("Identifier is assigned automatically and can't be changed.") }}</span>
            </label>

            <!-- First name -->
            <label class="field">
              <span class="field__label">{{ t('First Name') }}</span>
              <div class="control">
                <input v-model="form.first_name" :placeholder="t('First Name')">
              </div>
            </label>

            <!-- Last name -->
            <label class="field">
              <span class="field__label">{{ t('Last Name') }}</span>
              <div class="control">
                <input v-model="form.last_name" :placeholder="t('Last Name')">
              </div>
            </label>

            <!-- Role -->
            <label class="field">
              <span class="field__label">{{ t('Role') }}</span>
              <div class="control control--select">
                <select v-model="form.role" @change="onRoleChange">
                  <option v-for="r in roles" :key="r" :value="r">
                    {{ t(r) }}
                  </option>
                </select>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="chev"><polyline points="6 9 12 15 18 9" /></svg>
              </div>
            </label>

            <!-- Status (edit only — uses switch on edit; create defaults to ACTIVE) -->
            <label v-if="editing" class="field">
              <span class="field__label">{{ t('Status') }}</span>
              <div class="row" style="gap:10px;align-items:center;height:42px;">
                <span
                  class="switch"
                  :class="{ 'is-on': form.status === 'ACTIVE' }"
                  role="switch"
                  :aria-checked="form.status === 'ACTIVE'"
                  @click="form.status = form.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'"
                />
                <span style="font-size:14px;font-weight:500;color:var(--text-secondary);">
                  {{ t(form.status) }}
                </span>
              </div>
            </label>

            <!-- Email -->
            <label v-if="editing || isAdminRole || requiresEmail" class="field span-2">
              <span class="field__label">{{ t('Email') }}</span>
              <div class="control" :class="{ 'has-error': errors.email }">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:0 0 18px;color:var(--text-tertiary);">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
                </svg>
                <input v-model="form.email" type="email" placeholder="name@pos.local" @blur="onBlur('email')">
              </div>
              <span v-if="errors.email" class="field__error">{{ errors.email }}</span>
              <span v-else-if="!editing && requiresEmail" class="field__hint">{{ t('Required for ADMIN / MANAGER') }}</span>
            </label>

            <!-- Password -->
            <label class="field span-2">
              <span class="field__label">
                {{ editing ? t('New Password (leave blank to keep)') : (isPinRole ? t('4-digit PIN') : t('Password')) }}
              </span>
              <div class="control" :class="{ 'has-error': errors.password }">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:0 0 18px;color:var(--text-tertiary);">
                  <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                <input
                  v-model="form.password"
                  :type="isPinRole ? 'tel' : 'password'"
                  :placeholder="editing ? t('Leave blank to keep') : '••••••••'"
                  :maxlength="isPinRole ? 4 : undefined"
                  :pattern="isPinRole ? '[0-9]{4}' : undefined"
                  inputmode="numeric"
                  @blur="onBlur('password')"
                >
              </div>
              <span v-if="errors.password" class="field__error">{{ errors.password }}</span>
              <span v-else-if="!editing && isPinRole" class="field__hint">{{ t('Exactly 4 digits') }}</span>
            </label>
          </div>

          <div class="modal__foot">
            <button type="button" class="btn btn--ghost" :disabled="dialogLoading" @click="closeDialog">
              {{ t('Cancel') }}
            </button>
            <button type="submit" class="btn btn--primary" :class="{ 'is-loading': dialogLoading }" :disabled="dialogLoading">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {{ t('Save') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete confirm modal -->
    <div v-if="deleteDialog" class="overlay" @mousedown.self="closeDeleteDialog">
      <div class="modal" style="max-width:440px;" role="dialog" aria-modal="true">
        <div class="modal__head">
          <div style="flex:1;min-width:0;">
            <h3 class="modal__title">
              {{ t('Delete User') }}
            </h3>
            <div class="modal__sub">
              {{ t('This action cannot be undone') }}
            </div>
          </div>
          <button class="iconaction" :title="t('Close')" @click="closeDeleteDialog">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div class="modal__body">
          <div class="row" style="gap:14px;align-items:flex-start;">
            <div class="kpi__icon t-error" style="width:44px;height:44px;flex:0 0 44px;">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <p style="margin:0;font-weight:600;">
                {{ deleting ? `${deleting.first_name || ''} ${deleting.last_name || ''}`.trim() : '' }}
                {{ t('will be removed.') }}
              </p>
              <p class="muted" style="margin:6px 0 0;font-size:14px;">
                {{ t('This permanently revokes account access.') }}
              </p>
            </div>
          </div>
        </div>
        <div class="modal__foot">
          <button class="btn btn--ghost" :disabled="deleteBusy" @click="closeDeleteDialog">
            {{ t('Cancel') }}
          </button>
          <button class="btn btn--danger" :class="{ 'is-loading': deleteBusy }" :disabled="deleteBusy" @click="doDelete">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-2 14a2 2 0 01-2 2H9a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" />
            </svg>
            {{ t('Delete') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Status change confirm (ADMIN/MANAGER suspension) -->
    <div v-if="statusConfirm" class="overlay" @mousedown.self="cancelStatusChange">
      <div class="modal" style="max-width:440px;" role="dialog" aria-modal="true">
        <div class="modal__head">
          <div style="flex:1;min-width:0;">
            <h3 class="modal__title">
              {{ statusConfirm.newStatus === 'SUSPENDED' ? t('Suspend account') : t('Activate account') }}
            </h3>
            <div class="modal__sub">
              {{ t('Confirm sensitive role status change') }}
            </div>
          </div>
          <button class="iconaction" :title="t('Close')" @click="cancelStatusChange">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div class="modal__body">
          <div class="row" style="gap:14px;align-items:flex-start;">
            <div class="kpi__icon t-warning" style="width:44px;height:44px;flex:0 0 44px;">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <p style="margin:0;font-weight:600;">
                {{ `${statusConfirm.user.first_name || ''} ${statusConfirm.user.last_name || ''}`.trim() }}
                ({{ t(statusConfirm.user.role) }})
              </p>
              <p class="muted" style="margin:6px 0 0;font-size:14px;">
                {{ statusConfirm.newStatus === 'SUSPENDED'
                  ? t('Suspending a privileged account revokes their dashboard access immediately.')
                  : t('Activating restores full dashboard access for this account.') }}
              </p>
            </div>
          </div>
        </div>
        <div class="modal__foot">
          <button type="button" class="btn btn--ghost" @click="cancelStatusChange">
            {{ t('Cancel') }}
          </button>
          <button type="button" class="btn btn--primary" @click="confirmStatusChange">
            {{ statusConfirm.newStatus === 'SUSPENDED' ? t('Suspend') : t('Activate') }}
          </button>
        </div>
      </div>
    </div>

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
.field__error {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-danger, #ef4444);
  line-height: 1.3;
}
.control.has-error {
  border-color: var(--color-danger, #ef4444) !important;
  box-shadow: 0 0 0 1px var(--color-danger, #ef4444) inset;
}
.iconaction.is-busy {
  cursor: progress;
  opacity: 0.7;
}
.iconaction:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.iconspin {
  animation: users-spin 0.85s linear infinite;
}
@keyframes users-spin {
  to { transform: rotate(360deg); }
}
</style>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>
