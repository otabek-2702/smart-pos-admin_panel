export interface LoginLink {
  email: string
  password: string
  invalid: boolean
}

function invalidCredentials(email: string, password: string): boolean {
  return !/^[^\s@?]+@[^\s@?]+$/.test(email) || email.length > 254
    || password.length > 1024 || ['\0', '\r', '\n'].some(character => password.includes(character))
}

/** No app imports: this must run before router hydration and telemetry. */
export function parseLoginLink(href: string): LoginLink | null {
  const url = new URL(href, 'https://login.invalid')
  if (url.pathname.replace(/\/$/, '').toLowerCase() !== '/login')
    return null
  const query = url.searchParams
  const fragment = new URLSearchParams(url.hash.replace(/^#\??/, ''))
  const hasFields = (params: URLSearchParams) => params.has('email') || params.has('password')
  if (!hasFields(query) && !hasFields(fragment))
    return null
  if (hasFields(query) && hasFields(fragment))
    return { email: '', password: '', invalid: true }
  const params = hasFields(fragment) ? fragment : query
  if (params.getAll('email').length > 1 || params.getAll('password').length > 1)
    return { email: '', password: '', invalid: true }
  let email = params.get('email') ?? ''
  let password = params.get('password') ?? ''

  // Compatibility with the shared legacy ?email=...?... link. Normal links use &.
  if (!params.has('password') && email.includes('?password=')) {
    const separator = email.indexOf('?password=')

    password = email.slice(separator + 10)
    email = email.slice(0, separator)
  }
  email = email.trim()

  const invalid = invalidCredentials(email, password)

  return { email: invalid ? '' : email, password: invalid ? '' : password, invalid }
}

let pending: LoginLink | null = null
let active = false

if (typeof window !== 'undefined') {
  pending = parseLoginLink(window.location.href)
  active = pending !== null
  if (active) {
    // Strip query AND fragment before the router, font loader or Sentry starts.
    // This cannot undo a query string already sent to the web host.
    window.history.replaceState(window.history.state, '', '/login')
  }

  let reloadStarted = false

  const onCredentialNavigation = (event: Event) => {
    if (!parseLoginLink(window.location.href))
      return

    // A native same-document fragment link does not remount the login page.
    // Reload before router/telemetry listeners see it; the fresh bootstrap must
    // consume and scrub the URL, so do not remove its credentials here first.
    event.stopImmediatePropagation()
    if (!reloadStarted) {
      reloadStarted = true
      window.location.reload()
    }
  }

  window.addEventListener('popstate', onCredentialNavigation, true)
  window.addEventListener('hashchange', onCredentialNavigation, true)
}

export function hasLoginLink(): boolean { return active }

/** Consume once; passwords never enter persistent browser storage. */
export function takeLoginLink(): LoginLink | null {
  const link = pending

  pending = null
  return link
}

export function finishLoginLink() {
  pending = null
  active = false
}
