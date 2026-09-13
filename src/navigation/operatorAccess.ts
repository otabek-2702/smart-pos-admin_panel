import type { UserAbility } from '@/plugins/casl/AppAbility'

export const OPERATOR_HOME = '/operator/calls'

export function serverRole(user: Record<string, any> | null | undefined): string {
  return String(user?.role ?? user?.user?.role ?? '').trim().toUpperCase()
}

export function sessionEmail(user: Record<string, any> | null | undefined): string {
  return String(user?.email ?? user?.user?.email ?? '').trim().toLowerCase()
}

export function hasOperatorEmail(user: Record<string, any> | null | undefined): boolean {
  return sessionEmail(user).startsWith('operator')
}

/** Frontend workspace only; preserve the authenticated backend role unchanged. */
export function sessionRole(user: Record<string, any> | null | undefined): string {
  return hasOperatorEmail(user) ? 'OPERATOR' : serverRole(user)
}

/** Ordinary USER accounts no longer select the operator workspace by role alone. */
export function isOperatorRole(role: unknown): boolean {
  return String(role ?? '').trim().toUpperCase() === 'OPERATOR'
}

/** Client navigation isolation only; the backend must enforce the same boundary. */
export function operatorPathAllowed(path: string): boolean {
  return [OPERATOR_HOME, '/not-authorized'].includes(path.replace(/\/$/, ''))
}

export function loginAbilities(role: string): UserAbility[] {
  return (role.trim().toUpperCase() === 'WAREHOUSE' || isOperatorRole(role))
    ? [{ action: 'read', subject: 'Auth' }]
    : [{ action: 'manage', subject: 'all' }]
}

export function postLoginPath(role: string, requested: unknown): string {
  return isOperatorRole(role) ? OPERATOR_HOME : requested ? String(requested) : '/'
}

export function canHydrateBusinessSettings(role: string): boolean {
  return role.trim().toUpperCase() !== 'WAREHOUSE' && !isOperatorRole(role)
}
