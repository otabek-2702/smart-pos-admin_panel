/* eslint-disable @typescript-eslint/no-var-requires -- Node contract tests execute CommonJS modules. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')

const root = path.resolve(__dirname, '../..')
const TODAY = '2026-09-13'
const NOW = Date.parse('2026-09-13T12:00:00+05:00')
const SCOPE = { userId: 17, apiHost: 'https://api-fixture.invalid' }
const PROGRESS = { date: '2026-08-08', orderId: 42, finished: false, totalCustomers: 12 }
const json = value => JSON.parse(JSON.stringify(value))
const readSource = file => fs.readFileSync(path.join(root, file), 'utf8')

function compile(source) {
  return ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText
}

const compiled = compile(readSource('src/utils/operatorCallProgress.ts'))

class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [NOW])) }
  static now() { return NOW }
}

function setup({ store = new Map(), origin = 'https://frontend-fixture.invalid', noStorage = false, noWindow = false } = {}) {
  const mutations = []
  const faults = { read: false, write: false }

  const localStorage = {
    getItem: key => {
      if (faults.read)
        throw new Error('Synthetic storage unavailable')
      return store.get(key) ?? null
    },
    setItem: (key, value) => {
      if (faults.write)
        throw new Error('Synthetic quota exceeded')
      mutations.push({ key, value })
      store.set(key, value)
    },
    removeItem: key => { mutations.push({ remove: key }); store.delete(key) },
  }

  const context = vm.createContext({
    exports: {},
    URL,
    Date: FixedDate,
    ...(noStorage ? {} : { localStorage }),
    ...(noWindow ? {} : { window: { location: { origin } } }),
  })

  vm.runInContext(compiled, context)
  return { ...context.exports, store, faults, mutations, localStorage }
}

test('navigation bookmark round-trips with only version, day, opaque order anchor, finish flag and count', () => {
  const helper = setup()

  assert.equal(helper.saveOperatorCallProgress(SCOPE, {
    ...PROGRESS,
    version: 999,
    phone: 'private-fixture',
    name: 'private-fixture',
    address: 'private-fixture',
    password: 'private-fixture',
    accessToken: 'private-fixture',
    key: 'private-fixture',
    customerKey: 'private-fixture',
  }), true)
  assert.equal(helper.store.size, 1)

  const [[key, value]] = helper.store.entries()

  assert.ok(key.startsWith('operator-call-progress:v1:'))
  assert.deepEqual(JSON.parse(value), { version: 1, ...PROGRESS })
  assert.doesNotMatch(`${key}${value}`, /private-fixture|phone|password|accessToken|customerKey|address|"name"/)
  assert.deepEqual(json(helper.readOperatorCallProgress(SCOPE, TODAY)), PROGRESS)

  const reloaded = setup({ store: helper.store })

  assert.deepEqual(json(reloaded.readOperatorCallProgress(SCOPE, TODAY)), PROGRESS)
  assert.equal(reloaded.mutations.length, 0)
})

test('account and API-origin separation preserve bookmarks for other accounts without cleanup', () => {
  const helper = setup()
  const otherAccount = { ...SCOPE, userId: 18 }
  const otherHost = { ...SCOPE, apiHost: 'https://other-api-fixture.invalid' }
  const second = { ...PROGRESS, orderId: 43, finished: true }

  assert.equal(helper.saveOperatorCallProgress(SCOPE, PROGRESS), true)
  assert.equal(helper.readOperatorCallProgress(otherAccount, TODAY), null)
  assert.equal(helper.readOperatorCallProgress(otherHost, TODAY), null)
  assert.equal(helper.saveOperatorCallProgress(otherAccount, second), true)
  assert.equal(helper.saveOperatorCallProgress(otherHost, { ...PROGRESS, orderId: 44 }), true)
  assert.deepEqual(json(helper.readOperatorCallProgress(SCOPE, TODAY)), PROGRESS)
  assert.deepEqual(json(helper.readOperatorCallProgress(otherAccount, TODAY)), second)
  assert.equal(helper.store.size, 3)
  assert.ok(helper.mutations.every(change => !change.remove))
})

test('scope canonicalization is stable for numeric ID strings, case/default-port origins and relative same-origin APIs', () => {
  const helper = setup()

  helper.saveOperatorCallProgress(SCOPE, PROGRESS)
  assert.deepEqual(json(helper.readOperatorCallProgress({ userId: ' 017 ', apiHost: ' HTTPS://API-FIXTURE.INVALID:443/ ' }, TODAY)), PROGRESS)
  assert.equal(helper.saveOperatorCallProgress({ userId: 'synthetic-user-id', apiHost: '' }, PROGRESS), true)
  assert.deepEqual(json(helper.readOperatorCallProgress({ userId: 'synthetic-user-id', apiHost: 'https://frontend-fixture.invalid/' }, TODAY)), PROGRESS)

  const differentFrontend = setup({ store: helper.store, origin: 'https://another-frontend-fixture.invalid' })

  assert.equal(differentFrontend.readOperatorCallProgress({ userId: 'synthetic-user-id', apiHost: '' }, TODAY), null)
})

test('invalid or credential-bearing scope values never read or overwrite another bookmark', () => {
  const helper = setup()

  const invalidScopes = [
    null,
    {},
    { ...SCOPE, userId: null },
    { ...SCOPE, userId: 0 },
    { ...SCOPE, userId: -1 },
    { ...SCOPE, userId: 1.5 },
    { ...SCOPE, userId: Infinity },
    { ...SCOPE, userId: Number.MAX_SAFE_INTEGER + 1 },
    { ...SCOPE, userId: '' },
    { ...SCOPE, userId: 'person@example.invalid' },
    { ...SCOPE, userId: '+998900000001' },
    { ...SCOPE, userId: 'x'.repeat(129) },
    { ...SCOPE, userId: {} },
    { ...SCOPE, apiHost: 'javascript:alert(1)' },
    { ...SCOPE, apiHost: 'file:///fixture' },
    { ...SCOPE, apiHost: 'https://name:secret@api-fixture.invalid' },
    { ...SCOPE, apiHost: 'https://api-fixture.invalid/path' },
    { ...SCOPE, apiHost: 'https://api-fixture.invalid?token=private-fixture' },
    { ...SCOPE, apiHost: 'https://api-fixture.invalid#private-fixture' },
    { ...SCOPE, apiHost: 'api-fixture.invalid' },
    { ...SCOPE, apiHost: null },
  ]

  helper.saveOperatorCallProgress(SCOPE, PROGRESS)

  const before = [...helper.store]

  for (const scope of invalidScopes) {
    assert.equal(helper.readOperatorCallProgress(scope, TODAY), null)
    assert.equal(helper.saveOperatorCallProgress(scope, PROGRESS), false)
  }
  assert.deepEqual([...helper.store], before)
})

test('corrupt, oversized, unsupported-version and invalid progress payloads are ignored without deleting them', () => {
  const helper = setup()

  helper.saveOperatorCallProgress(SCOPE, PROGRESS)

  const key = [...helper.store.keys()][0]

  const invalidFields = [
    { version: 2 },
    { version: '1' },
    { date: '2026-07-31' },
    { date: '2026-09-14' },
    { date: '2026-08-32' },
    { date: '2026-02-30' },
    { date: '08/08/2026' },
    { date: null },
    { orderId: 0 },
    { orderId: '42' },
    { orderId: -1 },
    { orderId: 1.5 },
    { orderId: Number.MAX_SAFE_INTEGER + 1 },
    { finished: 'false' },
    { finished: null },
    { totalCustomers: 0 },
    { totalCustomers: 2001 },
    { totalCustomers: 1.5 },
    { totalCustomers: '12' },
  ]

  const payloads = ['{broken', 'null', '[]', '42', '"a string"', '', 'x'.repeat(513), ...invalidFields.map(fields => JSON.stringify({ version: 1, ...PROGRESS, ...fields }))]

  for (const payload of payloads) {
    helper.store.set(key, payload)
    assert.equal(helper.readOperatorCallProgress(SCOPE, TODAY), null)
    assert.equal(helper.store.get(key), payload)
  }
  assert.equal(helper.mutations.length, 1)
})

test('dates validate actual calendar days and Tashkent today; invalid saves preserve earlier valid progress', () => {
  const helper = setup()

  assert.equal(helper.saveOperatorCallProgress(SCOPE, { ...PROGRESS, date: '2026-08-01' }), true)
  assert.equal(helper.saveOperatorCallProgress(SCOPE, { ...PROGRESS, date: TODAY, totalCustomers: 2000 }), true)

  const before = [...helper.store]

  for (const progress of [
    null,
    [],
    { ...PROGRESS, date: '2026-09-14' },
    { ...PROGRESS, date: '2026-08-32' },
    { ...PROGRESS, date: '2026-07-31' },
    { ...PROGRESS, orderId: 0 },
    { ...PROGRESS, totalCustomers: 0 },
  ]) {
    assert.equal(helper.saveOperatorCallProgress(SCOPE, progress), false)
    assert.deepEqual([...helper.store], before)
  }
  for (const today of ['invalid', '2026-09-31', '2026-08-01', undefined, null])
    assert.equal(helper.readOperatorCallProgress(SCOPE, today), null)
})

test('unavailable storage, quota failures and missing browser globals fail silently without crashing', () => {
  const helper = setup()

  helper.saveOperatorCallProgress(SCOPE, PROGRESS)
  helper.faults.read = true
  assert.equal(helper.readOperatorCallProgress(SCOPE, TODAY), null)
  helper.faults.read = false
  helper.faults.write = true
  assert.equal(helper.saveOperatorCallProgress(SCOPE, { ...PROGRESS, orderId: 99 }), false)
  assert.deepEqual(json(helper.readOperatorCallProgress(SCOPE, TODAY)), PROGRESS)

  const missingStorage = setup({ noStorage: true })

  assert.equal(missingStorage.readOperatorCallProgress(SCOPE, TODAY), null)
  assert.equal(missingStorage.saveOperatorCallProgress(SCOPE, PROGRESS), false)

  const missingWindow = setup({ noWindow: true })

  assert.equal(missingWindow.readOperatorCallProgress({ ...SCOPE, apiHost: '' }, TODAY), null)
  assert.equal(missingWindow.saveOperatorCallProgress({ ...SCOPE, apiHost: '' }, PROGRESS), false)
})

test('fresh credential bootstrap and current login/logout/401 cleanup preserve the account-scoped bookmark', () => {
  const helper = setup()
  const authKeys = ['accessToken', 'userData', 'userAbilities']

  helper.saveOperatorCallProgress(SCOPE, PROGRESS)

  const bootstrap = readSource('src/bootstrap/loginLink.ts')

  const bootstrapContext = vm.createContext({
    exports: {},
    URL,
    URLSearchParams,
    localStorage: helper.localStorage,
    window: {
      location: { href: 'https://frontend-fixture.invalid/login#email=fixture%40example.invalid&password=synthetic-only' },
      history: { state: {}, replaceState: () => undefined },
      addEventListener: () => undefined,
    },
  })

  vm.runInContext(compile(bootstrap), bootstrapContext)
  assert.equal(bootstrapContext.exports.hasLoginLink(), true)
  assert.deepEqual(json(helper.readOperatorCallProgress(SCOPE, TODAY)), PROGRESS)

  const login = readSource('src/pages/login.vue')
  const logout = readSource('src/composables/useSessionLogout.ts')
  const axios = readSource('src/plugins/axios.ts')
  const unauthorizedCleanup = axios.match(/if \(error\.response\?\.status === 401[^\n]*\{([\s\S]*?)if \(window\.location\.pathname/)

  assert.ok(unauthorizedCleanup, 'Expected current unauthorized-session cleanup block')
  for (const source of [bootstrap, login, logout, axios])
    assert.doesNotMatch(source, /localStorage\.clear\s*\(|operator-call-progress/)
  for (const cleanup of [login, logout, unauthorizedCleanup[1]]) {
    const calls = [...cleanup.matchAll(/localStorage\.removeItem\('([^']+)'\)/g)]

    assert.deepEqual(calls.map(match => match[1]).sort(), [...authKeys].sort())
    for (const key of authKeys)
      helper.store.set(key, 'synthetic-session-value')
    vm.runInNewContext(calls.map(match => match[0]).join('\n'), { localStorage: helper.localStorage })
    assert.deepEqual(json(helper.readOperatorCallProgress(SCOPE, TODAY)), PROGRESS)
    assert.ok(authKeys.every(key => !helper.store.has(key)))
  }
})
