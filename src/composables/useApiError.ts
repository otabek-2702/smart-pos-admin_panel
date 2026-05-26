import type { AxiosError } from 'axios'

/**
 * Map of known backend error messages → i18n keys.
 * Backend returns English literals; we translate to the user's locale via i18n.
 * If a message isn't in this map, we show it as-is.
 *
 * Long-term: ask the backend to return a stable `error_code` (or `code`) field
 * and switch this map to be keyed on the code instead of the English string.
 */
const KNOWN_ERRORS: Record<string, string> = {
  'Invalid credentials': 'err_invalid_credentials',
  'Account is suspended': 'err_account_suspended',
  'Account suspended': 'err_account_suspended',
  'Hell no': 'err_admin_required',
  'Admin access required': 'err_admin_required',
  'Access denied. Admin role required': 'err_admin_required',
  'You are not authorized for this branch': 'err_wrong_branch',
  'Authentication required': 'err_auth_required',
  'Invalid session': 'err_invalid_session',
  'Invalid or expired session': 'err_invalid_session',
  'Token expired': 'err_token_expired',
  'Invalid token': 'err_invalid_token',
  'Missing token': 'err_auth_required',
  'You don\'t have permission to perform this action': 'err_no_permission',
  'Current password is incorrect': 'err_wrong_password',
  'Validation failed': 'err_validation',
  'Invalid JSON': 'err_invalid_json',
  'Expected JSON object': 'err_invalid_json',
}

// Stable `code` field — backend's licensing endpoints ship this. Prefer
// matching by code (stable) over message (fragile) when available.
const KNOWN_CODES: Record<string, string> = {
  license_unregistered: 'err_license_unregistered',
  license_suspended: 'err_license_suspended',
  license_expired: 'err_license_expired',
  license_grace: 'err_license_grace',
  already_registered: 'err_license_already_registered',
}

const RATE_LIMIT_PATTERN = /Too many .* attempts.* (?:Try again in (\d+) (?:minutes?|seconds?))?/i

export function useApiError() {
  const { t, te } = useI18n({ useScope: 'global' })

  /**
   * Convert any axios error / message string into a localized message.
   */
  function translate(input: unknown): string {
    // Code-first lookup — stable across backend wording changes.
    const code = (typeof input === 'object' && input !== null)
      ? ((input as AxiosError<any>)?.response?.data?.code)
      : undefined

    if (code) {
      const codeKey = KNOWN_CODES[code]
      if (codeKey && te(codeKey))
        return t(codeKey)
    }

    const msg = typeof input === 'string'
      ? input
      : (input as AxiosError<any>)?.response?.data?.message
        ?? (input as Error)?.message
        ?? ''

    if (!msg)
      return t('Error')

    // Known literal lookup
    const key = KNOWN_ERRORS[msg]
    if (key && te(key))
      return t(key)

    // Rate-limit messages have a variable timeout — translate template
    const match = msg.match(RATE_LIMIT_PATTERN)
    if (match)
      return te('err_rate_limit') ? t('err_rate_limit') : msg

    return msg
  }

  return { translate }
}
