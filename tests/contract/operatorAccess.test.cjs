/* eslint-disable @typescript-eslint/no-var-requires -- Node contract tests execute CommonJS modules. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const nodePath = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const { parse } = require('@vue/compiler-sfc')
const vue = require('vue')
const { Ability } = require('@casl/ability')
const ts = require('typescript')

// Real guard, login and access logic with synthetic server responses only.
// No production role overrides, requests, accounts or browser storage changes.
const root = nodePath.resolve(__dirname, '../..')
const json = value => JSON.parse(JSON.stringify(value))
const read = file => fs.readFileSync(nodePath.join(root, file), 'utf8')

const compile = source => ts.transpileModule(source.replace('import.meta.env.BASE_URL', '\'/\''), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
}).outputText

function execute(source, dependencies = {}, globals = {}) {
  const context = vm.createContext({
    ...vue,
    exports: {},
    Event,
    ...globals,
    require: request => {
      assert.ok(Object.hasOwn(dependencies, request), `Unexpected dependency: ${request}`)
      return dependencies[request]
    },
  })

  vm.runInContext(compile(source), context)
  return context.exports
}

const helper = execute(read('src/navigation/operatorAccess.ts'))

function storage(user) {
  const values = new Map([
    ['userData', JSON.stringify(user)],
    ['accessToken', '"synthetic-token"'],
    ['businessDayStart', '03:00'],
    ['userAbilities', JSON.stringify([{ action: 'manage', subject: 'all' }])],
  ])

  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
    getStoredToken: () => JSON.parse(values.get('accessToken') || 'null'),
    getStoredUserData: () => JSON.parse(values.get('userData') || '{}'),
    getStoredAbilities: () => JSON.parse(values.get('userAbilities') || 'null'),
  }
}

const loadAccess = local => execute(read('src/composables/useUserAccess.ts'), {
  '@/utils/storage': local,
  '@/navigation/operatorAccess': helper,
})

function loadRouter(user, loggedIn = true, loginLink = false) {
  const local = storage(user)
  let guard
  let routeOptions
  let settingsCalls = 0

  const dependencies = {
    'virtual:generated-layouts': { setupLayouts: routes => routes },
    'vue-router': {
      createWebHistory: () => ({}),
      createRouter: options => {
        routeOptions = options
        return { beforeEach: callback => { guard = callback }, afterEach: () => undefined }
      },
    },
    './utils': { isUserLoggedIn: () => loggedIn },
    '~pages': { default: [] },
    '@layouts/plugins/casl': { canNavigate: () => true },
    '@/composables/useAlphaMotion': { armMotion: () => undefined, replayMotion: () => undefined },
    '@/plugins/axios': { default: { get: async () => ({ data: { data: {} } }) }, getCurrentApiHost: () => 'https://api.example.invalid' },
    '@/bootstrap/loginLink': { hasLoginLink: () => loginLink },
    '@/composables/useBusinessDay': { hydrateBusinessSettings: async () => { settingsCalls += 1 }, setBusinessDayStart: () => undefined },
    '@/utils/storage': local,
    '@/composables/useUserAccess': loadAccess(local),
    '@/navigation/access': { warehousePathAllowed: value => value === '/warehouse' },
    '@/navigation/operatorAccess': helper,
  }

  execute(read('src/router/index.ts'), dependencies, { localStorage: local, window: { dispatchEvent: () => undefined } })
  return {
    guard: (path, meta = {}) => guard({ path, fullPath: path, meta, name: 'fixture' }),
    home: () => routeOptions.routes[0].redirect({ query: { to: '/treasury' } }),
    settingsCalls,
  }
}

function loadLogin(options = {}) {
  const user = options.user ?? { id: 1, role: 'ADMIN', email: 'operator@example.invalid' }
  const local = storage(options.cachedUser ?? {})
  const posts = []
  const postCalls = []
  const gets = []
  const getCalls = []
  const destinations = []
  const events = []
  const abilities = []
  const mounted = []
  let host = 'https://api.example.invalid'
  let pendingLink = options.link ?? null
  let linkActive = pendingLink !== null
  let finishCalls = 0
  let settingsCalls = 0
  const { descriptor } = parse(read('src/pages/login.vue'))

  const dependencies = {
    '@/@core/composable/useGenerateImageVariant': { useGenerateImageVariant: () => '' },
    '@images/illustrations/boy-with-rocket-dark.png': { default: '' },
    '@images/illustrations/boy-with-rocket-light.png': { default: '' },
    '@layouts/components/VNodeRenderer': {},
    '@/layouts/components/NavBarApiHost.vue': {},
    '@themeConfig': {},
    '@/plugins/axios': {
      default: {
        post: async (url, body, config) => {
          posts.push({ url, body: json(body ?? {}) })
          postCalls.push({ url, body: json(body ?? {}), config: config ? json(config) : undefined })
          return options.post ? options.post(url, body, config) : { data: { success: true, data: { token: 'synthetic-new-token', user } } }
        },
        get: async (url, config) => {
          gets.push(url)
          getCalls.push({ url, config: config ? json(config) : undefined })
          return options.get ? options.get(url, config) : { data: { success: true, data: {} } }
        },
      },
      getCurrentApiHost: () => host,
    },
    '@/plugins/casl/ability': {
      default: { update: value => abilities.push(json(value)) },
      initialAbility: [{ action: 'read', subject: 'Auth' }],
    },
    '@/bootstrap/loginLink': {
      takeLoginLink: () => {
        const value = pendingLink

        pendingLink = null; return value
      },
      finishLoginLink: () => { pendingLink = null; linkActive = false; finishCalls += 1 },
    },
    '@/utils/storage': local,
    '@/composables/useApiError': { useApiError: () => ({ translate: () => '' }) },
    '@/composables/useBusinessDay': { hydrateBusinessSettings: async () => { settingsCalls += 1 }, setBusinessDayStart: () => undefined },
    '@/navigation/operatorAccess': helper,
  }

  const page = execute(`${descriptor.scriptSetup.content}\nexport { login, initializeLoginLink, logoutForAccountSwitch, accountSwitchRequired, form, errorMsg, isLoading, isLinkLogin }`, dependencies, {
    localStorage: local,
    window: { dispatchEvent: event => events.push(event.type) },
    useI18n: () => ({ t: key => key, locale: vue.ref('en') }),
    useRouter: () => ({ replace: value => destinations.push(value) }),
    useRoute: () => ({ query: { to: options.requested ?? '/treasury' } }),
    onMounted: callback => mounted.push(callback),
  })

  return {
    page,
    local,
    posts,
    postCalls,
    gets,
    getCalls,
    destinations,
    events,
    abilities,
    mounted,
    get settingsCalls() { return settingsCalls },
    get finishCalls() { return finishCalls },
    get linkActive() { return linkActive },
    setHost: value => { host = value },
  }
}

async function loginAs(role, requested = '/treasury') {
  const user = typeof role === 'object' ? role : { id: 1, role, permissions: ['operator.call_queue.view'] }
  const result = loadLogin({ user, requested })
  const { page } = result

  page.form.value = { email: 'operator@example.invalid', password: 'synthetic-password' }
  await page.login()
  assert.equal(page.errorMsg.value, '')
  return result
}

test('operator email prefixes and explicit OPERATOR roles normalize without changing server identity', () => {
  for (const role of [' operator ', 'OPERATOR'])
    assert.equal(helper.isOperatorRole(role), true)
  for (const role of ['USER', 'user', 'ADMIN', 'WAREHOUSE', 'MANAGER', 'SUPERUSER', '', null])
    assert.equal(helper.isOperatorRole(role), false)
  for (const user of [
    { role: 'ADMIN', email: 'operator@example.invalid' },
    { role: 'USER', email: ' OPERATOR.one@example.invalid ' },
    { user: { role: 'admin', email: 'OperatorTwo@example.invalid' } },
    { role: 'OPERATOR', email: 'caller@example.invalid' },
  ])
    assert.equal(helper.sessionRole(user), 'OPERATOR')
  for (const user of [
    { role: 'USER', email: 'caller@example.invalid' },
    { role: 'ADMIN', email: 'myoperator@example.invalid' },
    { role: 'ADMIN', email: 'ordinary@operator.invalid' },
    { role: 'ADMIN' },
    {},
  ])
    assert.notEqual(helper.sessionRole(user), 'OPERATOR')
  assert.equal(helper.sessionEmail({ user: { email: ' OperatorTwo@example.invalid ' } }), 'operatortwo@example.invalid')
  assert.equal(helper.sessionRole({ user: { role: 'OPERATOR' } }), 'OPERATOR')
  assert.equal(helper.sessionRole({ user: { role: ' user ' } }), 'USER')
  assert.equal(helper.operatorPathAllowed('/operator/calls/'), true)
  assert.equal(helper.operatorPathAllowed('/not-authorized'), true)
  for (const path of ['/operator', '/operator/calls/finance', '/licensing/setup', '/login', '/treasury'])
    assert.equal(helper.operatorPathAllowed(path), false)
})

test('an operator requires its explicit queue permission; stale wildcard never grants financial access', () => {
  const access = loadAccess(storage({ id: 1, role: 'OPERATOR', permissions: ['*', 'treasury.view', 'operator.call_queue.view'] })).readUserAccess()

  assert.equal(access.isOperator, true)
  assert.equal(access.has('operator.call_queue.view'), true)
  assert.equal(access.has('treasury.view'), false)
  assert.equal(access.has('customer.retention.view'), false)
  assert.equal(loadAccess(storage({ id: 1, role: 'OPERATOR', permissions: ['*'] })).readUserAccess().has('operator.call_queue.view'), false)
})

test('operator-prefixed accounts get only queue UI permission even when the backend role is ADMIN', () => {
  for (const user of [
    { id: 1, role: 'ADMIN', email: 'operator@example.invalid' },
    { id: 1, role: 'admin', email: ' Operator.one@example.invalid ', permissions: ['*', 'treasury.view', 'customer.retention.view'] },
    { user: { id: 1, role: ' admin ', email: 'operatorTwo@example.invalid', permissions: { '*': true, 'orders.view': true } } },
  ]) {
    const local = storage(user)
    const access = loadAccess(local).readUserAccess()

    assert.equal(access.role, 'OPERATOR')
    assert.equal(access.serverRole, 'ADMIN')
    assert.equal(access.canReadOperatorOrders, true)
    assert.equal(access.userId, 1)
    assert.equal(access.isOperator, true)
    assert.equal(access.isAdministrator, false)
    assert.equal(access.has('operator.call_queue.view'), true)
    for (const permission of ['*', 'treasury.view', 'orders.view', 'customer.retention.view', 'operator.call.log'])
      assert.equal(access.has(permission), false)
    assert.equal(access.hasAny(['treasury.view', 'orders.view']), false)
    assert.equal(access.hasAll(['operator.call_queue.view', 'orders.view']), false)
    assert.deepEqual(local.getStoredUserData(), user)
  }
})

test('calling-workspace guards bypass stale manage/all while containing every administrative deep link', () => {
  for (const user of [{ id: 1, role: 'OPERATOR', permissions: [] }, { id: 1, role: 'ADMIN', email: 'operator@example.invalid' }, { user: { id: 1, role: 'admin', email: ' Operator2@example.invalid ' } }]) {
    const router = loadRouter(user)

    for (const path of ['/', '/login', '/treasury', '/stock/items', '/dashboard', '/orders', '/licensing/setup', '/unknown', '/operator/calls/extra'])
      assert.deepEqual(json(router.guard(path)), { path: '/operator/calls' })
    assert.equal(router.guard('/operator/calls'), true)
    assert.equal(router.guard('/not-authorized'), true)
    assert.deepEqual(json(router.home()), { path: '/operator/calls' })
    assert.equal(router.settingsCalls, 0)
  }
})

test('anonymous and unrelated roles cannot access the calling page; ADMIN and WAREHOUSE behavior remains', () => {
  assert.deepEqual(json(loadRouter({}, false).guard('/operator/calls')), { name: 'login' })
  assert.deepEqual(json(loadRouter({ id: 1, role: 'MANAGER', permissions: ['operator.call_queue.view'] }).guard('/operator/calls')), { name: 'not-authorized' })
  assert.deepEqual(json(loadRouter({ id: 1, role: 'USER', email: 'ordinary@example.invalid', permissions: ['operator.call_queue.view'] }).guard('/operator/calls')), { name: 'not-authorized' })
  assert.equal(loadAccess(storage({ id: 1, role: 'USER', email: 'ordinary@example.invalid' })).readUserAccess().isOperator, false)
  assert.equal(loadRouter({ id: 1, role: 'ADMIN' }).guard('/operator/calls'), undefined)
  assert.equal(loadRouter({ id: 1, role: 'ADMIN' }).guard('/orders'), undefined)
  assert.equal(loadRouter({ id: 1, role: 'WAREHOUSE' }).guard('/warehouse'), true)
  assert.equal(loadRouter({ id: 1, role: 'WAREHOUSE' }).settingsCalls, 0)
  assert.equal(loadRouter({ id: 1, role: 'ADMIN' }).settingsCalls, 1)
})

test('operator-prefixed and OPERATOR login ignore administrative return URLs without altering server roles', async () => {
  for (const user of [{ id: 1, role: 'OPERATOR' }, { id: 1, role: 'ADMIN', email: 'operator@example.invalid' }, { user: { id: 1, role: 'admin', email: 'operator2@example.invalid' } }]) {
    for (const destination of ['/treasury', '//untrusted.invalid', 'https://untrusted.invalid', ['/orders', '/settings']]) {
      const result = await loginAs(user, destination)

      assert.deepEqual(result.destinations, ['/operator/calls'])
      assert.deepEqual(result.posts, [{ url: '/auth-login', body: { email: 'operator@example.invalid', password: 'synthetic-password' } }])
      assert.deepEqual(result.gets, ['/auth-me'])
      assert.deepEqual(result.local.getStoredUserData(), user)
      assert.equal(result.settingsCalls, 0)
      assert.deepEqual(result.abilities.at(-1), [{ action: 'read', subject: 'Auth' }])
      assert.ok(result.events.includes('user-access-changed'))
    }
  }
})

test('ordinary USER, ADMIN and WAREHOUSE login contracts are unchanged', async () => {
  for (const role of ['USER', 'ADMIN', 'WAREHOUSE']) {
    const result = await loginAs(role, '/orders')

    assert.deepEqual(result.destinations, ['/orders'])
    assert.equal(result.local.getStoredUserData().role, role)
    assert.equal(result.settingsCalls, role === 'WAREHOUSE' ? 0 : 1)
    assert.deepEqual(result.abilities.at(-1), role === 'WAREHOUSE' ? [{ action: 'read', subject: 'Auth' }] : [{ action: 'manage', subject: 'all' }])
  }
})

test('restarting operator-email and OPERATOR sessions discards persisted manage/all while preserving ordinary accounts', () => {
  for (const user of [{ id: 1, role: 'OPERATOR' }, { id: 1, role: 'ADMIN' }, { id: 1, role: 'USER' }, { id: 1, role: 'ADMIN', email: 'operator@example.invalid' }, { user: { id: 1, role: 'admin', email: 'Operator2@example.invalid' } }]) {
    const ability = execute(read('src/plugins/casl/ability.ts'), {
      '@casl/ability': { Ability },
      '@/utils/storage': storage(user),
      '@/navigation/operatorAccess': helper,
    }).default

    assert.equal(ability.can('manage', 'all'), !helper.isOperatorRole(helper.sessionRole(user)))
    assert.equal(ability.can('read', 'Auth'), true)
  }
})

test('global administrative command surfaces do not mount for operators', () => {
  const source = read('src/App.vue')

  for (const component of ['CommandPalette', 'ShortcutHelp', 'ScrollToTop'])
    assert.match(source, new RegExp(`<${component} v-if="!isOperator && route.path !== '/login'"`))
  assert.match(source, /watch\(\(\) => route.fullPath, refreshAccess/)
})

const fixtureLink = () => ({ email: 'link-user@example.invalid', password: 'synthetic-link-secret', invalid: false })
const failure = (status, code) => Object.assign(new Error('synthetic failure'), { response: { status, data: { code } } })

const deferred = () => {
  let resolvePromise
  let rejectPromise
  const promise = new Promise((resolve, reject) => { resolvePromise = resolve; rejectPromise = reject })

  return { promise, resolve: resolvePromise, reject: rejectPromise }
}

const nextTurn = () => new Promise(resolve => setImmediate(resolve))

test('credential-link initialization wins over cached operator routing and suppresses startup settings requests', () => {
  for (const cachedUser of [{ id: 1, role: 'ADMIN', email: 'operator@example.invalid' }, { id: 1, role: 'ADMIN' }]) {
    const router = loadRouter(cachedUser, true, true)

    assert.equal(router.guard('/login', { redirectIfLoggedIn: true }), true)
    assert.equal(router.guard('/login/', { redirectIfLoggedIn: true }), true)
    assert.deepEqual(json(router.guard('/operator/calls')), { name: 'login' })
    assert.deepEqual(json(router.guard('/treasury')), { name: 'login' })
    assert.deepEqual(json(router.home()), { name: 'login' })
    assert.equal(router.settingsCalls, 0)
  }
})

test('mounted credential link freshly authenticates a cached operator exactly once and clears the password', async () => {
  const link = fixtureLink()
  const result = loadLogin({ link, cachedUser: { id: 90, role: 'ADMIN', email: 'operator@example.invalid' }, user: { id: 91, role: 'ADMIN', email: 'operator@example.invalid' } })

  assert.equal(result.mounted.length, 1)
  assert.equal(result.posts.length, 0)
  await result.mounted[0]()
  await result.page.initializeLoginLink()
  assert.deepEqual(result.posts, [{ url: '/auth-login', body: { email: 'link-user@example.invalid', password: 'synthetic-link-secret' } }])
  assert.deepEqual(result.gets, ['/auth-me'])
  assert.deepEqual(result.destinations, ['/operator/calls'])
  assert.equal(result.local.getStoredToken(), 'synthetic-new-token')
  assert.equal(result.local.getStoredUserData().id, 91)
  assert.equal(result.page.form.value.password, '')
  assert.equal(link.password, '')
  assert.equal(result.page.isLoading.value, false)
  assert.equal(result.page.isLinkLogin.value, false)
  assert.equal(result.linkActive, false)
  assert.equal(result.settingsCalls, 0)
  assert.deepEqual(result.abilities[0], [{ action: 'read', subject: 'Auth' }])
  for (const key of ['accessToken', 'userData', 'userAbilities', 'businessDayStart'])
    assert.ok(!String(result.local.getItem(key)).includes('synthetic-link-secret'))
})

test('a credential link clears cached local identity before sending its fresh login request', async () => {
  const result = loadLogin({
    link: fixtureLink(),
    cachedUser: { id: 90, role: 'USER' },
    post: async () => {
      assert.equal(result.local.getItem('accessToken'), null)
      assert.equal(result.local.getItem('userData'), null)
      assert.equal(result.local.getItem('userAbilities'), null)
      return { data: { success: true, data: { token: 'synthetic-next-token', user: { id: 91, role: 'ADMIN', email: 'operator@example.invalid' } } } }
    },
  })

  await result.page.initializeLoginLink()
  assert.equal(result.page.errorMsg.value, '')
  assert.deepEqual(result.destinations, ['/operator/calls'])
})

test('invalid and email-only links never submit credentials automatically', async () => {
  for (const link of [
    { email: '', password: '', invalid: true },
    { email: 'prefill@example.invalid', password: '', invalid: false },
  ]) {
    const result = loadLogin({ link })

    await result.page.initializeLoginLink()
    assert.deepEqual(result.posts, [])
    assert.deepEqual(result.gets, [])
    assert.deepEqual(result.destinations, [])
    assert.equal(result.page.form.value.email, link.email)
    assert.equal(result.page.form.value.password, '')
    assert.equal(result.page.errorMsg.value, link.invalid ? 'login_link_invalid' : '')
  }
})

test('invalid credentials produce one failure with no automatic retry, retained password, or protected navigation', async () => {
  const result = loadLogin({ link: fixtureLink(), post: async () => { throw failure(401, 'INVALID_CREDENTIALS') } })

  await result.page.initializeLoginLink()
  await result.page.initializeLoginLink()
  await nextTurn()
  assert.equal(result.posts.length, 1)
  assert.deepEqual(result.gets, [])
  assert.deepEqual(result.destinations, [])
  assert.equal(result.local.getStoredToken(), null)
  assert.equal(result.local.getItem('userData'), null)
  assert.equal(result.page.form.value.password, '')
  assert.equal(result.page.isLoading.value, false)
  assert.ok(result.page.errorMsg.value)
})

test('expired or forbidden auth-me after a fresh login leaves no usable local session or navigation', async () => {
  for (const status of [401, 403]) {
    const result = loadLogin({ link: fixtureLink(), get: async () => { throw failure(status, 'AUTHENTICATION_INVALID') } })

    await result.page.initializeLoginLink()
    assert.equal(result.posts.length, 1)
    assert.deepEqual(result.gets, ['/auth-me'])
    assert.deepEqual(result.destinations, [])
    for (const key of ['accessToken', 'userData', 'userAbilities'])
      assert.equal(result.local.getItem(key), null)
    assert.equal(result.page.errorMsg.value, 'login_session_rejected')
    assert.equal(result.page.form.value.password, '')
    assert.equal(result.settingsCalls, 0)
    assert.deepEqual(result.abilities.at(-1), [{ action: 'read', subject: 'Auth' }])
  }
})

test('an in-flight login prevents duplicate submission and clears link password after settlement', async () => {
  const request = deferred()
  const result = loadLogin({ link: fixtureLink(), post: () => request.promise })
  const initialization = result.page.initializeLoginLink()

  assert.equal(result.page.isLoading.value, true)
  await result.page.login()
  assert.equal(result.posts.length, 1)
  request.resolve({ data: { success: true, data: { token: 'synthetic-new-token', user: { id: 1, role: 'ADMIN', email: 'operator@example.invalid' } } } })
  await initialization
  assert.equal(result.page.form.value.password, '')
  assert.deepEqual(result.destinations, ['/operator/calls'])
})

test('a delayed login response cannot overwrite a changed token or API host', async () => {
  for (const change of ['token', 'host']) {
    const request = deferred()
    const result = loadLogin({ link: fixtureLink(), post: () => request.promise })
    const initialization = result.page.initializeLoginLink()

    if (change === 'token') {
      result.local.setItem('accessToken', JSON.stringify('synthetic-other-token'))
      result.local.setItem('userData', JSON.stringify({ id: 73, role: 'USER' }))
    }
    else {
      result.setHost('https://replacement-api.example.invalid')
    }
    request.resolve({ data: { success: true, data: { token: 'synthetic-stale-token', user: { id: 99, role: 'ADMIN' } } } })
    await initialization
    assert.deepEqual(result.gets, [])
    assert.deepEqual(result.destinations, [])
    assert.equal(result.page.errorMsg.value, 'login_session_changed')
    assert.equal(result.page.form.value.password, '')
    assert.equal(result.local.getStoredToken(), change === 'token' ? 'synthetic-other-token' : null)
    assert.notEqual(result.local.getStoredUserData().id, 99)
  }
})

test('a delayed auth-me response cannot hydrate or navigate after the token or API host changes', async () => {
  for (const change of ['token', 'host']) {
    const request = deferred()
    const result = loadLogin({ link: fixtureLink(), get: () => request.promise })
    const initialization = result.page.initializeLoginLink()

    await nextTurn()
    assert.deepEqual(result.gets, ['/auth-me'])
    if (change === 'token') {
      result.local.setItem('accessToken', JSON.stringify('synthetic-other-token'))
      result.local.setItem('userData', JSON.stringify({ id: 73, role: 'USER' }))
    }
    else {
      result.setHost('https://replacement-api.example.invalid')
    }
    request.resolve({ data: { success: true, data: { id: 99, role: 'ADMIN', business_day_start: '09:00' } } })
    await initialization
    assert.deepEqual(result.destinations, [])
    assert.equal(result.page.errorMsg.value, 'login_session_changed')
    assert.notEqual(result.local.getStoredUserData().id, 99)
    assert.equal(result.settingsCalls, 0)
    assert.equal(result.page.form.value.password, '')
  }
})

test('a delayed auth-me rejection cannot clear a newer session', async () => {
  for (const status of [401, 403]) {
    const request = deferred()
    const result = loadLogin({ link: fixtureLink(), get: () => request.promise })
    const initialization = result.page.initializeLoginLink()

    await nextTurn()
    result.local.setItem('accessToken', JSON.stringify('synthetic-other-token'))
    result.local.setItem('userData', JSON.stringify({ id: 73, role: 'USER' }))
    request.reject(failure(status, 'AUTHENTICATION_INVALID'))
    await initialization
    assert.equal(result.local.getStoredToken(), 'synthetic-other-token')
    assert.equal(result.local.getStoredUserData().id, 73)
    assert.deepEqual(result.destinations, [])
    assert.equal(result.page.form.value.password, '')
  }
})

test('malformed login success bodies never persist an authentication token', async () => {
  for (const body of [
    {},
    { success: false, data: { token: 'synthetic-rejected-token', user: { role: 'USER' } } },
    { success: true, data: { token: {}, user: { role: 'USER' } } },
    { success: true, data: { token: ' ', user: { role: 'USER' } } },
    { success: true, data: { token: 'synthetic-rejected-token', user: [] } },
    { success: true, data: { token: 'synthetic-rejected-token', user: {} } },
  ]) {
    const result = loadLogin({ link: fixtureLink(), post: async () => ({ data: body }) })

    await result.page.initializeLoginLink()
    assert.equal(result.local.getStoredToken(), null)
    assert.equal(result.local.getItem('userData'), null)
    assert.deepEqual(result.gets, [])
    assert.deepEqual(result.destinations, [])
    assert.equal(result.page.errorMsg.value, 'login_invalid_response')
    assert.equal(result.page.form.value.password, '')
  }
})

test('invalid auth-me payloads and mismatched identities reject the newly issued session', async () => {
  for (const body of [
    { success: false, data: {} },
    { success: true, data: [] },
    { success: true, data: 'synthetic-invalid-user' },
    { success: true, data: 4 },
    { success: true, data: null },
    { success: true, data: { id: 99, role: 'ADMIN' } },
    { success: true, data: { user: { id: 99, role: 'ADMIN' } } },
    { success: true, data: { user: [] } },
  ]) {
    const result = loadLogin({ link: fixtureLink(), get: async () => ({ data: body }) })

    await result.page.initializeLoginLink()
    assert.deepEqual(result.destinations, [])
    assert.equal(result.local.getStoredToken(), null)
    assert.equal(result.local.getItem('userData'), null)
    assert.equal(result.page.errorMsg.value, 'login_invalid_response')
    assert.equal(result.page.form.value.password, '')
    assert.equal(result.settingsCalls, 0)
  }
})

test('a credential-link account-switch response requires an explicit logout and never retries the password', async () => {
  const result = loadLogin({
    link: fixtureLink(),
    post: async url => {
      if (url === '/auth-login')
        throw failure(409, 'account_switch_requires_logout')
      assert.equal(url, '/auth-logout')
      return { data: { success: true } }
    },
  })

  await result.page.initializeLoginLink()
  assert.equal(result.page.accountSwitchRequired.value, true)
  assert.equal(result.page.errorMsg.value, 'login_link_logout_required')
  assert.equal(result.page.form.value.password, '')
  assert.deepEqual(result.posts.map(call => call.url), ['/auth-login'])
  assert.deepEqual(result.destinations, [])
  await result.page.logoutForAccountSwitch()
  assert.deepEqual(result.posts.map(call => call.url), ['/auth-login', '/auth-logout'])
  assert.equal(result.postCalls[1].config.skipAuthRedirect, true)
  assert.equal(result.postCalls[1].config.headers.Authorization, 'Bearer synthetic-token')
  assert.equal(result.page.accountSwitchRequired.value, false)
  assert.equal(result.page.form.value.password, '')
  assert.equal(result.local.getStoredToken(), null)
  assert.deepEqual(result.destinations, [])
  await result.page.initializeLoginLink()
  await result.page.logoutForAccountSwitch()
  assert.equal(result.posts.length, 2)
})

test('manual login account-switch logout uses its current cached session and clears it only on completion', async () => {
  const result = loadLogin({
    cachedUser: { id: 90, role: 'USER' },
    post: async url => {
      if (url === '/auth-login')
        throw failure(409, 'account_switch_requires_logout')
      return { data: { success: true } }
    },
  })

  result.page.form.value = { email: 'manual-user@example.invalid', password: 'synthetic-manual-secret' }
  await result.page.login()
  assert.equal(result.page.accountSwitchRequired.value, true)
  assert.equal(result.local.getStoredToken(), 'synthetic-token')
  await result.page.logoutForAccountSwitch()
  assert.deepEqual(result.posts.map(call => call.url), ['/auth-login', '/auth-logout'])
  assert.equal(result.postCalls[1].config.headers.Authorization, 'Bearer synthetic-token')
  assert.equal(result.local.getStoredToken(), null)
  assert.equal(result.local.getItem('userData'), null)
  assert.deepEqual(result.destinations, [])
})

test('account-switch logout does not start against a replacement token or host', async () => {
  for (const change of ['token', 'host']) {
    const result = loadLogin({ link: fixtureLink(), post: async () => { throw failure(409, 'account_switch_requires_logout') } })

    await result.page.initializeLoginLink()
    if (change === 'token') {
      result.local.setItem('accessToken', JSON.stringify('synthetic-replacement-token'))
      result.local.setItem('userData', JSON.stringify({ id: 73, role: 'USER' }))
    }
    else {
      result.setHost('https://replacement-api.example.invalid')
    }
    await result.page.logoutForAccountSwitch()
    assert.deepEqual(result.posts.map(call => call.url), ['/auth-login'])
    assert.equal(result.page.errorMsg.value, 'login_session_changed')
    assert.equal(result.local.getStoredToken(), change === 'token' ? 'synthetic-replacement-token' : null)
    assert.deepEqual(result.destinations, [])
  }
})

test('an in-flight explicit logout does not clear a replacement session or automatically retry credentials', async () => {
  for (const change of ['token', 'host']) {
    const request = deferred()

    const result = loadLogin({
      link: fixtureLink(),
      post: async url => {
        if (url === '/auth-login')
          throw failure(409, 'account_switch_requires_logout')
        return request.promise
      },
    })

    await result.page.initializeLoginLink()

    const logout = result.page.logoutForAccountSwitch()

    assert.equal(result.page.isLoading.value, true)
    await result.page.logoutForAccountSwitch()
    if (change === 'token') {
      result.local.setItem('accessToken', JSON.stringify('synthetic-replacement-token'))
      result.local.setItem('userData', JSON.stringify({ id: 73, role: 'USER' }))
    }
    else {
      result.setHost('https://replacement-api.example.invalid')
    }
    request.resolve({ data: { success: true } })
    await logout
    assert.deepEqual(result.posts.map(call => call.url), ['/auth-login', '/auth-logout'])
    assert.equal(result.local.getStoredToken(), change === 'token' ? 'synthetic-replacement-token' : null)
    assert.equal(result.page.errorMsg.value, 'login_session_changed')
    assert.equal(result.page.form.value.password, '')
    assert.deepEqual(result.destinations, [])
  }
})

test('login and auth-me bind their dispatch to the captured token and host', async () => {
  const result = loadLogin({ link: fixtureLink() })

  await result.page.initializeLoginLink()
  assert.deepEqual(result.postCalls[0].config.expectedAuthContext, { token: null, host: 'https://api.example.invalid' })
  assert.equal(result.getCalls[0].url, '/auth-me')
  assert.deepEqual(result.getCalls[0].config.expectedAuthContext, { token: 'synthetic-new-token', host: 'https://api.example.invalid' })
  assert.equal(result.getCalls[0].config.skipAuthRedirect, true)
  assert.deepEqual(result.destinations, ['/operator/calls'])
})

test('account-switch logout binds dispatch to the link or manual session context', async () => {
  for (const linked of [false, true]) {
    const result = loadLogin({
      ...(linked ? { link: fixtureLink() } : {}),
      post: async url => {
        if (url === '/auth-login')
          throw failure(409, 'account_switch_requires_logout')
        return { data: { success: true } }
      },
    })

    if (linked)
      await result.page.initializeLoginLink()
    else
      await result.page.login()
    await result.page.logoutForAccountSwitch()
    assert.deepEqual(result.postCalls[1].config.expectedAuthContext, {
      token: linked ? null : 'synthetic-token',
      host: 'https://api.example.invalid',
    })
  }
})

test('a stale login account-switch response does not offer logout against a replacement session or host', async () => {
  for (const change of ['token', 'host']) {
    const request = deferred()
    const result = loadLogin({ link: fixtureLink(), post: () => request.promise })
    const initialization = result.page.initializeLoginLink()

    if (change === 'token')
      result.local.setItem('accessToken', JSON.stringify('synthetic-replacement-token'))
    else
      result.setHost('https://replacement-api.example.invalid')
    request.reject(failure(409, 'account_switch_requires_logout'))
    await initialization
    assert.equal(result.page.accountSwitchRequired.value, false)
    assert.equal(result.page.errorMsg.value, 'login_session_changed')
    assert.deepEqual(result.destinations, [])
    assert.equal(result.page.form.value.password, '')
    await result.page.logoutForAccountSwitch()
    assert.equal(result.posts.length, 1)
  }
})

test('dispatch-time auth-context rejections are fatal to login rather than optional metadata failures', async () => {
  for (const stage of ['login', 'auth-me']) {
    const rejectContext = async () => { throw Object.assign(new Error('synthetic context mismatch'), { code: 'ERR_AUTH_CONTEXT' }) }
    const result = loadLogin({ link: fixtureLink(), ...(stage === 'login' ? { post: rejectContext } : { get: rejectContext }) })

    await result.page.initializeLoginLink()
    assert.deepEqual(result.destinations, [])
    assert.equal(result.page.errorMsg.value, 'login_session_changed')
    assert.equal(result.page.form.value.password, '')
    assert.equal(result.settingsCalls, 0)
  }
})
