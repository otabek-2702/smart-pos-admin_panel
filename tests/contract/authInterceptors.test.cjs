/* eslint-disable @typescript-eslint/no-var-requires -- Node contract tests execute CommonJS modules. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const { AxiosHeaders } = require('axios')
const ts = require('typescript')

// Actual interceptor callbacks; all sessions, hosts and transport are synthetic.
const root = path.resolve(__dirname, '../..')

const source = fs.readFileSync(path.join(root, 'src/plugins/axios.ts'), 'utf8')
  .replaceAll('import.meta.env', 'testEnvironment')

const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
}).outputText

function setup() {
  const stored = new Map([
    ['accessToken', JSON.stringify('synthetic-old-token')],
    ['userData', JSON.stringify({ id: 1, role: 'ADMIN' })],
    ['userAbilities', JSON.stringify([{ action: 'manage', subject: 'all' }])],
    ['apiHost', 'https://api-fixture.invalid'],
    ['unrelated', 'preserved'],
  ])

  const location = { origin: 'https://app-fixture.invalid', hostname: 'app-fixture.invalid', pathname: '/orders', href: '/orders' }
  const clients = []

  const axios = {
    create: options => {
      const client = {
        options,
        interceptors: {
          request: { use: callback => { client.request = callback } },
          response: { use: (success, failure) => { client.success = success; client.failure = failure } },
        },
      }

      clients.push(client)
      return client
    },
  }

  const dependencies = {
    'axios': { default: axios },
    '@/utils/storage': { getStoredToken: () => JSON.parse(stored.get('accessToken') ?? 'null') },
  }

  const context = vm.createContext({
    exports: {},
    URL,
    testEnvironment: { DEV: false, VITE_API_HOST: '', VITE_ALLOWED_API_HOSTS: 'https://api-fixture.invalid,https://second-api-fixture.invalid' },
    crypto: { randomUUID: () => 'synthetic-idempotency-key' },
    localStorage: {
      getItem: key => stored.get(key) ?? null,
      setItem: (key, value) => stored.set(key, value),
      removeItem: key => stored.delete(key),
    },
    window: { location },
    require: dependency => {
      assert.ok(Object.hasOwn(dependencies, dependency), `Unexpected dependency: ${dependency}`)
      return dependencies[dependency]
    },
  })

  vm.runInContext(compiled, context)
  return { ...context.exports, stored, location, clients }
}

function request(client, overrides = {}) {
  return client.request({ method: 'get', url: '/orders', headers: {}, ...overrides })
}

async function reject(client, config, status = 401, data = {}) {
  const error = { config, response: { status, data } }

  await assert.rejects(client.failure(error), value => value === error)
}

test('auth-login always removes saved or inherited Authorization without altering unrelated headers', async () => {
  for (const url of ['/auth-login', 'auth-login', '/auth-login/?source=fixture', '/api/admins/auth-login', 'https://api-fixture.invalid/api/admins/auth-login']) {
    for (const headers of [{ Authorization: 'Bearer stale', authorization: 'Bearer stale', Accept: 'application/json' }, new AxiosHeaders({ authorization: 'Bearer stale', Accept: 'application/json' })]) {
      const service = setup()
      const before = [...service.stored]
      const config = request(service.default, { method: 'post', url, headers })

      assert.ok(Object.keys(config.headers).every(key => key.toLowerCase() !== 'authorization'))
      assert.equal(config.headers.Accept, 'application/json')
      assert.equal(config.__sessionToken, null)
      assert.equal(config.baseURL, 'https://api-fixture.invalid/api/admins')
      await reject(service.default, config)
      assert.deepEqual([...service.stored], before)
      assert.equal(service.location.href, '/orders')
    }
  }
})

test('login-like query values do not make authenticated business requests anonymous', () => {
  const service = setup()
  const config = request(service.default, { url: '/orders?next=/auth-login' })

  assert.equal(config.headers.Authorization, 'Bearer synthetic-old-token')
  assert.equal(config.__sessionToken, 'synthetic-old-token')
})

test('expectedAuthContext rejects stale account or host before credentials or logout can dispatch', () => {
  for (const url of ['/auth-login', '/auth-me', '/auth-logout']) {
    for (const change of ['token', 'host']) {
      const service = setup()
      const expectedAuthContext = { token: 'synthetic-old-token', host: service.getCurrentApiHost() }
      const config = { url, method: 'post', headers: {}, data: { password: 'synthetic-password' }, expectedAuthContext }

      if (change === 'token')
        service.stored.set('accessToken', JSON.stringify('synthetic-new-token'))
      else
        service.setApiHost('https://second-api-fixture.invalid')

      const before = [...service.stored]

      assert.throws(() => service.default.request(config), error => {
        assert.equal(error.code, 'ERR_AUTH_CONTEXT')
        assert.doesNotMatch(error.message, /synthetic|fixture\.invalid/)
        return true
      })
      assert.equal(config.baseURL, undefined)
      assert.equal(config.__sessionToken, undefined)
      assert.deepEqual(config.headers, {})
      assert.deepEqual([...service.stored], before)
      assert.equal(service.location.href, '/orders')
    }
  }
})

test('matched expectedAuthContext supports authenticated validation and explicitly anonymous login', () => {
  const service = setup()
  const expectedAuthContext = { token: 'synthetic-old-token', host: service.getCurrentApiHost() }

  assert.equal(request(service.default, { url: '/auth-me', expectedAuthContext }).headers.Authorization, 'Bearer synthetic-old-token')
  assert.equal(request(service.default, { url: '/auth-login', expectedAuthContext }).headers.Authorization, undefined)
  service.stored.delete('accessToken')
  assert.equal(request(service.default, { url: '/auth-login', expectedAuthContext: { ...expectedAuthContext, token: null } }).headers.Authorization, undefined)
})

test('anonymous login preserves caller cookie and withCredentials behavior and surfaces conflicts unchanged', async () => {
  for (const withCredentials of [undefined, true, false]) {
    const service = setup()
    const before = [...service.stored]

    const config = request(service.default, {
      method: 'post', url: '/auth-login', withCredentials, headers: new AxiosHeaders({ Cookie: 'synthetic-session=fixture', Authorization: 'Bearer stale' }),
    })

    assert.equal(service.default.options.withCredentials, undefined)
    assert.equal(config.withCredentials, withCredentials)
    assert.equal(config.headers.get('Cookie'), 'synthetic-session=fixture')
    assert.equal(config.headers.has('Authorization'), false)
    await reject(service.default, config, 409, { code: 'SESSION_CONFLICT' })
    assert.deepEqual([...service.stored], before)
    assert.equal(service.location.href, '/orders')
  }
})

test('matching-current-token 401 retains existing logout behavior for every authenticated client', async () => {
  const names = ['default', 'stockApi', 'hrApi', 'discountsApi', 'notificationsApi', 'cashboxApi', 'fiscalApi']
  for (const name of names) {
    const service = setup()
    const config = request(service[name], { headers: new AxiosHeaders() })

    assert.equal(config.headers.get('Authorization'), 'Bearer synthetic-old-token')
    await reject(service[name], config)
    for (const key of ['accessToken', 'userData', 'userAbilities'])
      assert.equal(service.stored.has(key), false)
    assert.equal(service.stored.get('unrelated'), 'preserved')
    assert.equal(service.stored.get('apiHost'), 'https://api-fixture.invalid')
    assert.equal(service.location.href, '/login')
  }
})

test('late business 401 from an older token never clears or redirects a newer session', async () => {
  for (const name of ['default', 'stockApi', 'hrApi', 'discountsApi', 'notificationsApi', 'cashboxApi', 'fiscalApi']) {
    const service = setup()
    const config = request(service[name])

    service.stored.set('accessToken', JSON.stringify('synthetic-new-token'))
    service.stored.set('userData', JSON.stringify({ id: 2, role: 'USER' }))

    const before = [...service.stored]

    await reject(service[name], config)
    assert.deepEqual([...service.stored], before)
    assert.equal(service.location.href, '/orders')
  }
})

test('late 401 from the previously selected API host cannot clear a same-token session on the new host', async () => {
  for (const name of ['default', 'stockApi', 'hrApi', 'discountsApi', 'notificationsApi', 'cashboxApi', 'fiscalApi']) {
    const service = setup()
    const config = request(service[name])

    assert.equal(config.__sessionApiHost, 'https://api-fixture.invalid')
    service.setApiHost('https://second-api-fixture.invalid')

    const before = [...service.stored]

    await reject(service[name], config)
    assert.deepEqual([...service.stored], before)
    assert.equal(service.location.href, '/orders')
    assert.equal(service.stored.get('accessToken'), JSON.stringify(config.__sessionToken))

    const currentConfig = request(service[name])

    assert.equal(currentConfig.__sessionApiHost, 'https://second-api-fixture.invalid')
    await reject(service[name], currentConfig)
    assert.equal(service.stored.has('accessToken'), false)
    assert.equal(service.location.href, '/login')
  }
})

test('a request begun without a session cannot clear a later login and unknown request context is harmless', async () => {
  const service = setup()

  service.stored.delete('accessToken')

  const config = request(service.default)

  service.stored.set('accessToken', JSON.stringify('synthetic-new-token'))

  const before = [...service.stored]

  await reject(service.default, config)
  await reject(service.default, undefined)
  assert.deepEqual([...service.stored], before)
  assert.equal(service.location.href, '/orders')
})

test('skipAuthRedirect preserves Bearer and leaves matched 401 handling to its validation caller', async () => {
  const service = setup()
  const before = [...service.stored]
  const config = request(service.default, { url: '/auth-me', skipAuthRedirect: true })

  assert.equal(config.headers.Authorization, 'Bearer synthetic-old-token')
  await reject(service.default, config)
  assert.deepEqual([...service.stored], before)
  assert.equal(service.location.href, '/orders')

  await reject(service.default, request(service.default, { url: '/auth-me', skipAuthRedirect: false }))
  assert.equal(service.stored.has('accessToken'), false)
  assert.equal(service.location.href, '/login')
})

test('current-session 401 while already on login clears auth without forcing navigation', async () => {
  const service = setup()

  service.location.pathname = '/login'
  service.location.href = '/login?notice=fixture'
  await reject(service.default, request(service.default))
  assert.equal(service.stored.has('accessToken'), false)
  assert.equal(service.location.href, '/login?notice=fixture')
})

test('request host, idempotency, successful responses and licensing behavior remain unchanged', async () => {
  const service = setup()

  service.setApiHost('https://second-api-fixture.invalid')

  const config = request(service.default, { method: 'post', url: '/orders', data: { synthetic: true } })

  assert.equal(config.baseURL, 'https://second-api-fixture.invalid/api/admins')
  assert.equal(config.headers['Idempotency-Key'], 'synthetic-idempotency-key')

  const response = { config, data: { success: true } }

  assert.equal(service.default.success(response), response)
  await reject(service.default, config, 500)
  assert.equal(service.location.href, '/orders')
  await reject(service.default, { ...config, skipAuthRedirect: true }, 503, { code: 'license_expired' })
  assert.equal(service.location.href, '/licensing/setup')
  assert.equal(service.stored.has('accessToken'), true)
  assert.equal(service.licensingApi.request, undefined)
  assert.equal(service.licensingApi.failure, undefined)
})
