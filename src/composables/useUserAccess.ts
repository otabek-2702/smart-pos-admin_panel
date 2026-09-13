import { getStoredUserData } from '@/utils/storage'
import { hasOperatorEmail, isOperatorRole, serverRole, sessionEmail, sessionRole } from '@/navigation/operatorAccess'

type StoredUser = Record<string, any>

function normalizeUserId(user: StoredUser): string | number | null {
  return user?.id ?? user?.user_id ?? user?.user?.id ?? user?.user?.user_id ?? null
}

function normalizePermissions(user: StoredUser): Set<string> {
  const source = user?.permissions
    ?? user?.user?.permissions
    ?? user?.role_permissions
    ?? user?.user?.role_permissions
    ?? []

  if (Array.isArray(source)) {
    return new Set(source
      .map((permission: unknown) => {
        if (typeof permission === 'string')
          return permission
        if (!permission || typeof permission !== 'object')
          return ''

        const value = permission as Record<string, any>

        return String(value.code ?? value.codename ?? value.permission?.code ?? value.permission?.codename ?? '')
      })
      .filter(Boolean))
  }

  if (source && typeof source === 'object') {
    return new Set(Object.entries(source)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([key]) => key))
  }

  return new Set()
}

export function readUserAccess() {
  const user = getStoredUserData<StoredUser>()
  const role = sessionRole(user)
  const backendRole = serverRole(user)
  const email = sessionEmail(user)
  const operatorEmail = hasOperatorEmail(user)
  const userId = normalizeUserId(user)
  const permissions = normalizePermissions(user)

  function has(permission: string): boolean {
    // Email-selected operators have only calling-page access in the UI, even
    // when their real backend account is ADMIN. Never inherit its wildcard here.
    if (isOperatorRole(role))
      return permission === 'operator.call_queue.view' && (operatorEmail || permissions.has(permission))
    return role === 'ADMIN' || permissions.has('*') || permissions.has(permission)
  }

  function hasAny(required: string[]): boolean {
    return required.some(has)
  }

  function hasAll(required: string[]): boolean {
    return required.every(has)
  }

  return {
    user,
    userId,
    role,
    serverRole: backendRole,
    email,
    hasOperatorEmail: operatorEmail,

    // Transport capability, not admin navigation access. No role/token promotion.
    canReadOperatorOrders: backendRole === 'ADMIN',
    permissions,
    isWarehouse: role === 'WAREHOUSE',

    // Calling-workspace flag, not a replacement for the persisted server role.
    isOperator: isOperatorRole(role),
    isAdministrator: role === 'ADMIN',
    isManager: role === 'MANAGER',
    has,
    hasAny,
    hasAll,
  }
}

export function useUserAccess() {
  const access = shallowRef(readUserAccess())

  function refresh() {
    access.value = readUserAccess()
  }

  function onStorage(event: StorageEvent) {
    if (!event.key || ['userData', 'userAbilities'].includes(event.key))
      refresh()
  }

  onMounted(() => {
    window.addEventListener('storage', onStorage)
    window.addEventListener('user-access-changed', refresh)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('user-access-changed', refresh)
  })

  return {
    access: readonly(access),
    currentUserId: computed(() => access.value.userId),
    role: computed(() => access.value.role),
    serverRole: computed(() => access.value.serverRole),
    email: computed(() => access.value.email),
    permissions: computed(() => access.value.permissions),
    isWarehouse: computed(() => access.value.isWarehouse),
    isOperator: computed(() => access.value.isOperator),
    isAdministrator: computed(() => access.value.isAdministrator),
    isManager: computed(() => access.value.isManager),
    hasPermission: (permission: string) => access.value.has(permission),
    hasAnyPermission: (required: string[]) => access.value.hasAny(required),
    hasAllPermissions: (required: string[]) => access.value.hasAll(required),
    refresh,
  }
}
