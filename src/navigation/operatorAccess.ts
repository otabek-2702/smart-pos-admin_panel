import type { UserAbility } from '@/plugins/casl/AppAbility'

export const OPERATOR_HOME = '/operator/calls'

export function sessionRole(user: Record<string, any> | null | undefined): string {
  return String(user?.role ?? user?.user?.role ?? '').trim().toUpperCase()
}

/** USER and OPERATOR share the call-only workspace; this never changes the server role. */
export function isOperatorRole(role: unknown): boolean {
  return ['USER', 'OPERATOR'].includes(String(role ?? '').trim().toUpperCase())
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
